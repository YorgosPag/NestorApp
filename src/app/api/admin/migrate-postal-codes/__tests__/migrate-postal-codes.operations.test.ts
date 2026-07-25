/**
 * Unit tests — μετάπτωση Τ.Κ. (ADR-332 D16).
 *
 * Ελέγχεται η ίδια η λογική (`migratePostalCodes`) με πλαστό Admin Firestore,
 * όχι το HTTP περίβλημα: guard/audit/error body έρχονται από το SSoT
 * (`createMigrationRoute`, ADR-704) και δοκιμάζονται εκεί. Αντιγραφή του
 * route-test scaffolding εδώ θα ήταν ακριβώς το sibling clone του N.18.
 *
 * Συμβόλαιο:
 *  - GET/dry-run ⇒ ΜΗΔΕΝ εγγραφές.
 *  - Ιδιοτροπία: δεύτερη εκτέλεση βρίσκει 0.
 *  - Ξένες διευθύνσεις ΔΕΝ αγγίζονται.
 *  - Καθαρίζονται ΚΑΙ η αυθεντική εγγραφή ΚΑΙ το παράγωγο.
 */

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { migratePostalCodes } from '../migration-operations';

type DocData = Record<string, unknown>;

interface CommittedWrite {
  id: string;
  data: DocData;
}

/**
 * Πλαστό Admin Firestore: μόνο ό,τι αγγίζει η μετάπτωση — `collection().get()`
 * και `batch().update()/commit()`. Οι εγγραφές εφαρμόζονται πίσω στα δεδομένα
 * ώστε να μπορεί να ελεγχθεί η ιδιοτροπία με δεύτερη εκτέλεση.
 */
function fakeDb(store: Record<string, Record<string, DocData>>) {
  const committed: CommittedWrite[] = [];

  const refFor = (collection: string, id: string) => ({ __collection: collection, __id: id });

  const db = {
    collection: (name: string) => ({
      get: async () => {
        const docs = Object.entries(store[name] ?? {}).map(([id, data]) => ({
          id,
          ref: refFor(name, id),
          data: () => data,
        }));
        return { size: docs.length, docs };
      },
    }),
    batch: () => ({
      update: (ref: { __collection: string; __id: string }, data: DocData) => {
        committed.push({ id: ref.__id, data });
        const target = store[ref.__collection]?.[ref.__id];
        if (!target) return;
        for (const [fieldPath, value] of Object.entries(data)) {
          const segments = fieldPath.split('.');
          let cursor = target as DocData;
          for (const segment of segments.slice(0, -1)) {
            cursor = cursor[segment] as DocData;
          }
          cursor[segments[segments.length - 1]] = value;
        }
      },
      commit: async () => undefined,
    }),
  };

  return { db: db as unknown as Firestore, committed };
}

function contactStore() {
  return {
    [COLLECTIONS.CONTACTS]: {
      cont_alfa: {
        companyId: 'comp_1',
        addresses: [
          { street: 'Ονειροπόλων', postalCode: '546 24', country: 'GR' },
          { street: 'Τσιμισκή', postalCode: '54623', country: 'GR' },
        ],
        customFields: {
          companyAddresses: [{ street: 'Ονειροπόλων', postalCode: '546 24' }],
        },
      },
    },
    [COLLECTIONS.PROJECTS]: {
      proj_1: {
        companyId: 'comp_1',
        addresses: [{ street: 'Εγνατίας', postalCode: '546 22', country: 'Greece' }],
      },
    },
    [COLLECTIONS.BUILDINGS]: {},
  };
}

