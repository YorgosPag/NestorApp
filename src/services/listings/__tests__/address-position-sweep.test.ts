/**
 * ΑΓΚΥΡΑ — **ο ιδιοκτήτης του κύκλου ζωής της θέσης** (ADR-332 §D33).
 *
 * Το κενό που κλείνει: μια διεύθυνση χωρίς κριμένη θέση ολοκληρωνόταν **μόνο** μέσα σε αποθήκευση με αλλαγές.
 * Εδώ αποδεικνύεται ότι (α) τη βρίσκει χωρίς κανένα κλικ, (β) την ολοκληρώνει με τον έναν γραφέα, (γ) η
 * άγνοια του παρόχου γίνεται αναμονή — όχι απώλεια, όχι σφυροκόπημα — και (δ) τίποτα δεν διπλογράφεται.
 *
 * Ο γραφέας (`completePendingAddressPositions`) είναι εδώ υποκατάστατο: τη δική του ορθότητα την κρατά η
 * σουίτα του. Εδώ ελέγχεται **η ενορχήστρωση**.
 */

/* global describe, it, expect, beforeEach, jest */

import type { DocumentData, Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { completePendingAddressPositions } from '../address-position-completion';
import { runAddressPositionSweep, type AddressPositionSweepDeps } from '../address-position-sweep';
import { PROJECT_ADDRESS_CONTAINER } from '../address-position-containers';
import { POSITION_WORK_BACKOFF_MS } from '@/lib/geocoding/position-work';

jest.mock('server-only', () => ({}));
jest.mock('../address-position-completion', () => ({ completePendingAddressPositions: jest.fn() }));

const complete = completePendingAddressPositions as jest.MockedFunction<typeof completePendingAddressPositions>;

const NOW = 1_800_000_000_000;
const UNCHECKED = { id: 'addr_1', street: 'Τσιμισκή', number: '43', city: 'Θεσσαλονίκη' };
const LOCATED = { ...UNCHECKED, coordinates: { lat: 40.63, lng: 22.94 }, source: 'dragged' };
const WORK = 'address_position_work';

// ============================================================================
// ΜΙΑ ΒΑΣΗ ΣΤΗ ΜΝΗΜΗ — όσα ρωτά η σάρωση, τίποτα παραπάνω
// ============================================================================

type Store = Map<string, Map<string, DocumentData>>;

function memoryDb(seed: Record<string, Record<string, DocumentData>>): { db: AdminFirestore; store: Store } {
  const store: Store = new Map(Object.entries(seed).map(([name, docs]) => [name, new Map(Object.entries(docs))]));
  const table = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  };
  const ref = (name: string, id: string) => ({
    id,
    get: async () => ({ data: () => table(name).get(id) }),
    create: async (data: DocumentData) => {
      if (table(name).has(id)) throw Object.assign(new Error('exists'), { code: 6 });
      table(name).set(id, { ...data });
    },
    update: async (patch: DocumentData) => { table(name).set(id, { ...table(name).get(id), ...patch }); },
    delete: async () => { table(name).delete(id); },
  });
  const query = (name: string, state: { after?: string; max?: number; due?: number }) => ({
    orderBy: () => query(name, state),
    where: (_field: string, _op: string, value: number) => query(name, { ...state, due: value }),
    limit: (max: number) => query(name, { ...state, max }),
    startAfter: (after: string) => query(name, { ...state, after }),
    get: async () => {
      let entries = [...table(name).entries()].sort(([a], [b]) => a.localeCompare(b));
      if (state.due !== undefined) entries = entries.filter(([, d]) => d.dueAt <= state.due!)
        .sort(([, a], [, b]) => a.dueAt - b.dueAt);
      if (state.after) entries = entries.filter(([id]) => id > state.after!);
      const docs = entries.slice(0, state.max ?? entries.length)
        .map(([id, data]) => ({ id, ref: ref(name, id), data: () => data }));
      return { docs, size: docs.length };
    },
  });
  const db = { collection: (name: string) => ({ ...query(name, {}), doc: (id: string) => ref(name, id) }) };
  return { db: db as unknown as AdminFirestore, store };
}

