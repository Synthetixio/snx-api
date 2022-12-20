#!/bin/bash
cd /home/ubuntu/snx-api &&
docker volume prune --force &&
COMPOSE_HTTP_TIMEOUT=200 docker-compose up -d