describe('migratePostalCodes', () => {
  it('dry-run: αναφέρει τι θα άλλαζε ΧΩΡΙΣ καμία εγγραφή', async () => {
    const store = contactStore();
    const { db, committed } = fakeDb(store);

    const report = await migratePostalCodes(db, true);

    expect(committed).toHaveLength(0);
    expect(report.dryRun).toBe(true);
    expect(report.affectedDocuments).toBe(2);
    expect(report.affectedAddresses).toBe(3);
    // Τα δεδομένα μένουν ανέγγιχτα
    expect(store[COLLECTIONS.CONTACTS].cont_alfa.addresses).toEqual([
      { street: 'Ονειροπόλων', postalCode: '546 24', country: 'GR' },
      { street: 'Τσιμισκή', postalCode: '54623', country: 'GR' },
    ]);
  });

  it('καθαρίζει ΚΑΙ την αυθεντική εγγραφή ΚΑΙ το παράγωγο', async () => {
    const store = contactStore();
    const { db } = fakeDb(store);

    await migratePostalCodes(db, false);

    const contact = store[COLLECTIONS.CONTACTS].cont_alfa;
    expect((contact.addresses as DocData[])[0].postalCode).toBe('54624');
    const custom = contact.customFields as { companyAddresses: DocData[] };
    expect(custom.companyAddresses[0].postalCode).toBe('54624');
    // Αν καθαριζόταν μόνο το ένα, η επόμενη αποθήκευση θα ξανάγραφε το άλλο.
  });

  it('περνά και τα Έργα, όχι μόνο τις Επαφές', async () => {
    const store = contactStore();
    const { db } = fakeDb(store);

    await migratePostalCodes(db, false);

    expect((store[COLLECTIONS.PROJECTS].proj_1.addresses as DocData[])[0].postalCode).toBe('54622');
  });

  it('είναι ιδιότροπη — δεύτερη εκτέλεση δεν βρίσκει τίποτα', async () => {
    const store = contactStore();
    const { db } = fakeDb(store);

    await migratePostalCodes(db, false);
    const second = await migratePostalCodes(db, false);

    expect(second.affectedDocuments).toBe(0);
    expect(second.affectedAddresses).toBe(0);
  });

  it('ΔΕΝ αγγίζει ξένες διευθύνσεις', async () => {
    const store = {
      [COLLECTIONS.CONTACTS]: {
        cont_uk: {
          addresses: [
            { street: 'Downing Street', postalCode: 'SW1A 2AA', country: 'United Kingdom' },
            // Σουηδική μορφή «123 45» — ταιριάζει στο σχήμα, αλλά ΟΧΙ ελληνική χώρα.
            { street: 'Drottninggatan', postalCode: '111 51', country: 'Sweden' },
          ],
        },
      },
      [COLLECTIONS.PROJECTS]: {},
      [COLLECTIONS.BUILDINGS]: {},
    };
    const { db, committed } = fakeDb(store);

    const report = await migratePostalCodes(db, false);

    expect(report.affectedDocuments).toBe(0);
    expect(committed).toHaveLength(0);
    expect((store[COLLECTIONS.CONTACTS].cont_uk.addresses as DocData[])[1].postalCode).toBe('111 51');
  });

  it('αντέχει έγγραφα χωρίς πίνακα διευθύνσεων', async () => {
    const store = {
      [COLLECTIONS.CONTACTS]: {
        cont_bare: { companyId: 'comp_1' },
        cont_wrong_shape: { addresses: 'not-an-array' },
      },
      [COLLECTIONS.PROJECTS]: {},
      [COLLECTIONS.BUILDINGS]: {},
    };
    const { db } = fakeDb(store);

    const report = await migratePostalCodes(db, true);

    expect(report.scannedDocuments).toBe(2);
    expect(report.affectedDocuments).toBe(0);
  });

  it('καταγράφει τη διαδρομή του πεδίου στην αναφορά', async () => {
    const store = contactStore();
    const { db } = fakeDb(store);

    const report = await migratePostalCodes(db, true);
    const contactEntry = report.entries.find((e) => e.documentId === 'cont_alfa');

    expect(contactEntry?.changes).toEqual([
      { path: 'addresses', index: 0, from: '546 24', to: '54624' },
      { path: 'customFields.companyAddresses', index: 0, from: '546 24', to: '54624' },
    ]);
  });
});
