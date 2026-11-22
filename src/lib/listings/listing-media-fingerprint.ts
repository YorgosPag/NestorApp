/**
 * @fileoverview **ΤΟ «ΑΠΟΤΥΠΩΜΑ ΜΕΣΩΝ» ΜΙΑΣ ΑΓΓΕΛΙΑΣ** — *«συμφωνεί ό,τι βλέπει ο κόσμος με το τρέχον υλικό;»*
 * @related ADR-845 §7.17 Α5 (κλάση Ο-35) · services/listings/agency-media-selection (η είσοδος) ·
 *   lib/listings/model-source-revisions (το ίδιο ιδίωμα τριών απαντήσεων)
 * @module lib/listings/listing-media-fingerprint
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΕΙΝΑΙ, ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ **ΣΤΕΝΟ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η αγγελία παράγεται από τα **αρχεία** του ακινήτου. Τα στρώματα 1+2 της κλάσης Ο-35 *(πράξη
 * διακομιστή · κάθε πόρτα ξαναπροβάλλει)* οφείλουν να την κρατούν σωστή· το αποτύπωμα είναι το
 * **δίχτυ** που το **μετρά**: γράφεται τη στιγμή της δημοσίευσης, και η συμφιλίωση το συγκρίνει
 * με ό,τι θα έφευγε **τώρα**. Απόκλιση = **πόρτα που ξέφυγε**.
 *
 * ⛔ **ΜΟΝΟ τα μέσα — ποτέ όλες οι είσοδοι της αγγελίας** *(κτίριο, έργο, επωνυμία, τόπος)*:
 * μία ξεχασμένη είσοδος σε ένα «πλήρες» αποτύπωμα θα έλεγε *«συμφωνεί»* που δεν ισχύει.
 *
 * 🔑 **Ολόκληρη η έξοδος του επιλογέα, όχι επιλεγμένα πεδία της** — για τον ίδιο λόγο: νέο πεδίο
 * στο `PublicShelfSource` *(όπως έγιναν το `focalPoint`, το `captureSpot`, το `northRad`)* μπαίνει
 * στο αποτύπωμα **χωρίς να το θυμηθεί κανείς**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔒 ΓΙΑΤΙ **HASH** ΚΑΙ ΟΧΙ Η ΙΔΙΑ Η ΚΑΝΟΝΙΚΗ ΣΥΜΒΟΛΟΣΕΙΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το αποτύπωμα γράφεται **μέσα στο `public_listings`**, που το διαβάζει **όλος ο κόσμος**. Η
 * κανονική συμβολοσειρά περιέχει **μονοπάτια του ιδιωτικού κάδου** και αναγνωριστικά αρχείων —
 * ωμή, θα τα δημοσίευε. ⇒ Εδώ ζει η συμβολοσειρά *(καθαρή, σύγχρονη, κοινή σε διακομιστή και
 * browser)*· το SHA-256 το κάνει κάθε πλευρά με το δικό της εργαλείο και δένεται με {@link stampOf}.
 */

import { canonicalJson } from '@/lib/legal/canonical-json';
import type { ListingMaterial } from '@/lib/listings/listing-material';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';

/** Το πεδίο του αποθηκευμένου εγγράφου — μεταδεδομένο αποθήκευσης, δίπλα στο `schemaVersion`. */
export const MEDIA_FINGERPRINT_FIELD = 'mediaFingerprint';

/**
 * Η έκδοση της **κανονικής μορφής**. Αλλαγή στο τι μπαίνει ⇒ νέα έκδοση ⇒ κάθε παλιό αποτύπωμα
 * διαβάζεται `unknown` *(ποτέ `stale`)* και ξαναγράφεται στην επόμενη συμφιλίωση.
 */
