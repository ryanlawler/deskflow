# Fleet KVM — Mac client: PrintScreen → screenshot setup (mm32)

How to make the PC keyboard's **PrintScreen** key take a region screenshot on a
Mac client of the Deskflow desk KVM, and land the image in the clipboard so it can
be pasted on the other fleet machines. Written from the working mm32 setup so a new
Mac can be reproduced.

Fleet: **gamepc** = Linux server (holds the keyboard/mouse). **mm32** = Apple Silicon
Mac client. **recpc** = Linux client.

## The chain (every link must be present, or it silently does nothing)

1. Press PrintScreen on the PC keyboard (attached to gamepc).
2. Deskflow server (gamepc) forwards the key as `kKeyPrint`.
3. The **patched** Deskflow Mac client maps `kKeyPrint` → `kVK_F13` (keycode 105).
4. macOS symbolic hotkey **31** ("Copy picture of selected area to the Clipboard")
   is bound to F13, so it fires → region crosshair → drag → image to the clipboard.

## Per-Mac setup

### 1. Install the patched Deskflow app (kKeyPrint → F13)

Stock Deskflow drops PrintScreen on macOS. Its key table (`s_controlKeys[]` in
`src/lib/platform/OSXKeyState.cpp`) has no entry for `kKeyPrint`, so the key never
reaches the Mac. The patch adds one line:

    {kKeyPrint, kVK_F13},

Branch in this fork: `printscreen-macos-keymap`. Build the Mac app from a tree that
has this commit AND the fixed BMP converter (see Supporting fixes), then install to
`/Applications/Deskflow.app`. Keep a backup of the stock app.

### 2. Sign with a STABLE self-signed identity (so permissions stick)

macOS ties Accessibility / Screen-Recording grants to the app's code signature. An
ad-hoc signature changes on every build, so macOS keeps re-asking for permission.
Make ONE self-signed code-signing identity and always sign with it.

One-time, create the identity (Keychain Access → Certificate Assistant → Create a
Certificate → name "Deskflow Local Signing", type "Code Signing", self-signed), or
via openssl then import to the login keychain. Then, on every build:

    codesign --force --deep --sign "Deskflow Local Signing" /Applications/Deskflow.app

Use the SAME identity name across rebuilds so the grants carry over instead of resetting.

### 3. Grant permissions

System Settings → Privacy & Security:
- **Accessibility** → enable Deskflow (needed to inject keys and mouse).
- **Input Monitoring** → enable Deskflow.

Fully quit and relaunch Deskflow after granting. macOS caches the decision per process.

### 4. Bind macOS hotkey 31 to F13 — with TYPED values (the silent-failure trap)

macOS symbolic hotkey **31** = "Copy picture of selected area to the Clipboard".
Bind it to F13 (keycode 105).

WARNING — this is the step that cost us hours. The values MUST be real types: a
boolean for `enabled` and integers for the parameters. `defaults write ... -dict-add`
with an old-style string dict stores everything as `<string>`, and macOS **silently
refuses to register** the hotkey. It looks correct under `defaults read`, but the key
does nothing. Write it through plutil/JSON so the types are right:

    defaults export com.apple.symbolichotkeys /tmp/shk.plist
    plutil -replace AppleSymbolicHotKeys.31 -json '{"enabled":true,"value":{"type":"standard","parameters":[65535,105,0]}}' /tmp/shk.plist
    defaults import com.apple.symbolichotkeys /tmp/shk.plist
    # reload the hotkey registry without logging out:
    /System/Library/PrivateFrameworks/SystemAdministration.framework/Resources/activateSettings -u

Parameter meaning: `65535` = no ASCII char (function key), `105` = kVK_F13, `0` = no
modifiers. Verify the stored types:

    plutil -extract AppleSymbolicHotKeys.31 xml1 -o - ~/Library/Preferences/com.apple.symbolichotkeys.plist
    # want <true/> for enabled and <integer> for each parameter, NOT <string>

### 5. Test

Cursor on the Mac → press PrintScreen → the region crosshair should appear. Drag a
box → the image is on the Mac clipboard. Note: the "copy to clipboard" screenshot
shows NO thumbnail preview in the corner. That is normal for the clipboard variant,
not a sign of failure.

## Supporting fixes (same fork — needed for the whole thing to work end to end)

- **Screenshots arrive blank white on the Linux side** = the Mac app was built with an
  OLD `OSXClipboardBMPConverter` that drops the bitmap color masks, so the receiver
  decodes every pixel to one flat color. Fix = build the Mac app from the fixed
  converter (`src/lib/platform/OSXClipboardBMPConverter.{cpp,h}`, commit `62a8ee749`).
  The capture itself is fine — it pastes correctly locally on the Mac; it is a
  transfer/decode bug. Fingerprint: a ~2 MB screenshot re-encodes to a ~3 KB PNG on
  the server (a real image would be far larger).

- **Cursor freezes / flaps at a screen edge** = a coordinate underflow (INT_MIN) in the
  server flows unclamped into the screen-switch math. It is usually triggered by an
  oversized clipboard (a large screenshot) breaking the TLS link and forcing a client
  reconnect. Fix = branch `fix/cursor-coordinate-underflow`: clamp the entry coordinates
  in `Server::switchScreen` and guard the float→int casts in `Server::mapToPixel` with
  `std::isfinite`. Immediate escape if it happens live: press Scroll Lock (lock-to-screen).

- **Server clipboard on GNOME Wayland** = the `PortalServerClipboard` sidecar (branch
  `server-clipboard-portal`, upstream PR #10006). Without it the GNOME server has no
  clipboard at all and wipes the clients' clipboards on every screen crossing.

## Known limits

- The GNOME **input-capture consent dialog** on the server re-appears once per server
  start (so once per reboot). GNOME 50's input-capture portal is version 1, which cannot
  remember the grant. The code to persist it is compiled in (build against libportal 0.10
  headers so `HAVE_LIBPORTAL_INPUTCAPTURE_RESTORE` is set) and will start working when
  GNOME ships the newer portal. The clipboard consent already persists.

- Build the Linux server against **libportal 0.10 headers**, not the distro 0.9.1 dev
  headers, or the input-capture persistence and other 0.10 features get compiled out
  silently even though the bundled 0.10 library supports them.
