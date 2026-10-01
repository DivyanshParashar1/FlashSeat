import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const BASE = __ENV.BASE_URL || 'http://localhost:8081/api/v1';
const EVENT_ID = __ENV.EVENT_ID;
const SEAT_IDS = JSON.parse(__ENV.SEAT_IDS || '[]');
const VUS = Number(__ENV.VUS || 500);

if (!EVENT_ID || SEAT_IDS.length === 0) {
  throw new Error('EVENT_ID and SEAT_IDS env vars required');
}

export const options = {
  scenarios: {
    thundering_herd: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  },
};

const tokens = new SharedArray('tokens', () => {
  const list = [];
  for (let i = 0; i < VUS; i++) {
    const email = `k6-${__ENV.RUN_ID || Date.now()}-${i}@test.local`;
    const regRes = http.post(`${BASE}/auth/register`, JSON.stringify({ email, password: 'password123', name: `k6-${i}` }), {
      headers: { 'content-type': 'application/json' },
    });
    if (regRes.status !== 201 && regRes.status !== 400) {
      throw new Error(`register failed ${regRes.status}: ${regRes.body}`);
    }
    const loginRes = http.post(`${BASE}/auth/login`, JSON.stringify({ email, password: 'password123' }), {
      headers: { 'content-type': 'application/json' },
    });
    list.push(JSON.parse(loginRes.body).token);
  }
  return list;
});

export default function () {
  const token = tokens[__VU - 1];
  const seatId = SEAT_IDS[(__VU - 1) % SEAT_IDS.length];
  const res = http.post(
    `${BASE}/events/${EVENT_ID}/reservations`,
    JSON.stringify({ seatIds: [seatId], idempotencyKey: `k6-vu-${__VU}-${__ITER}` }),
    { headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` } },
  );
  check(res, {
    'status is 201 or 409': (r) => r.status === 201 || r.status === 409,
  });
  sleep(0.1);
}
