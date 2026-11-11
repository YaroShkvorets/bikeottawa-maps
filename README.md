# Bike Ottawa Maps

Cycling maps for Ottawa–Gatineau built on OpenStreetMap: street comfort (level of traffic stress), winter-maintained pathways, places such as bike parking, repair stations and water, and a route planner with riding styles. Successor to [maps.bikeottawa.ca](https://maps.bikeottawa.ca).

No map vendor or API keys: the basemap and data layers are static [PMTiles](https://docs.protomaps.com/pmtiles/) files rendered with [MapLibre](https://maplibre.org). The light, grey and dark map styles are the same basemap tiles restyled in the browser; only the satellite style loads from elsewhere (Esri World Imagery, no key).

## Layout

| Path          | What                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `web/`        | The app: React, TypeScript, Vite, MapLibre                                                                                             |
| `pipeline/`   | Builds the map tiles from OSM extracts (osmium, [stressmodel](https://github.com/BikeOttawa/stressmodel), tippecanoe)                  |
| `routing/`    | The route planner's backend: [BRouter](https://github.com/abrensch/brouter) with the `ottbike` profile and routing data for the region |
| `region.json` | Area covered and the OSM extracts to use                                                                                               |

## Getting started

```sh
brew install osmium-tool tippecanoe pmtiles
npm install
npm run basemap   # once: basemap extract, fonts and icons
npm run tiles     # data layers from the latest OSM extracts
npm run dev
```

`npm run tiles` downloads the Ontario and Quebec extracts from Geofabrik (2.2 GB) the first time and again only when they change. For a quick start covering just the urban area, use the 50 MB BBBike extract:

```sh
OSM_PBF_URLS=https://download.bbbike.org/osm/bbbike/Ottawa/Ottawa.osm.pbf npm run tiles
```

Tiles land in `web/public/tiles` and are not committed.

## Route planner

The planner asks a BRouter server for routes. Riding styles are sets of weights for the `ottbike` profile in `routing/profiles` (how hard to avoid busy roads, sidewalks, rough surfaces, unplowed paths, unlit sections and stops); they live in `web/src/route/styles.ts`.

The router image builds its own routing data, because it needs tags that stock BRouter data leaves out (`winter_service`, `width`, lane counts, `crossing:signals`). To run it locally:

```sh
npm run router:build   # OSM clip, elevation tiles and the image; about 5 minutes
npm run router         # BRouter on localhost:17777, using the profile file from the checkout
npm run dev            # .env.development points the app at it
```

`npm run router` mounts `routing/profiles/ottbike.brf` into the container, so profile edits take effect on the next route request; rebuild the image only for fresh OSM data or new lookup tags.

Without `VITE_ROUTER_URL` the app hides the planner. Place search and the addresses shown for points picked on the map come from [Photon](https://photon.komoot.io); set `VITE_GEOCODER_URL` to use another Photon server.

## Deployment

The `Deploy` workflow runs on every push to `main`, on `v*` tags and once a night. It rebuilds the tiles, the routing data and the app, then:

- publishes the site to GitHub Pages (the planner appears there once the `ROUTER_URL` repository variable points at a running router);
- pushes two Docker images with the data baked in, `ghcr.io/yaroshkvorets/bikeottawa-maps` (site) and `ghcr.io/yaroshkvorets/bikeottawa-maps-router` (router), tagged `main`, or the version and `latest` for a `v*` tag.

`compose.yml` runs both on one machine, with the site proxying `/brouter` to the router:

```sh
docker compose up -d    # http://localhost:8080
```

## Scripts

- `npm run dev` / `npm run build`: run or build the app
- `npm test`: unit tests for the app and the pipeline
- `npm run lint` / `npm run format`: check or fix with Biome
- `npm run tiles` / `npm run basemap`: rebuild the tiles
- `npm run router:build` / `npm run router`: build and run the local router

## Roadmap

1. Editing from the map (plowed or not, parking details) saved to OpenStreetMap
2. Planner: turn-by-turn, a gravel style, via points on touch screens
3. Collisions layer, offline use