function deps(db: AdminFirestore, extra: Partial<AddressPositionSweepDeps> = {}): AddressPositionSweepDeps {
  return { db, cursor: {}, saveCursor: jest.fn(async () => undefined), wallClock: () => NOW, ...extra };
}

/** Ο γραφέας «απαντά»: γράφει θέση σε όποια διεύθυνση του ζητήθηκε. */
function completesWith(store: Store) {
  complete.mockImplementation(async (_db, job) => {
    const docs = store.get(job.container.collection)!;
    const data = docs.get(job.docId)!;
    docs.set(job.docId, { ...data, addresses: (data.addresses as DocumentData[]).map((a) => ({ ...a, ...LOCATED, id: a.id })) });
    return { written: job.pendingIds.length };
  });
}

beforeEach(() => complete.mockReset());

describe('Α — ανακάλυψη χωρίς κανένα κλικ', () => {
  it('Α1 — μόνο το ζωντανό έγγραφο με διεύθυνση ΧΩΡΙΣ κριμένη θέση μπαίνει στο μητρώο', async () => {
    const { db, store } = memoryDb({
      projects: {
        proj_a: { companyId: 'c1', addresses: [UNCHECKED] },
        proj_b: { companyId: 'c1', addresses: [LOCATED] },
        proj_c: { companyId: 'c1', status: 'deleted', addresses: [UNCHECKED] },
      },
    });
    complete.mockResolvedValue({ written: 0 });

    const report = await runAddressPositionSweep(deps(db, { policy: { dueLimit: 0 } }));

    expect(report.discovered).toBe(1);
    expect([...store.get(WORK)!.keys()]).toEqual(['projects__proj_a']);
    expect(store.get(WORK)!.get('projects__proj_a')).toMatchObject({ companyId: 'c1', attempts: 0, dueAt: NOW });
  });

  it('Α2 — ιδεμποτική: δεύτερη ανακάλυψη ΔΕΝ μηδενίζει την αναμονή μιας εγγραφής που ήδη περιμένει', async () => {
    const { db, store } = memoryDb({
      projects: { proj_a: { companyId: 'c1', addresses: [UNCHECKED] } },
      [WORK]: { projects__proj_a: { collection: 'projects', docId: 'proj_a', attempts: 2, dueAt: NOW + 5 } },
    });

    const report = await runAddressPositionSweep(deps(db, { policy: { dueLimit: 0 } }));

    expect(report.discovered).toBe(0);
    expect(store.get(WORK)!.get('projects__proj_a')).toMatchObject({ attempts: 2, dueAt: NOW + 5 });
  });

  it('Α3 — κυλιόμενο σημείο συνέχισης: γεμάτη σελίδα ⇒ συνεχίζει από εκεί· μισή ⇒ ο κύκλος κλείνει (`null`)', async () => {
    const { db } = memoryDb({ projects: { proj_a: { addresses: [] }, proj_b: { addresses: [] } } });
    const saveCursor = jest.fn(async () => undefined);

    await runAddressPositionSweep(deps(db, { saveCursor, policy: { discoveryPageSize: 1, dueLimit: 0 } }));
    expect(saveCursor).toHaveBeenLastCalledWith(expect.objectContaining({ projects: 'proj_a', contacts: null }));

    await runAddressPositionSweep(deps(db, { cursor: { projects: 'proj_b' }, saveCursor, policy: { discoveryPageSize: 1, dueLimit: 0 } }));
    expect(saveCursor).toHaveBeenLastCalledWith(expect.objectContaining({ projects: null }));
  });
});

