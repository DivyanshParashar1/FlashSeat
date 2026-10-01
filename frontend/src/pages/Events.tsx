import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Event } from '../api';

export default function Events() {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .listEvents()
      .then((r) => setEvents(r.events))
      .catch((e) => setErr((e as Error).message));
  }, []);

  if (err) return <p className="text-rose-400">Failed to load: {err}</p>;
  if (!events) return <p className="text-slate-400">Loading events…</p>;
  if (events.length === 0)
    return <p className="text-slate-400">No events yet.</p>;

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Upcoming events</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {events.map((ev) => (
          <li
            key={ev.id}
            className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
          >
            <h2 className="text-lg font-medium">{ev.name}</h2>
            <p className="text-sm text-slate-400">
              {new Date(ev.date).toLocaleString()}
              {ev.venue ? ` · ${ev.venue}` : ''}
            </p>
            <p className="mt-1 text-sm">
              <span className="text-emerald-400">{ev.availableSeats}</span>{' '}
              seats available
            </p>
            <Link
              to={`/events/${ev.id}`}
              className="mt-3 inline-block rounded bg-indigo-600 px-3 py-1 text-sm hover:bg-indigo-500"
            >
              Pick seats →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
