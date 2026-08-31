/**
 * @fileoverview **Η ΑΠΑΝΤΗΣΗ ΝΟΜΙΜΟΤΗΤΑΣ** — πέντε ονόματα, καμία σιωπή, κανένα «νόμιμο».
 * @related ADR-838 §4.6 · ADR-835 §17 (το κενό με ΟΝΟΜΑ) · §4.7 (`conditional`) ·
 *   lib/legality/legality-claim.ts · lib/date-local.ts
 * @module lib/legality/legality-signal
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΠΕΝΤΕ ΑΠΑΝΤΗΣΕΙΣ, ΚΑΙ ΚΑΜΙΑ ΔΕΝ ΕΙΝΑΙ `boolean`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Απάντηση | Τι σημαίνει | Ποιανού είναι η θεραπεία |
 * |---|---|---|
 * | `undeclared` | **καμία** αξίωση καλύπτει αυτούς τους χώρους | του **κατόχου** |
 * | `declared` | αξίωση σε ισχύ, με **βαθμίδα** | — |
 * | `expired` | υπήρξε, **έληξε** — και ξέρουμε **πότε** | του **κατόχου**, επειγόντως |
 * | `expiry-unknown` | το είδος **λήγει**, η ισχύς **δεν δηλώθηκε** | **δική μας** — δεν ρωτήσαμε |
 * | `not-applicable` | η διάθεση **δεν σηκώνει** αυτό το ερώτημα | — |
 *
 * 🔑 **Οι τρεις μεσαίες θα γίνονταν ένα `false` σε μοντέλο ναι/όχι** — και οι τρεις
 * έχουν **διαφορετικό υπόχρεο**. Είναι, κατά λέξη, το μάθημα του ADR-835 §17.4:
 * *«το ΟΝΟΜΑ αντί για `boolean`»* — και του §4.7, όπου η τρίτη κατάσταση `conditional`
 * υπήρξε επειδή δύο καταστάσεις ισοπέδωναν μια πραγματική διαφορά.
 *
 * ⛔ **ΚΑΙ ΚΑΜΙΑ ΑΠΟ ΤΙΣ ΠΕΝΤΕ ΔΕΝ ΛΕΕΙ «ΝΟΜΙΜΟ».** Το `declared` λέει *«υπάρχει
 * αξίωση, από αυτή την πηγή»*. Η ουσιαστική κρίση **δεν είναι δική μας** (ADR-835 §7,
 * ρητή επιφύλαξη), και μια οθόνη που τη λέει μεταθέτει την απογοήτευση στο
 * συμβολαιογραφείο — ακριβώς αυτό που η Α17 υπάρχει για να αποτρέψει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΡΟΛΟΪ ΕΙΝΑΙ **ΟΡΙΣΜΑ**, ΚΑΙ ΕΙΝΑΙ ΠΑΘΗΜΑ, ΟΧΙ ΓΟΥΣΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `asOf` περνά **ρητά**. Η ADR-835 Φ3 μέτρησε άγκυρα που ήταν **πράσινη επειδή
 * τυφλή**: η μηχανή τρέχει σε **UTC+3** και η δοκιμή δεν μπορούσε να δει τη διαφορά
 * `getUTCDate()` / `getDate()`. Ένα `Date.now()` εδώ μέσα θα έκανε **κάθε** δοκιμή
 * λήξης εξαρτημένη από τη ζώνη της μηχανής — δηλαδή θα ξαναγέννα την ίδια τυφλότητα.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, **μηδέν ρολόι**.
 */

import { normalizeToMillisOrNull, utcDateOf } from '@/lib/date-local';
import type { SpaceRef } from '@/lib/spaces/space-ref';
import type { OfferKind } from '@/types/property-offers';
import {
  claimCovers,
  legalityKindSpec,
  type LegalityClaim,
  type LegalityClaimKind,
} from './legality-claim';
import { legalityRelevanceFor } from './legality-offer-matrix';
import { strongerTier, type LegalityTier } from './legality-tier';

// =============================================================================
// 1. ΤΟ ΛΕΞΙΛΟΓΙΟ
// =============================================================================

/**
 * **Η απάντηση για ΕΝΑ είδος αξίωσης, πάνω σε ΕΝΑ σύνολο χώρων.**
 *
 * Διακριτή ένωση: κάθε κατάσταση κουβαλά **ακριβώς** ό,τι έχει νόημα για εκείνη — το
 * `undeclared` δεν έχει βαθμίδα, το `expired` έχει **και** βαθμίδα **και** ημερομηνία.
 * Ένα κοινό σχήμα με προαιρετικά πεδία θα άφηνε κάθε καταναλωτή να μαντέψει ποια
 * ισχύουν.
 */
