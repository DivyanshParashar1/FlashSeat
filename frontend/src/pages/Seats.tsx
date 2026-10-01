import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Reservation, type Seat } from '../api';

type RazorpayOpts = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  handler: (r: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
};
declare global {
  interface Window {
    Razorpay: new (opts: RazorpayOpts) => { open: () => void };
  }
}

function statusClass(s: Seat['status'], selected: boolean) {
  if (selected) return 'bg-indigo-500 border-indigo-300 text-white';
  if (s === 'available')
    return 'bg-emerald-900/40 border-emerald-700 hover:bg-emerald-800/60';
  if (s === 'held')
    return 'bg-amber-900/40 border-amber-700 cursor-not-allowed';
  return 'bg-slate-800 border-slate-700 cursor-not-allowed text-slate-500';
}

export default function Seats() {
  const { id: eventId } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [seats, setSeats] = useState<Seat[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [now, setNow] = useState(Date.now());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Initial seat fetch
  useEffect(() => {
    if (!eventId) return;
    api
      .getSeats(eventId)
      .then((r) => setSeats(r.seats))
      .catch((e) => setErr((e as Error).message));
  }, [eventId]);

  // SSE live updates
  useEffect(() => {
    if (!eventId) return;
    const es = new EventSource(`/api/v1/events/${eventId}/seat-updates`);
    esRef.current = es;
    es.addEventListener('seat_update', (ev) => {
      try {
        const update = JSON.parse((ev as MessageEvent).data) as {
          seatId: string;
          status: Seat['status'];
        };
        setSeats((prev) =>
          prev
            ? prev.map((s) =>
                s.id === update.seatId ? { ...s, status: update.status } : s,
              )
            : prev,
        );
        setSelected((prev) => {
          if (update.status === 'available') return prev;
          if (!prev.has(update.seatId)) return prev;
          const next = new Set(prev);
          next.delete(update.seatId);
          return next;
        });
      } catch {
        /* ignore malformed */
      }
    });
    es.onerror = () => {
      // EventSource auto-reconnects; just surface a soft hint
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [eventId]);

  // Countdown ticker
  useEffect(() => {
    if (!reservation) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [reservation]);

  const heldSecondsLeft = useMemo(() => {
    if (!reservation) return 0;
    const diff = Math.floor(
      (new Date(reservation.heldUntil).getTime() - now) / 1000,
    );
    return Math.max(0, diff);
  }, [reservation, now]);

  useEffect(() => {
    if (reservation && heldSecondsLeft === 0) {
      setReservation(null);
      setSelected(new Set());
      setErr('Hold expired. Please pick seats again.');
    }
  }, [heldSecondsLeft, reservation]);

  const total = useMemo(() => {
    if (!seats) return 0;
    return seats
      .filter((s) => selected.has(s.id))
      .reduce((sum, s) => sum + s.price, 0);
  }, [seats, selected]);

  const toggle = (seat: Seat) => {
    if (seat.status !== 'available') return;
    if (reservation) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) next.delete(seat.id);
      else next.add(seat.id);
      return next;
    });
  };

  const hold = useCallback(async () => {
    if (!eventId || selected.size === 0) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await api.createReservation(eventId, {
        seatIds: [...selected],
        idempotencyKey: crypto.randomUUID(),
      });
      setReservation(res);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [eventId, selected]);

  const release = useCallback(async () => {
    if (!reservation) return;
    setBusy(true);
    try {
      await api.releaseReservation(reservation.reservationId);
      setReservation(null);
      setSelected(new Set());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [reservation]);

  const pay = useCallback(async () => {
    if (!reservation) return;
    setErr(null);
    setBusy(true);
    try {
      const checkout = await api.checkout(reservation.reservationId);
      const rzp = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        order_id: checkout.orderId,
        name: 'FlashSeat',
        description: 'Event booking',
        theme: { color: '#4f46e5' },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (r) => {
          try {
            await api.verifyPayment({
              razorpayOrderId: r.razorpay_order_id,
              razorpayPaymentId: r.razorpay_payment_id,
              razorpaySignature: r.razorpay_signature,
            });
            nav('/tickets');
          } catch (e) {
            setErr(`Verification failed: ${(e as Error).message}`);
            setBusy(false);
          }
        },
      });
      rzp.open();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }, [reservation, nav]);

  if (err && !seats) return <p className="text-rose-400">Failed: {err}</p>;
  if (!seats) return <p className="text-slate-400">Loading seats…</p>;

  const mm = String(Math.floor(heldSecondsLeft / 60)).padStart(2, '0');
  const ss = String(heldSecondsLeft % 60).padStart(2, '0');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pick your seats</h1>
        <div className="text-sm text-slate-400">
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-700 align-middle" />{' '}
          available{' '}
          <span className="ml-3 inline-block h-3 w-3 rounded-sm bg-amber-700 align-middle" />{' '}
          held{' '}
          <span className="ml-3 inline-block h-3 w-3 rounded-sm bg-slate-700 align-middle" />{' '}
          sold
        </div>
      </div>

      {err && (
        <div className="rounded border border-rose-700 bg-rose-900/30 p-2 text-sm text-rose-200">
          {err}
        </div>
      )}

      <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
        {seats.map((seat) => {
          const isSelected = selected.has(seat.id);
          return (
            <button
              key={seat.id}
              onClick={() => toggle(seat)}
              disabled={seat.status !== 'available' || !!reservation}
              className={`rounded border px-2 py-2 text-xs font-medium transition ${statusClass(seat.status, isSelected)}`}
              title={`${seat.seatNumber} · ₹${seat.price}`}
            >
              {seat.seatNumber}
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/80 p-4 backdrop-blur">
        <div>
          <p className="text-sm text-slate-400">
            {selected.size} seat{selected.size === 1 ? '' : 's'} selected
          </p>
          <p className="text-lg font-semibold">₹{total}</p>
          {reservation && (
            <p className="text-sm text-amber-300">
              Hold expires in {mm}:{ss}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {!reservation ? (
            <button
              onClick={hold}
              disabled={busy || selected.size === 0}
              className="rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {busy ? 'Holding…' : 'Hold seats'}
            </button>
          ) : (
            <>
              <button
                onClick={release}
                disabled={busy}
                className="rounded border border-slate-700 px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
              >
                Release
              </button>
              <button
                onClick={pay}
                disabled={busy}
                className="rounded bg-emerald-600 px-4 py-2 font-medium hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy ? 'Opening…' : 'Pay now'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
