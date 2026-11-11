#!/bin/sh
# Builds BRouter routing data (.rd5) from an OSM extract, with elevation when
# .hgt tiles are provided. Runs inside the Docker build, on the BRouter image.
# Usage: build-segments.sh <region.osm.pbf> <hgt-dir> <out-dir>
set -eu
PBF="$1"
HGT="$2"
OUT="$3"
P=/profiles2
JAVA="java -Xmx2g -cp /app/brouter.jar -DuseDenseMaps=true"

work="$(mktemp -d)"
cd "$work"
mkdir nodetiles waytiles waytiles55 nodes55 unodes55 bef segments

# Elevation: one raster per 5x5 degree tile, named after the SRTM grid.
if ls "$HGT"/*.hgt >/dev/null 2>&1; then
  for tile in $(ls "$HGT"/*.hgt | sed -E 's/.*([NS])([0-9]+)([EW])([0-9]+)\.hgt/\1 \2 \3 \4/' | while read -r ns lat ew lon; do
    lat="${lat#0}"; lon="${lon#0}"; lon="${lon#0}"
    [ "$ns" = S ] && lat="-$lat"
    [ "$ew" = W ] && lon="-$lon"
    printf 'srtm_%02d_%02d\n' $(( (lon + 180) / 5 + 1 )) $(( (59 - lat) / 5 + 1 ))
  done | sort -u); do
    $JAVA btools.mapcreator.ElevationRasterTileConverter "$tile" "$HGT" bef 1
  done
fi

$JAVA -Ddeletetmpfiles=true btools.mapcreator.OsmFastCutter "$P/lookups.dat" nodetiles waytiles nodes55 waytiles55 \
  bordernids.dat relations.dat restrictions.dat "$P/all.brf" "$P/ottbike.brf" "$P/softaccess.brf" "$PBF"
$JAVA -Ddeletetmpfiles=true btools.mapcreator.PosUnifier nodes55 unodes55 bordernids.dat bordernodes.dat bef
$JAVA -DskipEncodingCheck=true btools.mapcreator.WayLinker unodes55 waytiles55 bordernodes.dat restrictions.dat \
  "$P/lookups.dat" "$P/all.brf" segments rd5

mkdir -p "$OUT"
mv segments/*.rd5 "$OUT/"
rm -rf "$work"
ls -lh "$OUT"
