/**
 * @jest-environment node
 *
 * @fileoverview Άγκυρα της μετανάστευσης του φράχτη ανάγνωσης (ADR-862 Φ0 Β11).
 *
 * Η μετανάστευση είναι η ΜΟΝΗ διαδρομή που γράφει `cdeReadReach` σε παλιά έγγραφα. Αν
 * γράψει λάθος τιμή, ο θεματοφύλακας κάνει το αρχείο `unreadable` — δηλαδή η ίδια η
 * «διόρθωση» θα το έκρυβε. Κλειδώνουμε: παραγωγή από τον ΓΝΗΣΙΟ αναγνώστη, ιδεμποτησία,
 * και άρνηση γραφής σε βλάβη.
 */

jest.mock('firebase-admin', () => ({}));
jest.mock('../_shared/loadEnvLocal', () => ({ applyEnvLocal: jest.fn() }));
jest.mock('../_shared/firebaseAdminOps', () => ({ initAdminApp: jest.fn() }));

import { planReadReach } from '../migrate-cde-read-reach';

const SEAL = { by: 'u_author', at: '2026-09-17T10:00:00.000Z', revision: 2 };

describe('planReadReach', () => {
  it('pre-cde χωρίς φράχτη ⇒ γράψε tenant', () => {
    expect(planReadReach({ companyId: 'c' })).toEqual({ kind: 'write', reach: 'tenant' });
  });

  it('WIP (σφραγισμένο) χωρίς φράχτη ⇒ γράψε author — ΠΟΤΕ tenant', () => {
    expect(planReadReach({ cdeState: 'WIP', cdeSeal: SEAL, revision: 2 })).toEqual({
      kind: 'write',
      reach: 'author',
    });
  });

  it('SUPERSEDED με απόδειξη (κληρονομιά του Β10) ⇒ γράψε tenant', () => {
    expect(planReadReach({ cdeState: 'SUPERSEDED', supersededByFileId: 'file_new' })).toEqual({
      kind: 'write',
      reach: 'tenant',
    });
  });

  it('ιδεμποτησία: σωστός φράχτης ήδη ⇒ noop', () => {
    expect(planReadReach({ cdeReadReach: 'tenant' })).toEqual({ kind: 'noop' });
  });

  it('⛔ βλάβη ⇒ ΑΝΑΦΟΡΑ, ποτέ γραφή', () => {
    expect(planReadReach({ cdeState: 'SHARED' })).toEqual({
      kind: 'unreadable',
      why: 'shared-without-share-act',
    });
  });
});
