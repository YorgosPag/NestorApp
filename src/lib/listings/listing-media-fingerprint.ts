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
const MEDIA_FINGERPRINT_VERSION = 'v2';
const STAMP_PREFIX = `${MEDIA_FINGERPRINT_VERSION}:`;

/** **Η κανονική συμβολοσειρά** — ό,τι ζητήθηκε από το ράφι, με τη σειρά του, κλειδιά ταξινομημένα. */
export function mediaFingerprintInput(
  sources: readonly PublicShelfSource<ListingMaterial>[],
): string {
  return canonicalJson(sources);
}

/** Το αποτύπωμα όπως αποθηκεύεται: `v2:<sha256 hex της κανονικής συμβολοσειράς>`. */
export function stampOf(sha256Hex: string): string {
  return `${STAMP_PREFIX}${sha256Hex}`;
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
 * **Συμφωνεί το αποθηκευμένο αποτύπωμα με το τρέχον;**
 *
 * ⚠️ **Απουσία ⇒ `unknown`, ΠΟΤΕ `current`** — ίδια κατεύθυνση με το `modelFreshness`: το *«δεν
 * το μέτρησε κανείς»* δεν επιτρέπεται να διαβαστεί *«συμφωνεί»*.
 *
 * @param stored — το πεδίο **όπως βγήκε από τη βάση** (γι' αυτό `unknown`).
 * @param current — το αποτύπωμα του τρέχοντος υλικού, από {@link stampOf}.
 */
export function mediaAgreement(stored: unknown, current: string): MediaAgreement {
  if (typeof stored !== 'string' || !stored.startsWith(STAMP_PREFIX)) return 'unknown';
  return stored === current ? 'current' : 'stale';
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
