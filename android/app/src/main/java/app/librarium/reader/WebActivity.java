package app.librarium.reader;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.widget.FrameLayout;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONObject;

/**
 * EBOOK 自带的网页页面，两种用法（对应 Windows 客户端 src-tauri/src/main.rs 的 open_lanzou / open_web）：
 *   蓝奏云：提取码自动填好，用户自己点下载；下完的文件交给 EbookNative，走「用 EBOOK 打开」同一条入架路，然后自动关掉回到 EBOOK。
 *           不绕过蓝奏云的任何校验：页面、验证、点击都是用户在真实 WebView 里完成的，这里只接住最后那个下载。
 *   网页：  订阅源里只给了网址、或规则要执行脚本的，在这里看它的网页。下载到的 EPUB / TXT / ZIP 同样进书架，
 *           别的文件交给系统浏览器去下。订阅源里的 injectJs 不注入（不执行源里的脚本）。视频可以全屏。
 */
public class WebActivity extends AppCompatActivity {
    static final String EXTRA_URL = "url", EXTRA_PWD = "pwd", EXTRA_TITLE = "title", EXTRA_MODE = "mode";
    private static final long MAX_FILE = 120L * 1024 * 1024;

    /** 蓝奏云的文件链接、下载按钮（在 iframe 里）常用 target=_blank / window.open：统统改成在本页打开，下载才接得住 */
    private static final String SAME_WINDOW = "(function(){if(window.__ebookSame)return;window.__ebookSame=1;document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[target]');if(a&&a.target!=='_self'&&a.target!=='_top')a.target='_top';},true);window.open=function(u){if(u){var h=new URL(u,location.href).href;try{window.top.location.href=h;}catch(_){location.href=h;}}return null;};})();";

    private WebView web;
    private TextView status;
    private ProgressBar bar;
    private volatile boolean downloading = false;
    private String pageUrl = "";
    private boolean lanzou = true;
    private FrameLayout fullscreen;
    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;

    static boolean isWeb(Uri u) {
        String sch = u == null ? null : u.getScheme();
        return u != null && u.getHost() != null && ("https".equals(sch) || "http".equals(sch));
    }

