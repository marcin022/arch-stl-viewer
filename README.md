# STL Viewer

[Polski / Polish](README.pl.md)

A local desktop application for browsing STL models. It shows a folder tree or thumbnail grid on the left and an interactive 3D preview, dimensions, and triangle count on the right. Binary and ASCII STL files are supported. On Linux it opens a GTK window with embedded WebKit; no separate browser window is needed. The interface uses HTML and WebGL, while a local .NET service starts and stops with the desktop window.

The project is licensed under [GNU GPL 3.0](LICENSE), version 3 only (`GPL-3.0-only`).

## Language

English is the default. Click the flag in the top bar to switch between English and Polish. The choice is saved on this computer. The flag shows the current language: 🇬🇧 for English and 🇵🇱 for Polish.

## Run from source

On Linux, running from source requires the .NET 10 SDK, Python 3 with PyGObject, GTK 3, and WebKitGTK 4.1. On Arch Linux, the desktop dependencies are `python-gobject`, `gtk3`, and `webkit2gtk-4.1`. Folder selection uses `zenity` or `kdialog`, and Trash uses `gio`. The application does not download NuGet packages.

```bash
git clone https://github.com/marcin022/arch-stl-viewer.git
cd arch-stl-viewer
./uruchom.sh
```

The Linux launcher opens the **STL Viewer** window and starts its local service on a random free localhost port. Close the window or press Ctrl+C in the terminal to stop both. The current Windows package opens the interface in a browser; the desktop launcher is for Linux.

On KDE/Wayland with NVIDIA, the launcher sets `__NV_DISABLE_EXPLICIT_SYNC=1` for itself and the service to avoid a WebKitGTK protocol error. It does not change system or driver settings. If the window still closes unexpectedly, start the script in a terminal and keep the last lines of output.

To select a library on launch:

```bash
./uruchom.sh --library /full/path/to/models
```

You can also choose a folder inside the app. If the system folder picker is unavailable, enter the full path in the dialog.

## Use

- Click a folder in the list to expand it, then click an STL file to preview it.
- Use the buttons above the left panel to switch between list and grid. The grid shows model thumbnails, and folder cards show up to four randomly selected models from that folder and its subfolders. Click a folder to enter it; use the arrow above the grid to go back. Thumbnails load as you scroll.
- Right-click a file or folder in either view to rename, copy, cut, paste, or move it to Trash. Paste onto a folder to place the item there, or onto empty space to place it in the current folder. The in-app clipboard works within the chosen library. Copies receive a numbered name if necessary.
- Drag a model to rotate it. Use the mouse wheel or `+` and `−` buttons to zoom.
- **Rename** preserves the `.stl` extension for files, rejects invalid names, and does not overwrite existing files.
- **Copy** in the preview toolbar opens a destination folder picker. Existing files are kept; the copy receives a numbered name.
- **To Trash** asks for confirmation and uses the system Trash. After removing the selected model, the preview moves to the next visible STL file, or the previous one if it was last, while preserving the list's expanded folders and scroll position.
- The slicer list detects OrcaSlicer, Cura, Anycubic Slicer, PrusaSlicer, and Bambu Studio in `PATH`. Use `+` to add another executable or AppImage. The selected STL path is passed to the slicer as an argument.

Settings are stored in the user's application data directory (typically `~/.config/stl-viewer` on Linux and `%APPDATA%\stl-viewer` on Windows), or in the directory set by `STLV_CONFIG_DIR`.

## Distribution packages

### Arch Linux

Build a local Arch package with `./packaging/arch/build-local.sh`. The file `stl-viewer-0.1.0-1-x86_64.pkg.tar.zst` will appear in `dist/`. The package installs the `stl-viewer` command and an application menu entry. It uses system .NET, Python, GTK, and WebKitGTK packages.

Install the local package with `sudo pacman -U dist/stl-viewer-0.1.0-1-x86_64.pkg.tar.zst`. Then launch **STL Viewer** from the application menu or run `stl-viewer` in a terminal. `uruchom.sh` runs the source checkout without installation.

The [PKGBUILD](packaging/arch/PKGBUILD) points to `marcin022/arch-stl-viewer` and the future `v0.1.0` tag. Before submitting to AUR, publish that tag, replace `SKIP` with the SHA-256 checksum of the GitHub source archive, and generate `.SRCINFO`.

### Linux and Windows archives

[package.yml](.github/workflows/package.yml) builds `STL-Viewer-linux-x64.tar.gz` and `STL-Viewer-win-x64.zip`. Each includes the app and .NET 10 runtime. The Linux archive also includes the desktop launcher; the recipient still needs Python 3, PyGObject, GTK 3, and WebKitGTK 4.1. Folder selection requires `zenity` or `kdialog`, and Trash requires `gio`. The Windows archive still requires a browser.

In the GitHub repository, go to **Actions → Paczki Linux i Windows → Run workflow**. Archives appear as artifacts after the workflow completes. It also runs when a tag beginning with `v` is pushed. It does not automatically publish a release.

On Windows, extract the ZIP and start `StlViewer.exe`. On Linux, extract the tarball and run `./uruchom.sh`. Keep the complete archive, including `wwwroot`; the executable alone does not contain the interface.

The WebGL preview displays all STL triangles with depth testing. Large models can take more GPU memory and loading time. Dimensions and triangle count apply to the entire file; the preview does not validate the mesh or prepare it for printing.
