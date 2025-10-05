// stores/notificationStore.ts
import { create } from 'zustand';

type Notification = {
  id: string;
  title: string;
  body?: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
  read: boolean;
};

type State = {
  items: Notification[];
  unread: number;
  add: (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markRead: (ids?: string[]) => void;
  loadMock: () => void;
};

export const useNotificationStore = create<State>((set, get) => ({
  items: [],
  unread: 0,
  add: n => set(s => {
    const item = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), read: false, ...n };
    return { items: [item, ...s.items], unread: s.unread + 1 };
  }),
  markRead: ids => set(s => {
    const all = s.items.map(x => {
      if (!ids || ids.includes(x.id)) return { ...x, read: true };
      return x;
    });
    const unread = all.filter(x => !x.read).length;
    return { items: all, unread };
  }),
  loadMock: () => {
    const mock = [1, 2, 3].map(i => ({
      id: crypto.randomUUID(),
      title: `Mock event ${i}`,
      body: `Payload ${i}`,
      kind: 'info' as const,
      createdAt: new Date().toISOString(),
      read: false
    }));
    set({ items: mock, unread: mock.length });
  }
}));
