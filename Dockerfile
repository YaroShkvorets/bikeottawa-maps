# Self-contained image: the app plus whatever tiles are in web/public at build time.
# Build the tiles first (npm run basemap && npm run tiles), then: docker build -t bikeottawa-maps .
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/
COPY pipeline/package.json pipeline/
RUN npm ci --workspace web
COPY region.json ./
COPY web web
RUN npm run build --workspace web

FROM nginx:1.30-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
