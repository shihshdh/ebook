package app.librarium.reader;

import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private volatile boolean ready = false;
    private String lastInsets = "";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 启动页留到页面画好第一帧（前端调 EbookNative.ready），中间不露出空白 WebView；2.5 秒兜底
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        splash.setKeepOnScreenCondition(() -> !ready);
        new Handler(Looper.getMainLooper()).postDelayed(this::markReady, 2500);

        registerPlugin(EbookNative.class);
        super.onCreate(savedInstanceState);
        EbookNative.offer(getIntent());   // 冷启动就是被「用 EBOOK 打开」拉起来的

        // 铺满全屏（edge-to-edge）：系统栏透明，页面自己按安全区留白
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (android.os.Build.VERSION.SDK_INT >= 29) getWindow().setNavigationBarContrastEnforced(false);

        WebView web = getBridge().getWebView();
        web.setBackgroundColor(0xFFF4EFE6);   // 默认浅色「象牙纸」；切深色时 EbookNative.setBars 会改
        // 安卓 WebView 的 env(safe-area-inset-*) 靠不住：自己量系统栏 / 刘海 / 键盘，写成 CSS 变量
        View host = (View) web.getParent();
        ViewCompat.setOnApplyWindowInsetsListener(web, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            // 键盘弹出时把 WebView 底边抬上去（edge-to-edge 下 adjustResize 不再自动生效）
            host.setPadding(0, 0, 0, Math.max(0, ime.bottom - bars.bottom));
            pushInsets(web, bars);
            return WindowInsetsCompat.CONSUMED;
        });
    }

    void markReady() { ready = true; }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        EbookNative.offer(intent);       // 应用已在运行，又有文件带进来
    }

    private void pushInsets(WebView web, Insets in) {
        float d = getResources().getDisplayMetrics().density;
        String js = String.format(java.util.Locale.US,
            "(function(s){s.setProperty('--native-safe-top','%.1fpx');s.setProperty('--native-safe-right','%.1fpx');" +
            "s.setProperty('--native-safe-bottom','%.1fpx');s.setProperty('--native-safe-left','%.1fpx');})(document.documentElement.style)",
            in.top / d, in.right / d, in.bottom / d, in.left / d);
        if (js.equals(lastInsets)) return;
        lastInsets = js;
        web.post(() -> web.evaluateJavascript(js, null));
    }

    @Override
    public void onResume() {
        super.onResume();
        // 页面刷新后变量会丢：回到前台时补写一次
        WebView web = getBridge().getWebView();
        lastInsets = "";
        ViewCompat.requestApplyInsets(web);
    }
}
