package app.librarium.reader;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.View;
import com.getcapacitor.JSObject;
import android.content.ContentValues;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import android.view.Window;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * EBOOK 自己的小原生插件（前端在 src/lib/native.js 里调用）：
 *   ready()               页面画好第一帧了：撤掉启动页（MainActivity 一直留着它，防闪屏）
 *   setBars({dark})       状态栏 / 导航栏图标跟主题：深色主题用浅色图标，反之用深色图标
 *   setImmersive({on})    阅读时藏起系统栏，从边缘划一下临时呼出；离开阅读器恢复
 *   consumeFile()         取走「用 EBOOK 打开 / 分享到 EBOOK」带进来的文件：{ name, data(base64) }，没有就 {}
 *   事件 fileOpened         有新文件带进来了（应用已在运行时），前端收到后调 consumeFile
 *   openLanzou({url,pwd,title})  打开蓝奏云下载页（WebActivity）：提取码自动填，下完的文件同样经 consumeFile 交给前端
 *   openWeb({url,title})  订阅源的网页（WebActivity 网页模式），下到的书同样经 consumeFile 进书架
 *   beginSave / appendSave / endSave   账户导出：分块写临时文件，最后放进「下载/EBOOK」（大文件不经一整串 base64）
 *   installApk({token})   检查更新：beginSave/appendSave 写好的新版 APK 交给系统安装器（签名不同的包系统会拒装）
 * 安全区不在这里：MainActivity 监听 WindowInsets，直接把像素值写进 CSS 变量。
 */
@CapacitorPlugin(name = "EbookNative")
public class EbookNative extends Plugin {
    private static final long MAX_FILE = 120L * 1024 * 1024;
    private static Intent pending;
    /** 蓝奏云下载页下好的文件（应用缓存里），取走后删掉 */
    private static File pendingFile;
    private static EbookNative instance;

    @Override
    public void load() { instance = this; }

