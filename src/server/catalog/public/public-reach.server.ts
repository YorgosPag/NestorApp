import 'server-only';

/**
 * **Η ανάγνωση της δημόσιας εμβέλειας** (ADR-923 §5.13 Σ9): τα γεγονότα πίσω από το «Δημόσια ορατά: X από Y — γιατί».
 *
 * 🔑 X: το πλήθος των δημόσιων εγγράφων, από τον έναν αναγνώστη της συλλογής (CHECK 3.112). Y: τα **ίδια** ερωτήματα ρίζας με
 *    το πέρασμα. Και τα δύο aggregate `count()`: 1 ανάγνωση ανά 1.000 εγγραφές ευρετηρίου, κανένα έγγραφο.
 * 🔑 «Σε εξέλιξη» βλέπει μόνο το outbox `catalog` (πέρασμα ή αδιάβαστη αναθεώρηση). Σημειώσεις μοντέλων σε αναμονή δεν μετρώνται:
 *    θα ήθελαν δείκτη `(companyId, dirty)`, και η σάρωση τις αδειάζει στο ίδιο τρέξιμο με το πέρασμα.
 *
 * @module server/catalog/public/public-reach.server
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { AuthContext } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { countPublishedModels } from '@/services/public-catalog/public-catalog.reader';
import { readPublicationCondition } from '@/subapps/catalog/public/public-publication-condition';
import { explainPublicReach, type PublicCatalogReach } from '@/subapps/catalog/public/public-reach';
import { runCatalogReadOnly } from '../catalog-store.server';
import { readVisibilityRules } from '../visibility-reads.server';
import { publicCatalogRootQueries } from './public-catalog-pass.server';
import { PUBLIC_CATALOG_SCOPE, publicOutboxRef, type PublicOutboxRecord } from './public-outbox.server';
import { readLiveSupplierStanding } from './public-standing.server';

async function countRoots(db: Firestore, companyId: string): Promise<number> {
  const { models, products } = publicCatalogRootQueries(db, companyId);
  const [modelCount, productCount] = await Promise.all([models.count().get(), products.count().get()]);
  return modelCount.data().count + productCount.data().count;
}

interface PassState {
  readonly syncing: boolean;
  readonly lastPassAtMs: number | null;
}

/**
 * ⚠️ Η ώρα είναι το `passClosedAtMs` (κλείσιμο **κάθε** περάσματος), **όχι** το `fullPassAtMs`: εκείνο γράφεται μόνο όταν η σάρωση
 * ζητά το ημερήσιο, και μετρήθηκε ζωντανά (2026-11-07) να μένει 11:55 μετά από δύο περάσματα αλλαγής κανόνα. Χωρίς τιμή ⇒ `null`.
 */
async function readPassState(db: Firestore, companyId: string): Promise<PassState> {
  const record = (await publicOutboxRef(db, companyId, PUBLIC_CATALOG_SCOPE).get()).data() as PublicOutboxRecord | undefined;
  if (record === undefined) return { syncing: false, lastPassAtMs: null };
  const syncing = record.pass !== undefined || record.revision > (record.drainedRevision ?? 0);
  return { syncing, lastPassAtMs: record.passClosedAtMs ?? null };
}

/** Η εμβέλεια του καταλόγου του χώρου του καλούντος. Βλάβη οποιασδήποτε ανάγνωσης ρίχνει: ο καλών απαντά 503, ποτέ «0 από Y». */
export async function readPublicCatalogReach(ctx: AuthContext): Promise<PublicCatalogReach> {
  const db = getAdminFirestore();
  const { companyId } = ctx;
  const [published, total, rules, condition, pass] = await Promise.all([
    countPublishedModels(companyId),
    countRoots(db, companyId),
    runCatalogReadOnly(ctx, readVisibilityRules),
    readPublicationCondition(companyId, readLiveSupplierStanding),
    readPassState(db, companyId),
  ]);
  const reasons = explainPublicReach({ published, total, condition, rules, syncing: pass.syncing, atMs: Date.now() });
  return { published, total, lastPassAtMs: pass.lastPassAtMs, reasons };
}
