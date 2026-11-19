#!/bin/sh
# One-time setup of the local Garage node: layout, access key and buckets.
# Run from the repository root after `docker compose up -d garage`.
set -eu

ACCESS_KEY="${S3_ACCESS_KEY:-GK0123456789abcdef01234567}"
SECRET_KEY="${S3_SECRET_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
BUCKETS="${S3_BUCKETS:-events forms}"

garage() {
  docker compose exec -T garage /garage "$@"
}

if garage layout show | grep -q "No nodes"; then
  NODE_ID=$(garage status | grep -oE '^[0-9a-f]{16}' | head -n 1)
  garage layout assign -z dc1 -c 1G "$NODE_ID"
  garage layout apply --version 1
fi

garage key import --yes -n local-dev "$ACCESS_KEY" "$SECRET_KEY" || true

for bucket in $BUCKETS; do
  garage bucket create "$bucket" || true
  garage bucket allow --read --write --owner "$bucket" --key local-dev
  garage bucket website --allow "$bucket"
done
