import { useEffect, useRef, useState } from "react";
import { prefersReduced } from "../lib/motion";
import { tier, canWebGL2, watchFps } from "../lib/perf";
import { isLight } from "../lib/theme";
import { FPS_ACTIVE, cappedRaf } from "../lib/frame";
import "./PrismGlass.css";
const P = {
  TL: [-1, 1],
  T1: [-0.42, 1],
  T2: [0.36, 1],
  TR: [1, 1],
  L1: [-1, -0.1],
  R1: [1, 0.12],
  BL: [-1, -1],
  B1: [-0.2, -1],
  B2: [0.42, -1],
  BR: [1, -1],
  A: [-0.5, 0.35],
  B: [0.12, 0.08],
  C: [0.58, 0.42],
  D: [-0.12, -0.45],
  E: [0.66, -0.3]
};
const SHARDS = [
  ["TL", "T1", "A", "L1"],
  ["T1", "T2", "C", "B", "A"],
  ["T2", "TR", "R1", "C"],
  ["L1", "A", "D", "B1", "BL"],
  ["A", "B", "D"],
  ["D", "B", "E", "B2", "B1"],
  ["B", "C", "R1", "E"],
  ["E", "R1", "BR", "B2"]
];
// 全宽英雄区里过厚的倒角会切断整行字；保留细接缝和色散，平面区域保持清透。
const BEVEL = 0.009, GAP = BEVEL + 0.004, DEPTH = 0.035;
function insetPolygon(points, inset) {
  let area = 0;
  points.forEach(([x1, y1], i) => {
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  });
  const pts = area < 0 ? [...points].reverse() : points;
  return pts.map(([x, y], i) => {
    const [px, py] = pts[(i + pts.length - 1) % pts.length], [nx, ny] = pts[(i + 1) % pts.length];
    const e1 = [x - px, y - py], e2 = [nx - x, ny - y];
    const l1 = Math.hypot(e1[0], e1[1]), l2 = Math.hypot(e2[0], e2[1]);
    const n1 = [-e1[1] / l1, e1[0] / l1], n2 = [-e2[1] / l2, e2[0] / l2];
    const k = inset / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return [x + (n1[0] + n2[0]) * k, y + (n1[1] + n2[1]) * k];
  });
}
function canUseGlass() {
  if (prefersReduced() || matchMedia("(pointer: coarse)").matches) return false;
  if (tier() === "low") return false;
  try {
    return canWebGL2();
  } catch {
    return false;
  }
}
// 让出主线程：初始化拆成几段，每段之间浏览器可以先画一帧（首页的唱片照常转）
const nextTask = () => new Promise(r => setTimeout(r, 0));
/**
 * 环境光（PMREM）要用的几个着色器先交给驱动在后台并行编译（KHR_parallel_shader_compile），编好再 fromScene。
 * 不预热的话 fromScene 里每个着色器第一次用都要原地等链接完，电脑上一下卡八十毫秒（这时首页还在转唱片）。
 * 场景里那几个材质按 fromScene 渲染时的状态编（画进渲染目标、不做色调映射），编出来的程序 fromScene 直接复用；
 * 模糊着色器 three 没公开，借它两个内部方法先建出来（three 换了实现找不到这俩方法就跳过，大不了照旧等一下）
 */
