#!/usr/bin/env bash
# Builds web/public/tiles/overlays.pmtiles (ways + places) from an OSM extract.
# Needs: osmium, tippecanoe, node. The extract comes from region.json (override with OSM_PBF_URL).
set -euo pipefail
cd "$(dirname "$0")/.."

OSM_PBF_URL="${OSM_PBF_URL:-$(node -p "require('./region.json').osmPbfUrl")}"
WORK="${WORK_DIR:-.cache/pipeline}"
OUT=web/public/tiles
mkdir -p "$WORK" "$OUT"

echo "Downloading $OSM_PBF_URL"
curl -fsSL --retry 3 -o "$WORK/extract.osm.pbf" "$OSM_PBF_URL"

echo "Filtering and exporting"
osmium tags-filter "$WORK/extract.osm.pbf" \
  w/highway \
  nw/amenity=bicycle_parking,bicycle_repair_station,drinking_water,toilets \
  nw/shop=bicycle \
  --overwrite -o "$WORK/filtered.osm.pbf"
osmium export "$WORK/filtered.osm.pbf" --add-unique-id=type_id -f geojsonseq -x print_record_separator=false \
  --overwrite -o "$WORK/filtered.geojsonseq"

node pipeline/transform.mjs "$WORK/filtered.geojsonseq" "$WORK"

echo "Building tiles"
tippecanoe --force --quiet -o "$OUT/overlays.pmtiles" \
  -Z9 -z14 -r1 --read-parallel \
  --drop-densest-as-needed --extend-zooms-if-still-dropping \
  --name "Bike Ottawa overlays" --attribution "© OpenStreetMap contributors" \
  -L "ways:$WORK/ways.geojsonseq" -L "places:$WORK/places.geojsonseq"

OSM_TIMESTAMP="$(osmium fileinfo -e -g data.timestamp.last "$WORK/extract.osm.pbf")"
printf '{"osmTimestamp":"%s","builtAt":"%s"}\n' "$OSM_TIMESTAMP" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$OUT/meta.json"
ls -lh "$OUT/overlays.pmtiles"
cat "$OUT/meta.json"