// v2 (ADR-909 Α1, 2026-10-08): το υλικό της κάτοψης απέκτησε `provenance` ⇒ άλλη κανονική μορφή.
// v3 (ADR-920 §14.9 Γ, 2026-11-22): **δύο μέρη**, `v3:<πηγές>:<συνταγές>`. Το μέρος των πηγών είναι **ακριβώς** το hash
//    του v2 ⇒ ένα v2 αποτύπωμα συγκρίνεται κανονικά στο υλικό (καμία πλημμύρα `unknown`, κανένα ψευδές «πόρτα που
//    ξέφυγε»)· απλώς δεν έχει συνταγές, άρα η συνταγή του είναι `outdated`.
const MEDIA_FINGERPRINT_VERSION = 'v3';
/** Η προηγούμενη μορφή, που διαβάζεται ακόμη: ίδιο μέρος πηγών, χωρίς συνταγές. */
const LEGACY_SOURCES_ONLY_VERSION = 'v2';
const HEX_64 = /^[0-9a-f]{64}$/u;

/** **Η κανονική συμβολοσειρά** — ό,τι ζητήθηκε από το ράφι, με τη σειρά του, κλειδιά ταξινομημένα. */
export function mediaFingerprintInput(
  sources: readonly PublicShelfSource<ListingMaterial>[],
): string {
  return canonicalJson(sources);
}

/**
 * **Η κανονική συμβολοσειρά των ΣΥΝΤΑΓΩΝ** *(ADR-920 §14.9 Γ)* — για κάθε πηγή, με τη σειρά της, οι συνταγές των ραφιών
 * που την ψήνουν (`listingShelfRecipesOf`). Αλλαγή συνταγής ⇒ άλλο hash **μόνο** στις αγγελίες που έχουν τέτοιο υλικό.
 */
export function mediaRecipesInput(recipes: readonly (readonly string[])[]): string {
  return canonicalJson(recipes);
}

/** Το αποτύπωμα όπως αποθηκεύεται: `v3:<sha256 hex των πηγών>:<sha256 hex των συνταγών>`. */
export function stampOf(sourcesSha256Hex: string, recipesSha256Hex: string): string {
  return `${MEDIA_FINGERPRINT_VERSION}:${sourcesSha256Hex}:${recipesSha256Hex}`;
}

/** Τα δύο μέρη ενός αποθηκευμένου αποτυπώματος — ή `null` για ό,τι δεν είναι γνωστή μορφή. v2 ⇒ `recipes: null`. */
function partsOf(stamp: unknown): { readonly sources: string; readonly recipes: string | null } | null {
  if (typeof stamp !== 'string') return null;
  const [version, sources, recipes, ...rest] = stamp.split(':');
  if (rest.length > 0 || sources === undefined || !HEX_64.test(sources)) return null;
  if (version === LEGACY_SOURCES_ONLY_VERSION && recipes === undefined) return { sources, recipes: null };
  if (version === MEDIA_FINGERPRINT_VERSION && recipes !== undefined && HEX_64.test(recipes)) return { sources, recipes };
  return null;
}

/**
 * Τρεις απαντήσεις, όπως το `ModelFreshness` — **ένα** ιδίωμα παλαιότητας στην αγγελία.
 *
 * - `current` — ό,τι βλέπει ο κόσμος **είναι** το τρέχον υλικό
 * - `stale` — διαφέρει: κάποια αλλαγή αρχείου δεν έφτασε στην αγγελία
 * - `unknown` — **δεν ξέρω**: η αγγελία γράφτηκε πριν από το αποτύπωμα, με άλλη έκδοσή του, ή το
 *   ράφι της δεν συμφιλιώθηκε
 */
export type MediaAgreement = 'current' | 'stale' | 'unknown';

