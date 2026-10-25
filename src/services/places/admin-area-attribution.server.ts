import 'server-only';

/**
 * @fileoverview **Η ΔΙΟΙΚΗΤΙΚΗ ΑΠΟΔΟΣΗ ΜΙΑΣ ΘΕΣΗΣ, ΜΕ ΤΗ ΔΗΛΩΣΗ ΤΟΥ ΕΚΔΟΤΗ** — μία πόρτα για τρεις καλούντες (ADR-890 §21).
 * @related `lib/geo/admin-area-of-point.ts` (μέτρηση) · `lib/geo/admin-area-declaration.ts` (κριτής δήλωσης) ·
 *   `admin-boundaries.reader.ts` (πηγές) · `lib/listings/listing-map-shape.ts` (`listingSearchArea`, ο κύκλος αβεβαιότητας)
 *
 * 🔑 **Τρεις καλούντες, μία απάντηση**: η προβολή της αγγελίας (`listing-publication-facts.ts`), η πόρτα γραφής του
 * ιδιώτη (`owner-property-place-link.ts`) και οι επιλογές της φόρμας (`/api/geo/declarable-areas`). Αν ο καθένας
 * συνέθετε μόνος του «μέτρηση + κύκλος + δήλωση», η φόρμα θα μπορούσε να προσφέρει ό,τι η προβολή απορρίπτει.
 *
 * ⚠️ **Τρεις καταστάσεις αποτυχίας, όχι μία**: `rejected` (η δήλωση δεν στέκει — ο άνθρωπος τη διορθώνει) ·
 * `unverified` (δεν διαβάστηκαν ευρετήριο/όρια — **ποτέ** «άκυρη», ίδιο σκεπτικό με το `place-link-unverified`) ·
 * `none` (δεν δηλώθηκε τίποτα).
 */

import {
  declarableAdminAreas,
  declareAdminArea,
  deepestMeasuredId,
  type AdminAreaDeclarationRejection,
} from '@/lib/geo/admin-area-declaration';
import { ADMIN_LEVEL, type AdminArea } from '@/lib/geo/admin-area-index-file';
import { assignAdminArea, deepestAdminLevelFor, type AdminAreaAssignment } from '@/lib/geo/admin-area-of-point';
import { listingSearchArea } from '@/lib/listings/listing-map-shape';
import { ADMIN_ID_TRUSTED_VIA, identifyWithin } from '@/lib/places/admin-identity';
import type { ListingPosition } from '@/types/public-listing';
import { readAdminAreaDeclarationSources, readAdminAreaLookup } from './admin-boundaries.reader';
import { readAdminIdentitySources } from './administrative-hierarchy.reader';

/** Τι έγινε με τη δήλωση. */
export type AdminAreaDeclarationOutcome =
  | { readonly kind: 'none' }
  | { readonly kind: 'applied' }
  | { readonly kind: 'rejected'; readonly reason: AdminAreaDeclarationRejection }
  | { readonly kind: 'unverified' };

export interface AdminAreaAttribution {
  /** Η απόδοση — μετρημένη, με τη δηλωμένη ουρά όταν επικυρώθηκε· `null` = δεν αποδόθηκε τίποτα. */
  readonly assignment: AdminAreaAssignment | null;
  readonly declaration: AdminAreaDeclarationOutcome;
}

const NONE: AdminAreaDeclarationOutcome = { kind: 'none' };
const UNVERIFIED: AdminAreaDeclarationOutcome = { kind: 'unverified' };

type KnownPosition = Extract<ListingPosition, { kind: 'known' }>;

/** Η **μετρημένη** απόδοση — `undefined` = δεν διαβάστηκαν τα όρια (≠ `null` = «δεν πέφτει σε περιοχή»). */
async function measure(position: KnownPosition): Promise<AdminAreaAssignment | null | undefined> {
  const deepest = deepestAdminLevelFor(position);
  if (deepest === null) return null;
  const lookup = await readAdminAreaLookup();
  if (lookup === null) return undefined; // ο αναγνώστης το έχει ήδη καταγράψει
  return assignAdminArea(position.point, deepest, lookup);
}

/** Η δήλωση πάνω στη μέτρηση — ο κύκλος αβεβαιότητας είναι ο ΙΔΙΟΣ της αναζήτησης. */
async function withDeclaration(
  measured: AdminAreaAssignment,
  position: KnownPosition,
  declaredAreaId: string,
): Promise<AdminAreaAttribution> {
  const where = listingSearchArea(position);
  const sources = await readAdminAreaDeclarationSources();
  if (where === null || sources === null) return { assignment: measured, declaration: UNVERIFIED };

  const verdict = await declareAdminArea(measured, declaredAreaId, where, sources);
  return verdict.kind === 'applied'
    ? { assignment: verdict.assignment, declaration: { kind: 'applied' } }
    : { assignment: measured, declaration: { kind: 'rejected', reason: verdict.reason } };
}

