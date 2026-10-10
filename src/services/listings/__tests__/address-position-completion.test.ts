/**
 * ΑΓΚΥΡΑ — **η εκκρεμής θέση γράφεται μετά, και μόνο αν αφορά ακόμη τη διεύθυνση** (ADR-332 D29).
 *
 * Τρεις ιδιότητες, και καθεμία είναι ο λόγος που η ολοκλήρωση επιτρέπεται να τρέχει **χωρίς
 * άνθρωπο** (`after()`):
 * - **γράφει** ό,τι απάντησε η μηχανή για τη διεύθυνση που ρωτήθηκε·
 * - **δεν γράφει** όταν ο άνθρωπος άλλαξε στο μεταξύ το κείμενο ή έσυρε την πινέζα·
 * - **δεν γράφει** όταν η μηχανή δεν μπόρεσε να ρωτήσει — και δεύτερη εκτέλεση δεν αλλάζει τίποτα.
 */

/* global describe, it, expect, beforeEach, jest */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { completePendingAddressPositions } from '../address-position-completion';
import { geocodeWithVerdict } from '@/app/api/geocoding/geocoding-engine';
import { EntityAuditService } from '@/services/entity-audit.service';

jest.mock('server-only', () => ({}));
jest.mock('../listing-scope-republish', () => ({ republishListingsForProject: jest.fn() }));
jest.mock('@/app/api/geocoding/geocoding-engine', () => ({ geocodeWithVerdict: jest.fn() }));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn().mockResolvedValue('audit_1') },
}));

const engine = geocodeWithVerdict as jest.MockedFunction<typeof geocodeWithVerdict>;
const recordChange = EntityAuditService.recordChange as jest.MockedFunction<typeof EntityAuditService.recordChange>;

type Address = Record<string, unknown> & { id: string };

const HIT = {
  kind: 'hit',
  result: { lat: 40.6403, lng: 22.9444, accuracy: 'exact', confidence: 0.9, source: { variantUsed: 1 } },
} as unknown as Awaited<ReturnType<typeof geocodeWithVerdict>>;

const PENDING: Address = { id: 'addr_1', street: 'Τσιμισκή', number: '43', city: 'Θεσσαλονίκη', country: 'GR' };
const SETTLED: Address = {
  id: 'addr_2',
  street: 'Εγνατία',
  number: '1',
  city: 'Θεσσαλονίκη',
  coordinates: { lat: 40.63, lng: 22.95 },
  source: 'dragged',
};

/** Ένα έγγραφο στη μνήμη — αρκετό για `get` / `runTransaction`. `mutate` τρέχει ΠΡΙΝ τη συναλλαγή. */
function fakeDb(initial: Address[], mutateBeforeTransaction?: (addresses: Address[]) => Address[]) {
  const state: { addresses: Address[]; updates: number; extra: Record<string, unknown> } = {
    addresses: initial,
    updates: 0,
    extra: {},
  };
  const document = () => ({ name: 'Έργο Α', companyId: 'comp_1', addresses: state.addresses });
  const ref = { get: async () => ({ data: document }) };
  const db = {
    collection: () => ({ doc: () => ref }),
    runTransaction: async (run: (tx: unknown) => Promise<number>) => {
      if (mutateBeforeTransaction) state.addresses = mutateBeforeTransaction(state.addresses);
      return run({
        get: async () => ({ data: document }),
        update: (_ref: unknown, patch: { addresses: Address[] } & Record<string, unknown>) => {
          const { addresses, ...extra } = patch;
          state.addresses = addresses;
          state.extra = extra;
          state.updates += 1;
        },
      });
    },
  };
  return { db: db as unknown as AdminFirestore, state };
}

const JOB = { collection: 'projects', docId: 'proj_1', entityType: 'project' as const, pendingIds: ['addr_1'] };

beforeEach(() => {
  engine.mockReset();
  recordChange.mockClear();
});

