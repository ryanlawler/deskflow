import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {SelectArea} from 'resource:///org/gnome/shell/ui/screenshot.js';

const BUS_NAME = 'org.gnome.Shell.Extensions.AreaShot';
const OBJECT_PATH = '/org/gnome/Shell/Extensions/AreaShot';

const DBUS_INTERFACE_XML = `
<node>
  <interface name="org.gnome.Shell.Extensions.AreaShot">
    <method name="Grab"/>
  </interface>
</node>`;

const DBUS_INTERFACE =
    Gio.DBusInterfaceInfo.new_for_xml(DBUS_INTERFACE_XML);

function _storeScreenshot(bytes) {
    // Match GNOME Shell's ordering so a disk error does not prevent copying.
    const clipboard = St.Clipboard.get_default();
    clipboard.set_content(
        St.ClipboardType.CLIPBOARD, 'image/png', bytes);

    const directory = Gio.File.new_for_path(GLib.build_filenamev([
        GLib.get_home_dir(),
        'Pictures',
        'Screenshots',
    ]));

    try {
        directory.make_directory_with_parents(null);
    } catch (error) {
        if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
            throw error;
    }

    const timestamp =
        GLib.DateTime.new_now_local().format('%Y-%m-%d %H-%M-%S');
    const basename = `Screenshot From ${timestamp}`;

    for (let index = 0; ; index++) {
        const suffix = index === 0 ? '' : `-${index}`;
        const file = Gio.File.new_for_path(GLib.build_filenamev([
            directory.get_path(),
            `${basename}${suffix}.png`,
        ]));

        let fileStream;
        try {
            fileStream = file.create(Gio.FileCreateFlags.NONE, null);
        } catch (error) {
            if (error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
                continue;
            throw error;
        }

        try {
            fileStream.write_bytes(bytes, null);
        } finally {
            fileStream.close(null);
        }

        return file;
    }
}

async function _captureAndStore(texture, geometry, scale) {
    const stream = Gio.MemoryOutputStream.new_resizable();
    const scaledGeometry = [
        geometry.x * scale,
        geometry.y * scale,
        geometry.width * scale,
        geometry.height * scale,
    ];

    try {
        await Shell.Screenshot.composite_to_stream(
            texture,
            ...scaledGeometry,
            scale,
            null, 0, 0, 1,
            stream
        );
        stream.close(null);
    } catch (error) {
        try {
            stream.close(null);
        } catch {
            // Preserve the capture error.
        }
        throw error;
    }

    return _storeScreenshot(stream.steal_as_bytes());
}

export default class AreaShotExtension extends Extension {
    enable() {
        this._enabled = true;
        this._grabInProgress = false;

        this._dbusObject =
            Gio.DBusExportedObject.wrapJSObject(DBUS_INTERFACE, this);
        this._dbusObject.export(Gio.DBus.session, OBJECT_PATH);

        this._nameOwnerId = Gio.bus_own_name_on_connection(
            Gio.DBus.session,
            BUS_NAME,
            Gio.BusNameOwnerFlags.NONE,
            null,
            null
        );
    }

    disable() {
        this._enabled = false;

        this._dbusObject?.unexport();
        this._dbusObject = null;

        if (this._nameOwnerId) {
            Gio.bus_unown_name(this._nameOwnerId);
            this._nameOwnerId = 0;
        }
    }

    Grab() {
        if (!this._enabled || this._grabInProgress)
            return;

        this._grabInProgress = true;
        this._grabAsync()
            .catch(error => {
                logError(error, `[${this.uuid}] Area screenshot failed`);
            })
            .finally(() => {
                this._grabInProgress = false;
            });
    }

    async _grabAsync() {
        // Freeze the stage before SelectArea adds its rubber-band overlay.
        const shooter = new Shell.Screenshot();
        const [content, scale] =
            await shooter.screenshot_stage_to_content();
        const texture = content.get_texture();

        if (!this._enabled)
            return;

        const selector = new SelectArea();
        const geometry = await selector.selectAsync();

        // Escape resolves the selection with null.
        if (geometry === null || !this._enabled)
            return;

        await _captureAndStore(texture, geometry, scale);
    }
}
