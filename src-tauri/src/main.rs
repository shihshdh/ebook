// EBOOK · Windows 客户端。Tauri 2 + 系统自带的 WebView2，页面打包在客户端里从本地加载。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{Duration, UNIX_EPOCH};

use tauri::{
    webview::{DownloadEvent, NewWindowResponse},
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_window_state::StateFlags;
use url::Url;

/// 留在窗口里的地址：打包进来的本地页面、页面内生成的 blob/data。其余（蓝奏云、GitHub 等外链）交给系统浏览器。
fn stays_inside(url: &Url) -> bool {
    match url.scheme() {
        "tauri" | "about" | "blob" | "data" => true,
        "http" | "https" => matches!(url.host_str(), Some("tauri.localhost") | Some("localhost")),
        _ => false,
    }
}

// ---- 下载文件夹：蓝奏云这类只能在浏览器里下载的书，下好后自动放进书架 ----
// 页面只能列出、读取「下载」文件夹里最近的 EPUB / TXT / ZIP，别处一概不行。

#[derive(serde::Serialize)]
struct DownloadedFile {
    name: String,
    size: u64,
    /// 修改时间和创建时间取较晚的（毫秒）：有的浏览器会保留服务器给的修改时间
    time: u64,
}

fn downloads_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().download_dir().map_err(|e| e.to_string())
}

fn millis(t: std::io::Result<std::time::SystemTime>) -> u64 {
    t.ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis() as u64).unwrap_or(0)
}

#[tauri::command]
fn recent_downloads(app: tauri::AppHandle, since: u64) -> Result<Vec<DownloadedFile>, String> {
    let mut out = Vec::new();
    for entry in std::fs::read_dir(downloads_dir(&app)?).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
        if !matches!(ext.as_str(), "epub" | "txt" | "zip") {
            continue;
        }
        let Ok(meta) = entry.metadata() else { continue };
        let time = millis(meta.modified()).max(millis(meta.created()));
        if meta.is_file() && time >= since {
            out.push(DownloadedFile { name: entry.file_name().to_string_lossy().into_owned(), size: meta.len(), time });
        }
    }
    Ok(out)
}

