# Self-hosted Sat Sorter. The satsorter.com Netlify build does not use this image.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV VITE_SELF_HOSTED=true
RUN npx vite build && cp dist/index.html dist/404.html

FROM nginxinc/nginx-unprivileged:1.27-alpine

ENV MAPLE_UPSTREAM=http://maple-proxy:8080/
# Only this variable is substituted. nginx $uri and $host stay intact.
ENV NGINX_ENVSUBST_FILTER=^MAPLE_UPSTREAM$

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/10-normalize-maple-upstream.envsh /docker-entrypoint.d/10-normalize-maple-upstream.envsh
# The nginx entrypoint sources executable *.envsh files before envsubst.
USER root
RUN chmod 755 /docker-entrypoint.d/10-normalize-maple-upstream.envsh
USER nginx

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