async function prewarmPmrem(THREE, renderer, pmrem, room) {
  const waits = [];
  const target = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, depthBuffer: false });
  const prevTarget = renderer.getRenderTarget(), prevTone = renderer.toneMapping;
  const bg = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false }));
  try {
    renderer.setRenderTarget(target);
    renderer.toneMapping = THREE.NoToneMapping;
    room.add(bg);
    waits.push(renderer.compileAsync(room, new THREE.PerspectiveCamera(90, 1, 0.1, 100)));
  } finally {
    room.remove(bg);
    renderer.setRenderTarget(prevTarget);
    renderer.toneMapping = prevTone;
  }
  if (typeof pmrem._setSize === 'function' && typeof pmrem._allocateTargets === 'function') {
    try {
      pmrem._setSize(256);   // 和 fromScene 里的尺寸一致，它才会复用这里建好的模糊材质
      pmrem._allocateTargets().dispose();
      if (pmrem._blurMaterial && pmrem._lodPlanes?.[0]) waits.push(renderer.compileAsync(new THREE.Mesh(pmrem._lodPlanes[0], pmrem._blurMaterial), new THREE.OrthographicCamera()));
    } catch { /* 跳过 */ }
  }
  try { await Promise.all(waits); } finally { target.dispose(); bg.geometry.dispose(); bg.material.dispose(); }
}
export default function PrismGlass({ title = [], lead = "", caption = "TRANSMISSION \xB7 IOR 1.46 \xB7 DISPERSION", children, height = "min(72vh, 640px)" }) {
  const TITLE = title, LEAD = lead;
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const [mode, setMode] = useState("pending");
  useEffect(() => {
    const change = () => setMode(canUseGlass() ? "glass" : "static");
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    change();
    window.addEventListener('librarium:tier', change);
    media.addEventListener('change', change);
    return () => { window.removeEventListener('librarium:tier', change); media.removeEventListener('change', change); };
  }, []);
  useEffect(() => {
    if (mode !== "glass") return;
    const root = rootRef.current, canvas = canvasRef.current;
    if (!root || !canvas) return;
    // 初始化分几段做，段与段之间让出主线程（以前一口气做完，电脑上一百多毫秒，正赶上首页空闲时后台预渲染搜索页）。
    // 中途卸载：已经建好的东西按 disposers 倒着释放
    let disposed = false, running = true;
    const disposers = [];
    const cleanup = () => { while (disposers.length) { try { disposers.pop()(); } catch { /* 继续释放其余的 */ } } };
    (async () => {
      const THREE = await import("three");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      if (disposed) return;
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
      } catch {
        setMode("static");
        return;
      }
      disposers.push(() => renderer.dispose());
      const quality = tier(), dpr = devicePixelRatio || 1;
      renderer.setPixelRatio(quality === "ultra" ? Math.min(dpr * 1.25, 2.5) : quality === "high" ? Math.min(dpr, 2) : Math.min(dpr, 1.5));
      // Neutral 不会把近黑底压成浑浊的灰（ACES 会），玻璃才清透
      renderer.toneMapping = THREE.NeutralToneMapping;
      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      disposers.push(() => pmrem.dispose());
      const room = new RoomEnvironment();
      disposers.push(() => room.dispose());
      await nextTask();
      if (disposed) return;
      try { await prewarmPmrem(THREE, renderer, pmrem, room); } catch { /* 预热不成就照旧同步编 */ }
      if (disposed) return;
      await nextTask();
      if (disposed) return;
      const envTarget = pmrem.fromScene(room, 0.04);
      disposers.push(() => envTarget.dispose());
      const env = envTarget.texture;
      scene.environment = env;
      await nextTask();
      if (disposed) return;
      const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
      const dist = 0.5 / Math.tan(THREE.MathUtils.degToRad(14));
      camera.position.set(0, 0, dist);
      const PAD = 1.3, PLANE_Z = -0.22;
      const paper = document.createElement("canvas");
      const texture = new THREE.CanvasTexture(paper);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
      plane.position.z = PLANE_Z;
      const glass = new THREE.MeshPhysicalMaterial({
        color: 16777215,
        metalness: 0,
        roughness: 0.015,
        transmission: 1,
        thickness: 0.22,
        ior: 1.46,
        // 基础层很光滑，字透过玻璃仍清楚；高光交给粗糙一点的清漆层，才是 Prism 那种大片柔光而不是小光斑
        dispersion: 1.6,
        specularIntensity: 0.12,
        clearcoat: 0.12,
        clearcoatRoughness: 0.2,
        envMapIntensity: 0.38,
        attenuationColor: new THREE.Color("#a3a8b0"),
        attenuationDistance: 1.6
      });
      // 底板不跟着倾斜：字和真实的搜索框始终对齐；只有玻璃倾斜，折射随之变化（与原版 GlassInvite 一致）
      scene.add(plane);
      const group = new THREE.Group();
      scene.add(group);
      let shards = [];
      const lift = [];
      const key = new THREE.PointLight(16774374, 2.4, 0, 2);
      scene.add(key);
      const PALETTES = {
        dark: {
          paper: "#0b0b0d",
          ink: "#f4efe3",
          ink3: "#8b8d94",
          glows: [["#d4af6a26", 0.34], ["#4f6f9622", 0.32], ["#ffffff0a", 0.22]],
          glass: { attenuationColor: "#ffffff", attenuationDistance: 12, envMapIntensity: 0.06, specularIntensity: 0.025, dispersion: 1.6 },
          key: 0.65,
          exposure: 1.05,
          lead: "#b4b2ab"
        },
        // 浅色：比页面底色略深一档的暖灰纸，玻璃几乎无色，靠更亮的环境反射勾出倒角；字用页面墨色
        light: {
          paper: "#e9e2d3",
          ink: "#2a241b",
          ink3: "#7a705f",
          glows: [["#d8b46c55", 0.36], ["#a9b8c84d", 0.32], ["#ffffffb0", 0.24]],
          glass: { attenuationColor: "#ffffff", attenuationDistance: 8, envMapIntensity: 0.62, specularIntensity: 0.3, dispersion: 1.1 },
          key: 1.2,
          exposure: 1.16,
          lead: "#5d5446"
        }
      };
      const palette = () => PALETTES[isLight() ? "light" : "dark"];
      const applyGlass = () => {
        const p = palette();
        glass.attenuationColor.set(p.glass.attenuationColor);
        glass.attenuationDistance = p.glass.attenuationDistance;
        glass.envMapIntensity = p.glass.envMapIntensity;
        glass.specularIntensity = p.glass.specularIntensity;
        glass.dispersion = p.glass.dispersion;
        key.intensity = p.key;
        renderer.toneMappingExposure = p.exposure;
      };
      let W = 1, H = 1, sized = false;
      const paint = () => {
        const ratio = renderer.getPixelRatio();
        const cw = Math.round(W * PAD * ratio), ch = Math.round(H * PAD * ratio);
        paper.width = cw;
        paper.height = ch;
        const g = paper.getContext("2d");
        const { paper: base, ink, ink3, glows } = palette();
        g.fillStyle = base;
        g.fillRect(0, 0, cw, ch);
        const glow = (x, y, r, color) => {
          const grd = g.createRadialGradient(x * cw, y * ch, 0, x * cw, y * ch, r * cw);
          grd.addColorStop(0, color);
          grd.addColorStop(1, "transparent");
          g.fillStyle = grd;
          g.fillRect(0, 0, cw, ch);
        };
        glow(0.8, 0.28, glows[0][1], glows[0][0]);
        glow(0.18, 0.9, glows[1][1], glows[1][0]);
        glow(0.56, 0.5, glows[2][1], glows[2][0]);
        const s = ratio, ox = (PAD - 1) / 2 * W * s, oy = (PAD - 1) / 2 * H * s;
        // 字体从根元素读：从 root 读会逼浏览器给还藏在后台的搜索页算样式
        const family = getComputedStyle(document.documentElement).getPropertyValue("--serif").trim() || "serif";
        // 标题要大到横跨中间三四块碎片，跨过倒角时被错开，折射才看得出来
        const size = Math.min(110, Math.max(34, W * 0.092), H * 0.15);
        root.style.setProperty("--title-size", size + "px");
        const left = ox + W * 0.5 * s;
        g.fillStyle = ink;
        g.textBaseline = "alphabetic";
        g.textAlign = "center";
        g.font = `600 ${size * s}px ${family}`;
        if ("letterSpacing" in g) g.letterSpacing = `${-size * 0.02 * s}px`;
        const top = oy + H * 0.14 * s;
        TITLE.forEach((line, i) => g.fillText(line, left, top + size * s * (1 + i * 1.12)));
        // 小字保留 HTML，折射只作用于大标题以保证可读性。
        texture.needsUpdate = true;
      };
      const build = () => {
        shards.forEach((m) => {
          group.remove(m);
          m.geometry.dispose();
        });
        shards = [];
        const aspect = W / H, sx = aspect * 0.59, sy = 0.61;
        SHARDS.forEach((keys, i) => {
          const pts = insetPolygon(keys.map((k) => [P[k][0] * sx, P[k][1] * sy]), GAP);
          const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
          const geo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.01, bevelSize: BEVEL, bevelSegments: 5, curveSegments: 1 });
          geo.translate(0, 0, -DEPTH / 2);
          const mesh = new THREE.Mesh(geo, glass);
          group.add(mesh);
          shards.push(mesh);
          lift[i] = lift[i] || 0;
        });
        plane.scale.set(aspect * PAD * (dist - PLANE_Z) / dist, PAD * (dist - PLANE_Z) / dist, 1);
      };
      const state = { tx: 0, ty: 0, x: 0, y: 0, rx: 0.1, ry: -0.06, inside: false, hover: -1, visible: false };
      const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
      // 只在倾斜/抬升还没收敛时画，画的时候跟屏幕刷新率；停稳就不画
      const fr = cappedRaf(FPS_ACTIVE);
      let last = 0;
      const loop = (now) => {
        if (disposed || !state.visible || document.hidden) {
          last = 0;
          return;
        }
        const dt = Math.min(0.05, last ? (now - last) / 1e3 : 0.016);
        last = now;
        const ease = 1 - Math.exp(-dt * 7);
        state.x += (state.tx - state.x) * ease;
        state.y += (state.ty - state.y) * ease;
        const goalX = state.inside ? -state.y * 0.13 : 0, goalY = state.inside ? state.x * 0.19 : 0;
        state.rx += (goalX - state.rx) * ease;
        state.ry += (goalY - state.ry) * ease;
        group.rotation.set(state.rx, state.ry, 0);
        key.position.set(state.x * W / H * 0.5, state.y * 0.45, 1.25);
        let moving = Math.abs(goalX - state.rx) + Math.abs(goalY - state.ry) + Math.abs(state.tx - state.x) + Math.abs(state.ty - state.y) > 6e-4;
        if (state.inside) {
          ndc.set(state.tx, state.ty);
          ray.setFromCamera(ndc, camera);
          const hit = ray.intersectObjects(shards, false)[0];
          state.hover = hit ? shards.indexOf(hit.object) : -1;
        } else state.hover = -1;
        shards.forEach((mesh, i) => {
          const goal = i === state.hover ? 0.045 : 0;
          lift[i] += (goal - lift[i]) * ease;
          mesh.position.z = lift[i];
          if (Math.abs(goal - lift[i]) > 4e-4) moving = true;
        });
        renderer.render(scene, camera);
        // 第一帧画出来了才藏 HTML 标题：折射的字和 HTML 字在同一帧交接
        if (!shown) { shown = true; root.setAttribute("data-ready", ""); watchFps(); }
        if (moving && state.visible && !document.hidden) fr.request(loop);
        else last = 0;
      };
      // 着色器异步编译完之前不画：第一帧画的时候才同步编译，进搜索页那一下要卡几十毫秒
      // 也要等 ResizeObserver 给了真尺寸、纸面画好（页面还藏在后台时初始化就做完了，尺寸要等它排版）
      let ready = false, shown = false;
      const kick = () => {
        if (ready && sized && !fr.pending && state.visible && !document.hidden) fr.request(loop);
      };
      // 尺寸从 ResizeObserver 拿（排完版顺手给的），不读 clientWidth：读它会逼浏览器当场排版，页面还藏在后台时也一样
      const resize = ([entry]) => {
        const box = entry.borderBoxSize?.[0];
        const w = Math.round(box ? box.inlineSize : entry.contentRect.width), h = Math.round(box ? box.blockSize : entry.contentRect.height);
        if (!w || !h || (sized && w === W && h === H)) return;
        W = w; H = h; sized = true;
        renderer.setSize(W, H, false);
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
        build();
        paint();
        kick();
      };
      const move = (event) => {
        const r = root.getBoundingClientRect();
        state.tx = (event.clientX - r.left) / r.width * 2 - 1;
        state.ty = -((event.clientY - r.top) / r.height * 2 - 1);
        state.inside = true;
        kick();
      };
      const leave = () => {
        state.inside = false;
        kick();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(root);
      const stop = () => {
        fr.cancel();
        last = 0;
      };
      const visibility = () => {
        if (document.hidden) stop();
        else kick();
      };
      document.addEventListener("visibilitychange", visibility);
      const io = new IntersectionObserver(([entry]) => {
        state.visible = entry.isIntersecting;
        if (state.visible) kick();
        else stop();
      });
      io.observe(root);
      root.addEventListener("pointermove", move);
      root.addEventListener("pointerleave", leave);
      const lost = event => { event.preventDefault(); stop(); setMode('static'); };
      canvas.addEventListener('webglcontextlost', lost);
      void document.fonts?.ready.then(() => {
        if (!disposed && sized) {
          paint();
          kick();
        }
      });
      applyGlass();
      disposers.push(() => {
        fr.cancel();
        ro.disconnect();
        io.disconnect();
        document.removeEventListener("visibilitychange", visibility);
        root.removeEventListener("pointermove", move);
        root.removeEventListener("pointerleave", leave);
        canvas.removeEventListener('webglcontextlost', lost);
        root.removeAttribute('data-ready');
        shards.forEach((m) => m.geometry.dispose());
        glass.dispose();
        plane.geometry.dispose();
        plane.material.dispose();
        texture.dispose();
      });
      // 碎片先按 1:1 建一份（ResizeObserver 给了真尺寸再重建）：着色器只认材质不认形状，先建出来才能一起预编译
      if (!sized) build();
      // 玻璃、纸面的着色器交给驱动在后台并行编译（KHR_parallel_shader_compile），编好再开始画；
      // 这期间 HTML 标题照常显示，编好后第一帧折射和隐藏 HTML 标题落在同一帧
      try { await renderer.compileAsync(scene, camera); } catch { /* 不支持就第一次画时同步编译 */ }
      if (disposed) return;
      ready = true;
      kick();
    })().catch(() => {
      cleanup();
      if (!disposed) setMode("static");
    }).finally(() => { running = false; if (disposed) cleanup(); });
    // 还在初始化（等着色器编译）时卸载：等它停在下一个检查点再释放。马上释放渲染器的话，
    // three 还在轮询已删掉的着色器程序，永远等不到「编好」，每 10ms 空转一次
    return () => {
      disposed = true;
      if (!running) cleanup();
    };
  // lead、caption 是 HTML 字（不画进纹理）：它们变了不用重建 WebGL——以前书库一加载完、书源数一变，就整套拆掉重建一遍
  }, [mode, title.join("\n")]);
  return <section ref={rootRef} className={`prism-glass ${mode === "glass" ? "has-webgl" : "is-static"}`} style={{ height, "--prism-lines": title.length }}><canvas ref={canvasRef} className="prism-canvas" aria-hidden="true" /><div className="prism-copy"><h2>{title.map((line, i) => <span key={i}>{line}</span>)}</h2></div>{lead && <p className="prism-lead">{lead}</p>}<div className="prism-children">{children}</div><small className="prism-caption">{caption}</small></section>;
}
