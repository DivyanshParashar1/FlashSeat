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

export const eventExists = async (eventId: string) => {
  const result = await db
    .select({
      id: events.id,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (result[0]) return true;
  return false;
};

export const getSeatMap = async (eventId: string) => {
  return await db
    .select({
      id: seats.id,
      seatNumber: seats.seatNumber,
      price: seats.price,
      status: sql<'available' | 'held' | 'sold'>`
    case 
    when ${seats.status} = 'held' and ${seats.heldUntil} < now()
      then 'available'
    else ${seats.status}
    end
    `,
    })
    .from(seats)
    .where(eq(seats.eventId, eventId))
    .orderBy(
      sql`left(${seats.seatNumber}, 1)`,
      sql`substring(${seats.seatNumber} from 2)::integer`,
    );
};
