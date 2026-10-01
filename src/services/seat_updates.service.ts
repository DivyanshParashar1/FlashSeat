type Listener = (data: string) => void;

const listenersByEvent = new Map<string, Set<Listener>>();

export const subscribe = (
  eventId: string,
  listener: Listener,
): (() => void) => {
  let set = listenersByEvent.get(eventId);
  if (!set) {
    set = new Set();
    listenersByEvent.set(eventId, set);
  }
  set.add(listener);
  return () => {
    const current = listenersByEvent.get(eventId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listenersByEvent.delete(eventId);
  };
};

export interface SeatUpdate {
  seatId: string;
  status: 'available' | 'held' | 'sold';
}

export const broadcast = (eventId: string, update: SeatUpdate): void => {
  const set = listenersByEvent.get(eventId);
  if (!set) return;
  const payload = JSON.stringify(update);
  for (const listener of set) listener(payload);
};

export const subscriberCount = (eventId: string): number => {
  return listenersByEvent.get(eventId)?.size ?? 0;
};
