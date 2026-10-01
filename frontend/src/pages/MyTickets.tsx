import { useEffect, useState } from 'react';
import { api, type Booking } from '../api';

export default function MyTickets() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .listBookings()
      .then((r) => setBookings(r.bookings))
      .catch((e) => setErr((e as Error).message));
  }, []);

  if (err) return <p className="text-rose-400">Failed: {err}</p>;
  if (!bookings) return <p className="text-slate-400">Loading tickets…</p>;
  if (bookings.length === 0)
    return <p className="text-slate-400">No tickets yet.</p>;

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">My tickets</h1>
      <ul className="space-y-2">
        {bookings.map((b) => (
          <li
            key={b.bookingId}
            className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-medium">{b.event.name}</h2>
                <p className="text-sm text-slate-400">
                  {new Date(b.event.date).toLocaleString()}
                  {b.event.venue ? ` · ${b.event.venue}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">Seat {b.seat.seatNumber}</p>
                <p className="text-sm text-slate-400">₹{b.seat.price}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Booking #{b.bookingId.slice(0, 8)} ·{' '}
              {new Date(b.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
