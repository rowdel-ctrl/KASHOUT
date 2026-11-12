package ph.store.cashoutlog;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.IntentCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Lets other apps (like GCash) share a receipt picture, or its text, to Kashawt.
 * The picture is copied into the app's own cache so it can be read later, then the web part asks for it.
 */
@CapacitorPlugin(name = "SharedReceipt")
public class SharedReceiptPlugin extends Plugin {
    private static String sharedPath = null;
    private static String sharedText = null;

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;

        String type = intent.getType();
        Uri uri = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri.class);
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        boolean got = false;

        if (uri != null && type != null && type.startsWith("image/")) {
            String path = copyToCache(uri);
            if (path != null) {
                sharedPath = path;
                sharedText = null;
                got = true;
            }
        } else if (text != null && !text.trim().isEmpty()) {
            sharedText = text;
            sharedPath = null;
            got = true;
        }

        if (got) {
            notifyListeners("shared", new JSObject());
        }
    }

    /** Returns what was shared, then forgets it. Empty if nothing is waiting. */
    @PluginMethod
    public void getShared(PluginCall call) {
        JSObject result = new JSObject();
        if (sharedPath != null) {
            result.put("path", "file://" + sharedPath);
        } else if (sharedText != null) {
            result.put("text", sharedText);
        }
        sharedPath = null;
        sharedText = null;
        call.resolve(result);
    }

    private String copyToCache(Uri uri) {
        try {
            File dir = getContext().getCacheDir();
            File[] old = dir.listFiles();
            if (old != null) {
                for (File f : old) {
                    if (f.getName().startsWith("shared-")) f.delete();
                }
            }
            File out = new File(dir, "shared-" + System.currentTimeMillis() + ".jpg");
            try (InputStream in = getContext().getContentResolver().openInputStream(uri);
                 OutputStream os = new FileOutputStream(out)) {
                if (in == null) return null;
                byte[] buf = new byte[16 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
            }
            return out.getAbsolutePath();
        } catch (Exception e) {
            return null;
        }
    }
}
