#!/usr/bin/env bash
# Builds web/public/tiles/overlays.pmtiles (ways + places) from OSM extracts.
# Needs: osmium, tippecanoe, node. Extracts and bbox come from region.json;
# set OSM_PBF_URLS (space-separated) to use other extracts.
set -euo pipefail
cd "$(dirname "$0")/.."

URLS="${OSM_PBF_URLS:-$(node -p "require('./region.json').osmPbfUrls.join(' ')")}"
BBOX="$(node -p "require('./region.json').bbox.join(',')")"
WORK="${WORK_DIR:-.cache/pipeline}"
OUT=web/public/tiles
mkdir -p "$WORK" "$OUT"

parts=()
timestamps=()
for url in $URLS; do
  src="$WORK/$(basename "$url")"
  echo "Downloading $url"
  # Re-download only when the server has a newer file than the cached one.
  if [ -f "$src" ]; then
    curl -fsSL --retry 3 -z "$src" -o "$src" "$url"
  else
    curl -fsSL --retry 3 -o "$src" "$url"
  fi
  echo "Filtering $(basename "$src")"
  osmium tags-filter "$src" \
    w/highway \
    nw/amenity=bicycle_parking,bicycle_repair_station,drinking_water,toilets \
    nw/shop=bicycle \
    --overwrite -o "$src.filtered.osm.pbf"
  osmium extract --bbox "$BBOX" "$src.filtered.osm.pbf" --overwrite -o "$src.clipped.osm.pbf"
  parts+=("$src.clipped.osm.pbf")
  timestamps+=("$(osmium fileinfo -g header.option.osmosis_replication_timestamp "$src" 2>/dev/null || true)")
done

osmium merge "${parts[@]}" --overwrite -o "$WORK/filtered.osm.pbf"
osmium export "$WORK/filtered.osm.pbf" --add-unique-id=type_id -f geojsonseq -x print_record_separator=false \
  --overwrite -o "$WORK/filtered.geojsonseq"

node pipeline/transform.mjs "$WORK/filtered.geojsonseq" "$WORK"

echo "Building tiles"
tippecanoe --force --quiet -o "$OUT/overlays.pmtiles" \
  -Z9 -z14 -r1 --read-parallel \
  --drop-densest-as-needed --extend-zooms-if-still-dropping \
  --name "Bike Ottawa overlays" --attribution "© OpenStreetMap contributors" \
  -L "ways:$WORK/ways.geojsonseq" -L "places:$WORK/places.geojsonseq"

# Date of the OSM data: the oldest extract's replication timestamp, or failing
# that the newest edit among the features kept.
OSM_TIMESTAMP="$(printf '%s\n' "${timestamps[@]}" | grep . | sort | head -1 || true)"
if [ -z "$OSM_TIMESTAMP" ]; then
  OSM_TIMESTAMP="$(osmium fileinfo -e -g data.timestamp.last "$WORK/filtered.osm.pbf")"
fi
printf '{"osmTimestamp":"%s","builtAt":"%s"}\n' "$OSM_TIMESTAMP" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$OUT/meta.json"
ls -lh "$OUT/overlays.pmtiles"
cat "$OUT/meta.json"
