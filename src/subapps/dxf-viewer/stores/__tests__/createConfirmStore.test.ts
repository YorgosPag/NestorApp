/**
 * Tests για το createConfirmStore factory (Promise-handshake confirm SSoT).
 */

import { createConfirmStore } from '../createConfirmStore';

interface St { readonly open: boolean; readonly payload?: number }
type Action = 'yes' | 'no';

describe('createConfirmStore', () => {
  it('request → resolve περνά την επιλογή στο Promise', async () => {
    const s = createConfirmStore<St, Action>({ open: false });
    const p = s.request({ open: true, payload: 7 });
    expect(s.getSnapshot()).toEqual({ open: true, payload: 7 });
    s.resolve('yes');
    await expect(p).resolves.toBe('yes');
    expect(s.getSnapshot()).toEqual({ open: false }); // επέστρεψε στο closed
  });

  it('ειδοποιεί τους subscribers σε request ΚΑΙ resolve', () => {
    const s = createConfirmStore<St, Action>({ open: false });
    let n = 0;
    const off = s.subscribe(() => { n += 1; });
    void s.request({ open: true });
    s.resolve('no');
    expect(n).toBe(2);
    off();
    void s.request({ open: true });
    expect(n).toBe(2); // μετά το unsubscribe δεν ειδοποιεί
  });

  it('getSnapshot σταθερή reference μεταξύ αλλαγών (useSyncExternalStore-safe)', () => {
    const s = createConfirmStore<St, Action>({ open: false });
    const a = s.getSnapshot();
    expect(s.getSnapshot()).toBe(a); // ίδιο ref χωρίς αλλαγή
    const open = { open: true } as St;
    void s.request(open);
    expect(s.getSnapshot()).toBe(open); // το ίδιο object που δόθηκε
  });

  it('resolve χωρίς εκκρεμές request δεν πετά', () => {
    const s = createConfirmStore<St, Action>({ open: false });
    expect(() => s.resolve('yes')).not.toThrow();
  });
});
