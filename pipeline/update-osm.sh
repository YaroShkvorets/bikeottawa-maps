#!/usr/bin/env bash
# Keeps .cache/osm/region.osm.pbf current: all OSM data for the routing area in
# region.json, which the map tiles and the router are both built from.
#
# The first run cuts the area out of the Geofabrik extracts. Later runs only
# fetch OpenStreetMap's hourly change files and apply them, so the data is at
# most an hour or so old and a run downloads megabytes, not gigabytes.
# Needs: osmium, pyosmium-up-to-date (pipx install osmium), node, curl.
set -euo pipefail
cd "$(dirname "$0")/.."

OSM="${OSM_DIR:-.cache/osm}"
REGION="$OSM/region.osm.pbf"
mkdir -p "$OSM"

region() { node -p "const r=require('./region.json'); $1"; }
BBOX="$(region "r.routingBbox.join(',')")"
REPLICATION_URL="$(region "r.replicationUrl")"
COUNT="$(region "r.extracts.length")"

timestamp_of() { osmium fileinfo -g header.option.osmosis_replication_timestamp "$1" 2>/dev/null || true; }

if [ ! -f "$REGION" ]; then
  echo "No region file yet: cutting it out of the full extracts"
  parts=()
  stamps=()
  for i in $(seq 0 $((COUNT - 1))); do
    url="$(region "r.extracts[$i].pbf")"
    src="$OSM/$(basename "$url")"
    [ -f "$src" ] || { echo "Downloading $url"; curl -fsSL --retry 3 -o "$src" "$url"; }
    osmium extract --bbox "$BBOX" "$src" --overwrite -o "$OSM/part-$i.osm.pbf"
    parts+=("$OSM/part-$i.osm.pbf")
    stamps+=("$(timestamp_of "$src")")
  done
  # Updates start from the oldest of the extracts, so nothing is skipped.
  oldest="$(printf '%s\n' "${stamps[@]}" | grep . | sort | head -1)"
  osmium merge "${parts[@]}" --overwrite -o "$REGION" --output-header="osmosis_replication_timestamp=$oldest"
  rm -f "${parts[@]}"
fi

echo "Applying changes since $(timestamp_of "$REGION")"
# Exit code 1 means "applied some, more to come" (the tool caps how much it takes at once).
status=1
while [ "$status" -eq 1 ]; do
  status=0
  pyosmium-up-to-date --server "$REPLICATION_URL" --ignore-osmosis-headers \
    -o "$OSM/updated.osm.pbf" "$REGION" || status=$?
  [ "$status" -le 1 ] || { echo "Update failed (exit $status)" >&2; exit "$status"; }
  [ -f "$OSM/updated.osm.pbf" ] || break
  stamp="$(timestamp_of "$OSM/updated.osm.pbf")"

  # The change files cover the whole world, so cut back to the area: first the
  # box, then each extract's boundary (which keeps out the US side of the box).
  osmium extract --bbox "$BBOX" "$OSM/updated.osm.pbf" --overwrite -o "$OSM/box.osm.pbf"
  parts=()
  for i in $(seq 0 $((COUNT - 1))); do
    url="$(region "r.extracts[$i].poly")"
    poly="$OSM/$(basename "$url")"
    [ -f "$poly" ] || curl -fsSL --retry 3 -o "$poly" "$url"
    osmium extract --polygon "$poly" "$OSM/box.osm.pbf" --overwrite -o "$OSM/part-$i.osm.pbf"
    parts+=("$OSM/part-$i.osm.pbf")
  done
  osmium merge "${parts[@]}" --overwrite -o "$REGION" --output-header="osmosis_replication_timestamp=$stamp"
  rm -f "${parts[@]}" "$OSM/box.osm.pbf" "$OSM/updated.osm.pbf"
done

echo "Region data is current to $(timestamp_of "$REGION")"
ls -lh "$REGION"
