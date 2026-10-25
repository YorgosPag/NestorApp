import 'server-only';

/**
 * =============================================================================
 * Η ΕΡΓΑΣΙΑ ΕΠΑΝΥΠΟΛΟΓΙΣΜΟΥ ΤΩΝ ΠΑΡΑΓΩΓΩΝ — σελίδα-σελίδα, ιδεμπότητη (ADR-923 §5.10 Δ7)
 * =============================================================================
 *
 * Αλλαγή απαιτήσεων οικογένειας ή γλωσσών καναλιού ⇒ η αποθηκευμένη πληρότητα **κάθε** προϊόντος γίνεται
 * μπαγιάτικη. Αυτό **δεν** γράφεται πουθενά: το **αποδεικνύει** η ανάγνωση (`isCompletenessStale`, Δ7). Η εργασία
 * εδώ τη **διορθώνει**:
 *
 *   - μονάδα = **ένα σύνολο** (ρίζα + απόγονοι, ή απλό προϊόν), σε **δική του** συναλλαγή, μέσα από την **ίδια**
 *     μηχανή με τις αποθηκεύσεις (`commitAggregate` χωρίς αλλαγές) — καμία δεύτερη υλοποίηση της πληρότητας·
 *   - **ιδεμπότητη**: η μηχανή γράφει (`stageDerived`) **μόνο** παράγωγα που διαφέρουν — δεύτερη εκτέλεση = μηδέν
 *     εγγραφές· καμία αναθεώρηση, κανένα ίχνος (κανείς άνθρωπος δεν άλλαξε τίποτα)·
 *   - **συνεχιζόμενη**: δρομέας `m:<id>` (ρίζες) → `p:<id>` (απλά προϊόντα) → τέλος. Κάθε κλήση επεξεργάζεται μία
 *     σελίδα και επιστρέφει τον επόμενο δρομέα (Akeneo: `compute_completeness_of_products_family`, εδώ χωρίς ουρά).
 *   - ένα σύνολο που **δεν** περνά πια την κρίση (π.χ. κανόνας που έγινε αυστηρότερος σε αξονική τιμή) **δεν** σταματά
 *     την εργασία: μετριέται ως `rejected` και η εργασία συνεχίζει (ο άνθρωπος το βλέπει στην επόμενη επεξεργασία).
 *
 * @module server/catalog/completeness-recompute.server
 */

import { FieldPath, type Query } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { commitAggregate } from './catalog-aggregate.server';
import { runCatalogTransaction } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';

/** Σύνολα ανά κλήση: ≤ 25 × (1 + 200) αναγνώσεις — καλά μέσα στο χρονικό όριο ενός αιτήματος. */
export const RECOMPUTE_PAGE_SIZE = 25;

export interface RecomputeRequest {
  /** Μόνο μία οικογένεια (μετά από αλλαγή της)· `null` = όλος ο χώρος (μετά από αλλαγή ρυθμίσεων). */
  readonly familyId: string | null;
  readonly cursor: string | null;
}

export interface RecomputeResult {
  readonly processed: number;
  readonly rejected: number;
  /** `null` = τέλος. */
  readonly nextCursor: string | null;
}

type Phase = 'm' | 'p';

function parseCursor(cursor: string | null): { readonly phase: Phase; readonly after: string | null } {
  if (cursor === null) return { phase: 'm', after: null };
  const [phase, after] = [cursor.slice(0, 1), cursor.slice(2)];
  if ((phase !== 'm' && phase !== 'p') || cursor[1] !== ':') throw new CatalogWriteError('invalid', [{ code: 'invalidCode', path: 'cursor' }]);
  return { phase, after: after === '' ? null : after };
}

/** Οι ρίζες (μοντέλα χωρίς γονέα) ή τα απλά προϊόντα (χωρίς μοντέλο) του χώρου — κατά id. */
function pageQuery(ctx: AuthContext, request: RecomputeRequest, phase: Phase, after: string | null): Query {
  const db = getAdminFirestore();
  let query: Query =
    phase === 'm'
      ? db.collection(COLLECTIONS.CATALOG_PRODUCT_MODELS).where('companyId', '==', ctx.companyId).where('isDeleted', '==', false).where('parentId', '==', null)
      : db.collection(COLLECTIONS.CATALOG_PRODUCTS).where('companyId', '==', ctx.companyId).where('isDeleted', '==', false).where('modelId', '==', null);
  if (request.familyId !== null) query = query.where('familyId', '==', request.familyId);
  query = query.orderBy(FieldPath.documentId());
  return (after === null ? query : query.startAfter(after)).limit(RECOMPUTE_PAGE_SIZE);
}

/** Ένα σύνολο σε δική του συναλλαγή — `false` αν η μηχανή το απέρριψε (μετριέται, δεν σταματά την εργασία). */
async function recomputeOne(ctx: AuthContext, phase: Phase, id: string): Promise<boolean> {
  try {
    await runCatalogTransaction(ctx, (scope) =>
      commitAggregate(scope, phase === 'm' ? id : null, phase === 'm' ? [] : [{ op: 'touch', kind: 'product', id }]),
    );
    return true;
  } catch (error) {
    if (error instanceof CatalogWriteError) return false;
    throw error;
  }
}

/** Μία σελίδα της εργασίας. */
export async function recomputeCatalogDerived(ctx: AuthContext, request: RecomputeRequest): Promise<RecomputeResult> {
  const { phase, after } = parseCursor(request.cursor);
  const snap = await pageQuery(ctx, request, phase, after).get();
  let rejected = 0;
  for (const doc of snap.docs) {
    if (!(await recomputeOne(ctx, phase, doc.id))) rejected += 1;
  }
  const last = snap.docs.at(-1)?.id ?? null;
  const pageFull = snap.size === RECOMPUTE_PAGE_SIZE;
  const nextCursor = pageFull && last !== null ? `${phase}:${last}` : phase === 'm' ? 'p:' : null;
  return { processed: snap.size, rejected, nextCursor };
}
