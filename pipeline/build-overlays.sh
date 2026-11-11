#!/usr/bin/env bash
# Builds web/public/tiles/overlays.pmtiles (ways + places) for the map area in
# region.json, from OSM data brought up to date by pipeline/update-osm.sh.
# Needs: osmium, tippecanoe, node, and what update-osm.sh needs.
set -euo pipefail
cd "$(dirname "$0")/.."

pipeline/update-osm.sh

REGION="${OSM_DIR:-.cache/osm}/region.osm.pbf"
BBOX="$(node -p "require('./region.json').bbox.join(',')")"
WORK="${WORK_DIR:-.cache/pipeline}"
OUT=web/public/tiles
mkdir -p "$WORK" "$OUT"
# Which places to keep is defined once, in classify.mjs.
PLACE_FILTERS="$(node -e "import('./pipeline/classify.mjs').then((m) => console.log(m.placeFilters().join(' ')))")"

echo "Filtering and exporting"
# shellcheck disable=SC2086 # one filter expression per word
osmium tags-filter "$REGION" w/highway $PLACE_FILTERS --overwrite -o "$WORK/tagged.osm.pbf"
osmium extract --bbox "$BBOX" "$WORK/tagged.osm.pbf" --overwrite -o "$WORK/filtered.osm.pbf"
osmium export "$WORK/filtered.osm.pbf" --add-unique-id=type_id -f geojsonseq -x print_record_separator=false \
  --overwrite -o "$WORK/filtered.geojsonseq"

node pipeline/transform.mjs "$WORK/filtered.geojsonseq" "$WORK"

echo "Building tiles"
tippecanoe --force --quiet -o "$OUT/overlays.pmtiles" \
  -Z9 -z14 -r1 --read-parallel \
  --drop-densest-as-needed --extend-zooms-if-still-dropping \
  --name "Bike Ottawa overlays" --attribution "© OpenStreetMap contributors" \
  -L "ways:$WORK/ways.geojsonseq" -L "places:$WORK/places.geojsonseq"

# Date of the OSM data: how far the change files have been applied.
OSM_TIMESTAMP="$(osmium fileinfo -g header.option.osmosis_replication_timestamp "$REGION")"
printf '{"osmTimestamp":"%s","builtAt":"%s"}\n' "$OSM_TIMESTAMP" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$OUT/meta.json"
ls -lh "$OUT/overlays.pmtiles"
cat "$OUT/meta.json"
