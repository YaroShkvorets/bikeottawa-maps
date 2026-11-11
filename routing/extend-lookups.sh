#!/bin/sh
# Adds the OSM tags we need but stock BRouter does not carry to a lookups.dat, in place:
#   on ways   winter_service, width, lanes:forward, lanes:backward, crossing:signals, path=desire
#   on nodes  crossing:signals
# Usage: extend-lookups.sh <lookups.dat> <way-extras.dat> <node-extras.dat>
set -eu
lookups="$1"
way_extra="$2"
node_extra="$3"
awk -v extra="$way_extra" '
  /^path;/ { print; if (!done_path) { print "path;0000000001 desire"; done_path = 1 } next }
  /^---context:node/ { while ((getline line < extra) > 0) print line; print "" }
  { print }
' "$lookups" > "$lookups.tmp"
# The node section is the last one, so its extras go at the end.
{ cat "$lookups.tmp"; echo; cat "$node_extra"; } > "$lookups"
rm "$lookups.tmp"
grep -q "^winter_service;" "$lookups" && grep -q "^path;.* desire" "$lookups" && [ "$(grep -c '^crossing:signals;.* yes' "$lookups")" = 2 ]