#[tauri::command]
fn read_download(app: tauri::AppHandle, name: String) -> Result<tauri::ipc::Response, String> {
    // 只认文件名，不认路径：防止页面借机读下载文件夹以外的东西
    if name.contains(['/', '\\', ':']) || name.contains("..") {
        return Err("非法文件名".into());
    }
    let bytes = std::fs::read(downloads_dir(&app)?.join(&name)).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

// ---- 蓝奏云小窗：在 EBOOK 里打开蓝奏云分享页，提取码自动填好；用户在页面上点下载，文件直接进书架 ----
// 用的是蓝奏云自己的页面，不碰它的防护，也不在后台批量拉取：每个文件都由用户在页面上点下载。
// 这个窗口跑的是远程网页，不在任何 capability 里，拿不到 EBOOK 的任何本地命令。

fn lanzou_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("lanzou");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn is_lanzou(url: &Url) -> bool {
    url.scheme() == "https" && url.host_str().is_some_and(|h| h.contains("lanzo") || h.ends_with("lanzn.com"))
}

/// 关掉指定前缀的小窗（蓝奏云换一本书重开时关 "lanzou"；主窗口关闭时把蓝奏云和订阅网页窗都关掉）
fn close_popups(app: &tauri::AppHandle, prefix: &str) {
    for (label, w) in app.webview_windows() {
        if label.starts_with(prefix) {
            let _ = w.destroy();
        }
    }
}

static LANZOU_SEQ: AtomicU32 = AtomicU32::new(0);

/// 蓝奏云的文件链接、下载按钮（在 iframe 里）都用 target=_blank / window.open 开新窗口。
/// 在新窗口回调里让本窗口跳转会被 WebView2 吞掉——点了文件没反应，下载根本走不到。
/// 所以注入到所有 frame：点链接时把「开新窗口」改成整个小窗跳过去（iframe 里的下载按钮也一样），下载才进得了 on_download。
const SAME_WINDOW: &str = r#"(function(){if(window.__ebookSame)return;window.__ebookSame=1;document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[target]');if(a&&a.target!=='_self'&&a.target!=='_top')a.target='_top';},true);window.open=function(u){if(u){var h=new URL(u,location.href).href;try{window.top.location.href=h;}catch(_){location.href=h;}}return null;};})();"#;

/// 必须是 async 命令：Tauri 的同步命令跑在主线程上，在里面建 WebView2 窗口会死锁
/// （官方文档原话：On Windows, this function deadlocks when used in a synchronous command）。
/// 0.2.0 ~ 0.3.3 就是这样——点「打开下载」小窗白屏、主窗口跟着卡死、整个程序关不掉。
#[tauri::command]
async fn open_lanzou(app: tauri::AppHandle, url: String, pwd: String, title: String) -> Result<(), String> {
    let target = Url::parse(&url).map_err(|e| e.to_string())?;
    if !is_lanzou(&target) {
        return Err("只支持蓝奏云链接".into());
    }
    // 注入脚本是建窗时定的，换一本书就关掉旧窗重开。每次用新标签：旧窗的销毁是异步的，同名标签会撞上还没走完的旧窗
    close_popups(&app, "lanzou");
    let label = format!("lanzou-{}", LANZOU_SEQ.fetch_add(1, Ordering::Relaxed));
    let dir = lanzou_dir(&app)?;
    let pwd = serde_json::to_string(&pwd).map_err(|e| e.to_string())?;
    // 自动填提取码并提交：等输入框出现（最多 10 秒），只填一次
    let script = format!(
        r#"(function(){{var P={pwd};if(!P)return;var n=0;var t=setInterval(function(){{n++;var i=document.querySelector('#pwd,input[name="pwd"]');if(i&&!i.dataset.ebook){{i.dataset.ebook='1';i.value=P;i.dispatchEvent(new Event('input',{{bubbles:true}}));var b=document.querySelector('#sub,.passwddiv-btn,#passwddiv .btn,input[type="submit"]');if(b)b.click();clearInterval(t);}}if(n>40)clearInterval(t);}},250);}})();"#
    );
    let popup = app.clone();
    let popup_label = label.clone();
    let done = app.clone();
    let mut builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(target))
        .title(format!("蓝奏云 · {title} · 点下载，下完自动放进书架"))
        .inner_size(1000.0, 760.0)
        .center()
        .initialization_script_for_all_frames(SAME_WINDOW)
        .initialization_script(&script)
        // 页面里新开窗口的链接（下载按钮常这样）留在小窗里打开，下载才接得住
        // 兜底：脚本没拦住的新窗口请求，等回调返回后再让小窗跳过去（在回调里直接跳会被吞掉）
        .on_new_window(move |url, _features| {
            let app = popup.clone();
            let label = popup_label.clone();
            std::thread::spawn(move || {
                if let Some(w) = app.get_webview_window(&label) {
                    let _ = w.navigate(url);
                }
            });
            NewWindowResponse::Deny
        })
        .on_download(move |_webview, event| {
            match event {
                DownloadEvent::Requested { destination, .. } => {
                    let name = destination.file_name().map(|n| n.to_owned()).unwrap_or_else(|| "book.epub".into());
                    *destination = dir.join(name);
                }
                DownloadEvent::Finished { path, success, .. } => {
                    if let (true, Some(name)) = (success, path.as_ref().and_then(|p| p.file_name())) {
                        let _ = done.emit_to("main", "lanzou-file", name.to_string_lossy().into_owned());
                    }
                }
                _ => {}
            }
            true
        });
    if let Some(main) = app.get_webview_window("main") {
        builder = builder.parent(&main).map_err(|e| e.to_string())?;
    }
    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

/// 订阅源的网页窗口：只给了网址、或规则要执行脚本的订阅源，直接在这里看它的网页。
/// 和蓝奏云小窗一样跑的是远程网页、不在任何 capability 里；订阅源里的 injectJs 不注入（不执行源里的脚本）。
/// 页面里下载到的 EPUB / TXT / ZIP 走蓝奏云那条路直接进书架，别的文件照常存进「下载」。
/// 每次开新窗（可以同时开几个），async 原因同 open_lanzou。
#[tauri::command]
async fn open_web(app: tauri::AppHandle, url: String, title: String) -> Result<(), String> {
    let target = Url::parse(&url).map_err(|e| e.to_string())?;
    if !matches!(target.scheme(), "http" | "https") {
        return Err("只能打开网页地址".into());
    }
    let label = format!("web-{}", LANZOU_SEQ.fetch_add(1, Ordering::Relaxed));
    let dir = lanzou_dir(&app)?;
    let popup = app.clone();
    let popup_label = label.clone();
    let done = app.clone();
    let mut builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(target))
        .title(if title.is_empty() { "EBOOK".to_string() } else { format!("{title} · EBOOK") })
        .inner_size(1100.0, 800.0)
        .center()
        .initialization_script_for_all_frames(SAME_WINDOW)
        .on_new_window(move |url, _features| {
            let app = popup.clone();
            let label = popup_label.clone();
            std::thread::spawn(move || {
                if let Some(w) = app.get_webview_window(&label) {
                    let _ = w.navigate(url);
                }
            });
            NewWindowResponse::Deny
        })
        .on_download(move |_webview, event| {
            match event {
                DownloadEvent::Requested { destination, .. } => {
                    let is_book = destination
                        .extension()
                        .and_then(|e| e.to_str())
                        .is_some_and(|e| matches!(e.to_ascii_lowercase().as_str(), "epub" | "txt" | "zip"));
                    if is_book {
                        let name = destination.file_name().map(|n| n.to_owned()).unwrap_or_else(|| "book.epub".into());
                        *destination = dir.join(name);
                    }
                }
                DownloadEvent::Finished { path, success, .. } => {
                    if let (true, Some(p)) = (success, path.as_ref()) {
                        if p.starts_with(&dir) {
                            if let Some(name) = p.file_name() {
                                let _ = done.emit_to("main", "lanzou-file", name.to_string_lossy().into_owned());
                            }
                        }
                    }
                }
                _ => {}
            }
            true
        });
    if let Some(main) = app.get_webview_window("main") {
        builder = builder.parent(&main).map_err(|e| e.to_string())?;
    }
    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

/// 主窗口取走小窗下好的文件（只认文件名，只在 EBOOK 自己的缓存目录里），取完删掉
#[tauri::command]
fn take_lanzou_file(app: tauri::AppHandle, name: String) -> Result<tauri::ipc::Response, String> {
    if name.contains(['/', '\\', ':']) || name.contains("..") {
        return Err("非法文件名".into());
    }
    let path = lanzou_dir(&app)?.join(&name);
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&path);
    Ok(tauri::ipc::Response::new(bytes))
}