describe('ολοκλήρωση εκκρεμών θέσεων', () => {
  it('Ο1 — γράφει τη θέση της εκκρεμούς διεύθυνσης και ΜΟΝΟ αυτής', async () => {
    engine.mockResolvedValue(HIT);
    const { db, state } = fakeDb([PENDING, SETTLED]);

    const outcome = await completePendingAddressPositions(db, JOB);

    expect(outcome.written).toBe(1);
    expect(state.addresses[0]).toMatchObject({
      id: 'addr_1',
      street: 'Τσιμισκή',
      coordinates: { lat: 40.6403, lng: 22.9444 },
      source: 'geocoded',
    });
    // Η απόδειξη ταξιδεύει μαζί: για ΠΟΙΟ κείμενο ισχύει η θέση.
    expect((state.addresses[0].geocodingMetadata as { resolvedFor?: unknown }).resolvedFor).toMatchObject({
      street: 'Τσιμισκή',
      number: '43',
    });
    expect(state.addresses[1]).toEqual(SETTLED);
    expect(engine).toHaveBeenCalledTimes(1);
  });

  it('Ο2 — το κείμενο άλλαξε στο μεταξύ ⇒ η απάντηση πετιέται, καμία γραφή', async () => {
    engine.mockResolvedValue(HIT);
    const { db, state } = fakeDb([PENDING], (addresses) =>
      addresses.map((address) => ({ ...address, street: 'Μητροπόλεως' })),
    );

    const outcome = await completePendingAddressPositions(db, JOB);

    expect(outcome.written).toBe(0);
    expect(state.updates).toBe(0);
    expect(state.addresses[0].coordinates).toBeUndefined();
  });

  it('Ο3 — ο άνθρωπος έσυρε την πινέζα στο μεταξύ ⇒ η πινέζα του μένει', async () => {
    engine.mockResolvedValue(HIT);
    const pin = { lat: 40.6, lng: 22.9 };
    const { db, state } = fakeDb([PENDING], (addresses) =>
      addresses.map((address) => ({ ...address, coordinates: pin, source: 'dragged' })),
    );

    const outcome = await completePendingAddressPositions(db, JOB);

    expect(outcome.written).toBe(0);
    expect(state.addresses[0].coordinates).toEqual(pin);
  });

  it('Ο4 — «δεν μπόρεσα να ρωτήσω» ⇒ καμία γραφή, καμία συναλλαγή', async () => {
    engine.mockResolvedValue({ kind: 'unavailable' } as Awaited<ReturnType<typeof geocodeWithVerdict>>);
    const { db, state } = fakeDb([PENDING]);

    const outcome = await completePendingAddressPositions(db, JOB);

    expect(outcome.written).toBe(0);
    expect(state.updates).toBe(0);
  });

  it('Ο5 — ιδεμποτικό: δεύτερη εκτέλεση δεν γράφει ξανά', async () => {
    engine.mockResolvedValue(HIT);
    const { db, state } = fakeDb([PENDING]);

    await completePendingAddressPositions(db, JOB);
    const second = await completePendingAddressPositions(db, JOB);

    expect(second.written).toBe(0);
    expect(state.updates).toBe(1);
  });

  it('Ο6 — παλιά θέση ΑΛΛΟΥ κειμένου και η νέα διεύθυνση δεν υπάρχει ⇒ η παλιά θέση σβήνει', async () => {
    // Η προθεσμία κρατά ό,τι ήταν αποθηκευμένο· αν η νέα διεύθυνση αποδειχθεί ανύπαρκτη, η θέση
    // του ΠΡΟΗΓΟΥΜΕΝΟΥ κειμένου δεν επιτρέπεται να μείνει κάτω από το νέο.
    engine.mockResolvedValue({ kind: 'absent' } as Awaited<ReturnType<typeof geocodeWithVerdict>>);
    const stale: Address = {
      ...PENDING,
      coordinates: { lat: 37.98, lng: 23.72 },
      source: 'geocoded',
      geocodingMetadata: { accuracy: 'exact', confidence: 0.9, variantUsed: 1, resolvedFor: { street: 'Σταδίου', city: 'Αθήνα' } },
    };
    const { db, state } = fakeDb([stale]);

    const outcome = await completePendingAddressPositions(db, JOB);

    expect(outcome.written).toBe(1);
    expect(state.addresses[0].coordinates).toBeUndefined();
    expect(state.addresses[0].geocodingMetadata).toBeUndefined();
  });

  it('Ο7 — αποτυχία της βάσης δεν πετά: καταγράφεται και επιστρέφει μηδέν', async () => {
    const db = {
      collection: () => ({ doc: () => ({ get: async () => { throw new Error('βάση'); } }) }),
    } as unknown as AdminFirestore;

    await expect(completePendingAddressPositions(db, JOB)).resolves.toEqual({ written: 0 });
  });
});

