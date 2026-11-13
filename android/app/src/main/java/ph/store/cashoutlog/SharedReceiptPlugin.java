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
        // Opening the app again from the recent apps list hands back the old share. It is not a new share.
        if ((intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) return;

        String type = intent.getType();
        Uri uri = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri.class);
        // Some apps hand the picture over in the clip instead of the usual place.
        if (uri == null && intent.getClipData() != null && intent.getClipData().getItemCount() > 0) {
            uri = intent.getClipData().getItemAt(0).getUri();
        }
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        boolean got = false;

        // GCash sends a picture with the message. Some apps label the share as text even then,
        // so look at what the file really is, not only at the label on the share.
        if (uri != null && looksLikeImage(uri, type)) {
            String path = copyToCache(uri);
            if (path != null) {
                sharedPath = path;
                sharedText = (text != null && !text.trim().isEmpty()) ? text : null;
                got = true;
            }
        }
        if (!got && text != null && !text.trim().isEmpty()) {
            sharedText = text;
            sharedPath = null;
            got = true;
        }

        // The activity keeps the share as its launch intent, and Capacitor reads it again each time the activity
        // is recreated. Replace it so one share opens one entry, once.
        if (getActivity() != null) getActivity().setIntent(new Intent(Intent.ACTION_MAIN));

        if (got) {
            notifyListeners("shared", new JSObject());
        }
    }

    private boolean looksLikeImage(Uri uri, String shareType) {
        String real = null;
        try {
            real = getContext().getContentResolver().getType(uri);
        } catch (Exception e) {
            // unknown
        }
        if (real != null) return real.startsWith("image/");
        return shareType == null || shareType.startsWith("image/") || shareType.equals("*/*");
    }

    /** Returns what was shared, then forgets it. Empty if nothing is waiting. */
    @PluginMethod
    public void getShared(PluginCall call) {
        JSObject result = new JSObject();
        if (sharedPath != null) result.put("path", "file://" + sharedPath);
        if (sharedText != null) result.put("text", sharedText);
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
