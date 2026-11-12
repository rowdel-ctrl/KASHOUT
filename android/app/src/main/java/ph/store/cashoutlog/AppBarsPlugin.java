package ph.store.cashoutlog;

import android.graphics.Color;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Makes the status bar and the navigation bar match the app: the colour behind them,
 * and dark or light icons so they can always be read.
 */
@CapacitorPlugin(name = "AppBars")
public class AppBarsPlugin extends Plugin {
    @PluginMethod
    public void apply(final PluginCall call) {
        final boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        final String color = call.getString("color", "#FBF7F1");
        getActivity().runOnUiThread(() -> {
            try {
                Window window = getActivity().getWindow();
                window.getDecorView().setBackgroundColor(Color.parseColor(color));
                window.setStatusBarColor(Color.TRANSPARENT);
                window.setNavigationBarColor(Color.TRANSPARENT);
                WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
                // "Light" bars have dark icons. Use them on a light app, and light icons on a dark app.
                controller.setAppearanceLightStatusBars(!dark);
                controller.setAppearanceLightNavigationBars(!dark);
                call.resolve();
            } catch (Exception e) {
                call.reject("Could not set the bars", e);
            }
        });
    }
}
