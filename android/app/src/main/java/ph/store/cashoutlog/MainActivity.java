package ph.store.cashoutlog;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Draw behind the status and navigation bars on every Android version (newer ones already do).
        // The Capacitor system-bars plugin then adds the space for the bars exactly once.
        // Without this, phones older than Android 15 counted the bars twice: a gap above and below.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        // Must be registered before the bridge starts.
        registerPlugin(SharedReceiptPlugin.class);
        registerPlugin(AppBarsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
