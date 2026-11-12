package ph.store.cashoutlog;

import android.os.Bundle;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must be registered before the bridge starts.
        registerPlugin(SharedReceiptPlugin.class);
        registerPlugin(AppBarsPlugin.class);
        super.onCreate(savedInstanceState);
        // Draw behind the status and navigation bars on every Android version (newer ones already do).
        // The Capacitor system-bars plugin then adds the space for the bars exactly once.
        // This has to come AFTER super.onCreate, which sets the no-title-bar theme. Calling it first made
        // Android build the window with the launch theme and a white title bar ("Ka...") appeared on top.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        ViewCompat.requestApplyInsets(getWindow().getDecorView());
    }
}