    /** MainActivity 收到 VIEW / SEND 意图时调用 */
    static void offer(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_VIEW.equals(action) && !Intent.ACTION_SEND.equals(action)) return;
        pending = intent;
        if (instance != null) instance.notifyListeners("fileOpened", new JSObject(), true);
    }

    /** WebActivity 下完一个文件时调用 */
    static void offerFile(File f) {
        pendingFile = f;
        if (instance != null) instance.notifyListeners("fileOpened", new JSObject(), true);
    }

    @PluginMethod
    public void openLanzou(PluginCall call) {
        String url = call.getString("url", "");
        if (!WebActivity.isLanzou(Uri.parse(url))) { call.reject("只支持蓝奏云链接"); return; }
        Intent i = new Intent(getContext(), WebActivity.class);
        i.putExtra(WebActivity.EXTRA_URL, url);
        i.putExtra(WebActivity.EXTRA_PWD, call.getString("pwd", ""));
        i.putExtra(WebActivity.EXTRA_TITLE, call.getString("title", ""));
        getActivity().startActivity(i);
        call.resolve();
    }

    /** 订阅源的网页：在 WebActivity 的网页模式里打开 */
    @PluginMethod
    public void openWeb(PluginCall call) {
        String url = call.getString("url", "");
        if (!WebActivity.isWeb(Uri.parse(url))) { call.reject("只能打开网页地址"); return; }
        Intent i = new Intent(getContext(), WebActivity.class);
        i.putExtra(WebActivity.EXTRA_URL, url);
        i.putExtra(WebActivity.EXTRA_TITLE, call.getString("title", ""));
        i.putExtra(WebActivity.EXTRA_MODE, "web");
        getActivity().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void consumeFile(PluginCall call) {
        File file = pendingFile;
        pendingFile = null;
        if (file != null) {
            new Thread(() -> {
                try {
                    if (file.length() > MAX_FILE) throw new IllegalStateException("文件太大");
                    ByteArrayOutputStream buf = new ByteArrayOutputStream((int) file.length());
                    try (InputStream in = new FileInputStream(file)) { copy(in, buf); }
                    JSObject out = new JSObject();
                    out.put("name", file.getName());
                    out.put("data", Base64.encodeToString(buf.toByteArray(), Base64.NO_WRAP));
                    call.resolve(out);
                } catch (Exception e) {
                    call.reject("读不到下好的文件：" + e.getMessage());
                } finally {
                    //noinspection ResultOfMethodCallIgnored
                    file.delete();
                }
            }).start();
            return;
        }
        Intent intent = pending;
        pending = null;
        JSObject out = new JSObject();
        if (intent == null) { call.resolve(out); return; }
        Uri uri = Intent.ACTION_SEND.equals(intent.getAction()) ? intent.getParcelableExtra(Intent.EXTRA_STREAM) : intent.getData();
        if (uri == null) { call.resolve(out); return; }
        new Thread(() -> {
            try {
                String name = "book";
                try (Cursor c = getContext().getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                    if (c != null && c.moveToFirst()) name = c.getString(0);
                } catch (Exception ignored) {
                    String last = uri.getLastPathSegment();
                    if (last != null) name = last;
                }
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
                    byte[] chunk = new byte[65536];
                    int n;
                    while ((n = in.read(chunk)) > 0) {
                        buf.write(chunk, 0, n);
                        if (buf.size() > MAX_FILE) throw new IllegalStateException("文件太大");
                    }
                }
                out.put("name", name);
                out.put("data", Base64.encodeToString(buf.toByteArray(), Base64.NO_WRAP));
                call.resolve(out);
            } catch (Exception e) {
                call.reject("读不到这个文件：" + e.getMessage());
            }
        }).start();
    }

    // ---------- 账户导出 ----------
    private final Map<String, File> saves = new HashMap<>();

    @PluginMethod
    public void beginSave(PluginCall call) {
        try {
            File tmp = File.createTempFile("export", ".part", getContext().getCacheDir());
            String token = UUID.randomUUID().toString();
            saves.put(token, tmp);
            JSObject out = new JSObject();
            out.put("token", token);
            call.resolve(out);
        } catch (Exception e) { call.reject("没法创建临时文件：" + e.getMessage()); }
    }

    @PluginMethod
    public void appendSave(PluginCall call) {
        File tmp = saves.get(call.getString("token", ""));
        if (tmp == null) { call.reject("导出已失效"); return; }
        try (FileOutputStream out = new FileOutputStream(tmp, true)) {
            out.write(Base64.decode(call.getString("data", ""), Base64.DEFAULT));
            call.resolve();
        } catch (Exception e) { call.reject("写入失败：" + e.getMessage()); }
    }

    @PluginMethod
    public void endSave(PluginCall call) {
        File tmp = saves.remove(call.getString("token", ""));
        String name = call.getString("name", "EBOOK账户.zip").replaceAll("[\\\\/:*?\"<>|]", "_");
        if (tmp == null) { call.reject("导出已失效"); return; }
        new Thread(() -> {
            try {
                String shown;
                if (Build.VERSION.SDK_INT >= 29) {
                    // Android 10+：MediaStore 写进公共「下载/EBOOK」，不需要存储权限
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    v.put(MediaStore.Downloads.MIME_TYPE, "application/zip");
                    v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/EBOOK");
                    Uri uri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new IllegalStateException("系统没给写入位置");
                    try (InputStream in = new FileInputStream(tmp); OutputStream out = getContext().getContentResolver().openOutputStream(uri)) {
                        copy(in, out);
                    }
                    shown = "下载/EBOOK/" + name;
                } else {
                    // 老系统：放应用自己的下载目录，不用申请存储权限
                    File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    File dest = new File(dir, name);
                    try (InputStream in = new FileInputStream(tmp); OutputStream out = new FileOutputStream(dest)) {
                        copy(in, out);
                    }
                    shown = dest.getAbsolutePath();
                }
                JSObject out = new JSObject();
                out.put("path", shown);
                call.resolve(out);
            } catch (Exception e) {
                call.reject("保存失败：" + e.getMessage());
            } finally {
                //noinspection ResultOfMethodCallIgnored
                tmp.delete();
            }
        }).start();
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        File tmp = saves.remove(call.getString("token", ""));
        if (tmp == null) { call.reject("安装包已失效"); return; }
        try {
            File dir = new File(getContext().getCacheDir(), "update");
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
            File apk = new File(dir, "EBOOK-update.apk");
            //noinspection ResultOfMethodCallIgnored
            apk.delete();
            if (!tmp.renameTo(apk)) {
                try (InputStream in = new FileInputStream(tmp); OutputStream out = new FileOutputStream(apk)) { copy(in, out); }
                //noinspection ResultOfMethodCallIgnored
                tmp.delete();
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("打不开安装器：" + e.getMessage());
        }
    }

    private static void copy(InputStream in, OutputStream out) throws java.io.IOException {
        byte[] buf = new byte[65536];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
    }

    @PluginMethod
    public void ready(PluginCall call) {
        Activity a = getActivity();
        if (a instanceof MainActivity) ((MainActivity) a).markReady();
        call.resolve();
    }

    @PluginMethod
    public void setBars(PluginCall call) {
        final boolean dark = call.getBoolean("dark", false);
        getActivity().runOnUiThread(() -> {
            Window w = getActivity().getWindow();
            WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, w.getDecorView());
            c.setAppearanceLightStatusBars(!dark);
            c.setAppearanceLightNavigationBars(!dark);
            View web = getBridge().getWebView();
            web.setBackgroundColor(dark ? 0xFF080706 : 0xFFF4EFE6);
        });
        call.resolve();
    }

    @PluginMethod
    public void setImmersive(PluginCall call) {
        final boolean on = call.getBoolean("on", false);
        getActivity().runOnUiThread(() -> {
            Window w = getActivity().getWindow();
            WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, w.getDecorView());
            if (on) {
                c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                c.hide(WindowInsetsCompat.Type.systemBars());
            } else {
                c.show(WindowInsetsCompat.Type.systemBars());
            }
        });
        call.resolve();
    }
}
