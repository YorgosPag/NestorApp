/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΓΡΑΦΕΑΣ ΤΩΝ ΑΔΕΙΩΝ ΚΡΙΝΕΙ ΜΕΣΑ ΣΤΗ ΣΥΝΑΛΛΑΓΗ** — ADR-915 §34 Λ5 (καμία διπλή δήλωση).
 * @related services/mandate/showcase-licence-custody.ts · lib/agency/showcase-licence.ts (`licenceDeclaredTwice`)
 *
 * 🔑 Ο κριτής (`licenceDeclaredTwice`) είναι **πραγματικός**· ψεύτικα είναι μόνο η συναλλαγή και ο αναγνώστης του
 *    εγγράφου (`readShowcase` — έχει δικές του σουίτες). Ελέγχεται **τι γράφτηκε**, όχι μόνο τι επέστρεψε.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ELECTRICAL_INSTALLER_ESCO_URIS } from '@/config/electrical-installer-occupations';
import type { PublicShowcase, ShowcaseCredential, ShowcaseLicence } from '@/types/agency-profile';

import { showcaseFixture } from '@/lib/agency/__fixtures__/showcase-fixture';

let stored: PublicShowcase | null = null;
jest.mock('@/lib/agency/showcase-read', () => ({
  readShowcase: () => (stored === null ? { outcome: 'absent' } : { outcome: 'showcase', showcase: stored }),
}));

import { saveShowcaseLicences } from '../showcase-licence-custody';

const REGISTERED_ELECTRICIAN: ShowcaseCredential = {
  standing: 'self-declared',
  occupation: { escoUri: ELECTRICAL_INSTALLER_ESCO_URIS[0], label: { el: 'ηλεκτρολόγος', en: 'electrician' }, iscoCode: '7411' },
  attestation: {
    state: 'declared',
    registration: { authorityKind: 'chapter', authority: 'regional-authority', chapter: 'ΠΕ Λάρισας', number: '77' },
  },
};

const INSTALLER: ShowcaseLicence = {
  licence: 'electrical-installer',
  attestation: {
    state: 'declared',
    registration: { authorityKind: 'chapter', authority: 'regional-authority', chapter: 'ΠΕ Λάρισας', number: '77' },
  },
};

function fakeDb(): { readonly db: AdminFirestore; readonly update: jest.Mock } {
  const update = jest.fn();
  const transaction = { get: async () => ({ exists: stored !== null, data: () => ({}) }), update };
  const db = {
    collection: () => ({ doc: () => ({ id: 'comp_x' }) }),
    runTransaction: async <T,>(fn: (tx: typeof transaction) => Promise<T>): Promise<T> => fn(transaction),
  };
  return { db: db as unknown as AdminFirestore, update };
}

beforeEach(() => {
  stored = null;
});

describe('ADR-915 §34 Λ5 — μία δήλωση ανά άδεια', () => {
  it('🔴 Γ1 — ρητή άδεια εγκαταστάτη ενώ η ειδικότητα την ΕΧΕΙ ήδη ⇒ ονομασμένη άρνηση, ΚΑΜΙΑ γραφή', async () => {
    stored = showcaseFixture({ credentials: [REGISTERED_ELECTRICIAN], licences: [] });
    const { db, update } = fakeDb();

    expect(await saveShowcaseLicences(db, 'comp_x', [INSTALLER])).toEqual({
      kind: 'rejected',
      reason: 'licence-held-through-occupation',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('🔑 Γ2 — ο ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: ηλεκτρολόγος ΧΩΡΙΣ αριθμό Περιφέρειας ⇒ η ρητή άδεια γράφεται', async () => {
    stored = showcaseFixture({ credentials: [{ ...REGISTERED_ELECTRICIAN, attestation: { state: 'unknown' } }], licences: [] });
    const { db, update } = fakeDb();

    expect(await saveShowcaseLicences(db, 'comp_x', [INSTALLER])).toEqual({ kind: 'saved', licences: [INSTALLER] });
    expect(update).toHaveBeenCalledWith(expect.anything(), { licences: [INSTALLER] });
  });

  it('🔑 Γ3 — η κενή λίστα (ενοποίηση μετά τη δήλωση στην ειδικότητα) γράφεται πάντα', async () => {
    stored = showcaseFixture({ credentials: [REGISTERED_ELECTRICIAN], licences: [INSTALLER] });
    const { db, update } = fakeDb();

    expect(await saveShowcaseLicences(db, 'comp_x', [])).toEqual({ kind: 'saved', licences: [] });
    expect(update).toHaveBeenCalledWith(expect.anything(), { licences: [] });
  });

  it('Γ4 — χωρίς βιτρίνα ⇒ η παλιά άρνηση, πριν από κάθε άλλη κρίση', async () => {
    const { db, update } = fakeDb();
    expect(await saveShowcaseLicences(db, 'comp_x', [INSTALLER])).toEqual({
      kind: 'rejected',
      reason: 'licences-without-showcase',
    });
    expect(update).not.toHaveBeenCalled();
  });
});
