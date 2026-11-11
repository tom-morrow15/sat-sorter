#!/bin/sh
# nginx stays in the foreground. The guest budget store is local to this container.
set -u
node /opt/sat-sorter/guestBudgetStore.mjs &
STORE_PID=$!
trap 'kill "$STORE_PID" 2>/dev/null || true' TERM INT

# Don't send guest requests to nginx until the store is accepting them.
n=0
while [ "$n" -lt 50 ]; do
  if node -e 'fetch("http://127.0.0.1:8091/api/guest-budget").then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'; then
    break
  fi
  n=$((n + 1))
  sleep 0.1
done

/docker-entrypoint.sh nginx -g 'daemon off;' &
NGINX_PID=$!
wait "$NGINX_PID"
STATUS=$?
kill "$STORE_PID" 2>/dev/null || true
wait "$STORE_PID" 2>/dev/null || true
exit "$STATUS"
