import 'server-only';

/**
 * **Το πέρασμα ολόκληρου του καταλόγου** (ADR-923 §5.13 Δ3): το scope `catalog` δεν προβάλλει τίποτα, **απλώνεται** σε
 * σημειώσεις `model:<id>`, ώστε να υπάρχει ένας μόνο δρόμος προς το δημόσιο έγγραφο και ένα CAS.
 *
 * 🔑 Τμηματικό, με δρομέα στο ίδιο το outbox: ο δρομέας και οι σημειώσεις μιας σελίδας γράφονται στην ίδια συναλλαγή, άρα
 *    διακοπή στη μέση δεν χάνει ούτε διπλασιάζει σελίδα.
 * 🔑 Το πέρασμα κρατά το `revision` της αρχής του. Στο τέλος `drainedRevision` = αυτό: αλλαγή στη διάρκεια αφήνει το scope
 *    βρώμικο, και συνεχείς αλλαγές δεν το λιμοκτονούν.
 *
 * @module server/catalog/public/public-catalog-pass.server
 */

import { FieldPath, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { isDeepStrictEqual } from 'node:util';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { PublicScope } from '@/subapps/catalog/public/public-scopes-of-write';
import { PUBLIC_CATALOG_SCOPE, publicOutboxRef, signalPublicScopesInTx, type PublicCatalogPass, type PublicOutboxRecord } from './public-outbox.server';

const ROOT_PAGE = 200;

async function rootPage(db: Firestore, companyId: string, pass: PublicCatalogPass): Promise<readonly string[]> {
  const models = db
    .collection(COLLECTIONS.CATALOG_PRODUCT_MODELS)
    .where('companyId', '==', companyId)
    .where('isDeleted', '==', false)
    .where('parentId', '==', null);
  const products = db
    .collection(COLLECTIONS.CATALOG_PRODUCTS)
    .where('companyId', '==', companyId)
    .where('isDeleted', '==', false)
    .where('modelId', '==', null);
  const ordered = (pass.phase === 'models' ? models : products).orderBy(FieldPath.documentId()).limit(ROOT_PAGE);
  const snap = await (pass.afterId === null ? ordered : ordered.startAfter(pass.afterId)).get();
  return snap.docs.map((doc) => doc.id);
}

/** Η επόμενη θέση του δρομέα, ή `null` όταν το πέρασμα τελείωσε. */
function nextPass(pass: PublicCatalogPass, page: readonly string[]): PublicCatalogPass | null {
  if (page.length === ROOT_PAGE) return { ...pass, afterId: page[page.length - 1] };
  return pass.phase === 'models' ? { ...pass, phase: 'products', afterId: null } : null;
}

/** Μία σελίδα. Επιστρέφει `true` όσο μένουν κι άλλες. Δεύτερος ταυτόχρονος δρομέας δεν γράφει τίποτα. */
export async function expandPublicCatalogPage(db: Firestore, companyId: string): Promise<boolean> {
  const ref = publicOutboxRef(db, companyId, PUBLIC_CATALOG_SCOPE);
  const record = (await ref.get()).data() as PublicOutboxRecord | undefined;
  if (record === undefined) return false;
  const pass: PublicCatalogPass = record.pass ?? { revision: record.revision, phase: 'models', afterId: null };
  const page = await rootPage(db, companyId, pass);
  const next = nextPass(pass, page);
  const scopes = page.map((modelId): PublicScope => ({ kind: 'model', modelId }));
  await db.runTransaction(async (tx) => {
    const current = (await tx.get(ref)).data() as PublicOutboxRecord | undefined;
    if (current === undefined || !isDeepStrictEqual(current.pass, record.pass)) return;
    signalPublicScopesInTx(tx, db, companyId, scopes);
    const closing = { pass: FieldValue.delete(), drainedRevision: pass.revision, dirty: current.revision !== pass.revision };
    tx.set(ref, next === null ? closing : { pass: next }, { merge: true });
  });
  return next !== null;
}
