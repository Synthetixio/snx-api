#!/bin/bash
docker compose -f docker-compose.dev.yml up --force-recreate --no-deps --build cache api proxy
