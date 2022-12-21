# SNX-API

## Development (auto-reload included)

- `docker compose -f docker-compose.dev.yml up --force-recreate --no-deps --build cache api proxy`

## Production

- Testing: `docker compose up --force-recreate --no-deps --build cache api proxy`
- Running: `docker compose up -d`
