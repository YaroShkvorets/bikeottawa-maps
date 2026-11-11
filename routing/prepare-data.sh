#!/usr/bin/env bash
# Gathers what the router image is built from, into routing/data:
#   region.osm.pbf   OSM data for the routing area in region.json
#   elevation/*.hgt  1-arcsecond elevation tiles covering the same area
# Needs: node, curl, and what pipeline/update-osm.sh needs.
set -euo pipefail
cd "$(dirname "$0")/.."

REGION="${OSM_DIR:-.cache/osm}/region.osm.pbf"
OUT=routing/data
mkdir -p "$OUT/elevation"

# The tiles build normally brings the data up to date first; do it here if not.
[ -f "$REGION" ] || pipeline/update-osm.sh
cp "$REGION" "$OUT/region.osm.pbf"

# One tile per degree cell, named after its south-west corner, e.g. N45W076.
for tile in $(node -p "
  const [w,s,e,n]=require('./region.json').routingBbox;
  const out=[];
  for (let lat=Math.floor(s); lat<=Math.floor(n); lat++)
    for (let lon=Math.floor(w); lon<=Math.floor(e); lon++)
      out.push((lat<0?'S':'N')+String(Math.abs(lat)).padStart(2,'0')+(lon<0?'W':'E')+String(Math.abs(lon)).padStart(3,'0'));
  out.join(' ')"); do
  if [ ! -f "$OUT/elevation/$tile.hgt" ]; then
    echo "Downloading elevation tile $tile"
    curl -fsSL --retry 3 "https://s3.amazonaws.com/elevation-tiles-prod/skadi/${tile:0:3}/$tile.hgt.gz" | gunzip > "$OUT/elevation/$tile.hgt"
  fi
done
ls -lh "$OUT/region.osm.pbf"
ls "$OUT/elevation" | tr '\n' ' '
echo
