## Build stage: compile Vite app to static assets
FROM node:22-alpine AS build

WORKDIR /app

ARG VITE_ACTIVE_THEME
ARG VITE_ENABLE_UPLOAD_IMAGE
ARG VITE_SHOW_REASONING
ARG VITE_DEV_HTTPS
ARG VITE_DEV_PORT
ARG VITE_API_BASE_URL

ENV VITE_ACTIVE_THEME=${VITE_ACTIVE_THEME}
ENV VITE_ENABLE_UPLOAD_IMAGE=${VITE_ENABLE_UPLOAD_IMAGE}
ENV VITE_SHOW_REASONING=${VITE_SHOW_REASONING}
ENV VITE_DEV_HTTPS=${VITE_DEV_HTTPS}
ENV VITE_DEV_PORT=${VITE_DEV_PORT}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

## Runtime stage: serve static files with a slim nginx
FROM nginx:1.27-alpine

# Copy build output to nginx web root
COPY --from=build /app/dist /usr/share/nginx/html

# Configure nginx for SPA routing and basic caching
RUN printf 'server {\n\
  listen 80;\n\
  server_name _;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  # Cache hashed assets forever — filenames change on every build\n\
  location /assets/ {\n\
    expires 1y;\n\
    add_header Cache-Control "public, max-age=31536000, immutable";\n\
  }\n\
  # Never cache the service worker — must be revalidated on every load\n\
  location ~* (sw\\.js|workbox-[^.]+\\.js)$ {\n\
    expires -1;\n\
    add_header Cache-Control "no-cache, no-store, must-revalidate";\n\
    try_files $uri =404;\n\
  }\n\
  # SPA fallback — index.html must never be cached so new builds are picked up immediately\n\
  location / {\n\
    try_files $uri /index.html;\n\
    add_header Cache-Control "no-cache, no-store, must-revalidate";\n\
    add_header Pragma "no-cache";\n\
    add_header Expires "0";\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

