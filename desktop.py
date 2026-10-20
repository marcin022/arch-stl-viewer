#!/usr/bin/env python3
"""Linux desktop window for the STL viewer."""

import os
import pathlib
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

# WebKitGTK 2.52.x can disconnect from KWin Wayland during its first GPU paint
# on NVIDIA. Keep this workaround scoped to this launcher and its child process.
if (os.environ.get("WAYLAND_DISPLAY") and pathlib.Path("/proc/driver/nvidia/version").exists()):
    os.environ.setdefault("__NV_DISABLE_EXPLICIT_SYNC", "1")

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.1")
gi.require_version("GLibUnix", "2.0")
from gi.repository import GLib, GLibUnix, Gtk, WebKit2  # noqa: E402


BASE = pathlib.Path(__file__).resolve().parent


def free_port():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def server_command(port, arguments):
    options = ["--no-browser", "--port", str(port), "--parent-pid", str(os.getpid()), *arguments]
    published = BASE / "StlViewer"
    if published.is_file() and os.access(published, os.X_OK):
        return [str(published), *options]
    assembly = BASE / "StlViewer.dll"
    if assembly.is_file():
        return ["dotnet", str(assembly), *options]
    project = BASE / "StlViewer" / "StlViewer.csproj"
    if project.is_file():
        built = subprocess.run(["dotnet", "build", str(project), "--nologo"], cwd=BASE,
                               capture_output=True, text=True)
        if built.returncode != 0:
            raise RuntimeError("Could not build the .NET service:\n" + built.stdout + built.stderr)
        assembly = BASE / "StlViewer" / "bin" / "Debug" / "net10.0" / "StlViewer.dll"
        return ["dotnet", str(assembly), *options]
    raise FileNotFoundError("StlViewer executable or project not found.")


class Desktop:
    def __init__(self, arguments):
        self.process = None
        port = free_port()
        self.origin = f"http://127.0.0.1:{port}"
        self.window = Gtk.Window(title="STL Viewer")
        self.window.set_default_size(1280, 800)
        self.window.set_size_request(760, 520)
        self.window.connect("destroy", self.close)
        self.stack = Gtk.Stack()
        status = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16)
        status.set_halign(Gtk.Align.CENTER)
        status.set_valign(Gtk.Align.CENTER)
        self.status_label = Gtk.Label(label="Starting STL Viewer…")
        self.status_label.set_line_wrap(True)
        self.status_label.set_max_width_chars(70)
        status.pack_start(self.status_label, False, False, 0)
        retry = Gtk.Button(label="Try again")
        retry.connect("clicked", self.retry_load)
        status.pack_start(retry, False, False, 0)
        self.stack.add_named(status, "status")
        self.view = WebKit2.WebView()
        self.view.get_settings().set_enable_webgl(True)
        self.view.get_settings().set_enable_developer_extras(False)
        self.view.connect("decide-policy", self.navigation_policy)
        self.view.connect("load-failed", self.load_failed)
        self.view.connect("load-changed", self.load_changed)
        self.view.connect("web-process-terminated", self.web_process_terminated)
        self.stack.add_named(self.view, "viewer")
        self.stack.set_visible_child_name("status")
        self.window.add(self.stack)
        self.window.show_all()
        self.window.present()
        if self.window.get_window() is None:
            raise RuntimeError("GTK could not create the application window.")
        try:
            self.process = subprocess.Popen(server_command(port, arguments), cwd=BASE)
        except Exception as error:
            self.show_error(f"Could not start the .NET service: {error}")
            return
        self.started = time.monotonic()
        print(f"STL Viewer: application window opened; service address: {self.origin}", flush=True)
        GLib.timeout_add(100, self.wait_for_server)

    def wait_for_server(self):
        if self.process.poll() is not None:
            self.show_error("The STL Viewer service stopped during startup.")
            return False
        try:
            with urllib.request.urlopen(self.origin + "/api/state", timeout=0.2) as response:
                if response.status == 200:
                    self.retry_load()
                    self.window.present()
                    return False
        except (OSError, urllib.error.URLError):
            pass
        if time.monotonic() - self.started > 30:
            self.show_error("STL Viewer did not start within 30 seconds.")
            return False
        return True

    def navigation_policy(self, view, decision, decision_type):
        if decision_type == WebKit2.PolicyDecisionType.NAVIGATION_ACTION:
            uri = decision.get_navigation_action().get_request().get_uri()
            if uri.startswith((self.origin + "/", "about:")) or uri == self.origin:
                return False
            decision.ignore()
            return True
        return False

    def load_failed(self, view, event, uri, error):
        if uri.startswith(self.origin):
            self.show_error("Could not load the interface: " + error.message)
        return True

    def load_changed(self, view, event):
        if event == WebKit2.LoadEvent.FINISHED and not self.load_error:
            self.stack.set_visible_child_name("viewer")
            print("STL Viewer: interface loaded in the application window.", flush=True)

    def web_process_terminated(self, view, reason):
        self.show_error(f"The WebKit process stopped ({reason.value_nick}).")

    def retry_load(self, *_):
        if self.process is None or self.process.poll() is not None:
            self.show_error("The .NET service is not running. Close and restart the application.")
            return
        self.load_error = False
        self.status_label.set_text("Loading interface…")
        self.stack.set_visible_child_name("viewer")
        self.view.load_uri(self.origin)

    def show_error(self, message):
        self.load_error = True
        self.status_label.set_text(message)
        self.stack.set_visible_child_name("status")
        print("STL Viewer: " + message, file=sys.stderr, flush=True)

    def close(self, *_):
        if self.process is not None and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
        Gtk.main_quit()


def main():
    if sys.platform != "linux":
        raise SystemExit("This desktop launcher is for Linux.")
    if not Gtk.init_check([])[0]:
        raise SystemExit("Cannot connect to a GTK graphical desktop. Run ./uruchom.sh in a terminal in your KDE session.")
    try:
        desktop = Desktop(sys.argv[1:])
    except Exception as error:
        raise SystemExit(f"Could not open the STL Viewer window: {error}") from error
    GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, signal.SIGINT,
                        lambda: desktop.window.destroy() or GLib.SOURCE_REMOVE)
    GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, signal.SIGTERM,
                        lambda: desktop.window.destroy() or GLib.SOURCE_REMOVE)
    Gtk.main()


if __name__ == "__main__":
    main()
