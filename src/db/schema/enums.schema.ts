import { pgEnum } from 'drizzle-orm/pg-core';

export const seatStatusEnum = pgEnum('seatStatus', [
  'available',
  'held',
  'sold',
]);
export const reservationStatusEnum = pgEnum('reservationStatus', [
  'pending',
  'confirmed',
  'expired',
  'failed',
]);
