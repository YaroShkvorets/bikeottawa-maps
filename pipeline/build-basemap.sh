#!/usr/bin/env bash
# Builds web/public/tiles/basemap.pmtiles (Protomaps extract of the region in region.json)
# and copies the fonts and icons the basemap style needs into web/public/basemap-assets.
# Needs: pmtiles, git, node, curl.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=web/public/tiles
ASSETS=web/public/basemap-assets
WORK="${WORK_DIR:-.cache/pipeline}"
mkdir -p "$OUT" "$WORK"

BBOX="$(node -p "require('./region.json').bbox.join(',')")"
BUILD="${PROTOMAPS_BUILD:-$(curl -fsSL https://build-metadata.protomaps.dev/builds.json | node -p "JSON.parse(require('fs').readFileSync(0)).at(-1).key")}"

echo "Extracting $BBOX from Protomaps build $BUILD"
pmtiles extract "https://build.protomaps.com/$BUILD" "$OUT/basemap.pmtiles" --bbox="$BBOX" --maxzoom=15

if [ ! -d "$WORK/basemaps-assets" ]; then
  git clone --quiet --depth 1 --filter=blob:none --sparse https://github.com/protomaps/basemaps-assets "$WORK/basemaps-assets"
  git -C "$WORK/basemaps-assets" sparse-checkout set --no-cone \
    "/fonts/Noto Sans Regular/" "/fonts/Noto Sans Medium/" "/fonts/Noto Sans Italic/" "/sprites/v4/light*"
fi
rm -rf "$ASSETS"
mkdir -p "$ASSETS/sprites/v4"
cp -R "$WORK/basemaps-assets/fonts" "$ASSETS/fonts"
cp "$WORK/basemaps-assets"/sprites/v4/light* "$ASSETS/sprites/v4/"
ls -lh "$OUT/basemap.pmtiles"
du -sh "$ASSETS"
