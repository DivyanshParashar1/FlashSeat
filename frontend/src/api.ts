const BASE = '/api/v1';

export type Event = {
  id: string;
  name: string;
  date: string;
  venue: string | null;
  availableSeats: number;
};

export type Seat = {
  id: string;
  seatNumber: string;
  price: number;
  status: 'available' | 'held' | 'sold';
};

export type Booking = {
  bookingId: string;
  createdAt: string;
  event: { id: string; name: string; date: string; venue: string | null };
  seat: { id: string; seatNumber: string; price: number };
};

export type Reservation = { reservationId: string; heldUntil: string };

export type Checkout = {
  orderId: string;
  amount: number;
  currency: 'INR';
  keyId: string;
};

function tokenHeader(): HeadersInit {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...tokenHeader(),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.message ?? body.error ?? msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  register: (body: { email: string; password: string; name: string }) =>
    request<{ email: string; name: string; isAdmin: boolean }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  login: (body: { email: string; password: string }) =>
    request<{ token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listEvents: () => request<{ events: Event[] }>('/events/'),
  getSeats: (eventId: string) =>
    request<{ seats: Seat[] }>(`/events/${eventId}/seats`),
  createReservation: (
    eventId: string,
    body: { seatIds: string[]; idempotencyKey: string },
  ) =>
    request<Reservation>(`/events/${eventId}/reservations`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  releaseReservation: (reservationId: string) =>
    request<void>(`/reservations/${reservationId}`, { method: 'DELETE' }),
  checkout: (reservationId: string) =>
    request<Checkout>(`/reservations/${reservationId}/checkout`, {
      method: 'POST',
    }),
  verifyPayment: (body: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) =>
    request<{ status: 'verified' }>('/payments/verify', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listBookings: () => request<{ bookings: Booking[] }>('/bookings'),
  joinQueue: (eventId: string) =>
    request<{ token: string; position: number }>(`/events/${eventId}/queue`, {
      method: 'POST',
    }),
  queuePosition: (eventId: string, token: string) =>
    request<{ position: number; admitted?: boolean }>(
      `/events/${eventId}/queue?token=${encodeURIComponent(token)}`,
    ),
};
