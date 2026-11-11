# BRouter with the ottbike and ottwalk profiles and routing data for the region baked in.
# Run routing/prepare-data.sh first, then: docker build -t bikeottawa-router routing
#
# The base is our fork's image (bikeottawa branch, commit ff7deb5): upstream
# BRouter plus isochrones (engineMode=5: how far you get in a given time), time
# lost at stop signs and signals (the profiles' stopdelay), and per-way speed
# limits for walking too.
ARG BROUTER_IMAGE=ghcr.io/yaroshkvorets/brouter:bikeottawa@sha256:27f51ce15fa4e8db8a84784efd5dfc1b0de47490425568a161cd0d9d8917edd9

FROM ${BROUTER_IMAGE} AS base
USER root
# Tags the profile needs that stock BRouter data does not carry.
COPY lookups-extra.dat lookups-extra-node.dat extend-lookups.sh /tmp/
RUN /tmp/extend-lookups.sh /profiles2/lookups.dat /tmp/lookups-extra.dat /tmp/lookups-extra-node.dat \
    && rm /tmp/lookups-extra.dat /tmp/lookups-extra-node.dat /tmp/extend-lookups.sh
COPY profiles/ /profiles2/
# No profile uploads on a public server.
RUN chown root:root /customprofiles && chmod 555 /customprofiles

FROM base AS segments
COPY build-segments.sh /usr/local/bin/
COPY data/ /data/
RUN build-segments.sh /data/region.osm.pbf /data/elevation /segments4

FROM base
COPY --from=segments /segments4 /segments4
USER brouter
ENV MAXTHREADS=4 \
    JAVA_OPTS="-Xmx512M -Xms128M -DmaxRunningTime=60 -DuseRFCMimeType=false"
