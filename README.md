# Bike Ottawa Maps

Cycling maps for Ottawa–Gatineau built on OpenStreetMap: street comfort (level of traffic stress), winter-maintained pathways, and places such as bike parking, repair stations and water. Successor to [maps.bikeottawa.ca](https://maps.bikeottawa.ca).

No map vendor or API keys: the basemap and data layers are static [PMTiles](https://docs.protomaps.com/pmtiles/) files rendered with [MapLibre](https://maplibre.org).

## Layout

| Path          | What                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `web/`        | The app: React, TypeScript, Vite, MapLibre                                                                          |
| `pipeline/`   | Builds the tiles from an OSM extract (osmium, [stressmodel](https://github.com/BikeOttawa/stressmodel), tippecanoe) |
| `region.json` | Area covered and the OSM extract to use                                                                             |

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

## Deployment

The `Deploy` workflow rebuilds the tiles and the app and publishes them to GitHub Pages on every push to `main` and once a night.

It also pushes a Docker image with the tiles baked in to `ghcr.io/yaroshkvorets/bikeottawa-maps`: tagged `main` on every push to `main`, and with the version (and `latest`) on every `v*` tag.

```sh
docker run -p 8080:80 ghcr.io/yaroshkvorets/bikeottawa-maps:main
```

## Scripts

- `npm run dev` / `npm run build`: run or build the app
- `npm test`: unit tests for the app and the pipeline
- `npm run lint` / `npm run format`: check or fix with Biome
- `npm run tiles` / `npm run basemap`: rebuild the tiles

## Roadmap

1. Editing from the map (plowed or not, parking details) saved to OpenStreetMap
2. Route planner with riding styles, backed by BRouter
3. Collisions layer, search, offline use