/**
 * **Συμφωνεί το αποθηκευμένο αποτύπωμα με το τρέχον — στο ΥΛΙΚΟ;**
 *
 * ⚠️ **Απουσία ⇒ `unknown`, ΠΟΤΕ `current`** — ίδια κατεύθυνση με το `modelFreshness`: το *«δεν
 * το μέτρησε κανείς»* δεν επιτρέπεται να διαβαστεί *«συμφωνεί»*.
 *
 * 🔑 Κοιτά **μόνο** το μέρος των πηγών: η συνταγή είναι άλλη ερώτηση ({@link recipeAgreement}). Μια αναβάθμιση της
 * μηχανής δεν είναι «πόρτα που ξέφυγε», και ο άνθρωπος δεν τη βλέπει ως «η αγγελία διαφέρει από τα αρχεία σου».
 *
 * @param stored — το πεδίο **όπως βγήκε από τη βάση** (γι' αυτό `unknown`).
 * @param current — το αποτύπωμα του τρέχοντος υλικού, από {@link stampOf}.
 */
export function mediaAgreement(stored: unknown, current: string): MediaAgreement {
  const was = partsOf(stored);
  const now = partsOf(current);
  if (was === null || now === null) return 'unknown';
  return was.sources === now.sources ? 'current' : 'stale';
}

/**
 * ADR-920 §14.9 Γ — **ψήθηκαν τα μέσα αυτής της αγγελίας με τις ΤΡΕΧΟΥΣΕΣ συνταγές;** `outdated` = μια αλλαγή συνταγής
 * (π.χ. νέα αναθεώρηση του builder εδάφους) δεν έχει φτάσει ακόμη εδώ: η αγγελία είναι σωστή στο υλικό και ξαναψήνεται
 * με ρυθμό. Μορφή που δεν ξέρει συνταγές (v2) ή δεν διαβάζεται ⇒ `outdated`, ποτέ `current`.
 */
export type RecipeAgreement = 'current' | 'outdated';

export function recipeAgreement(stored: unknown, current: string): RecipeAgreement {
  const was = partsOf(stored);
  const now = partsOf(current);
  const same = was !== null && now !== null && was.recipes !== null && was.recipes === now.recipes;
  return same ? 'current' : 'outdated';
}

/**
 * Η ετυμηγορία για **ένα ακίνητο**, όπως τη βλέπει η οθόνη του γραφείου (ADR-845 §7.17 Α5β).
 *
 * Οι τρεις του {@link MediaAgreement}, και δύο που αφορούν την **ύπαρξη** της αγγελίας:
 * - `missing` — το ακίνητο διατίθεται στο κοινό, αλλά δημόσια αγγελία **δεν υπάρχει**
 * - `unlisted` — το ακίνητο **δεν** διατίθεται στο κοινό· δεν υπάρχει τίποτα να συγκριθεί
 */
export type ListingMediaVerdict = MediaAgreement | 'missing' | 'unlisted';

/**
 * Η απάντηση του `GET|POST /api/properties/{id}/listing-media` στο σύρμα.
 *
 * 🔑 **Το `mayRefresh` το λέει ο διακομιστής**: η οθόνη δεν ξαναδιατυπώνει το *«μπορεί να αλλάξει
 * τι βλέπει ο κόσμος;»* — το ρωτά ο ΕΝΑΣ τόπος του (`mayChangePublication`) και ταξιδεύει έτοιμο.
 */
export interface ListingMediaAgreementResponse {
  readonly agreement: ListingMediaVerdict;
  readonly mayRefresh: boolean;
}

/**
 * **Έχει νόημα να προταθεί «ενημέρωση τώρα»;** — σε ό,τι **δεν** είναι αποδεδειγμένα σωστό.
 *
 * 🔑 Και στο `unknown`: μια επαναπροβολή **γράφει αποτύπωμα**, άρα είναι ο τρόπος να γίνει το «δεν
 * ξέρω» οριστική απάντηση. Ποτέ στο `unlisted` — δεν υπάρχει αγγελία να ενημερωθεί.
 */
export function needsListingRefresh(verdict: ListingMediaVerdict): boolean {
  return verdict !== 'current' && verdict !== 'unlisted';
}
