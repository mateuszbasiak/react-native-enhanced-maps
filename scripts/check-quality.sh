#!/bin/bash

# Consume the hook event; keep stdout reserved for the hook JSON response.
cat >/dev/null
cd "$(dirname "$0")/.." || exit 1

status=0
npm run format >&2 || status=1
npm run lint >&2 || status=1

printf '{}\n'
exit "$status"