/**
 * **Η απόδοση μιας θέσης**, με τη δήλωση του εκδότη αν υπάρχει. Ποτέ πιο ακριβής από τη θέση· η δήλωση μόνο
 * συμπληρώνει βαθύτερες βαθμίδες και **δεν** αγγίζει σημείο ή ακρίβεια. Μπορεί να πετάξει (ανάγνωση αρχείων)·
 * ο καλών αποφασίζει τι σημαίνει αυτό για τη δική του πράξη.
 */
export async function attributeAdminArea(
  position: ListingPosition,
  declaredAreaId: string | null,
): Promise<AdminAreaAttribution> {
  const declaredNothing = declaredAreaId === null;
  if (position.kind === 'unknown') return { assignment: null, declaration: declaredNothing ? NONE : UNVERIFIED };

  const measured = await measure(position);
  if (measured === undefined) return { assignment: null, declaration: declaredNothing ? NONE : UNVERIFIED };
  if (declaredNothing) return { assignment: measured, declaration: NONE };
  // Καμία μετρημένη περιοχή (σημείο εκτός Ελλάδας) ⇒ τίποτα να επιβεβαιώσει τη δήλωση.
  if (measured === null) return { assignment: null, declaration: { kind: 'rejected', reason: 'contradicts-measured' } };
  return withDeclaration(measured, position, declaredAreaId);
}

/** Η μετρημένη απόδοση, οι περιοχές που μπορούν να δηλωθούν πάνω της, και η πρόταση της μηχανής. */
export interface DeclarableAdminAreas {
  readonly measured: AdminAreaAssignment | null;
  readonly candidates: readonly AdminArea[];
  /**
   * **Η πρόταση** — η τοποθεσία που αναγνώρισε ο geocoder, ταυτοποιημένη **μέσα** στη μετρημένη περιοχή. Είναι
   * `inferred` (ADR-842 Α7): η φόρμα τη δείχνει προεπιλεγμένη και ο άνθρωπος την **επιβεβαιώνει**· μόνο τότε γίνεται
   * δήλωση. Πάντα μία από τις {@link candidates} — ποτέ πρόταση που ο server θα απέρριπτε.
   */
  readonly suggestedId: string | null;
}

/** Από το στενότερο στο ευρύτερο: «Σίβηρη» είναι οικισμός, όχι Δ.Ε. — ο πρώτος που ταυτοποιείται νικά. */
const SUGGESTION_LEVELS = [ADMIN_LEVEL.settlement, ADMIN_LEVEL.community, ADMIN_LEVEL.municipalUnit] as const;

/**
 * **Ποια από τις επιλογές ονομάζει η μηχανή;** — με τον ΥΠΑΡΧΟΝΤΑ κριτή ταυτότητας (`identifyWithin`), **μέσα στην
 * εμβέλεια** της μετρημένης περιοχής, όπου οι 41 ομώνυμες «Καλλιθέα» γίνονται μία. Αμφίσημο ⇒ καμία πρόταση.
 */
async function suggestionAmong(
  locality: string | null,
  scopeId: string | null,
  candidates: readonly AdminArea[],
): Promise<string | null> {
  if (locality === null || locality.trim() === '' || scopeId === null || candidates.length === 0) return null;
  const sources = await readAdminIdentitySources();
  if (sources === null) return null;

  const offered = new Set(candidates.map(({ id }) => id));
  for (const level of SUGGESTION_LEVELS) {
    const verdict = identifyWithin(locality, level, scopeId, sources);
    if (verdict.kind === 'identified' && ADMIN_ID_TRUSTED_VIA.includes(verdict.via) && offered.has(verdict.entity.id)) {
      return verdict.entity.id;
    }
  }
  return null;
}

const NO_CHOICE: DeclarableAdminAreas = { measured: null, candidates: [], suggestedId: null };

/**
 * **Οι επιλογές της φόρμας** — ό,τι ο {@link attributeAdminArea} θα δεχόταν για αυτή τη θέση (ADR-890 §21).
 * Θέση που ήδη φτάνει ως την κοινότητα ⇒ καμία επιλογή (δεν υπάρχει βαθύτερη βαθμίδα με όριο).
 * `null` = δεν διαβάστηκαν οι πηγές (ο καλών απαντά 503, ποτέ «καμία επιλογή»).
 *
 * @param locality Η τοποθεσία όπως την αναγνώρισε ο geocoder — για την πρόταση· ποτέ για τις επιλογές.
 */
export async function declarableAdminAreasAt(
  position: ListingPosition,
  locality: string | null,
): Promise<DeclarableAdminAreas | null> {
  if (position.kind === 'unknown') return NO_CHOICE;
  const measured = await measure(position);
  if (measured === undefined) return null;
  if (measured === null) return NO_CHOICE;

  const where = listingSearchArea(position);
  const sources = await readAdminAreaDeclarationSources();
  if (where === null || sources === null) return null;
  const candidates = await declarableAdminAreas(measured, where, sources);
  return { measured, candidates, suggestedId: await suggestionAmong(locality, deepestMeasuredId(measured), candidates) };
}