export type LegalitySignal =
  | { readonly state: 'undeclared'; readonly kind: LegalityClaimKind }
  | { readonly state: 'not-applicable'; readonly kind: LegalityClaimKind }
  | {
      readonly state: 'declared';
      readonly kind: LegalityClaimKind;
      readonly tier: LegalityTier;
      /** `null` όταν το είδος **δεν δημοσιεύει** τιμή, ή δεν δόθηκε. */
      readonly value: string | null;
      readonly assertedAt: string;
    }
  | {
      readonly state: 'expired';
      readonly kind: LegalityClaimKind;
      readonly tier: LegalityTier;
      /** Η ημέρα **ως την οποία** ίσχυε — `YYYY-MM-DD`. */
      readonly expiredAfter: string;
    }
  | {
      readonly state: 'expiry-unknown';
      readonly kind: LegalityClaimKind;
      readonly tier: LegalityTier;
    };

export type LegalitySignalState = LegalitySignal['state'];

/**
 * **Οι πέντε καταστάσεις, ονομαστικά** — κλειστός κατάλογος για οθόνη και άγκυρες.
 *
 * ⚠️ Δεν παράγεται από την ένωση (δεν γίνεται σε χρόνο εκτέλεσης)· κρατιέται
 * συγχρονισμένος από **άγκυρα**, όχι από ελπίδα.
 */
export const LEGALITY_SIGNAL_STATES = [
  'undeclared',
  'declared',
  'expired',
  'expiry-unknown',
  'not-applicable',
] as const;

// =============================================================================
// 2. Η ΛΗΞΗ — μία ερώτηση, μία απάντηση
// =============================================================================

/**
 * **Έληξε ως αυτή τη στιγμή;** — σύγκριση σε **ημέρα**, όχι σε χιλιοστά.
 *
 * 🔴 **Η ΤΕΛΕΥΤΑΙΑ ΜΕΡΑ ΕΙΝΑΙ ΜΕΣΑ.** Έγγραφο «σε ισχύ έως 31/08» ισχύει **όλη** την
 * 31/08. Σύγκριση σε χιλιοστά θα το κήρυσσε ληγμένο στις 00:00:01 της ίδιας ημέρας —
 * το ίδιο σχήμα με τον φρουρό «αυστηρής ανισότητας» που η Φ3 βρήκε σε **δύο** αρχεία.
 * Γι' αυτό η σύγκριση γίνεται πάνω σε `YYYY-MM-DD` με **`>`**, όπου το ίσον σημαίνει
 * «ίδια μέρα ⇒ ακόμη σε ισχύ».
 *
 * ⚠️ **Αδιάβαστη ημερομηνία ⇒ `null`**, ποτέ `false`: ένα `false` θα σήμαινε «σε
 * ισχύ», δηλαδή θα μετέτρεπε το **δυσανάγνωστο** σε **έγκυρο**.
 */
export function isExpiredOn(validUntil: unknown, asOf: unknown): boolean | null {
  const untilMs = normalizeToMillisOrNull(validUntil);
  const asOfMs = normalizeToMillisOrNull(asOf);
  if (untilMs === null || asOfMs === null) return null;

  const untilDay = utcDateOf(untilMs);
  const asOfDay = utcDateOf(asOfMs);
  if (untilDay === null || asOfDay === null) return null;

  return asOfDay > untilDay;
}

// =============================================================================
// 3. Ο ΚΡΙΤΗΣ
// =============================================================================

/**
 * **Η ισχυρότερη αξίωση αυτού του είδους που καλύπτει αυτούς τους χώρους.**
 *
 * ⚠️ **«Ισχυρότερη» σημαίνει ανώτερη ΒΑΘΜΙΔΑ, όχι νεότερη.** Μια `self-declared`
 * δήλωση της περασμένης εβδομάδας **δεν** υπερισχύει μιας `registry-verified` του
 * περασμένου μήνα: η πρόσφατη ημερομηνία δεν κάνει τον ισχυρισμό ισχυρότερο.
 */
function strongestCovering(
  claims: readonly LegalityClaim[],
  kind: LegalityClaimKind,
  spaces: readonly SpaceRef[],
): LegalityClaim | null {
  let best: LegalityClaim | null = null;

  for (const claim of claims) {
    if (claim.kind !== kind) continue;
    if (!claimCovers(claim, spaces)) continue;
    if (best === null) {
      best = claim;
      continue;
    }
    if (strongerTier(best.tier, claim.tier) === claim.tier && claim.tier !== best.tier) {
      best = claim;
    }
  }

  return best;
}

