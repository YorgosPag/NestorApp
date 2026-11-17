/**
 * Μια **ψεύτικη Firestore μίας συνεδρίας πληρωμής** για τις σουίτες της κράτησης marketplace (μεταφορά · διακανονισμός):
 * συναλλαγή, `update` με διαδρομές «a.b», και κάθε ερώτημα επιστρέφει τη μία συνεδρία. Ένας ορισμός, ώστε οι σουίτες να μη
 * γράφουν η καθεμία τη δική της.
 */

import type { Firestore } from 'firebase-admin/firestore';

export type Doc = Record<string, unknown>;

/** Εφαρμόζει ενημέρωση με διαδρομές «a.b» — όπως το `update` του Firestore. */
function applyUpdate(doc: Doc, patch: Doc): Doc {
  const next: Doc = structuredClone(doc);
  for (const [path, value] of Object.entries(patch)) {
    const keys = path.split('.');
    let node: Doc = next;
    for (const key of keys.slice(0, -1)) node = (node[key] ?? (node[key] = {})) as Doc;
    node[keys[keys.length - 1]] = value;
  }
  return next;
}

export function fakeCheckoutDb(initial: Doc) {
  let stored: Doc | null = structuredClone(initial);
  const ref = { id: 'pchk_1' };
  const snapshot = () => ({ id: 'pchk_1', exists: stored !== null, data: () => (stored === null ? undefined : structuredClone(stored)) });
  const query = { get: async () => ({ docs: stored === null ? [] : [snapshot()] }) };
  const db = {
    collection: () => ({
      doc: () => ref,
      where: () => ({ limit: () => query }),
    }),
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({
      get: async () => snapshot(),
      update: (_ref: unknown, patch: Doc) => { stored = applyUpdate(stored ?? {}, patch); },
    }),
  };
  return { db: db as unknown as Firestore, read: () => stored };
}

/** Μια πληρωμένη συνεδρία προκαταβολής (4000 λεπτά, `pmt_1`) με την κράτηση που δίνεται. */
export function advanceCheckoutDoc(marketplace: Doc | null): Doc {
  return {
    companyId: 'comp_1', subjectKind: 'issuance-advance', assignmentId: 'dia_1', withdrawalWaiverAt: '2026-11-17T09:00:00.000Z',
    provider: 'everypay', method: 'card', amountMinor: 4000, currency: 'EUR', status: 'paid', providerReference: 'pnt_1',
    paymentReference: 'pmt_1', lastFailure: null, marketplace, createdAt: '2026-11-17T09:00:00.000Z',
    expiresAt: '2026-11-17T09:30:00.000Z',
  };
}

/** Η κράτηση μιας συνεδρίας χωρίς ακόμη μεταφορά, μίσθωση ή εντολή. */
export const EMPTY_MARKETPLACE: Doc = { payeeReference: 'sel_1', transferReference: null, transferDue: false, lease: null, settlement: null };
