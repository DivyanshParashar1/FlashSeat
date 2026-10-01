import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../app.js';
import { db } from '../db/index.js';
import { users } from '../db/schema/users.schema.js';
import { eq, sql } from 'drizzle-orm';

const RUN_ID = Date.now();

async function bootstrap() {
  await server.ready();
}

async function register(email: string, isAdmin = false) {
  await server.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: 'password123', name: email },
  });
  if (isAdmin) {
    await db.update(users).set({ isAdmin: true }).where(eq(users.email, email));
  }
  const r = await server.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'password123' },
  });
  return JSON.parse(r.body).token as string;
}

const authHeader = (t: string) => ({ authorization: `Bearer ${t}` });

test('golden path: event → seats → hold → release → booking view', async () => {
  await bootstrap();
  const adminToken = await register(`smoke-admin-${RUN_ID}@test.local`, true);
  const userToken = await register(`smoke-user-${RUN_ID}@test.local`);

  // Create event
  const evRes = await server.inject({
    method: 'POST',
    url: '/api/v1/admin/events',
    headers: authHeader(adminToken),
    payload: {
      name: `smoke-event-${RUN_ID}`,
      date: new Date().toISOString(),
      venue: 'Hall',
    },
  });
  assert.equal(evRes.statusCode, 201);
  const eventId = JSON.parse(evRes.body).id;

  // Bulk seats: 5 of row X
  const seatRes = await server.inject({
    method: 'POST',
    url: `/api/v1/admin/events/${eventId}/seats`,
    headers: authHeader(adminToken),
    payload: { rows: [{ label: 'X', count: 5, price: 1000 }] },
  });
  assert.equal(seatRes.statusCode, 201);
  assert.equal(JSON.parse(seatRes.body).created, 5);

  // Fetch seat map
  const mapRes = await server.inject({
    method: 'GET',
    url: `/api/v1/events/${eventId}/seats`,
  });
  const seatList = JSON.parse(mapRes.body).seats;
  assert.equal(seatList.length, 5);
  const [s1, s2] = seatList;

  // Hold 2 seats
  const holdRes = await server.inject({
    method: 'POST',
    url: `/api/v1/events/${eventId}/reservations`,
    headers: authHeader(userToken),
    payload: {
      seatIds: [s1.id, s2.id],
      idempotencyKey: `smoke-${RUN_ID}-golden`,
    },
  });
  assert.equal(holdRes.statusCode, 201);
  const { reservationId } = JSON.parse(holdRes.body);

  // Release the hold
  const relRes = await server.inject({
    method: 'DELETE',
    url: `/api/v1/reservations/${reservationId}`,
    headers: authHeader(userToken),
  });
  assert.equal(relRes.statusCode, 204);

  // Seats should be available again
  const map2 = await server.inject({
    method: 'GET',
    url: `/api/v1/events/${eventId}/seats`,
  });
  const after = JSON.parse(map2.body).seats;
  assert.ok(after.every((s: { status: string }) => s.status === 'available'));

  // /bookings should be empty (release never produces a booking)
  const bk = await server.inject({
    method: 'GET',
    url: '/api/v1/bookings',
    headers: authHeader(userToken),
  });
  assert.deepEqual(JSON.parse(bk.body).bookings, []);
});

test('no oversell: 20 concurrent reservations on 1 seat', async () => {
  await bootstrap();
  const adminToken = await register(`smoke-admin2-${RUN_ID}@test.local`, true);
  const evRes = await server.inject({
    method: 'POST',
    url: '/api/v1/admin/events',
    headers: authHeader(adminToken),
    payload: {
      name: `smoke-contention-${RUN_ID}`,
      date: new Date().toISOString(),
      venue: 'Hall',
    },
  });
  const eventId = JSON.parse(evRes.body).id;
  await server.inject({
    method: 'POST',
    url: `/api/v1/admin/events/${eventId}/seats`,
    headers: authHeader(adminToken),
    payload: { rows: [{ label: 'C', count: 1, price: 500 }] },
  });
  const map = JSON.parse(
    (
      await server.inject({
        method: 'GET',
        url: `/api/v1/events/${eventId}/seats`,
      })
    ).body,
  );
  const seatId = map.seats[0].id;

  // 20 buyers, each registers + races for the same seat
  const tokens = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      register(`smoke-buyer-${RUN_ID}-${i}@test.local`),
    ),
  );

  const results = await Promise.all(
    tokens.map((t, i) =>
      server.inject({
        method: 'POST',
        url: `/api/v1/events/${eventId}/reservations`,
        headers: authHeader(t),
        payload: {
          seatIds: [seatId],
          idempotencyKey: `smoke-${RUN_ID}-contend-${i}`,
        },
      }),
    ),
  );

  const wins = results.filter((r) => r.statusCode === 201).length;
  const losses = results.filter((r) => r.statusCode === 409).length;
  assert.equal(wins, 1, 'exactly one winner');
  assert.equal(losses, 19, 'rest should be 409');

  const sold = await db.execute(
    sql`select count(*)::int as c from seats where id = ${seatId} and status = 'held'`,
  );
  const soldRows = (sold.rows ?? sold) as Array<{ c: number }>;
  assert.equal(soldRows[0]?.c, 1);

  await server.close();
});
