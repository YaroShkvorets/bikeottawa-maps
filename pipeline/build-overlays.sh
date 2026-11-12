#!/usr/bin/env bash
# Builds web/public/tiles/overlays.pmtiles (streets), places.pmtiles, night.pmtiles
# (lit ways + street lamps), routes.pmtiles and routes.json (signed bike routes) and
# places/<kind>.json (where each kind of place is) for the map area in region.json,
# from OSM data brought up to date by pipeline/update-osm.sh.
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
osmium tags-filter "$REGION" w/highway n/highway=street_lamp $PLACE_FILTERS --overwrite -o "$WORK/tagged.osm.pbf"
osmium extract --bbox "$BBOX" "$WORK/tagged.osm.pbf" --overwrite -o "$WORK/filtered.osm.pbf"
osmium export "$WORK/filtered.osm.pbf" --add-unique-id=type_id -f geojsonseq -x print_record_separator=false \
  --overwrite -o "$WORK/filtered.geojsonseq"

# Train and light rail routes, and the stop areas that tie them to stations.
osmium tags-filter "$REGION" r/route=train,light_rail,subway,tram r/public_transport=stop_area -R \
  --overwrite -o "$WORK/transit.osm.pbf"
osmium cat "$WORK/transit.osm.pbf" -f opl --overwrite -o "$WORK/transit.opl"

# Signed bike and mountain-bike routes, and the routes they are part of.
osmium tags-filter "$REGION" r/route=bicycle,mtb -R --overwrite -o "$WORK/routes.osm.pbf"
osmium cat "$WORK/routes.osm.pbf" -f opl --overwrite -o "$WORK/routes.opl"

node pipeline/transform.mjs "$WORK/filtered.geojsonseq" "$WORK" "$WORK/transit.opl" "$WORK/routes.opl"
cp "$WORK/routes.json" "$OUT/routes.json"
# Where each kind of place is, for counting the places within reach.
node pipeline/place-points.mjs "$WORK/places.geojsonseq" "$OUT/places"

echo "Building tiles"
# Streets and places in files of their own, so each loads only for its layer.
tippecanoe --force --quiet -o "$OUT/overlays.pmtiles" \
  -Z9 -z14 -r1 --read-parallel \
  --drop-densest-as-needed --extend-zooms-if-still-dropping \
  --name "Bike Ottawa streets" --attribution "© OpenStreetMap contributors" \
  -L "ways:$WORK/ways.geojsonseq"

# Each place kind has its own zoom to appear from, so nothing needs dropping.
tippecanoe --force --quiet -o "$OUT/places.pmtiles" \
  -Z9 -z14 -r1 --read-parallel --no-feature-limit --no-tile-size-limit \
  --name "Bike Ottawa places" --attribution "© OpenStreetMap contributors" \
  -L "places:$WORK/places.geojsonseq"

# Signed bike routes, for the routes overlay: few enough to keep every one.
tippecanoe --force --quiet -o "$OUT/routes.pmtiles" \
  -Z9 -z14 -r1 --read-parallel --no-feature-limit --no-tile-size-limit \
  --name "Bike Ottawa routes" --attribution "© OpenStreetMap contributors" \
  -L "routes:$WORK/routes.geojsonseq"

# The night layer, in a file of its own so it only loads when that layer is on:
# every lit way from zoom 9, and the street lamps themselves from zoom 12.
tippecanoe --force --quiet -o "$OUT/night.pmtiles" \
  -Z9 -z14 -r1 --read-parallel --coalesce --reorder --no-tile-size-limit \
  --name "Bike Ottawa night" --attribution "© OpenStreetMap contributors" \
  -L "streets:$WORK/lit.geojsonseq" -L "lamps:$WORK/lamps.geojsonseq"

# Date of the OSM data: how far the change files have been applied.
OSM_TIMESTAMP="$(osmium fileinfo -g header.option.osmosis_replication_timestamp "$REGION")"
printf '{"osmTimestamp":"%s","builtAt":"%s"}\n' "$OSM_TIMESTAMP" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$OUT/meta.json"
ls -lh "$OUT/overlays.pmtiles" "$OUT/places.pmtiles" "$OUT/night.pmtiles" "$OUT/routes.pmtiles"
cat "$OUT/meta.json"
