#!/usr/bin/env bash
# Gathers what the router image is built from, into routing/data:
#   region.osm.pbf   OSM data for the routing area in region.json
#   elevation/*.hgt  1-arcsecond elevation tiles covering the same area
# Needs: node, curl, docker, and what pipeline/update-osm.sh needs.
set -euo pipefail
cd "$(dirname "$0")/.."

REGION="${OSM_DIR:-.cache/osm}/region.osm.pbf"
OUT=routing/data
mkdir -p "$OUT/elevation"

# The tiles build normally brings the data up to date first; do it here if not.
[ -f "$REGION" ] || pipeline/update-osm.sh
cp "$REGION" "$OUT/region.osm.pbf"

# Elevation is NRCan's MRDEM-30: bare ground (no trees or roofs), from lidar
# around Ottawa–Gatineau. It is resampled to 1-arcsecond .hgt tiles, the finest
# BRouter reads; SRTM fills in outside Canada. GDAL runs from its Docker image.
GDAL_IMAGE=ghcr.io/osgeo/gdal:ubuntu-small-3.13.3
MRDEM=/vsicurl/https://canelevation-dem.s3.ca-central-1.amazonaws.com/mrdem-30/mrdem-30-dtm.tif
SRTM="${SRTM_DIR:-.cache/elevation}"
mkdir -p "$SRTM"

# One tile per degree cell, named after its south-west corner, e.g. N45W076.
node -e "
  const [w,s,e,n]=require('./region.json').routingBbox;
  for (let lat=Math.floor(s); lat<=Math.floor(n); lat++)
    for (let lon=Math.floor(w); lon<=Math.floor(e); lon++)
      console.log((lat<0?'S':'N')+String(Math.abs(lat)).padStart(2,'0')+(lon<0?'W':'E')+String(Math.abs(lon)).padStart(3,'0'), lon, lat)" |
  while read -r tile lon lat; do
    [ -f "$OUT/elevation/$tile.hgt" ] && continue
    echo "Building elevation tile $tile"
    [ -f "$SRTM/$tile.hgt" ] ||
      curl -fsSL --retry 3 "https://s3.amazonaws.com/elevation-tiles-prod/skadi/${tile:0:3}/$tile.hgt.gz" | gunzip > "$SRTM/$tile.hgt"
    # A tile's 3601 x 3601 points sit on whole arcseconds, edges included.
    edges="$(node -p "const h=1/7200; [$lon-h, $lat-h, $lon+1+h, $lat+1+h].join(' ')")"
    # Later sources win: MRDEM over SRTM wherever MRDEM has data.
    docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/w" -w /w \
      -e GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR -e GDAL_PAM_ENABLED=NO -e CPL_VSIL_CURL_ALLOWED_EXTENSIONS=.tif \
      "$GDAL_IMAGE" sh -ec "
        gdalwarp -q -overwrite -t_srs EPSG:4326 -te $edges -ts 3601 3601 -r bilinear \
          -ot Float32 -dstnodata -32768 '$SRTM/$tile.hgt' '$MRDEM' /tmp/tile.tif
        gdal_translate -q -of SRTMHGT -ot Int16 /tmp/tile.tif '$OUT/elevation/$tile.hgt'"
  done
ls -lh "$OUT/region.osm.pbf"
ls "$OUT/elevation" | tr '\n' ' '
echo
