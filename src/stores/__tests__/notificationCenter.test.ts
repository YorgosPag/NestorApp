/**
 * Η σειρά του κουδουνιού — «νεότερη πρώτη», ανεξάρτητα από τη σειρά άφιξης (ADR-901 §14.6 Δ · ζωντανή δοκιμή 2026-10-04).
 *
 * Το σφάλμα που φυλάει: το `ingest` έκανε `unshift` ανά στοιχείο σε σελίδα που το API δίνει ήδη `createdAt desc` ⇒
 * αντέστρεφε τη σελίδα και το κουδούνι έδειχνε την παλιότερη πρώτη.
 */

import type { Notification } from '@/types/notification';
import { useNotificationCenter } from '../notificationCenter';

function notification(id: string, createdAt: string): Notification {
  return {
    id,
    tenantId: 't',
    userId: 'u',
    createdAt,
    severity: 'info',
    title: id,
    source: { service: 'test' },
    channel: 'inapp',
    delivery: { state: 'delivered', attempts: 1 },
  };
}

const OLD = notification('old', '2026-09-26T10:31:00.000Z');
const MID = notification('mid', '2026-10-03T21:57:00.000Z');
const NEW = notification('new', '2026-10-04T10:13:00.000Z');

describe('notificationCenter — σειρά', () => {
  beforeEach(() => useNotificationCenter.getState().reset());

  it('σελίδα από το API (νεότερη πρώτη) ⇒ μένει νεότερη πρώτη', () => {
    useNotificationCenter.getState().ingest([NEW, MID, OLD]);
    expect(useNotificationCenter.getState().order).toEqual(['new', 'mid', 'old']);
  });

  it('οποιαδήποτε σειρά άφιξης ⇒ νεότερη πρώτη', () => {
    useNotificationCenter.getState().ingest([MID, OLD, NEW]);
    expect(useNotificationCenter.getState().order).toEqual(['new', 'mid', 'old']);
  });

  it('δεύτερη σελίδα (παλιότερες) ⇒ μπαίνουν από κάτω', () => {
    useNotificationCenter.getState().ingest([NEW, MID]);
    useNotificationCenter.getState().ingest([OLD]);
    expect(useNotificationCenter.getState().order).toEqual(['new', 'mid', 'old']);
  });

  it('επανάληψη της ίδιας ειδοποίησης ⇒ καμία διπλή γραμμή', () => {
    useNotificationCenter.getState().ingest([NEW, MID]);
    useNotificationCenter.getState().ingest([NEW]);
    expect(useNotificationCenter.getState().order).toEqual(['new', 'mid']);
  });
});