    static boolean isLanzou(Uri u) {
        String host = u == null ? null : u.getHost();
        return host != null && "https".equals(u.getScheme()) && (host.contains("lanzo") || host.endsWith("lanzn.com"));
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String url = getIntent().getStringExtra(EXTRA_URL);
        lanzou = !"web".equals(getIntent().getStringExtra(EXTRA_MODE));
        if (url == null || !(lanzou ? isLanzou(Uri.parse(url)) : isWeb(Uri.parse(url)))) { finish(); return; }
        String pwd = getIntent().getStringExtra(EXTRA_PWD);
        String title = getIntent().getStringExtra(EXTRA_TITLE);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setFitsSystemWindows(true);
        root.setBackgroundColor(0xFFF4EFE6);

        // 顶栏：返回 · 书名 / 提示
        LinearLayout head = new LinearLayout(this);
        head.setOrientation(LinearLayout.HORIZONTAL);
        head.setGravity(Gravity.CENTER_VERTICAL);
        head.setPadding(dp(4), dp(6), dp(16), dp(6));
        TextView back = new TextView(this);
        back.setText("‹ 返回");
        back.setTextColor(0xFF6B5A3E);
        back.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        back.setPadding(dp(12), dp(10), dp(12), dp(10));
        back.setOnClickListener(v -> finish());
        head.addView(back);
        LinearLayout texts = new LinearLayout(this);
        texts.setOrientation(LinearLayout.VERTICAL);
        TextView name = new TextView(this);
        name.setText(title == null || title.isEmpty() ? (lanzou ? "蓝奏云" : "网页") : title);
        name.setTextColor(0xFF1E1A14);
        name.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        name.setTypeface(Typeface.DEFAULT_BOLD);
        name.setSingleLine(true);
        name.setEllipsize(android.text.TextUtils.TruncateAt.END);
        status = new TextView(this);
        status.setText(!lanzou ? Uri.parse(url).getHost() : pwd == null || pwd.isEmpty() ? "点下载，下完自动放进书架" : "提取码已自动填好 · 点下载，下完自动放进书架");
        status.setTextColor(0xFF8A7A62);
        status.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        texts.addView(name);
        texts.addView(status);
        head.addView(texts, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        root.addView(head);

        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(1000);
        bar.setVisibility(View.GONE);
        root.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));

        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        // 网页里的视频点全屏时，把播放器搬到这一层盖满屏幕
        FrameLayout stack = new FrameLayout(this);
        stack.addView(root, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        fullscreen = new FrameLayout(this);
        fullscreen.setBackgroundColor(0xFF000000);
        fullscreen.setVisibility(View.GONE);
        stack.addView(fullscreen, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(stack);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setSupportMultipleWindows(false);           // 新窗口请求留在本页打开
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        String fill = !lanzou ? "" : "(function(){var P=" + JSONObject.quote(pwd == null ? "" : pwd) + ";if(!P||window.top!==window)return;var n=0;var t=setInterval(function(){n++;var i=document.querySelector('#pwd,input[name=\"pwd\"]');if(i&&!i.dataset.ebook){i.dataset.ebook='1';i.value=P;i.dispatchEvent(new Event('input',{bubbles:true}));var b=document.querySelector('#sub,.passwddiv-btn,#passwddiv .btn,input[type=\"submit\"]');if(b)b.click();clearInterval(t);}if(n>40)clearInterval(t);},250);})();";
        final boolean startScripts = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT);
        if (startScripts) {
            // 注入到所有 frame（下载按钮在 iframe 里）
            WebViewCompat.addDocumentStartJavaScript(web, SAME_WINDOW + fill, Collections.singleton("*"));
        }

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                String sch = req.getUrl().getScheme();
                // 只在本页里走 http(s)；页面想拉起别的 App（intent://、蓝奏云客户端）一律不理
                return !("https".equals(sch) || "http".equals(sch));
            }
            @Override
            public void onPageFinished(WebView view, String u) {
                pageUrl = u;
                if (!startScripts) view.evaluateJavascript(SAME_WINDOW + fill, null);   // 老 WebView：只能顾到主页面
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int p) {
                if (downloading) return;
                bar.setVisibility(p < 100 ? View.VISIBLE : View.GONE);
                bar.setIndeterminate(false);
                bar.setProgress(p * 10);
            }
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) { callback.onCustomViewHidden(); return; }
                customView = view;
                customCallback = callback;
                fullscreen.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                fullscreen.setVisibility(View.VISIBLE);
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                fullscreen.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            }
            @Override
            public void onHideCustomView() { exitFullscreen(); }
        });
        web.setDownloadListener((dlUrl, ua, disposition, mime, length) -> {
            // 网页模式：只收书；别的文件（安装包、视频、图片…）交给系统浏览器去下
            if (!lanzou && !looksLikeBook(URLUtil.guessFileName(dlUrl, disposition, mime), mime)) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(dlUrl))); } catch (Exception ignored) {}
                return;
            }
            download(dlUrl, ua, disposition, mime);
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (customView != null) exitFullscreen();
                else if (web.canGoBack()) web.goBack(); else finish();
            }
        });
        web.loadUrl(url);
    }

    private void download(String url, String ua, String disposition, String mime) {
        if (downloading) return;
        downloading = true;
        say("正在下载…", 0, 0);
        new Thread(() -> {
            File out = null;
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setInstanceFollowRedirects(true);
                c.setConnectTimeout(15000);
                c.setReadTimeout(60000);
                if (ua != null) c.setRequestProperty("User-Agent", ua);
                String cookie = CookieManager.getInstance().getCookie(url);
                if (cookie != null) c.setRequestProperty("Cookie", cookie);
                if (!pageUrl.isEmpty()) c.setRequestProperty("Referer", pageUrl);
                int code = c.getResponseCode();
                if (code / 100 != 2) throw new IllegalStateException("HTTP " + code);
                long total = c.getContentLengthLong();
                String cd = c.getHeaderField("Content-Disposition");
                String name = fileName(url, cd != null ? cd : disposition, mime);
                File dir = new File(getCacheDir(), "lanzou");
                //noinspection ResultOfMethodCallIgnored
                dir.mkdirs();
                out = new File(dir, name);
                byte[] head = new byte[64];
                int headLen = 0;
                try (InputStream in = c.getInputStream(); OutputStream os = new FileOutputStream(out)) {
                    byte[] buf = new byte[65536];
                    long got = 0, lastSay = 0;
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        if (headLen < head.length) {
                            int k = Math.min(n, head.length - headLen);
                            System.arraycopy(buf, 0, head, headLen, k);
                            headLen += k;
                        }
                        os.write(buf, 0, n);
                        got += n;
                        if (got > MAX_FILE) throw new IllegalStateException("文件太大");
                        long now = System.currentTimeMillis();
                        if (now - lastSay > 200) { lastSay = now; say(null, got, total); }
                    }
                }
                // 蓝奏云的人机验证页也会走到这里：拿到的是网页不是书，就当没下成
                String start = new String(head, 0, headLen, StandardCharsets.ISO_8859_1).trim().toLowerCase(Locale.ROOT);
                if (start.startsWith("<")) throw new IllegalStateException("拿到的是网页");
                File fin = fixExt(out, head, headLen);
                EbookNative.offerFile(fin);
                runOnUiThread(() -> {
                    if (lanzou) { status.setText("下好了，正在放进书架…"); finish(); return; }
                    // 网页模式留在页面上，可以接着看
                    downloading = false;
                    bar.setVisibility(View.GONE);
                    status.setTextColor(0xFF3F8F5F);
                    status.setText(fin.getName() + " 已放进书架");
                });
            } catch (Exception e) {
                if (out != null) //noinspection ResultOfMethodCallIgnored
                    out.delete();
                downloading = false;
                runOnUiThread(() -> {
                    bar.setVisibility(View.GONE);
                    status.setText("没下成（" + e.getMessage() + "），再点一次下载试试");
                    status.setTextColor(0xFFB3412E);
                });
            }
        }).start();
    }

    private void say(String text, long got, long total) {
        runOnUiThread(() -> {
            bar.setVisibility(View.VISIBLE);
            bar.setIndeterminate(total <= 0);
            if (total > 0) bar.setProgress((int) (got * 1000 / total));
            status.setTextColor(0xFF8A7A62);
            status.setText(text != null ? text : String.format(Locale.US, "正在下载… %.1f%s MB", got / 1048576.0,
                total > 0 ? String.format(Locale.US, " / %.1f", total / 1048576.0) : ""));
        });
    }

    /** 文件名：优先 filename*=UTF-8''…，其次 filename="…"（蓝奏云常把 UTF-8 原样塞进头里），都没有再猜 */
    static String fileName(String url, String cd, String mime) {
        String name = null;
        if (cd != null) {
            Matcher m = Pattern.compile("filename\\*\\s*=\\s*([\\w-]+)''([^;]+)", Pattern.CASE_INSENSITIVE).matcher(cd);
            if (m.find()) {
                try { name = URLDecoder.decode(m.group(2).trim(), m.group(1)); } catch (Exception ignored) {}
            }
            if (name == null) {
                m = Pattern.compile("filename\\s*=\\s*\"?([^\";]+)\"?", Pattern.CASE_INSENSITIVE).matcher(cd);
                if (m.find()) {
                    String raw = m.group(1).trim();
                    // HttpURLConnection 按 ISO-8859-1 读头：原本是 UTF-8 的中文要还原回来
                    String utf8 = new String(raw.getBytes(StandardCharsets.ISO_8859_1), StandardCharsets.UTF_8);
                    name = utf8.contains("\uFFFD") ? raw : utf8;
                    if (name.contains("%")) try { name = URLDecoder.decode(name, "UTF-8"); } catch (Exception ignored) {}
                }
            }
        }
        if (name == null || name.isEmpty()) name = URLUtil.guessFileName(url, cd, mime);
        name = name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
        return name.isEmpty() ? "book" : name;
    }

    /** 名字里没有 .epub / .txt / .zip 的，按内容补上（EPUB 是 zip，开头紧跟 mimetype） */
    private static File fixExt(File f, byte[] head, int len) {
        String lower = f.getName().toLowerCase(Locale.ROOT);
        if (lower.endsWith(".epub") || lower.endsWith(".txt") || lower.endsWith(".zip")) return f;
        String h = new String(head, 0, len, StandardCharsets.ISO_8859_1);
        String ext = h.startsWith("PK") ? (h.contains("epub") ? ".epub" : ".zip") : ".txt";
        File to = new File(f.getParentFile(), f.getName() + ext);
        return f.renameTo(to) ? to : f;
    }

    private void exitFullscreen() {
        if (customView == null) return;
        fullscreen.removeView(customView);
        fullscreen.setVisibility(View.GONE);
        customView = null;
        if (customCallback != null) customCallback.onCustomViewHidden();
        customCallback = null;
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
    }

    static boolean looksLikeBook(String name, String mime) {
        String n = name == null ? "" : name.toLowerCase(Locale.ROOT);
        String m = mime == null ? "" : mime.toLowerCase(Locale.ROOT);
        return n.endsWith(".epub") || n.endsWith(".txt") || n.endsWith(".zip") || m.contains("epub") || m.equals("text/plain") || m.contains("zip");
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    @Override
    protected void onDestroy() {
        if (web != null) { web.stopLoading(); web.destroy(); }
        super.onDestroy();
    }
}
