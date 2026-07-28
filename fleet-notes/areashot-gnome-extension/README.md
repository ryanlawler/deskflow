# AreaShot — GNOME Shell extension: macOS-style area screenshot across all monitors

The Linux screenshot solution for the desk fleet (recpc + gamepc-Linux, GNOME 50
Wayland, dual-monitor). Press Print -> drag a box anywhere across ALL monitors ->
release -> the region is copied to the clipboard AND saved as a timestamped PNG in
~/Pictures/Screenshots. No toolbar, no Enter, no notification, no flash. Exactly like
macOS Cmd+Shift+4.

## Why an extension (and why Flameshot could not do it)
Flameshot cannot draw one selection across two monitors on GNOME Wayland:
- Wayland gives a client no union-of-all-outputs surface (X11 had one), so a tool's
  overlay lands on one monitor only. Even Flameshot v14 is one-monitor-at-a-time.
- GNOME 41+ blocks external tools/scripts from the shell's screenshot path (a
  DBusSenderChecker allowlist: only gnome-settings-daemon + the GNOME portal pass).
Code running INSIDE gnome-shell (an extension) is not a D-Bus sender, so it can call
GNOME's own in-process SelectArea overlay -- which DOES span all monitors -- directly.
That is the entire reason this must be an extension.

## What it is
UUID areashot@ryanlawler. Two files here: metadata.json + extension.js. It exposes a
D-Bus method org.gnome.Shell.Extensions.AreaShot.Grab; the Print key is bound to poke it.
Grab() freezes the stage (Shell.Screenshot.screenshot_stage_to_content), shows GNOME's
SelectArea overlay, and on release composites the region and does its OWN save + clipboard
(St.Clipboard.set_content 'image/png') so GNOME's notification/sound never fire.
Verified against GNOME Shell 50.1 js/ui/screenshot.js.

## Install (per GNOME/Wayland box)
    # 1. copy into place (rename this dir to the UUID)
    mkdir -p ~/.local/share/gnome-shell/extensions
    cp -r areashot-gnome-extension ~/.local/share/gnome-shell/extensions/areashot@ryanlawler
    # (drop the README there or not; only metadata.json + extension.js matter)

    # 2. add to the enabled list. `gnome-extensions enable` only works AFTER a login
    #    (GNOME scans new extensions at login), so append the UUID directly:
    #    take `gsettings get org.gnome.shell enabled-extensions`, add 'areashot@ryanlawler',
    #    then `gsettings set org.gnome.shell enabled-extensions "[...]"`.

    # 3. bind Print to it (session D-Bus env needed over ssh):
    export XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
    S="org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/flameshot/"
    gsettings set "$S" command 'gdbus call --session -d org.gnome.Shell.Extensions.AreaShot -o /org/gnome/Shell/Extensions/AreaShot -m org.gnome.Shell.Extensions.AreaShot.Grab'
    gsettings set "$S" binding 'Print'

    # 4. LOG OUT AND BACK IN. Mandatory on Wayland to load a new extension; a lock/unlock
    #    is not enough. recpc: do this on its next reboot (do not restart the session while
    #    OBS is streaming).

## Notes
- Maintenance: extensions are tied to GNOME internals. A major GNOME version bump can
  break it -- update shell-version in metadata.json and re-verify the screenshot.js API
  (SelectArea, screenshot_stage_to_content, composite_to_stream, St.Clipboard.set_content).
- Flameshot is left installed on the boxes as a dormant fallback; Print is repointed here.
- The capture flash is off because GNOME animations are disabled
  (enable-animations=false) -- see linux-flameshot-screenshots.md.

## Update (2026-07-27): GNOME animations stay ON
The AreaShot extension does its OWN capture and never calls GNOME's screenshot flash,
so it needs NO animations change -- verified flash-free with animations ON. GNOME
animations were re-enabled (enable-animations=true) on both boxes. The
enable-animations=false trick was only ever needed for the earlier Flameshot / built-in
GNOME-portal capture path, which is no longer used.
