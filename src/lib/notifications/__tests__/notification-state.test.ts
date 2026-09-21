/**
 * ADR-867 Β9(β) Ε10 — ΑΓΚΥΡΕΣ του **ενός** κριτή κατάστασης ειδοποίησης (κουδούνι · συρτάρι · σελίδα).
 *
 *   Σ-1  🔴 Η αποσυρμένη ΔΕΝ φαίνεται και ΔΕΝ μετρά στο σήμα (μετάλλαξη: λείπει από τις κρυφές)
 *   Σ-2  Η «με ενέργεια» είναι διαβασμένη — ίδια απάντηση στο σήμα και στη λίστα (η παλιά απόκλιση)
 *   Σ-3  Κάθε κατάσταση απαντά σε ΑΚΡΙΒΩΣ ένα από: αδιάβαστη · διαβασμένη · κρυφή
 */

import { isHiddenFromInbox, isNotificationRead, isNotificationUnread } from '@/lib/notifications/notification-state';
import type { DeliveryState } from '@/types/notification';

const ALL: readonly DeliveryState[] = ['queued', 'sent', 'delivered', 'seen', 'acted', 'failed', 'expired', 'dismissed', 'withdrawn'];

describe('ο κριτής κατάστασης ειδοποίησης', () => {
  it('Σ-1 🔴 η αποσυρμένη ΔΕΝ φαίνεται και ΔΕΝ μετρά στο σήμα', () => {
    expect(isHiddenFromInbox('withdrawn')).toBe(true);
    expect(isNotificationUnread('withdrawn')).toBe(false);
  });

  it('Σ-2 η «με ενέργεια» είναι διαβασμένη — και δεν μετρά στο σήμα', () => {
    expect(isNotificationRead('acted')).toBe(true);
    expect(isNotificationUnread('acted')).toBe(false);
    expect(isNotificationUnread('delivered')).toBe(true);
  });

  it('Σ-3 κάθε κατάσταση σε ΑΚΡΙΒΩΣ μία κατηγορία', () => {
    for (const state of ALL) {
      const buckets = [isNotificationUnread(state), isNotificationRead(state), isHiddenFromInbox(state)].filter(Boolean);
      expect({ state, buckets: buckets.length }).toStrictEqual({ state, buckets: 1 });
    }
  });
});
