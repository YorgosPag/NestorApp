import 'server-only';

/**
 * =============================================================================
 * ΚΡΑΤΗΣΕΙΣ ΜΟΝΑΔΙΚΩΝ ΤΙΜΩΝ — «ο 016-15-001 ανήκει ήδη σε άλλο είδος» (ADR-923 §5.10 Δ3)
 * =============================================================================
 *
 * Akeneo: πίνακας `pim_catalog_product_unique_data` με μοναδικό δείκτη (ιδιότητα, τιμή). Εδώ: ένα έγγραφο ανά
 * (χώρος, ιδιότητα, **κανονικοποιημένη** τιμή) με **ντετερμινιστικό** id ⇒ η μοναδικότητα είναι δομική, μέσα
 * στη **ίδια** συναλλαγή με το προϊόν. Κανένα ερώτημα «υπάρχει ήδη;» με race.
 *
 * 🏆 Πέρα από το Akeneo:
 *   - **Ανταλλαγή μέσα σε δέσμη**: η παραλλαγή Α δίνει τον κωδικό της στη Β και παίρνει άλλον στην ίδια
 *     επικόλληση ⇒ επιτρέπεται (η κράτηση απελευθερώνεται και ξανακρατείται στην ίδια συναλλαγή).
 *   - **Μπαγιάτικη κράτηση** (ο κάτοχος δεν είναι πια ενεργός — π.χ. εγγραφή πριν από κάποιο σφάλμα) ⇒
 *     **ανακτάται**, δεν κλειδώνει τον κωδικό για πάντα. Ζώνη ασφαλείας πάνω από την απελευθέρωση στη διαγραφή.
 *   - **Ομοιότητα σχήματος** (UTS #39, `lib/unicode/skeleton`): «Ο16-15-OO1» με κεφαλαίο όμικρον δεν είναι ο
 *     ίδιος κωδικός (σωστά — κανένα μπλοκ), αλλά **προειδοποιεί** «μοιάζει με υπάρχοντα». Ποτέ ταυτότητα:
 *     θα έκανε το «I1» ≡ «11» και θα απέρριπτε νόμιμους κωδικούς (§5.10.1).
 *
 * @module server/catalog/unique-reservations.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { skeleton } from '@/lib/unicode/skeleton';
import { generateDeterministicCatalogUniqueValueId } from '@/services/enterprise-id.service';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { CatalogValueHolderKind } from '@/subapps/catalog/types/product';
import { readActiveByIds } from './catalog-library-reads.server';
import {
  stageUniqueClaim,
  stageUniqueRelease,
  uniqueValueRef,
  type CatalogTx,
  type CatalogUniqueValueDoc,
} from './catalog-store.server';

/** Τι κρατούσε και τι θα κρατά ένας φορέας: id ιδιότητας → κλειδί (`derived.uniqueKeys`). */
export interface HolderUniqueDelta {
  readonly holderKind: CatalogValueHolderKind;
  readonly holderId: string;
  readonly before: Readonly<Record<string, string>>;
  readonly after: Readonly<Record<string, string>>;
  /** Η διαδρομή του ευρήματος για αυτή την ιδιότητα αυτού του φορέα (π.χ. `variants.<id>.values.<attr>`). */
  readonly pathOf: (attributeId: string) => string;
}

export interface ReservationPlan {
  readonly claims: readonly CatalogUniqueValueDoc[];
  readonly releases: readonly string[];
  /** Μπλοκάρουν (422). */
  readonly issues: readonly CatalogIssue[];
  /** Δεν μπλοκάρουν — γράφονται στο `derived.warnings` του φορέα. */
  readonly warnings: ReadonlyMap<string, readonly CatalogIssue[]>;
}

interface Claim {
  readonly doc: CatalogUniqueValueDoc;
  readonly path: string;
}

function reservationIdOf(scope: CatalogTx, attributeId: string, key: string): string {
  return generateDeterministicCatalogUniqueValueId(scope.ctx.companyId, attributeId, key);
}

function diffDeltas(scope: CatalogTx, deltas: readonly HolderUniqueDelta[]): { claims: Claim[]; releases: Set<string> } {
  const claims: Claim[] = [];
  const releases = new Set<string>();
  for (const delta of deltas) {
    for (const [attributeId, key] of Object.entries(delta.before)) {
      if (delta.after[attributeId] !== key) releases.add(reservationIdOf(scope, attributeId, key));
    }
    for (const [attributeId, key] of Object.entries(delta.after)) {
      if (delta.before[attributeId] === key) continue;
      const doc: CatalogUniqueValueDoc = {
        id: reservationIdOf(scope, attributeId, key),
        companyId: scope.ctx.companyId,
        attributeId,
        uniqueKey: key,
        skeleton: skeleton(key),
        holderKind: delta.holderKind,
        holderId: delta.holderId,
        createdAt: scope.now,
      };
      claims.push({ doc, path: delta.pathOf(attributeId) });
    }
  }
  return { claims, releases };
}

