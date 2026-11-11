#!/usr/bin/env bash
# Gathers what the router image is built from, into routing/data:
#   region.osm.pbf   OSM data cut out of the extracts in region.json
#   elevation/*.hgt  1-arcsecond elevation tiles covering the same area
# Reuses downloads made by pipeline/build-overlays.sh. Needs: osmium, node, curl.
set -euo pipefail
cd "$(dirname "$0")/.."

URLS="${OSM_PBF_URLS:-$(node -p "require('./region.json').osmPbfUrls.join(' ')")}"
# Wider than the map so routes near the edge are not cut short.
MARGIN=0.3
BBOX="$(node -p "const [w,s,e,n]=require('./region.json').bbox; const m=$MARGIN; [w-m,s-m,e+m,n+m].map(v=>v.toFixed(2)).join(',')")"
WORK="${WORK_DIR:-.cache/pipeline}"
OUT=routing/data
mkdir -p "$WORK" "$OUT/elevation"

parts=()
for url in $URLS; do
  src="$WORK/$(basename "$url")"
  if [ ! -f "$src" ]; then
    echo "Downloading $url"
    curl -fsSL --retry 3 -o "$src" "$url"
  fi
  echo "Clipping $(basename "$src") to $BBOX"
  osmium extract --bbox "$BBOX" "$src" --overwrite -o "$src.routing.osm.pbf"
  parts+=("$src.routing.osm.pbf")
done
osmium merge "${parts[@]}" --overwrite -o "$OUT/region.osm.pbf"

# One tile per degree cell, named after its south-west corner, e.g. N45W076.
for tile in $(node -p "
  const [w,s,e,n]=require('./region.json').bbox.map((v,i)=>v+(i<2?-$MARGIN:$MARGIN));
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
ls -lh "$OUT/region.osm.pbf" "$OUT/elevation"
