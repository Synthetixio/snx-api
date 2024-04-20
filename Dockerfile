# syntax=docker/dockerfile:1
FROM synthetixio/docker-node:20.12-alpine as builder

RUN mkdir /app
WORKDIR /app

COPY package.json ./
COPY pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prefer-offline
COPY . .

FROM builder as api
USER node
EXPOSE 3000
CMD ["pm2-runtime", "ecosystem.config.js"]