/** Οι υπάρχουσες κρατήσεις στα ids των νέων διεκδικήσεων — με τους κατόχους τους, αν είναι ακόμη ενεργοί. */
async function readHeld(scope: CatalogTx, claims: readonly Claim[]) {
  const snaps = claims.length === 0 ? [] : await scope.tx.getAll(...claims.map((claim) => uniqueValueRef(scope.db, claim.doc.id)));
  const held = new Map<string, CatalogUniqueValueDoc>();
  for (const snap of snaps) {
    const data = snap.data() as CatalogUniqueValueDoc | undefined;
    if (data && data.companyId === scope.ctx.companyId) held.set(snap.id, data);
  }
  const holders = [...held.values()];
  const liveModels = await readActiveByIds(scope, 'productModel', holders.filter((h) => h.holderKind === 'productModel').map((h) => h.holderId));
  const liveProducts = await readActiveByIds(scope, 'product', holders.filter((h) => h.holderKind === 'product').map((h) => h.holderId));
  const isLive = (doc: CatalogUniqueValueDoc) => (doc.holderKind === 'product' ? liveProducts : liveModels).has(doc.holderId);
  return { held, isLive };
}

/** Κωδικοί που **μοιάζουν** (ίδιος σκελετός) με άλλου φορέα — προειδοποίηση, ποτέ μπλοκ. */
async function similarityWarnings(scope: CatalogTx, claims: readonly Claim[]): Promise<Map<string, CatalogIssue[]>> {
  const warnings = new Map<string, CatalogIssue[]>();
  for (const { doc, path } of claims) {
    const snap = await scope.tx.get(
      scope.db
        .collection(COLLECTIONS.CATALOG_UNIQUE_VALUES)
        .where('companyId', '==', scope.ctx.companyId)
        .where('attributeId', '==', doc.attributeId)
        .where('skeleton', '==', doc.skeleton)
        .limit(5),
    );
    const other = snap.docs.map((d) => d.data() as CatalogUniqueValueDoc).find((d) => d.id !== doc.id && d.holderId !== doc.holderId);
    if (!other) continue;
    const list = warnings.get(doc.holderId) ?? [];
    list.push({ code: 'uniqueValueLooksLike', path, params: { holderId: other.holderId } });
    warnings.set(doc.holderId, list);
  }
  return warnings;
}

/**
 * Σχεδιάζει τις κρατήσεις μιας συναλλαγής: **μόνο αναγνώσεις** (όλες πριν από κάθε εγγραφή). Η σκηνοθεσία
 * γίνεται μετά, με το `stageReservationPlan`, και μόνο αν δεν υπάρχουν μπλοκάροντα ευρήματα.
 */
export async function planUniqueReservations(scope: CatalogTx, deltas: readonly HolderUniqueDelta[]): Promise<ReservationPlan> {
  const { claims, releases } = diffDeltas(scope, deltas);
  const { held, isLive } = await readHeld(scope, claims);
  const issues: CatalogIssue[] = [];
  const claimedHere = new Map<string, string>();
  for (const { doc, path } of claims) {
    const firstInBatch = claimedHere.get(doc.id);
    const existing = held.get(doc.id);
    const takenByOther = existing !== undefined && existing.holderId !== doc.holderId && !releases.has(doc.id) && isLive(existing);
    if (firstInBatch !== undefined) issues.push({ code: 'uniqueValueTaken', path, params: { holderId: firstInBatch } });
    else if (takenByOther) issues.push({ code: 'uniqueValueTaken', path, params: { holderId: existing.holderId } });
    claimedHere.set(doc.id, doc.holderId);
  }
  const warnings = issues.length > 0 ? new Map<string, CatalogIssue[]>() : await similarityWarnings(scope, claims);
  return { claims: claims.map((claim) => claim.doc), releases: [...releases], issues, warnings };
}

/** Σκηνοθετεί το σχέδιο: πρώτα απελευθερώσεις, μετά κρατήσεις (η ανταλλαγή μέσα στη δέσμη γράφει την τελική). */
export function stageReservationPlan(scope: CatalogTx, plan: ReservationPlan): void {
  const claimed = new Set(plan.claims.map((claim) => claim.id));
  plan.releases.filter((id) => !claimed.has(id)).forEach((id) => stageUniqueRelease(scope, id));
  plan.claims.forEach((claim) => stageUniqueClaim(scope, claim));
}
