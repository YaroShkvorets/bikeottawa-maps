#!/bin/sh
# Adds the OSM tags our profile needs but stock BRouter does not carry
# (winter_service, width, lanes:forward, lanes:backward, path=desire) to a lookups.dat, in place.
# Usage: extend-lookups.sh <lookups.dat> <lookups-extra.dat>
set -eu
lookups="$1"
extra="$2"
awk -v extra="$extra" '
  /^path;/ { print; if (!done_path) { print "path;0000000001 desire"; done_path = 1 } next }
  /^---context:node/ { while ((getline line < extra) > 0) print line; print "" }
  { print }
' "$lookups" > "$lookups.tmp"
mv "$lookups.tmp" "$lookups"
grep -q "^winter_service;" "$lookups" && grep -q "^path;.* desire" "$lookups"
