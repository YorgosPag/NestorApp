/**
 * «Διπλή κλήση» για τον συγχρονισμό τιμής υλικού (ADR-873 Φ1 Στάδιο 1 — ζητούμενο Giorgio).
 *
 * Τρεις ερωτήσεις, και οι τρεις για **χρήματα**:
 *   1. Το ίδιο γεγονός δύο φορές αλλάζει το `avgPrice` **δύο** φορές; (η αλλοίωση)
 *   2. Δύο παραγγελίες του ίδιου υλικού ταυτόχρονα χάνουν ενημέρωση; (Ε-873.4)
 *   3. Δύο γραμμές της **ίδιας** παραγγελίας μετράνε **δύο** φορές; (η σημερινή συμπεριφορά,
 *      απόφαση Giorgio — δηλώνεται εδώ ώστε να μην αλλάξει κατά λάθος)
 *
 * @module functions/procurement/__tests__/material-price-sync-write
 */

jest.mock('firebase-functions/v1', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('firebase-admin', () => ({
  firestore: Object.assign(() => ({}), {
    Timestamp: { fromMillis: (ms: number) => ({ __ts: ms }) },
  }),
}));

import * as admin from 'firebase-admin';

import { COLLECTIONS } from '../../config/firestore-collections';
import { generateFunctionEventId } from '../../config/enterprise-id';
import { asFirestore, FakeFirestore } from '../../shared/__tests__/fake-firestore';
import {
  materialPriceSyncSeed,
  syncMaterialPriceOnce,
  type DeliveredLine,
} from '../material-price-sync-write';

const NOW = 1_758_000_000_000;
const MATERIAL_PATH = `${COLLECTIONS.MATERIALS}/mat_1`;

const line = (overrides: Partial<DeliveredLine> = {}): DeliveredLine => ({
  companyId: 'comp_1',
  poId: 'po_1',
  materialId: 'mat_1',
  lineId: 'line_1',
  unitPrice: 200,
  deliveredAt: admin.firestore.Timestamp.fromMillis(NOW),
  ...overrides,
});

const material = (avgPrice: number | null, overrides: Record<string, unknown> = {}) => ({
  companyId: 'comp_1',
  isDeleted: false,
  avgPrice,
  ...overrides,
});

const storeWith = (avgPrice: number | null, overrides: Record<string, unknown> = {}) =>
  new FakeFirestore({ [MATERIAL_PATH]: material(avgPrice, overrides) });

const claimPathOf = (deliveredLine: DeliveredLine) =>
  `${COLLECTIONS.FUNCTION_EVENT_RECORDS}/${generateFunctionEventId(materialPriceSyncSeed(deliveredLine))}`;

describe('syncMaterialPriceOnce — η ίδια παράδοση, δύο φορές', () => {
  it('🔴 δεύτερη κλήση ΔΕΝ ξανακουνά το avgPrice', async () => {
    const db = storeWith(100);

    const first = await syncMaterialPriceOnce(asFirestore(db), line(), NOW);
    const second = await syncMaterialPriceOnce(asFirestore(db), line(), NOW + 1_000);

    expect(first).toEqual({ kind: 'applied', avgPrice: 150 });
    expect(second).toEqual({ kind: 'skipped', reason: 'already-applied' });
    expect(db.read(MATERIAL_PATH)?.avgPrice).toBe(150);
  });

  it('η τρίτη και η τέταρτη κλήση επίσης όχι — ο δείκτης δεν «ξεχνά»', async () => {
    const db = storeWith(100);
    for (let i = 0; i < 4; i++) await syncMaterialPriceOnce(asFirestore(db), line(), NOW + i);
    expect(db.read(MATERIAL_PATH)?.avgPrice).toBe(150);
  });

  it('ο δείκτης και η τιμή γράφονται ΜΑΖΙ — καμία ενδιάμεση κατάσταση', async () => {
    const db = storeWith(100);
    await syncMaterialPriceOnce(asFirestore(db), line(), NOW);

    expect(db.paths()).toEqual([claimPathOf(line()), MATERIAL_PATH].sort());
    expect(db.read(claimPathOf(line()))).toMatchObject({ state: 'done', completedAtMs: NOW });
  });

  it('🔑 ΝΕΑ μετάβαση delivered της ίδιας παραγγελίας δεν ξαναμετρά (businessSeed, όχι γεγονός)', async () => {
    const db = storeWith(100);
    await syncMaterialPriceOnce(asFirestore(db), line(), NOW);

    // Ίδια παραγγελία, ίδια γραμμή, εντελώς άλλη στιγμή — άλλο γεγονός, ίδια επιχειρηματική
    // ταυτότητα. Αυτό θα περνούσε αν το κλειδί ήταν firestoreChangeSeed.
    const later = await syncMaterialPriceOnce(asFirestore(db), line(), NOW + 86_400_000);

    expect(later).toEqual({ kind: 'skipped', reason: 'already-applied' });
    expect(db.read(MATERIAL_PATH)?.avgPrice).toBe(150);
  });
});

describe('syncMaterialPriceOnce — η σημερινή συμπεριφορά, δηλωμένη', () => {
  it('πρώτη αγορά ΟΡΙΖΕΙ τον μέσο όρο', async () => {
    const db = storeWith(null);
    expect(await syncMaterialPriceOnce(asFirestore(db), line(), NOW)).toEqual({
      kind: 'applied',
      avgPrice: 200,
    });
  });

  it('δύο ΓΡΑΜΜΕΣ της ίδιας παραγγελίας μετράνε δύο φορές (απόφαση Giorgio)', async () => {
    const db = storeWith(100);

    await syncMaterialPriceOnce(asFirestore(db), line({ lineId: 'line_1', unitPrice: 200 }), NOW);
    await syncMaterialPriceOnce(asFirestore(db), line({ lineId: 'line_2', unitPrice: 300 }), NOW);

    // (100+200)/2 = 150 · (150+300)/2 = 225
    expect(db.read(MATERIAL_PATH)?.avgPrice).toBe(225);
  });

  it('γράφει lastPrice και lastPurchaseDate μαζί με τον μέσο όρο', async () => {
    const db = storeWith(100);
    await syncMaterialPriceOnce(asFirestore(db), line(), NOW);

    expect(db.read(MATERIAL_PATH)).toMatchObject({
      avgPrice: 150,
      lastPrice: 200,
      lastPurchaseDate: { __ts: NOW },
    });
  });
});

describe('syncMaterialPriceOnce — Ε-873.4: ταυτόχρονες παραγγελίες', () => {
  it('🔴 καμία χαμένη ενημέρωση όταν άλλος γράφει ανάμεσα στην ανάγνωση και το commit', async () => {
    const db = storeWith(100);

    // Η «άλλη παραγγελία» commit-άρει αφού εμείς διαβάσαμε 100: χωρίς συναλλαγή θα γράφαμε 150
    // πάνω από το 300 της και η ενημέρωσή της θα εξαφανιζόταν σιωπηλά.
    db.interleaveOnce(() => {
      db.applyWrite({ kind: 'update', path: MATERIAL_PATH, data: { avgPrice: 300 } });
    });

    const result = await syncMaterialPriceOnce(asFirestore(db), line(), NOW);

    // (300+200)/2 = 250 — δηλαδή ξαναδιαβάσαμε την τιμή της, δεν τη σβήσαμε.
    expect(result).toEqual({ kind: 'applied', avgPrice: 250 });
    expect(db.read(MATERIAL_PATH)?.avgPrice).toBe(250);
    expect(db.transactionAttempts).toBeGreaterThan(1);
  });
});

describe('syncMaterialPriceOnce — τίποτα δεν έγινε, τίποτα δεν διεκδικείται', () => {
  it.each([
    ['ανύπαρκτο υλικό', new FakeFirestore({}), 'material-missing'],
    ['ξένος μισθωτής', storeWith(100, { companyId: 'comp_2' }), 'tenant-mismatch'],
    ['διαγραμμένο υλικό', storeWith(100, { isDeleted: true }), 'material-deleted'],
  ])('%s ⇒ %s, χωρίς δείκτη', async (_label, db, reason) => {
    const result = await syncMaterialPriceOnce(asFirestore(db as FakeFirestore), line(), NOW);

    expect(result).toEqual({ kind: 'skipped', reason });
    // 🔑 Ο δείκτης ΔΕΝ γράφτηκε: το υλικό μπορεί να υπάρξει στην επόμενη απόπειρα της
    // πλατφόρμας, και ένας δείκτης εδώ θα έκανε τη σιωπή μόνιμη.
    expect((db as FakeFirestore).paths()).not.toContain(claimPathOf(line()));
  });
});
