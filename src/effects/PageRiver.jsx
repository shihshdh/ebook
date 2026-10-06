import { useEffect, useRef, useState } from 'react';
import { prefersReduced, seeded } from '../lib/motion';
import { tier, canWebGL2, watchFps } from '../lib/perf';
import { FPS_ACTIVE, FPS_IDLE, cappedRaf } from '../lib/frame';
import { isLight } from '../lib/theme';
import './PageRiver.css';

export default function PageRiver({ className = '', style }) {
  const root = useRef(null), canvas = useRef(null);
  const [quality, setQuality] = useState(tier), [live, setLive] = useState(false);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setQuality(prefersReduced() ? 'low' : tier());
    window.addEventListener('librarium:tier', change); media.addEventListener('change', change);
    return () => { window.removeEventListener('librarium:tier', change); media.removeEventListener('change', change); };
  }, []);
  useEffect(() => {
    setLive(false);
    if (quality === 'low' || prefersReduced() || !canWebGL2()) return;
    let disposed = false, cleanup = () => {};
    (async () => {
      const T = await import('three');
      if (disposed) return;
      const el = root.current;
      let renderer;
      try { renderer = new T.WebGLRenderer({ canvas: canvas.current, alpha: true, antialias: false, powerPreference: 'low-power' }); }
      catch { return; }
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality === 'ultra' ? 2 : 1.5));
      renderer.toneMapping = T.ACESFilmicToneMapping;
      const light = isLight();
      const scene = new T.Scene(); scene.fog = new T.FogExp2(light ? '#f4efe6' : '#080706', light ? .06 : .085);
      const camera = new T.PerspectiveCamera(40, 1, .1, 50); camera.position.z = 12;
      const geometry = new T.BoxGeometry(.11, .17, .006);
      const material = new T.MeshStandardMaterial({ color: '#e4d8bb', roughness: .84, metalness: .08 });
      const count = ({ ultra: 5000, high: 3500, balanced: 1800 })[quality] || 1800;
      const mesh = new T.InstancedMesh(geometry, material, count); mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; scene.add(mesh);
      const lamp = new T.PointLight(light ? '#ffcf7a' : '#ffd69a', light ? 26 : 32, 6, 2); lamp.position.set(2, 0, 2);
      scene.add(lamp, new T.AmbientLight(light ? '#fff6e6' : '#b9a78a', light ? 1.6 : .025));
      if (light) { const sun = new T.DirectionalLight('#fff3dc', 1.1); sun.position.set(-3, 5, 6); scene.add(sun); }
      const random = seeded(601), dummy = new T.Object3D(), color = new T.Color();
      const pages = Array.from({ length: count }, (_, i) => {
        mesh.setColorAt(i, color.set(light
          ? (random() < .08 ? '#b8862f' : random() < .45 ? '#e2d3b3' : random() < .5 ? '#c9b48c' : '#a8936c')
          : (random() < .065 ? '#c89b46' : random() < .5 ? '#f4e6c9' : '#b3a48b')));
        return { u: random(), lane: (random() + random() - 1) * 2.4, z: (random() - .5) * 5, phase: random() * Math.PI * 2, scale: .45 + random() * 1.3, x: 0, y: 0, vx: 0, vy: 0, spin: 0, speed: 0 };
      });
      // 省电：有人划过、纸页还在弹回时 60 帧；只剩缓慢漂移时 20 帧（漂移每帧不到 1 像素，看不出差别）
      const fr = cappedRaf(FPS_IDLE);
      let width = 1, height = 1, aspect = 1, last = 0, time = 0, visible = false, resizeTimer;
      const pointer = { tx: 2, ty: 0, x: 2, y: 0, active: false };
      const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 0, 1), 0), hit = new T.Vector3();
      const stop = () => { fr.cancel(); last = 0; };
      const frame = now => {
        if (disposed || !visible || document.hidden) { last = 0; return; }
        // 上限放到 0.08 秒：20 帧时每帧 0.05 秒，不能被截短，否则漂移会变慢
        const dt = Math.min(.08, last ? (now - last) / 1000 : 1 / fr.fps); last = now; time += dt;
        let energy = Math.abs(pointer.tx - pointer.x) + Math.abs(pointer.ty - pointer.y);
        const ease = 1 - Math.exp(-dt * 3);
        pointer.x += (pointer.tx - pointer.x) * ease; pointer.y += (pointer.ty - pointer.y) * ease;
        lamp.position.set(pointer.x, pointer.y, 2.2);
        const span = Math.max(8, aspect * 10);
        pages.forEach((p, i) => {
          const u = ((p.u + time * .007) % 1) * 2 - 1;
          const x = u * span * .55, y = -u * 3 + Math.sin(u * 3 + .5) * .7 + p.lane;
          const dx = x + p.x - pointer.x, dy = y + p.y - pointer.y, distance = Math.hypot(dx, dy);
          if (pointer.active && distance < 1.25) {
            const force = (1 - distance / 1.25) * 22;
            p.vx += dx / Math.max(.1, distance) * force * dt; p.vy += dy / Math.max(.1, distance) * force * dt;
            p.speed += force * dt * (p.phase > Math.PI ? 1 : -1);
          }
          p.vx += (-p.x * 3.2 - p.vx * 2.7) * dt; p.vy += (-p.y * 3.2 - p.vy * 2.7) * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.speed *= Math.exp(-dt * 1.8); p.spin += p.speed * dt;
          energy += Math.abs(p.vx) + Math.abs(p.vy) + Math.abs(p.speed) * .3;
          dummy.position.set(x + p.x, y + p.y, p.z + Math.sin(time * .24 + p.phase) * .15);
          dummy.rotation.set(p.phase + time * .12 + p.spin, p.phase * .7 + p.spin * .6, p.phase + time * .07);
          dummy.scale.setScalar(p.scale); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true; renderer.render(scene, camera);
        // 河流本身持续漂移，因此只在可见时连续运行；后台和离屏立即停止。
        fr.fps = pointer.active || energy > .05 ? FPS_ACTIVE : FPS_IDLE;
        fr.request(frame);
      };
      const kick = () => { if (!fr.pending && visible && !document.hidden && !disposed) fr.request(frame); };
      const resize = () => {
        width = Math.max(1, el.clientWidth); height = Math.max(1, el.clientHeight); aspect = width / height;
        renderer.setSize(width, height, false); camera.aspect = aspect; camera.updateProjectionMatrix(); kick();
      };
      const move = e => {
        if (e.pointerType === 'touch' && !e.buttons) return;
        const rect = el.getBoundingClientRect(); ndc.set((e.clientX - rect.left) / rect.width * 2 - 1, 1 - (e.clientY - rect.top) / rect.height * 2);
        ray.setFromCamera(ndc, camera); if (ray.ray.intersectPlane(plane, hit)) { pointer.tx = hit.x; pointer.ty = hit.y; if (!pointer.active) { pointer.active = true; fr.fps = FPS_ACTIVE; } kick(); }
      };
      const leave = () => { pointer.active = false; pointer.tx = 2; pointer.ty = 0; kick(); };
      const visibility = () => { if (document.hidden) stop(); else kick(); };
      const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) kick(); else stop(); }); observer.observe(el);
      const ro = new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); }); ro.observe(el);
      // 背景可设 pointer-events:none；在父英雄区观察输入，避免挡住真实链接。
      const input = el.parentElement || el;
      input.addEventListener('pointermove', move, { passive: true }); input.addEventListener('pointerdown', move, { passive: true }); input.addEventListener('pointerleave', leave); input.addEventListener('pointerup', leave); input.addEventListener('pointercancel', leave);
      document.addEventListener('visibilitychange', visibility);
      const lost = e => { e.preventDefault(); stop(); setLive(false); };
      canvas.current.addEventListener('webglcontextlost', lost);
      resize(); setLive(true); watchFps();
      cleanup = () => { stop(); clearTimeout(resizeTimer); observer.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', visibility); input.removeEventListener('pointermove', move); input.removeEventListener('pointerdown', move); input.removeEventListener('pointerleave', leave); input.removeEventListener('pointerup', leave); input.removeEventListener('pointercancel', leave); renderer.domElement.removeEventListener('webglcontextlost', lost); mesh.dispose(); geometry.dispose(); material.dispose(); renderer.dispose(); };
    })().catch(() => { if (!disposed) setLive(false); cleanup(); });
    return () => { disposed = true; cleanup(); };
  }, [quality]);
  return <div ref={root} className={`page-river ${className}`} style={style} aria-hidden="true"><div className={`page-river-still ${live ? 'is-hidden' : ''}`}>{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</div><canvas ref={canvas} className={live ? 'is-live' : ''} /></div>;
}
