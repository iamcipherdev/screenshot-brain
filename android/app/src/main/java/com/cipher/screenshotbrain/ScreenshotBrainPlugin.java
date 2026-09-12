package com.cipher.screenshotbrain;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.Toast;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;

@CapacitorPlugin(name = "ScreenshotBrain", permissions = {
    @Permission(strings = { Manifest.permission.READ_MEDIA_IMAGES }, alias = "images33"),
    @Permission(strings = { "android.permission.READ_MEDIA_VISUAL_USER_SELECTED" }, alias = "visualSelected"),
    @Permission(strings = { Manifest.permission.READ_EXTERNAL_STORAGE }, alias = "storageLegacy")
})
public class ScreenshotBrainPlugin extends Plugin {

    private static final String VISUAL_SELECTED = "android.permission.READ_MEDIA_VISUAL_USER_SELECTED";

    // ── Permissions ────────────────────────────────────────────────────────

    private boolean hasMediaPermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_MEDIA_IMAGES)
                == PackageManager.PERMISSION_GRANTED;
        }
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_EXTERNAL_STORAGE)
            == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasPartialMediaPermission() {
        if (Build.VERSION.SDK_INT >= 34) {
            return ContextCompat.checkSelfPermission(getContext(), VISUAL_SELECTED)
                == PackageManager.PERMISSION_GRANTED;
        }
        return false;
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject r = new JSObject();
        boolean granted = hasMediaPermission() || hasPartialMediaPermission();
        r.put("granted", granted);
        r.put("limited", hasPartialMediaPermission() && !hasMediaPermission());
        call.resolve(r);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (hasMediaPermission() || hasPartialMediaPermission()) {
            JSObject r = new JSObject();
            boolean granted = hasMediaPermission() || hasPartialMediaPermission();
            r.put("granted", granted);
            r.put("limited", hasPartialMediaPermission() && !hasMediaPermission());
            call.resolve(r);
            return;
        }
        if (Build.VERSION.SDK_INT >= 34) {
            requestPermissionForAliases(new String[]{ "images33", "visualSelected" }, call, "onPermResult");
        } else if (Build.VERSION.SDK_INT >= 33) {
            requestPermissionForAlias("images33", call, "onPermResult");
        } else {
            requestPermissionForAlias("storageLegacy", call, "onPermResult");
        }
    }

    @PermissionCallback
    private void onPermResult(PluginCall call) {
        JSObject r = new JSObject();
        boolean granted = hasMediaPermission() || hasPartialMediaPermission();
        r.put("granted", granted);
        r.put("limited", hasPartialMediaPermission() && !hasMediaPermission());
        call.resolve(r);
    }

    // ── Scan Screenshots folder via MediaStore ─────────────────────────────

    @PluginMethod
    public void scanScreenshots(PluginCall call) {
        if (!hasMediaPermission() && !hasPartialMediaPermission()) {
            call.reject("PERMISSION_REQUIRED");
            return;
        }
        JSArray items = new JSArray();
        try {
            ContentResolver cr = getContext().getContentResolver();
            String selection;
            String[] args;
            if (Build.VERSION.SDK_INT >= 29) {
                selection = MediaStore.Images.Media.RELATIVE_PATH + " LIKE ?";
                args = new String[]{"%Screenshots%"};
            } else {
                selection = MediaStore.Images.Media.DATA + " LIKE ?";
                args = new String[]{"%Screenshots%"};
            }
            String[] proj = {
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.DATE_TAKEN,
                MediaStore.Images.Media.DATE_ADDED,
                MediaStore.Images.Media.SIZE,
                MediaStore.Images.Media.WIDTH,
                MediaStore.Images.Media.HEIGHT,
            };
            Cursor c = cr.query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, proj, selection, args,
                MediaStore.Images.Media.DATE_TAKEN + " DESC");
            if (c != null) {
                while (c.moveToNext()) {
                    long id = c.getLong(0);
                    JSObject o = new JSObject();
                    Uri uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
                    o.put("uri", uri.toString());
                    o.put("fileName", c.getString(1));
                    long dateTaken = c.isNull(2) ? 0 : c.getLong(2);
                    long dateAdded = c.isNull(3) ? 0 : c.getLong(3) * 1000L;
                    o.put("dateTaken", dateTaken > 0 ? dateTaken : dateAdded);
                    o.put("size", c.isNull(4) ? 0 : c.getLong(4));
                    o.put("width", c.isNull(5) ? 0 : c.getInt(5));
                    o.put("height", c.isNull(6) ? 0 : c.getInt(6));
                    items.put(o);
                }
                c.close();
            }
        } catch (Exception e) {
            call.reject("SCAN_FAILED: " + e.getMessage());
            return;
        }
        JSObject res = new JSObject();
        res.put("items", items);
        call.resolve(res);
    }

    // ── Load + downscale an image ──────────────────────────────────────────

    @PluginMethod
    public void loadMediaImage(PluginCall call) {
        String uriStr = call.getString("uri");
        int maxSize = call.getInt("maxSize", 2048);
        if (uriStr == null) { call.reject("NO_URI"); return; }
        try {
            Uri uri = Uri.parse(uriStr);
            Bitmap bmp = decodeScaled(uri, maxSize);
            if (bmp == null) { call.reject("DECODE_FAILED"); return; }
            String b64 = bitmapToBase64(bmp, 88);
            JSObject res = new JSObject();
            res.put("base64", b64);
            res.put("width", bmp.getWidth());
            res.put("height", bmp.getHeight());
            call.resolve(res);
        } catch (SecurityException se) {
            call.reject("PERMISSION_REQUIRED");
        } catch (Exception e) {
            call.reject("LOAD_FAILED: " + e.getMessage());
        }
    }

    // ── ML Kit on-device OCR ───────────────────────────────────────────────

    @PluginMethod
    public void recognizeText(final PluginCall call) {
        String b64 = call.getString("base64");
        if (b64 == null || b64.isEmpty()) { call.reject("NO_IMAGE"); return; }
        try {
            byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
            Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bmp == null) { call.reject("DECODE_FAILED"); return; }
            InputImage image = InputImage.fromBitmap(bmp, 0);
            TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            final Bitmap bmpRef = bmp;
            recognizer.process(image)
                .addOnSuccessListener((Text text) -> {
                    JSObject res = new JSObject();
                    res.put("text", text.getText());
                    res.put("confidenceOk", true);
                    recognizer.close();
                    bmpRef.recycle();
                    call.resolve(res);
                })
                .addOnFailureListener(e -> {
                    recognizer.close();
                    bmpRef.recycle();
                    // Real failure (model not ready etc.) — report so JS can retry later
                    call.reject("OCR_FAILED: " + e.getMessage());
                });
        } catch (Exception e) {
            call.reject("OCR_SETUP_FAILED: " + e.getMessage());
        }
    }

    // ── Share inbox consumption ────────────────────────────────────────────

    @PluginMethod
    public void takeSharedFile(PluginCall call) {
        File inbox = new File(getContext().getCacheDir(), "shared_inbox");
        File[] files = inbox.listFiles();
        if (files == null || files.length == 0) {
            JSObject res = new JSObject();
            res.put("found", false);
            call.resolve(res);
            return;
        }
        File f = files[0];
        try {
            Bitmap bmp = decodeScaledFromFile(f, 2048);
            long lastMod = f.lastModified();
            String name = f.getName();
            JSObject res = new JSObject();
            if (bmp == null) {
                // unreadable — remove it and report not found
                f.delete();
                res.put("found", false);
                call.resolve(res);
                return;
            }
            res.put("found", true);
            res.put("fileName", name);
            res.put("dateTaken", lastMod);
            res.put("base64", bitmapToBase64(bmp, 88));
            res.put("width", bmp.getWidth());
            res.put("height", bmp.getHeight());
            bmp.recycle();
            f.delete(); // consumed
            call.resolve(res);
        } catch (Exception e) {
            f.delete();
            JSObject res = new JSObject();
            res.put("found", false);
            call.resolve(res);
        }
    }

    // ── Toast ──────────────────────────────────────────────────────────────

    @PluginMethod
    public void toast(PluginCall call) {
        String message = call.getString("message", "");
        Toast.makeText(getContext(), message, Toast.LENGTH_SHORT).show();
        call.resolve();
    }

    // ── Biometric app lock ───────────────────────────────────────────────────

    @PluginMethod
    public void biometricCheck(PluginCall call) {
        JSObject r = new JSObject();
        try {
            BiometricManager bm = BiometricManager.from(getContext());
            int can = bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK
                    | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
            r.put("available", can == BiometricManager.BIOMETRIC_SUCCESS);
        } catch (Exception e) {
            r.put("available", false);
        }
        call.resolve(r);
    }

    @PluginMethod
    public void biometricAuthenticate(PluginCall call) {
        String title = call.getString("title", "Unlock Screenshot Brain");
        String subtitle = call.getString("subtitle", "");
        Context ctx = getContext();
        BiometricManager bm = BiometricManager.from(ctx);
        int can = bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK
                | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
        if (can != BiometricManager.BIOMETRIC_SUCCESS) {
            JSObject r = new JSObject();
            r.put("ok", false);
            r.put("reason", "unavailable");
            call.resolve(r);
            return;
        }
        Context actCtx = ctx;
        while (actCtx instanceof android.content.ContextWrapper) {
            if (actCtx instanceof FragmentActivity) break;
            actCtx = ((android.content.ContextWrapper) actCtx).getBaseContext();
        }
        if (!(actCtx instanceof FragmentActivity)) {
            JSObject r = new JSObject();
            r.put("ok", false);
            r.put("reason", "no-activity");
            call.resolve(r);
            return;
        }
        FragmentActivity activity = (FragmentActivity) actCtx;
        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK
                        | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                .build();
        BiometricPrompt prompt = new BiometricPrompt(activity,
                ContextCompat.getMainExecutor(ctx),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        JSObject r = new JSObject();
                        r.put("ok", true);
                        call.resolve(r);
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        JSObject r = new JSObject();
                        r.put("ok", false);
                        r.put("reason", errString.toString());
                        call.resolve(r);
                    }
                });
        prompt.authenticate(info);
    }

    // ── Share event bridge ─────────────────────────────────────────────────

    public void notifyShareReceived() {
        JSObject data = new JSObject();
        data.put("count", 1);
        notifyListeners("shareReceived", data);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private Bitmap decodeScaled(Uri uri, int maxSize) throws Exception {
        InputStream is = getContext().getContentResolver().openInputStream(uri);
        if (is == null) return null;
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inJustDecodeBounds = true;
        BitmapFactory.decodeStream(is, null, opts);
        is.close();
        int sample = 1;
        while (opts.outWidth / (sample * 2) >= maxSize && opts.outHeight / (sample * 2) >= maxSize) sample *= 2;
        opts = new BitmapFactory.Options();
        opts.inSampleSize = sample;
        is = getContext().getContentResolver().openInputStream(uri);
        if (is == null) return null;
        Bitmap bmp = BitmapFactory.decodeStream(is, null, opts);
        is.close();
        return clampTo(bmp, maxSize);
    }

    private Bitmap decodeScaledFromFile(File f, int maxSize) throws Exception {
        InputStream is = new FileInputStream(f);
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inJustDecodeBounds = true;
        BitmapFactory.decodeStream(is, null, opts);
        is.close();
        int sample = 1;
        while (opts.outWidth / (sample * 2) >= maxSize && opts.outHeight / (sample * 2) >= maxSize) sample *= 2;
        opts = new BitmapFactory.Options();
        opts.inSampleSize = sample;
        is = new FileInputStream(f);
        Bitmap bmp = BitmapFactory.decodeStream(is, null, opts);
        is.close();
        return clampTo(bmp, maxSize);
    }

    private Bitmap clampTo(Bitmap bmp, int maxSize) {
        if (bmp == null) return null;
        int w = bmp.getWidth(), h = bmp.getHeight();
        int m = Math.max(w, h);
        if (m > maxSize) {
            float scale = maxSize / (float) m;
            Matrix mx = new Matrix();
            mx.postScale(scale, scale);
            Bitmap scaled = Bitmap.createBitmap(bmp, 0, 0, w, h, mx, true);
            if (scaled != bmp) bmp.recycle();
            return scaled;
        }
        return bmp;
    }

    private String bitmapToBase64(Bitmap bmp, int quality) {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        bmp.compress(Bitmap.CompressFormat.JPEG, quality, bos);
        return Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
    }
}
