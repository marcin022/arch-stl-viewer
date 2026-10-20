#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/../.." && pwd)"
version="$(sed -n 's/^pkgver=//p' "$project_dir/packaging/arch/PKGBUILD")"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
source_dir="$work_dir/arch-stl-viewer-$version"
mkdir -p "$source_dir/packaging"
cp "$project_dir/desktop.py" "$project_dir/README.md" "$project_dir/README.pl.md" "$project_dir/LICENSE" "$source_dir/"
cp -a "$project_dir/StlViewer" "$source_dir/"
rm -rf "$source_dir/StlViewer/bin" "$source_dir/StlViewer/obj"
cp -a "$project_dir/packaging/arch" "$source_dir/packaging/"
tar -C "$work_dir" -czf "$work_dir/stl-viewer-$version.tar.gz" "arch-stl-viewer-$version"
cp "$project_dir/packaging/arch/PKGBUILD" "$work_dir/"
checksum="$(sha256sum "$work_dir/stl-viewer-$version.tar.gz" | cut -d ' ' -f 1)"
sed -i "s/sha256sums=('SKIP')/sha256sums=('$checksum')/" "$work_dir/PKGBUILD"
(cd "$work_dir" && makepkg --noconfirm --cleanbuild)
mkdir -p "$project_dir/dist"
cp "$work_dir"/*.pkg.tar.zst "$project_dir/dist/"
printf 'Pakiet: %s\n' "$project_dir/dist/stl-viewer-$version-1-x86_64.pkg.tar.zst"
