// stores/notificationCenter.ts
// ✅ ENTERPRISE: Zustand store με Map-based dedup, σελιδοποίηση με δρομέα-τιμή, καταστάσεις σφάλματος.
//
// 🔑 **Η ΜΙΑ ΚΡΥΦΗ ΜΝΗΜΗ ΤΩΝ ΕΙΔΟΠΟΙΗΣΕΩΝ ΣΤΟΝ ΠΕΛΑΤΗ** (ADR-927). Τη διαβάζουν το κουδούνι,
//    το συρτάρι **και** η σελίδα `/crm/notifications`. Ως τις 2026-11-03 η σελίδα είχε δική της σύνδεση
//    και δική της μνήμη, που **δεν** έκρυβε τις απορριφθείσες: απέρριπτες στο συρτάρι, έμενε στη σελίδα.
//    Ποιος γεμίζει το store: **μόνο** η ροή `stores/notification-feed.ts`.

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { DeliveryState, Notification } from '@/types/notification';
import { isHiddenFromInbox, isNotificationUnread } from '@/lib/notifications/notification-state';

export type CenterState = {
  items: Map<string, Notification>; // by id
  order: string[]; // newest first
  unread: number;
  /** Υπάρχουν παλαιότερες ειδοποιήσεις στη βάση από όσες έχει ο πελάτης; */
  hasMore: boolean;
  /** Φορτώνεται τώρα παλαιότερη σελίδα; — ένα αίτημα τη φορά. */
  loadingOlder: boolean;
  error?: string;
  status: 'idle' | 'loading' | 'ready' | 'error';

  /** Εισαγωγή/ενημέρωση· όσες είναι κρυμμένες (dismissed · withdrawn) **φεύγουν**. Και η «αναίρεση». */
  ingest: (ns: Notification[]) => void;
  /** Αισιόδοξη αλλαγή κατάστασης (αναγνωσμένη · μη αναγνωσμένη · ενεργήθηκε). */
  setDeliveryState: (ids: readonly string[], state: DeliveryState) => void;
  /** Αισιόδοξη αφαίρεση από τη λίστα. */
  dismiss: (id: string) => void;
  setPaging: (p: { hasMore?: boolean; loadingOlder?: boolean }) => void;
  setStatus: (s: CenterState['status']) => void;
  setError: (e?: string) => void;
  reset: () => void;
};

const recalcUnread = (items: Map<string, Notification>) => {
  let c = 0;
  for (const n of items.values()) if (isNotificationUnread(n.delivery.state)) c++;
  return c;
};

const createdAtMs = (n: Notification | undefined): number => {
  const ms = n ? Date.parse(n.createdAt) : Number.NaN;
  return Number.isNaN(ms) ? 0 : ms;
};

/** «Νεότερη πρώτη», με το `id` ως ισοπαλαιστή — ίδια σειρά με το ερώτημα (`createdAt ↓ · __name__ ↓`). */
const byNewest = (items: Map<string, Notification>) => (a: string, b: string): number =>
  createdAtMs(items.get(b)) - createdAtMs(items.get(a)) || (a < b ? 1 : a > b ? -1 : 0);

const INITIAL = {
  items: new Map<string, Notification>(),
  order: [] as string[],
  unread: 0,
  hasMore: false,
  loadingOlder: false,
  status: 'idle' as const,
  error: undefined,
};

export const useNotificationCenter = create<CenterState>()(devtools((set) => ({
  ...INITIAL,

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
      if (!order.includes(n.id)) order.push(n.id);
    }
    // Η σειρά είναι ΠΑΝΤΑ «νεότερη πρώτη», ανεξάρτητα από τη σειρά άφιξης: το `unshift` ανά στοιχείο αντέστρεφε τη
    // σελίδα (το API επιστρέφει `createdAt desc`) ⇒ το κουδούνι έδειχνε την παλιότερη πρώτη (ADR-901 §14.6 Δ).
    order.sort(byNewest(items));
    return { items, order, unread: recalcUnread(items) };
  }),

  setDeliveryState: (ids, state) => set((s) => {
    const items = new Map(s.items);
    for (const id of ids) {
      const cur = items.get(id);
      if (cur && cur.delivery.state !== state) {
        items.set(id, { ...cur, delivery: { ...cur.delivery, state } });
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

  setPaging: (p) => set(p),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  reset: () => set({ ...INITIAL, items: new Map(), order: [] }),
}), { name: 'NotificationCenter' }));

/**
 * Η λίστα με τη σειρά της.
 * ⛔ **ΠΟΤΕ ως selector του zustand** (`useNotificationCenter(notificationListOf)`): γυρίζει **νέο** πίνακα
 *    σε κάθε κλήση ⇒ το `useSyncExternalStore` βλέπει πάντα αλλαγή ⇒ βρόχος απόδοσης. Διάλεξε `items` και
 *    `order` χωριστά και κάλεσέ το μέσα σε `useMemo`, ή τη στιγμή του γεγονότος με `getState()`.
 */
export function notificationListOf(s: Pick<CenterState, 'items' | 'order'>): Notification[] {
  const list: Notification[] = [];
  for (const id of s.order) {
    const n = s.items.get(id);
    if (n) list.push(n);
  }
  return list;
}
