#!/bin/bash
docker compose up --force-recreate --no-deps --build cache api proxy
