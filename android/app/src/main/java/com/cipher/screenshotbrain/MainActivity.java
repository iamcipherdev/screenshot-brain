package com.cipher.screenshotbrain;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ScreenshotBrainPlugin.class);
        super.onCreate(savedInstanceState);
        handleShareIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleShareIntent(intent);
    }

    /**
     * Android Share Target: images shared from any gallery app arrive here.
     * We copy each stream into our inbox directory, then the plugin bridge
     * notifies the web layer, which imports them through the normal pipeline.
     */
    private void handleShareIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) return;

        String type = intent.getType();
        if (type == null || !type.startsWith("image/")) return;

        java.util.ArrayList<Uri> uris = new java.util.ArrayList<>();
        if (Intent.ACTION_SEND.equals(action)) {
            Uri u = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u != null) uris.add(u);
        } else {
            java.util.ArrayList<Uri> list = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (list != null) uris.addAll(list);
        }
        if (uris.isEmpty()) return;

        java.io.File inbox = new java.io.File(getCacheDir(), "shared_inbox");
        if (!inbox.exists()) inbox.mkdirs();

        int saved = 0;
        for (Uri uri : uris) {
            try (java.io.InputStream in = getContentResolver().openInputStream(uri)) {
                if (in == null) continue;
                String name = "shared_" + System.currentTimeMillis() + "_" + (saved++) + ".jpg";
                java.io.File dest = new java.io.File(inbox, name);
                try (java.io.OutputStream out = new java.io.FileOutputStream(dest)) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                }
            } catch (Exception e) {
                android.util.Log.w("ScreenshotBrain", "Failed to copy shared image", e);
            }
        }

        if (saved > 0 && bridge != null) {
            com.getcapacitor.PluginHandle handle = bridge.getPlugin("ScreenshotBrain");
            if (handle != null && handle.getInstance() instanceof ScreenshotBrainPlugin) {
                ((ScreenshotBrainPlugin) handle.getInstance()).notifyShareReceived();
            }
        }
    }
}