describe('Ο — οφειλόμενες: ένας γραφέας, κλείσιμο ή αναμονή', () => {
  it('Ο1 — ο γραφέας απαντά ⇒ η εγγραφή ΚΛΕΙΝΕΙ και ακολουθεί ό,τι οφείλει το δοχείο (έργο: αγγελίες)', async () => {
    const { db, store } = memoryDb({ projects: { proj_a: { companyId: 'c1', addresses: [UNCHECKED] } } });
    completesWith(store);
    const onWritten = jest.fn(async () => undefined);

    const report = await runAddressPositionSweep(deps(db, { onWritten }));

    expect(complete).toHaveBeenCalledWith(db, expect.objectContaining({
      container: PROJECT_ADDRESS_CONTAINER, docId: 'proj_a', pendingIds: ['addr_1'],
    }));
    expect(report).toMatchObject({ discovered: 1, attempted: 1, written: 1, settled: 1, retried: 0 });
    expect(store.get(WORK)!.size).toBe(0);
    expect(onWritten).toHaveBeenCalledWith(PROJECT_ADDRESS_CONTAINER, 'proj_a', expect.objectContaining({ companyId: 'c1' }));
  });

  it('Ο2 — ο πάροχος δεν απαντά ⇒ ΜΙΑ δοκιμή ακόμη και αναμονή 1ώ — όχι απώλεια, όχι σφυροκόπημα', async () => {
    const { db, store } = memoryDb({ projects: { proj_a: { companyId: 'c1', addresses: [UNCHECKED] } } });
    complete.mockResolvedValue({ written: 0 });

    const report = await runAddressPositionSweep(deps(db));

    expect(report).toMatchObject({ attempted: 1, retried: 1, settled: 0 });
    expect(store.get(WORK)!.get('projects__proj_a')).toMatchObject({
      attempts: 1, lastAttemptAt: NOW, dueAt: NOW + POSITION_WORK_BACKOFF_MS[0],
    });
  });

  it('Ο3 — η οντότητα διαγράφηκε στο μεταξύ ⇒ η εγγραφή κλείνει ΧΩΡΙΣ κλήση στον γραφέα', async () => {
    const { db, store } = memoryDb({
      projects: { proj_a: { status: 'deleted', addresses: [UNCHECKED] } },
      [WORK]: { projects__proj_a: { collection: 'projects', docId: 'proj_a', attempts: 0, dueAt: NOW } },
    });

    const report = await runAddressPositionSweep(deps(db));

    expect(complete).not.toHaveBeenCalled();
    expect(report.settled).toBe(1);
    expect(store.get(WORK)!.size).toBe(0);
  });

  it('Ο4 — η θέση κρίθηκε από άνθρωπο στο μεταξύ ⇒ κλείνει χωρίς κλήση (καμία διπλή ερώτηση)', async () => {
    const { db } = memoryDb({
      projects: { proj_a: { addresses: [LOCATED] } },
      [WORK]: { projects__proj_a: { collection: 'projects', docId: 'proj_a', attempts: 3, dueAt: NOW } },
    });

    const report = await runAddressPositionSweep(deps(db));

    expect(complete).not.toHaveBeenCalled();
    expect(report.settled).toBe(1);
  });

  it('Ο5 — εγγραφή ΜΕΛΛΟΝΤΙΚΗ ⇒ δεν αγγίζεται (η αναμονή τηρείται)', async () => {
    const { db } = memoryDb({
      projects: { proj_a: { addresses: [UNCHECKED] } },
      [WORK]: { projects__proj_a: { collection: 'projects', docId: 'proj_a', attempts: 1, dueAt: NOW + 1 } },
    });

    await runAddressPositionSweep(deps(db));

    expect(complete).not.toHaveBeenCalled();
  });

  it('Ο6 — εξαντλημένη προθεσμία ⇒ καμία νέα δοκιμή· οι οφειλόμενες μένουν οφειλόμενες (`deferred`)', async () => {
    const { db, store } = memoryDb({ projects: { proj_a: { addresses: [UNCHECKED] }, proj_b: { addresses: [UNCHECKED] } } });
    let clock = NOW;
    const wallClock = () => clock;
    complete.mockImplementation(async () => {
      clock += 10_000_000; // η πρώτη δοκιμή τρώει όλη την προθεσμία
      return { written: 0 };
    });

    const report = await runAddressPositionSweep(deps(db, { wallClock }));

    expect(report).toMatchObject({ attempted: 1, deferred: 1 });
    expect(store.get(WORK)!.get('projects__proj_b')).toMatchObject({ attempts: 0 });
  });
});
