# Load Testing

## Prereqs

- Install k6: `brew install k6`
- Dev server running: `pnpm dev`
- Create a fresh event + seats via admin API, grab the IDs:
  ```bash
  export BASE_URL=http://localhost:8081/api/v1
  # register + promote admin, then:
  EVENT_ID=$(curl -s -X POST $BASE_URL/admin/events -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"name":"load-test","date":"2026-12-01T19:00:00Z","venue":"Hall"}' | jq -r .id)
  curl -s -X POST $BASE_URL/admin/events/$EVENT_ID/seats -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"rows":[{"label":"L","count":50,"price":1000}]}' > /dev/null
  SEAT_IDS=$(curl -s $BASE_URL/events/$EVENT_ID/seats | jq -c '[.seats[].id]')
  ```

## Test 1 — Oversell under contention (P3-8)

500 users race for 50 seats. Assertion: `count(status='sold'|'held') == 50` after the run.

```bash
k6 run \
  -e BASE_URL=$BASE_URL \
  -e EVENT_ID=$EVENT_ID \
  -e SEAT_IDS="$SEAT_IDS" \
  -e VUS=500 \
  -e RUN_ID=$(date +%s) \
  loadtest/k6_oversell.js
```

After the run, verify zero oversells:
```sql
SELECT count(*) FROM seats WHERE event_id = '<EVENT_ID>' AND status IN ('held', 'sold');
-- Must equal 50
```

k6 output contains p50/p95/p99 latencies. Capture these for the resume bullet.

## Test 2 — With Redis waiting room (P3-9)

Same test with Redis running. Set `REDIS_URL=redis://localhost:6379` in `.env`, restart server, re-run:

```bash
redis-server --daemonize yes
# server must be restarted so it picks up REDIS_URL
k6 run \
  -e BASE_URL=$BASE_URL \
  -e EVENT_ID=$EVENT_ID \
  -e SEAT_IDS="$SEAT_IDS" \
  -e VUS=500 \
  -e RUN_ID=$(date +%s)-q \
  loadtest/k6_oversell.js
```

Compare p99 latency with vs without Redis — delta is the Phase 3 resume bullet.
