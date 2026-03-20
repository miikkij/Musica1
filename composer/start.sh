#!/bin/bash
cd "$(dirname "$0")"
if [ ! -d "dist" ]; then
  echo "Building frontend..."
  npm run build
fi
echo "Starting Composer on http://localhost:8000"
cd .. && uv run python -m composer.server.app