/**
 * **Η απάντηση για ΕΝΑ είδος** — αξιώσεις + χώροι + στιγμή ⇒ ένα από πέντε ονόματα.
 *
 * 🔴 **ΚΕΝΟ ΣΥΝΟΛΟ ΧΩΡΩΝ ⇒ `undeclared`, ΠΟΤΕ `declared`.** Το `spaceSetCovers` με
 * κενό στόχο επιστρέφει `true` (κενή σύζευξη — σωστή **άλγεβρα**), και μια αξίωση θα
 * «κάλυπτε» το τίποτα. Ο φρουρός ζει **εδώ**, στο **λεξιλόγιο**, ακριβώς όπως το
 * ADR-835 §17 χώρισε την άλγεβρα του κενού διαστήματος από το όνομά του: *«ρώτησες για
 * κανέναν χώρο» δεν είναι «όλα καλά»*.
 */
export function legalitySignalFor(
  claims: readonly LegalityClaim[],
  kind: LegalityClaimKind,
  spaces: readonly SpaceRef[],
  asOf: unknown,
): LegalitySignal {
  if (spaces.length === 0) return { state: 'undeclared', kind };

  const claim = strongestCovering(claims, kind, spaces);
  if (claim === null) return { state: 'undeclared', kind };

  const spec = legalityKindSpec(kind);
  if (spec.expires) {
    if (claim.validUntil === null) {
      return { state: 'expiry-unknown', kind, tier: claim.tier };
    }
    const expired = isExpiredOn(claim.validUntil, asOf);
    // ⚠️ `null` (αδιάβαστη ημερομηνία) πέφτει **εδώ**, όχι στο «σε ισχύ»: δεν ξέρουμε
    //    ως πότε ισχύει — που είναι **ακριβώς** το `expiry-unknown`, όχι το `declared`.
    if (expired === null) return { state: 'expiry-unknown', kind, tier: claim.tier };
    if (expired) {
      const untilMs = normalizeToMillisOrNull(claim.validUntil);
      const expiredAfter = untilMs === null ? claim.validUntil : (utcDateOf(untilMs) ?? claim.validUntil);
      return { state: 'expired', kind, tier: claim.tier, expiredAfter };
    }
  }

  return {
    state: 'declared',
    kind,
    tier: claim.tier,
    // 🔑 **Η ΠΥΛΗ ΤΗΣ ΤΙΜΗΣ ΖΕΙ ΕΔΩ, ΜΙΑ ΦΟΡΑ.** Αν κάθε καταναλωτής αποφάσιζε μόνος
    //    του αν δείχνει το `value`, η απόφαση «ποτέ το έγγραφο» θα είχε τόσες εκδοχές
    //    όσοι οι καταναλωτές — και θα αρκούσε **ένας** να ξεχάσει.
    value: spec.valueDisclosure === 'published' ? claim.value : null,
    assertedAt: claim.assertedAt,
  };
}

/**
 * **Όλες οι απαντήσεις για ΑΥΤΕΣ τις διαθέσεις** — ο πλήρης παρονομαστής.
 *
 * 🔴 **ΕΠΙΣΤΡΕΦΕΙ ΓΡΑΜΜΗ ΚΑΙ ΓΙΑ ΟΣΑ ΔΕΝ ΣΗΚΩΝΟΝΤΑΙ** (`not-applicable`), και είναι
 * απόφαση: η **παράλειψη** μιας γραμμής είναι σιωπή, και η σιωπή διαβάζεται ως «δεν
 * έχει». Ο καταναλωτής της οθόνης φιλτράρει αν θέλει — αλλά **βλέπει** ότι το ερώτημα
 * τέθηκε και απαντήθηκε. Ίδιο επιχείρημα με το `ListingOpenSubjects` («*το λέμε*»).
 *
 * Η σειρά είναι του {@link LEGALITY_CLAIM_KINDS} — σταθερή, ώστε η οθόνη να μην
 * αναδιατάσσεται όταν αλλάξουν τα δεδομένα.
 */
export function legalitySignalsFor(
  claims: readonly LegalityClaim[],
  offerKinds: readonly OfferKind[],
  spaces: readonly SpaceRef[],
  asOf: unknown,
  kinds: readonly LegalityClaimKind[],
): readonly LegalitySignal[] {
  return kinds.map((kind) => {
    const raised = offerKinds.some(
      (offerKind) => legalityRelevanceFor(offerKind, kind).relevance !== 'not-raised'
    );
    if (!raised) return { state: 'not-applicable', kind } as const;
    return legalitySignalFor(claims, kind, spaces, asOf);
  });
}