// ---- 账户导出：存进下载文件夹，存完在资源管理器里选中 ----
// 文件体走原始字节（不转 JSON 数组），几百 MB 的带书备份也快；文件名放在 x-name 头里（URL 编码）。
#[tauri::command]
fn save_export(app: tauri::AppHandle, request: tauri::ipc::Request<'_>) -> Result<String, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("没有收到文件内容".into());
    };
    let raw = request.headers().get("x-name").and_then(|v| v.to_str().ok()).unwrap_or("EBOOK账户.zip");
    let name: String = percent_encoding::percent_decode_str(raw)
        .decode_utf8_lossy()
        .chars()
        .map(|c| if r#"\/:*?"<>|"#.contains(c) || c.is_control() { '_' } else { c })
        .collect();
    let dir = downloads_dir(&app)?;
    // 同名不覆盖：加 (2)、(3)…
    let (stem, ext) = match name.rsplit_once('.') {
        Some((s, e)) => (s.to_string(), format!(".{e}")),
        None => (name.clone(), String::new()),
    };
    let mut path = dir.join(&name);
    let mut n = 2;
    while path.exists() {
        path = dir.join(format!("{stem} ({n}){ext}"));
        n += 1;
    }
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    let _ = app.opener().reveal_item_in_dir(&path);
    Ok(path.to_string_lossy().into_owned())
}

