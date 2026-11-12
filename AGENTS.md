# Notes for coding agents

What the code does not tell you. See README.md for what the project is and how it fits together.

## Before committing

- `npm run lint`, `npm run typecheck` and `npm test` must pass. Biome formats: `npx biome check --write`.
- Commit to `main`. Push only when asked: every push deploys the live site.
- Keep comments, docs and commit messages short and plain.

## Text

- Every string lives in `web/src/i18n.ts`, in English and in Quebec French (dépanneur, stationnement, casse-croûte), never one without the other.
- Keep French about as short as the English: long labels wrap and break buttons. Typography follows the OQLF: a non-breaking space before a colon, none before `;` `?` `!`.

## Data

- Tiles in `web/public/tiles` are not committed; `npm run tiles` rebuilds them in a few minutes.
- Collisions are committed (`web/public/data/collisions.geojson`); `npm run collisions` refreshes them when the city publishes a year.

## Router

- The local router (`npm run router`, port 17777) reads `routing/profiles/*.brf` live, so a broken profile breaks it at once. Try profile changes on a second container on another port first.
- Profiles can only use the tags and values in BRouter's lookups (`/profiles2/lookups.dat` in the image, plus `routing/lookups-extra*.dat`). An unknown value makes the whole profile fail to load.
- Changes to BRouter itself go on the `bikeottawa` branch of github.com/YaroShkvorets/brouter. Its CI publishes `ghcr.io/yaroshkvorets/brouter:bikeottawa`, pinned by digest in `routing/Dockerfile`. That build runs upstream's checks (PMD), so run `./gradlew build` before pushing.

## Outside services

- Photon (place search, addresses) refuses bursts: keep lookups to two at a time (`web/src/route/geocode.ts`). Testing with many parallel requests got the network blocked for a while.
- The Mapillary token comes from `VITE_MAPILLARY_TOKEN`: `web/.env.development.local` locally (git ignores it), the `MAPILLARY_TOKEN` repository variable when deployed. Never put it in code.

## Map style

- `buildStyle` builds the whole MapLibre style from app state, and the map compares it with the last one on every change. Large GeoJSON does not belong in it: set it on the source directly, as the How far map does in `web/src/map/MapView.tsx`.
- A style rebuild empties sources that were filled that way, so fill them again after `setStyle`.
