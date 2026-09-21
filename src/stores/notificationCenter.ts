// stores/notificationCenter.ts
// ✅ ENTERPRISE: Zustand store με Map-based dedup, cursor pagination, error states

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Notification } from '@/types/notification';
import { isHiddenFromInbox, isNotificationUnread } from '@/lib/notifications/notification-state';

export type CenterState = {
  items: Map<string, Notification>; // by id
  order: string[]; // newest first
  unread: number;
  cursor?: string;
  error?: string;
  status: 'idle' | 'loading' | 'ready' | 'error';

  ingest: (ns: Notification[]) => void;
  addOrUpdate: (n: Notification) => void;
  markRead: (ids?: string[]) => void;
  dismiss: (id: string) => void;
  setCursor: (c?: string) => void;
  setStatus: (s: CenterState['status']) => void;
  setError: (e?: string) => void;
  reset: () => void;
};

const recalcUnread = (items: Map<string, Notification>) => {
  let c = 0;
  for (const n of items.values()) if (isNotificationUnread(n.delivery.state)) c++;
  return c;
};

export const useNotificationCenter = create<CenterState>()(devtools((set, get) => ({
  items: new Map(),
  order: [],
  unread: 0,
  status: 'idle',

  ingest: (ns) => set((s) => {
    const items = new Map(s.items);
    let order = [...s.order];
    for (const n of ns) {
      // Κρυμμένες (dismissed · withdrawn — ADR-867 Ε10) δεν εμφανίζονται — ένας κριτής, `notification-state.ts`.
      if (isHiddenFromInbox(n.delivery.state)) {
        items.delete(n.id);
        order = order.filter(id => id !== n.id);
        continue;
      }
      items.set(n.id, n);
      if (!order.includes(n.id)) order.unshift(n.id);
    }
    return { items, order, unread: recalcUnread(items) };
  }),

  addOrUpdate: (n) => set((s) => {
    const items = new Map(s.items);
    items.set(n.id, n);
    const order = s.order.includes(n.id) ? s.order : [n.id, ...s.order];
    return { items, order, unread: recalcUnread(items) };
  }),

  markRead: (ids) => set((s) => {
    const items = new Map(s.items);
    const target = ids ?? s.order;
    for (const id of target) {
      const cur = items.get(id);
      if (cur && isNotificationUnread(cur.delivery.state)) {
        items.set(id, { ...cur, delivery: { ...cur.delivery, state: 'seen' } });
      }
    }
    return { items, unread: recalcUnread(items) };
  }),

  dismiss: (id) => set((s) => {
    const items = new Map(s.items);
    items.delete(id);
    const order = s.order.filter(oid => oid !== id);
    return { items, order, unread: recalcUnread(items) };
  }),

  setCursor: (c) => set({ cursor: c }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  reset: () => set({ items: new Map(), order: [], unread: 0, cursor: undefined, status: 'idle', error: undefined }),
}), { name: 'NotificationCenter' }));
