# Linux screenshots: Flameshot (the ShareX of Linux), macOS-style one-shot

Set up on recpc + gamepc-Linux so screenshots on the Linux boxes save timestamped
files (no name collisions) AND copy to the clipboard, in one drag — like macOS
Cmd+Shift+4. Reproducible for any new GNOME/Wayland Linux box on the fleet.

## Behavior
Press Print -> drag a box -> release. Done: the region is copied to the clipboard
AND saved as a timestamped PNG in ~/Pictures/Screenshots. No toolbar, no Enter, no
notification, no screenshot flash.

## Install
    sudo apt-get install -y flameshot     # v13.3+ for solid GNOME Wayland support

## Config  (~/.config/flameshot/flameshot.ini)
    [General]
    savePath=/home/ryanlawler/Pictures/Screenshots
    savePathFixed=true           # never prompt for a save path
    saveAfterCopy=true           # save automatically right after the copy
    saveAsFileExtension=.png
    showStartupLaunchMessage=false
    showDesktopNotification=false    # no "capture saved to clipboard" popup
    disabledTrayIcon=true
    showHelp=false

## Hotkey  (GNOME custom shortcut via gsettings; export the session D-Bus env first:
##   export XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus )
    # free Print from GNOME's own screenshot UI
    gsettings set org.gnome.shell.keybindings show-screenshot-ui "[]"
    # bind Print -> flameshot with accept-on-select (-s) + clipboard (-c)
    P=/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/flameshot/
    gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings "['$P']"
    S="org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$P"
    gsettings set "$S" name "Flameshot"
    gsettings set "$S" command "flameshot gui -s -c"
    gsettings set "$S" binding "Print"

`-s` (accept-on-select) is the macOS one-shot magic: it accepts the moment you release
the drag, so no toolbar/editor appears. `-c` copies; saveAfterCopy (config) saves.

## Autostart the daemon  (~/.config/autostart/flameshot.desktop)
    [Desktop Entry]
    Type=Application
    Name=Flameshot
    Exec=flameshot
    X-GNOME-Autostart-enabled=true

## Removing the screenshot flash
On GNOME Wayland, Flameshot must grab the screen through GNOME's screenshot system,
which plays a white "flash" as feedback. There is NO per-app or dedicated toggle for
just the flash. It was removed by turning off GNOME animations globally (this also
removes window/workspace/overview animations; the desktop just feels snappier):
    gsettings set org.gnome.desktop.interface enable-animations false
Revert with `true`.

## Notes
- All of this persists across reboots (dconf settings + config files + autostart entry).
- Linux equivalent of ShareX on the Windows side of the same fleet.
- Because the shot lands in the clipboard, it also pastes cross-machine over the Deskflow
  KVM clipboard (subject to the receiving box's clipboard size cap).

---
## SUPERSEDED for multi-monitor (2026-07-27)
Flameshot CANNOT draw one selection across both monitors on GNOME Wayland (Wayland has no
union-of-outputs surface; GNOME blocks external tools from the shell capture path; even
Flameshot v14 is one-monitor-at-a-time). Replaced by the **AreaShot GNOME Shell extension**
(see areashot-gnome-extension/), which uses GNOME's own in-process cross-monitor selector.
This Flameshot config still works for a single-monitor box, but the fleet now uses AreaShot.
