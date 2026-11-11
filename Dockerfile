# Self-contained image: the app plus whatever tiles are in web/public at build time.
# Build the tiles first (npm run basemap && npm run tiles), then: docker build -t bikeottawa-maps .
FROM node:24-alpine AS build
# git: the stressmodel dependency is installed straight from GitHub.
RUN apk add --no-cache git
# Where the app finds the router; /brouter is proxied to the router container (see compose.yml).
ARG VITE_ROUTER_URL=/brouter
ENV VITE_ROUTER_URL=$VITE_ROUTER_URL
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
