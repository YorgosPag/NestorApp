/**
 * **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΕΝΟΣ ΚΡΙΤΗ ΦΙΛΤΡΩΝ ΤΟΥ ΙΣΤΟΡΙΚΟΥ** — ζωντανό παράθυρο ΚΑΙ ουρά διακομιστή
 * @related lib/audit/global-audit-filter.ts · services/entity-audit-client.service.ts · api/audit-trail/global
 *
 * 🔑 Ο παρονομαστής σε κάθε αποκλεισμό: μια εγγραφή που ΠΕΡΝΑ δίπλα σε αυτήν που κόβεται.
 */

import type { EntityAuditEntry } from '@/types/audit-trail';

import { globalAuditFilterPredicate, hasGlobalAuditFilter } from '../global-audit-filter';

function entry(overrides: Partial<EntityAuditEntry> = {}): EntityAuditEntry {
  return {
    id: 'e',
    entityType: 'contact',
    entityId: 'c_1',
    action: 'updated',
    performedBy: 'uid_maria',
    performedByName: 'Μαρία Παπαδοπούλου',
    timestamp: '2026-10-30T12:00:00.000Z',
    ...overrides,
  } as EntityAuditEntry;
}

const pass = (filters: Parameters<typeof globalAuditFilterPredicate>[0], e: EntityAuditEntry) =>
  globalAuditFilterPredicate(filters)(e);

describe('globalAuditFilterPredicate', () => {
  it('χωρίς φίλτρο ⇒ όλα περνούν', () => {
    expect(hasGlobalAuditFilter(undefined)).toBe(false);
    expect(hasGlobalAuditFilter({})).toBe(false);
    expect(pass(undefined, entry())).toBe(true);
  });

  /** 🔴 Ο πελάτης ζητούσε ΑΚΡΙΒΗ ισότητα uid, ενώ το πεδίο της οθόνης είναι ελεύθερο κείμενο ⇒ με όνομα: τίποτα. */
  it('🔴 Φ-1 `performedBy` = μέρος ονόματος Ή uid, χωρίς διάκριση πεζών', () => {
    expect(pass({ performedBy: 'μαρία' }, entry())).toBe(true);
    expect(pass({ performedBy: 'MARIA' }, entry())).toBe(true);
    expect(pass({ performedBy: 'γιώργος' }, entry())).toBe(false);
  });

  /** 🔴 Ο πελάτης: `ts > μεσάνυχτα UTC της toDate` ⇒ ολόκληρη η ημέρα «έως» αποκλειόταν. */
  it('🔴 Φ-2 `toDate` περιλαμβάνει ΟΛΗ την ημέρα· η 00:00 της επόμενης όχι', () => {
    const filters = { toDate: '2026-10-30' };
    expect(pass(filters, entry({ timestamp: '2026-10-30T23:59:59.999Z' }))).toBe(true);
    expect(pass(filters, entry({ timestamp: '2026-10-31T00:00:00.000Z' }))).toBe(false);
  });

  it('Φ-3 `fromDate` από τις 00:00 της ημέρας', () => {
    const filters = { fromDate: '2026-10-30' };
    expect(pass(filters, entry({ timestamp: '2026-10-30T00:00:00.000Z' }))).toBe(true);
    expect(pass(filters, entry({ timestamp: '2026-10-29T23:59:59.999Z' }))).toBe(false);
  });

  it('Φ-4 με φίλτρο ημερομηνίας, εγγραφή χωρίς έγκυρη ώρα ΔΕΝ περνά (δεν αποδεικνύεται)', () => {
    expect(pass({ fromDate: '2026-01-01' }, entry({ timestamp: 'σκουπίδι' }))).toBe(false);
    expect(pass({ action: 'updated' }, entry({ timestamp: 'σκουπίδι' }))).toBe(true);
  });

  it('Φ-5 τύπος οντότητας και ενέργεια = ισότητα', () => {
    expect(pass({ entityType: 'contact', action: 'updated' }, entry())).toBe(true);
    expect(pass({ entityType: 'project' }, entry())).toBe(false);
    expect(pass({ action: 'created' }, entry())).toBe(false);
  });
});
