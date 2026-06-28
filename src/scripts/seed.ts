import { users } from '../db/schema/users.schema.js';
import { events } from '../db/schema/events.schema.js';
import { seats } from '../db/schema/seats.schema.js';
import { db } from '../db/index.js';
import { v5 as uuidv5 } from 'uuid';

// uuid generation
const Name_space = '0f639e50-d4c6-493b-a38a-2488f8a439c2';
const SEED_USER_ID = uuidv5('new user', Name_space);
const SEED_EVENT_ID = uuidv5('new event', Name_space);

// seeding the user

type NewUser = typeof users.$inferInsert;

const insertUser = async (user: NewUser) => {
  return db
    .insert(users)
    .values(user)
    .onConflictDoNothing({ target: users.email });
};

const newUser: NewUser = {
  id: SEED_USER_ID,
  email: 'testUser@example.com',
  name: 'Amit Verma',
  isAdmin: false,
  hashedPassword: '12345',
};
await insertUser(newUser);

// add new event idempotent
type NewEvent = typeof events.$inferInsert;

const insertEvent = async (event: NewEvent) => {
  return db
    .insert(events)
    .values(event)
    .onConflictDoNothing({ target: events.id });
};

const newEvent: NewEvent = {
  id: SEED_EVENT_ID,
  name: 'Event1',
  date: new Date(),
  venue: 'Mall',
};

await insertEvent(newEvent);

// add 100 seats

type NewSeat = typeof seats.$inferInsert;

const insertSeat = async (seatArray: NewSeat[]) => {
  return db
    .insert(seats)
    .values(seatArray)
    .onConflictDoNothing({ target: seats.id });
};

const arr: NewSeat[] = [];
let count = 0;

for (let i = 0; i < 10; i++) {
  const char = String.fromCodePoint(i + 65);
  for (let j = 0; j < 10; j++) {
    const seatNumberString = `${char}${j + 1}`;

    const newSeat: NewSeat = {
      id: uuidv5(seatNumberString, Name_space),
      seatNumber: seatNumberString,
      status: 'available',
      price: 5000,
      eventId: SEED_EVENT_ID,
    };

    arr[count] = newSeat;
    count++;
  }
}

await insertSeat(arr);