describe('«μετακίνησε την πινέζα» που δεν πρόλαβε την προθεσμία', () => {
  const PINNED: Address = { ...PENDING, coordinates: { lat: 40.6, lng: 22.9 }, source: 'dragged' };

  it('Μ1 — ΜΕ δήλωση μετακίνησης: η μηχανή ρωτιέται και η πινέζα πηγαίνει στη διεύθυνση', async () => {
    engine.mockResolvedValue(HIT);
    const { db, state } = fakeDb([PINNED]);

    const outcome = await completePendingAddressPositions(db, { ...JOB, relocateIds: ['addr_1'] });

    expect(outcome.written).toBe(1);
    expect(state.addresses[0]).toMatchObject({ coordinates: { lat: 40.6403, lng: 22.9444 }, source: 'geocoded' });
  });

  it('Μ2 — ΧΩΡΙΣ δήλωση: η πινέζα του ανθρώπου μένει και η μηχανή δεν ρωτιέται καν', async () => {
    engine.mockResolvedValue(HIT);
    const { db, state } = fakeDb([PINNED]);

    const outcome = await completePendingAddressPositions(db, JOB);

    expect(outcome.written).toBe(0);
    expect(state.addresses[0].coordinates).toEqual({ lat: 40.6, lng: 22.9 });
    expect(engine).not.toHaveBeenCalled();
  });

  it('Μ3 — ο άνθρωπος ξανάσυρε την πινέζα στο μεταξύ ⇒ η μετακίνηση πετιέται', async () => {
    engine.mockResolvedValue(HIT);
    const again = { lat: 40.61, lng: 22.91 };
    const { db, state } = fakeDb([PINNED], (addresses) =>
      addresses.map((address) => ({ ...address, coordinates: again })),
    );

    const outcome = await completePendingAddressPositions(db, { ...JOB, relocateIds: ['addr_1'] });

    expect(outcome.written).toBe(0);
    expect(state.addresses[0].coordinates).toEqual(again);
  });
});

describe('παράγωγα πεδία — στην ΙΔΙΑ συναλλαγή με τη θέση', () => {
  it('Π1 — ό,τι παράγει το `derive` γράφεται μαζί με τις διευθύνσεις, από ό,τι ΓΡΑΦΕΤΑΙ', async () => {
    engine.mockResolvedValue(HIT);
    const { db, state } = fakeDb([PENDING]);
    const derive = jest.fn((addresses: readonly { coordinates?: { lat: number; lng: number } }[]) => ({
      latitude: addresses[0].coordinates?.lat,
      longitude: addresses[0].coordinates?.lng,
    }));

    await completePendingAddressPositions(db, { ...JOB, derive });

    expect(state.updates).toBe(1);
    expect(state.extra).toEqual({ latitude: 40.6403, longitude: 22.9444 });
  });

  it('Π2 — καμία αλλαγή θέσης ⇒ το `derive` δεν καλείται', async () => {
    engine.mockResolvedValue({ kind: 'absent' } as Awaited<ReturnType<typeof geocodeWithVerdict>>);
    const { db } = fakeDb([PENDING]);
    const derive = jest.fn(() => ({}));

    await completePendingAddressPositions(db, { ...JOB, derive });

    expect(derive).not.toHaveBeenCalled();
  });
});

describe('ιστορικό — η μηχανή λέει τι άλλαξε', () => {
  it('Ι1 — μία γραμμή, με ταυτότητα ΜΗΧΑΝΗΣ, στο χρονολόγιο της οντότητας', async () => {
    engine.mockResolvedValue(HIT);
    const { db } = fakeDb([PENDING, SETTLED]);

    await completePendingAddressPositions(db, JOB);

    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(recordChange.mock.calls[0][0]).toMatchObject({
      entityType: 'project',
      entityId: 'proj_1',
      entityName: 'Έργο Α',
      action: 'updated',
      performedBy: 'system:address-position',
      companyId: 'comp_1',
    });
  });

  it('Ι2 — η αλλαγή ονομάζει ΤΗ διεύθυνση και δείχνει συντεταγμένες που διαβάζει άνθρωπος', async () => {
    engine.mockResolvedValue(HIT);
    const { db } = fakeDb([PENDING, SETTLED]);

    await completePendingAddressPositions(db, JOB);

    expect(recordChange.mock.calls[0][0].changes).toEqual([
      {
        field: 'addresses',
        oldValue: null,
        newValue: null,
        label: 'addresses',
        kind: 'collection',
        op: 'modified',
        itemKey: 'k:addr_1',
        itemLabel: 'Τσιμισκή — 43',
        subChanges: [{ subField: 'coordinates', oldValue: null, newValue: '40.64030, 22.94440' }],
      },
    ]);
  });

  it('Ι3 — καμία γραφή ⇒ καμία γραμμή (ούτε όταν η απάντηση πετάχτηκε)', async () => {
    engine.mockResolvedValue(HIT);
    const { db } = fakeDb([PENDING], (addresses) =>
      addresses.map((address) => ({ ...address, street: 'Μητροπόλεως' })),
    );

    await completePendingAddressPositions(db, JOB);

    expect(recordChange).not.toHaveBeenCalled();
  });

  it('Ι4 — το ιστορικό γράφεται ΜΕΤΑ τη συναλλαγή, όχι μέσα της', async () => {
    engine.mockResolvedValue(HIT);
    const { db, state } = fakeDb([PENDING]);
    let updatesWhenRecorded = -1;
    recordChange.mockImplementationOnce(async () => {
      updatesWhenRecorded = state.updates;
      return 'audit_1';
    });

    await completePendingAddressPositions(db, JOB);

    expect(updatesWhenRecorded).toBe(1);
  });
});
