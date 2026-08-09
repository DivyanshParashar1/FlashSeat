import { db } from '../db/index.js';
import { events } from '../db/schema/events.schema.js';
import { seats } from '../db/schema/seats.schema.js';
import { eq, sql } from 'drizzle-orm';

export const liveEvents = async () => {
  // it would return all the available seats for all the events
  return await db
    .select({
      id: events.id,
      name: events.name,
      date: events.date,
      venue: events.venue,
      availableSeats: sql<number>`
        count(*) filter(
        where ${seats.status} = 'available' 
        or (${seats.status} = 'held' and ${seats.heldUntil} < now())
        )
        `.mapWith(Number),
    })
    .from(events)
    .leftJoin(seats, eq(seats.eventId, events.id))
    .groupBy(events.id);
};
