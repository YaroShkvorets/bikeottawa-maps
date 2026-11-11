# BRouter with the ottbike profile and routing data for the region baked in.
# Run routing/prepare-data.sh first, then: docker build -t bikeottawa-router routing
ARG BROUTER_IMAGE=ghcr.io/abrensch/brouter:master@sha256:1e73860a13994eb49871bd35e20e955ab3d3b3cde0f26575a9cf2a69a72495ae
# The commit BROUTER_IMAGE was built from; the server jar is rebuilt from it
# with brouter/isochrone.patch (engineMode=5: how far you get in a given time).
ARG BROUTER_COMMIT=fed8f185ecdba4c01f4d6913bff7c0fae4576a32

FROM alpine/git:v2.49.1 AS source
ARG BROUTER_COMMIT
WORKDIR /brouter
RUN git init -q && git remote add origin https://github.com/abrensch/brouter.git \
    && git fetch -q --depth 1 origin "$BROUTER_COMMIT" && git checkout -q FETCH_HEAD
COPY brouter/isochrone.patch /tmp/
RUN git apply /tmp/isochrone.patch

FROM --platform=$BUILDPLATFORM eclipse-temurin:17-jdk-jammy AS jar
COPY --from=source /brouter /brouter
WORKDIR /brouter
RUN --mount=type=cache,target=/root/.gradle \
    sed -i 's/\r$//' gradlew && chmod +x gradlew && ./gradlew --no-daemon -q :brouter-server:fatJar

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
COPY --from=jar /brouter/brouter-server/build/libs/brouter-*-all.jar /app/brouter.jar
COPY --from=segments /segments4 /segments4
USER brouter
ENV MAXTHREADS=4 \
    JAVA_OPTS="-Xmx512M -Xms128M -DmaxRunningTime=60 -DuseRFCMimeType=false"