/// 再次打开 EBOOK 时，单实例插件会用 SendMessage 把参数交给正在运行的那个实例并一直等它回话。
/// 要是那个实例已经卡死，新进程就跟着卡住，用户每点一次图标就多一个卡住的进程（0.2.0 出过）。
/// 所以先自己探一下：旧实例 3 秒内不回话，就问用户要不要关掉它重新打开。正常情况什么都不做，交给插件唤起原窗口。
#[cfg(windows)]
fn guard_frozen_instance(id: &str) {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{OpenProcess, TerminateProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE, PROCESS_TERMINATE};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        FindWindowW, GetWindowThreadProcessId, MessageBoxW, SendMessageTimeoutW, IDYES, MB_ICONWARNING, MB_SETFOREGROUND, MB_TOPMOST, MB_YESNO, SMTO_ABORTIFHUNG,
        WM_NULL,
    };
    let wide = |s: &str| s.encode_utf16().chain(Some(0)).collect::<Vec<u16>>();
    // 插件建的隐藏窗口：类名 <id>-sic，标题 <id>-siw（tauri-plugin-single-instance 2.x）
    let (class, title) = (wide(&format!("{id}-sic")), wide(&format!("{id}-siw")));
    unsafe {
        let hwnd = FindWindowW(class.as_ptr(), title.as_ptr());
        if hwnd.is_null() {
            return;
        }
        let mut reply = 0usize;
        if SendMessageTimeoutW(hwnd, WM_NULL, 0, 0, SMTO_ABORTIFHUNG, 3000, &mut reply) != 0 {
            return;
        }
        let text = wide("EBOOK 已经在运行，但没有响应了（可能卡住了）。\n\n要关掉它重新打开吗？阅读进度是随时保存的，不会丢。");
        let caption = wide("EBOOK");
        // 置顶：卡住的旧窗口还挂在屏幕上，对话框不能被它挡住
        if MessageBoxW(std::ptr::null_mut(), text.as_ptr(), caption.as_ptr(), MB_YESNO | MB_ICONWARNING | MB_TOPMOST | MB_SETFOREGROUND) != IDYES {
            std::process::exit(0);
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return;
        }
        let process = OpenProcess(PROCESS_TERMINATE | PROCESS_SYNCHRONIZE, 0, pid);
        if !process.is_null() {
            TerminateProcess(process, 1);
            WaitForSingleObject(process, 5000);
            CloseHandle(process);
        }
    }
    // 之前点图标卡住的那些进程，等的窗口一没就会自己退出；等它们放开单实例锁再往下走
    std::thread::sleep(Duration::from_millis(600));
}

fn main() {
    #[cfg(windows)]
    guard_frozen_instance("app.librarium.reader");
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            // 再次启动时唤醒原窗口，避免两个阅读器竞争本地书架。
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        // 只记窗口大小、位置、最大化。不记"可见"（窗口要等页面画好第一帧再显示，防白闪），
        // 也不记"边框"（旧版有系统标题栏，记下来会把无边框窗口又恢复成带边框的）
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        )
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![recent_downloads, read_download, open_lanzou, open_web, take_lanzou_file, save_export])
        .setup(|app| {
            let nav_handle = app.handle().clone();
            let popup_handle = app.handle().clone();
            // 不加 --force_high_performance_gpu：看书软件不需要独显，交给 Windows 按省电策略选显卡。
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("EBOOK")
                .inner_size(1280.0, 820.0)
                .min_inner_size(380.0, 640.0)
                .center()
                // 自绘玻璃标题栏；shadow 让 Win11 保留系统圆角和阴影
                .decorations(false)
                .shadow(true)
                // 先藏着，页面画好第一帧后由前端调 win.show()
                .visible(false)
                // 底色同默认浅色主题「象牙纸」；前端切到深色时会改成 #080706
                .background_color(tauri::window::Color(0xf4, 0xef, 0xe6, 255))
                // 让网页自己处理拖进来的 TXT / EPUB
                .disable_drag_drop_handler()
                .on_navigation(move |url| {
                    if stays_inside(url) {
                        return true;
                    }
                    let _ = nav_handle.opener().open_url(url.as_str(), None::<&str>);
                    false
                })
                .on_new_window(move |url, _features| {
                    if stays_inside(&url) {
                        return NewWindowResponse::Allow;
                    }
                    let _ = popup_handle.opener().open_url(url.as_str(), None::<&str>);
                    NewWindowResponse::Deny
                })
                .build()?;
            // 关主窗口：先关掉挂在它下面的蓝奏云小窗，主窗口没了就让整个程序退出。
            // 0.2.0 出过一次「主窗口藏起来、程序卡死」，怀疑是小窗作为子窗口被系统连带销毁、WebView2 来不及收尾；
            // 另外小窗还开着时主窗口关了，进程也不该留在后台。
            let app_handle = app.handle().clone();
            window.on_window_event(move |event| match event {
                WindowEvent::CloseRequested { .. } => {
                    close_popups(&app_handle, "lanzou");
                    close_popups(&app_handle, "web-");
                }
                WindowEvent::Destroyed => app_handle.exit(0),
                _ => {}
            });
            // 兜底：前端万一没调 show（脚本出错），2 秒后也要把窗口亮出来
            let fallback = window.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(2));
                if !fallback.is_visible().unwrap_or(true) {
                    let _ = fallback.show();
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("无法启动 EBOOK");
}
