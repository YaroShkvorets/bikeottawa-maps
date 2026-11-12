# Bike Ottawa Maps

Cycling maps for Ottawa–Gatineau built on OpenStreetMap: street comfort (level of traffic stress), winter-maintained pathways, places such as bike parking, repair stations and water, a night map of lit streets and street lights, a map of collisions involving cyclists and pedestrians, a route planner for riding or walking, a map of how far you get in 10 to 30 minutes, and street-level photos of places and streets. Successor to [maps.bikeottawa.ca](https://maps.bikeottawa.ca).

No map vendor or API keys: the basemap and data layers are static [PMTiles](https://docs.protomaps.com/pmtiles/) files rendered with [MapLibre](https://maplibre.org). The light, grey and dark map styles are the same basemap tiles restyled in the browser; only the satellite style loads from elsewhere (Esri World Imagery, no key).

## Layout

| Path          | What                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `web/`        | The app: React, TypeScript, Vite, MapLibre                                                                                             |
| `pipeline/`   | Builds the map tiles from OSM extracts (osmium, [stressmodel](https://github.com/BikeOttawa/stressmodel), tippecanoe)                  |
| `routing/`    | The route planner's backend: [BRouter](https://github.com/abrensch/brouter) with the `ottbike` and `ottwalk` profiles and routing data for the region |
| `region.json` | Area covered and the OSM extracts to use                                                                                               |

## Getting started

```sh
brew install osmium-tool tippecanoe pmtiles
pipx install osmium   # pyosmium-up-to-date
npm install
npm run basemap   # once: basemap extract, fonts and icons
npm run tiles     # data layers from current OSM data
npm run dev
```

Tiles land in `web/public/tiles` and are not committed: `basemap.pmtiles` (Protomaps), `overlays.pmtiles` (street comfort and winter data), `places.pmtiles` and `night.pmtiles` (lit streets and lamps). The app only loads the files the current layer draws, so the first visit fetches the basemap alone.

## OSM data

`pipeline/update-osm.sh` (`npm run osm`, also run by `npm run tiles`) keeps one file, `.cache/osm/region.osm.pbf`, with all OSM data for the routing area in `region.json`. The map tiles and the router are both built from it.

The first run downloads the Ontario and Quebec extracts from Geofabrik (2.2 GB) and cuts the area out. After that it only fetches OpenStreetMap's hourly change files, applies them and trims the result back to the area, so the data is about an hour behind OSM and a day's update is around 100 MB.

`region.json` has two boxes: `bbox` is what the map shows, `routingBbox` is the wider area routes can cross.

## Collisions

The collisions layer shows the City of Ottawa's reported traffic collisions that involve a cyclist or a pedestrian ([open data](https://open.ottawa.ca/), Open Government Licence – Ottawa). They are kept in the repository as `web/public/data/collisions.geojson`, about 3,500 points. The city publishes a new year each summer; `npm run collisions` downloads the data again. 2023 is missing from the city's data.

## Route planner

The planner asks a BRouter server for routes. Riding styles are sets of weights for the `ottbike` profile in `routing/profiles` (how hard to avoid busy roads, sidewalks, rough surfaces, unplowed paths, unlit sections and stops) plus a riding speed on the flat; they live in `web/src/route/styles.ts`. Travel times also count walking pace where the bike is pushed and the seconds lost at stop signs and signals. Walking uses its own profile, `ottwalk` (sidewalks and paths first, busy roads without a sidewalk avoided; a winter switch avoids unplowed paths and walks them slowly).

"How far" uses the same router and riding styles: BRouter has no isochrones of its own, so the router image starts from our fork's image, `ghcr.io/yaroshkvorets/brouter:bikeottawa`, built from the `bikeottawa` branch of [the fork](https://github.com/YaroShkvorets/brouter/tree/bikeottawa): upstream BRouter plus three changes: `engineMode=5` with `isochroneTime=<seconds>` (up to 1800), which spreads out from one point along the cheapest paths of the profile and returns every way reached as GeoJSON, one MultiLineString per minute; the profiles' `stopdelay` (seconds lost at stop signs and signals) added to travel times; and per-way speed limits (`maxspeed`) applied to walking as well as riding. Every push to that branch publishes a new image. To move to a newer BRouter, rebase the branch onto upstream, push, and pin the new image digest as `BROUTER_IMAGE` in `routing/Dockerfile`.

The router image builds its own routing data from the same OSM file, because it needs tags that stock BRouter data leaves out (`winter_service`, `width`, lane counts, `crossing:signals`). To run it locally:

```sh
npm run router:build   # elevation tiles and the image, with routing data built inside it
npm run router         # BRouter on localhost:17777, using the profiles from the checkout
npm run dev            # .env.development points the app at it
```

`npm run router` mounts the two profiles in `routing/profiles` into the container, so profile edits take effect on the next route request; rebuild the image only for fresh OSM data or new lookup tags.

Without `VITE_ROUTER_URL` the "Plan a route" page says that no routing server is connected. Place search and the addresses shown for points picked on the map come from [Photon](https://photon.komoot.io); set `VITE_GEOCODER_URL` to use another Photon server.

## Photos

Cards for places and streets show street-level photos from [Mapillary](https://www.mapillary.com): a place's own photo when its OSM `mapillary` tag names one, then the photos taken nearby (the closest of each capture run), which the larger view steps through. They need a Mapillary client token in `VITE_MAPILLARY_TOKEN` (for local work, in `web/.env.development.local`, which git ignores); without one, cards link to the photo instead. Places whose `image` tag is a picture show it too. Photos are only requested once a card is open.

## Deployment

The `Deploy` workflow runs on every push to `main`, on `v*` tags and once a night. Two jobs run side by side, each bringing the OSM data up to date (the file is carried between runs in the Actions cache): one rebuilds the tiles and the app, the other the routing data. The site goes live as soon as the first is done, a few minutes after a push. Then:

- publishes the site to GitHub Pages. Repository variables set what it connects to: `ROUTER_URL` (the planner works once it points at a running router) and `MAPILLARY_TOKEN` (photos);
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
- `npm run osm`: bring the OSM data up to date without rebuilding anything
- `npm run collisions`: download the city's collision data again
- `npm run router:build` / `npm run router`: build and run the local router

## Roadmap

1. Editing from the map (plowed or not, parking details) saved to OpenStreetMap
2. Planner: turn-by-turn, a gravel style, via points on touch screens
3. Collisions in Gatineau (no open data yet), offline use
