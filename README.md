# SNX-API

Docker with latest docker compose is mandatory.

## Development (auto-reload included)

- `pnpm dev` (use this for dev)

## Production

- `pnpm start` (this is not intended to work on localhost)

## Release

- push changes to dev
- open PR from dev to main (promote dev to main)
- merge PR
- wait for API to be automatically deployed to production
