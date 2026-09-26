/**
 * @fileoverview **ΟΙ ΚΑΝΟΝΕΣ ΜΙΑΣ ΛΗΨΗΣ** — προέλευση, υπογραφή, κοινό και τι ανεβαίνει στο δημόσιο ράφι.
 * @related ADR-884 §8.1 Φ0.2 (αναλλοίωτα #1–#3) · Φ0.4 · §12 Δ4 · §12 Δ6 · ADR-841 Α9.2/Α10/Α11
 * @module lib/spatial-tour/tour-capture-invariants
 *
 * Επιβάλλονται **στον διακομιστή**, όχι μόνο στους τύπους:
 * - **#1** `virtual-staging`/`design-study` ⇒ `baseCaptureId` δείχνει σε `as-built` του **ίδιου** κόμβου
 *   (η Σύγκριση «σήμερα ⟷ πρόταση» πάντα έχει την πραγματική φωτογραφία δίπλα, πρότυπο AB 723).
 * - **#2** `design-study` ⇒ υπογράφων με δηλωμένο όνομα/ειδικότητα **και** εγγραφή ΤΕΕ ≥ `declared`
 *   (πήχης ADR-841 Α9.2) — ο «γκρεμισμένος» φέρων τοίχος σε οθόνη είναι υπόσχεση μόνο ενός μηχανικού.
 * - **#3** `project-team`/`unit-owner` ⇒ **ποτέ** στο δημόσιο ράφι· προς `public-listing` μόνο με **ρητή** πράξη.
 *
 * ⚠️ Το αναλλοίωτο #6 του ADR (γεωμετρική σύγκριση `virtual-staging` ↔ αρχικό) **δεν** είναι κώδικας Φ0:
 * ανήκει στη Φ4. Η Φ0 δεσμεύει μόνο το `baseCaptureId` (#1).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import { DERIVED_CAPTURE_PROVENANCES } from '@/constants/spatial-tour-vocabulary';
import type { TourCaptureAudience } from '@/constants/spatial-tour-vocabulary';
import { normalizeToMillisOrNull } from '@/lib/date-local';
import { hasSignatory } from '@/lib/listings/listing-model-declaration';
import { attestsNationalRegistry } from '@/lib/professional/professional-attestation';
import type { SpatialTour, TourCapture } from '@/types/spatial-tour';

export type TourCaptureViolation =
  | { readonly kind: 'base-capture-missing'; readonly captureId: string }
  | { readonly kind: 'base-capture-unexpected'; readonly captureId: string }
  | { readonly kind: 'base-capture-not-as-built'; readonly captureId: string }
  | { readonly kind: 'base-capture-other-node'; readonly captureId: string }
  /**
   * Παράγωγη λήψη (ή η βάση της) **ατοποθέτητη**: το «ίδιος κόμβος» (#1) δεν μπορεί να κριθεί — το `null === null`
   * θα περνούσε δύο φωτογραφίες που **κανείς** δεν έβαλε στο ίδιο σημείο. Πρώτα τοποθέτηση (Φ2), μετά «ντύσιμο».
   */
  | { readonly kind: 'derived-capture-unplaced'; readonly captureId: string }
  | { readonly kind: 'design-study-unsigned'; readonly captureId: string }
  | { readonly kind: 'design-study-unregistered'; readonly captureId: string };

type BaseCapture = Pick<TourCapture, 'id' | 'nodeId' | 'provenance'>;

/** #1 — η λήψη που «ντύνεται». `base` = το έγγραφο που δείχνει το `baseCaptureId`, ή `null` αν δεν βρέθηκε. */
function baseViolations(capture: TourCapture, base: BaseCapture | null): TourCaptureViolation[] {
  const captureId = capture.id;
  const derived = DERIVED_CAPTURE_PROVENANCES.includes(capture.provenance);
  if (!derived) return capture.baseCaptureId === null ? [] : [{ kind: 'base-capture-unexpected', captureId }];
  if (capture.baseCaptureId === null || base === null || base.id !== capture.baseCaptureId) {
    return [{ kind: 'base-capture-missing', captureId }];
  }
  const out: TourCaptureViolation[] = [];
  if (base.provenance !== 'as-built') out.push({ kind: 'base-capture-not-as-built', captureId });
  if (capture.nodeId === null || base.nodeId === null) out.push({ kind: 'derived-capture-unplaced', captureId });
  else if (base.nodeId !== capture.nodeId) out.push({ kind: 'base-capture-other-node', captureId });
  return out;
}

/** #2 — μελέτη = υπογράφων μηχανικός με ΤΕΕ. */
function signatoryViolations(capture: TourCapture): TourCaptureViolation[] {
  if (capture.provenance !== 'design-study') return [];
  const { signatory, id: captureId } = capture;
  if (signatory === null || !hasSignatory(signatory.person)) return [{ kind: 'design-study-unsigned', captureId }];
  return attestsNationalRegistry(signatory.attestation, 'tee')
    ? []
    : [{ kind: 'design-study-unregistered', captureId }];
}

/** **Ο έλεγχος πριν γραφτεί μια λήψη.** Κενός πίνακας ⇒ έγκυρη. */
export function checkTourCapture(capture: TourCapture, base: BaseCapture | null): TourCaptureViolation[] {
  return [...baseViolations(capture, base), ...signatoryViolations(capture)];
}

/** #3 — επιτρέπεται να φτάσει αυτή η λήψη στο δημόσιο ράφι; (Φ0.4) */
export function mayEnterPublicShelf(
  capture: Pick<TourCapture, 'audience'>,
  tour: Pick<SpatialTour, 'lifecycle' | 'visibility'>,
): boolean {
  return capture.audience === 'public-listing' && tour.lifecycle === 'published' && tour.visibility === 'public';
}

type NodeCapture = Pick<TourCapture, 'id' | 'nodeId' | 'capturedAt' | 'audience'>;

/**
 * **Για κάθε κόμβο, μόνο η πιο πρόσφατη** λήψη που περνά το `admits` (§12 Δ6). Ισοπαλία στην ημερομηνία ⇒ το
 * μεγαλύτερο id, ώστε η επιλογή να μην εξαρτάται από τη σειρά ανάγνωσης. Ατοποθέτητη λήψη **δεν** επιλέγεται ποτέ:
 * δεν ανήκει σε κόμβο, άρα ο θεατής δεν θα ήξερε **πού** στέκεται.
 */
function latestPerNode<C extends NodeCapture>(captures: readonly C[], admits: (capture: C) => boolean): C[] {
  const latest = new Map<string, { readonly capture: C; readonly atMs: number }>();
  for (const capture of captures) {
    const atMs = normalizeToMillisOrNull(capture.capturedAt);
    // Λήψη χωρίς αναγνώσιμη ημερομηνία δεν «κερδίζει» ποτέ — δεν ξέρουμε αν είναι η τελευταία.
    const { nodeId } = capture;
    if (atMs === null || nodeId === null || !admits(capture)) continue;
    const current = latest.get(nodeId);
    const newer = !current || atMs > current.atMs || (atMs === current.atMs && capture.id > current.capture.id);
    if (newer) latest.set(nodeId, { capture, atMs });
  }
  return [...latest.values()].map((entry) => entry.capture);
}

/** Το **δημόσιο ράφι** (Φ0.4): μόνο ό,τι επιτρέπεται να φτάσει στο κοινό **χωρίς** κουπόνι. */
export function selectShelfCaptures<C extends NodeCapture>(
  captures: readonly C[],
  tour: Pick<SpatialTour, 'lifecycle' | 'visibility'>,
): C[] {
  return latestPerNode(captures, (capture) => mayEnterPublicShelf(capture, tour));
}

/**
 * **Ό,τι βλέπει ένας κριμένος θεατής** (Κ3β): λήψεις για το κοινό της αγγελίας, πιο πρόσφατη ανά κόμβο. Η
 * ορατότητα **δεν** ρωτιέται εδώ — την έκρινε ήδη η πύλη θέασης (`judgeTourView`). Ίδιος κανόνας επιλογής με
 * το ράφι: ο εγκεκριμένος αγοραστής και ο ανώνυμος επισκέπτης βλέπουν το **ίδιο** σπίτι.
 */
export function selectViewerCaptures<C extends NodeCapture>(captures: readonly C[]): C[] {
  return latestPerNode(captures, (capture) => capture.audience === 'public-listing');
}

/** Αλλαγή κοινού μιας λήψης: προς `public-listing` **μόνο** με ρητή πράξη του υπευθύνου (#3, §12 Δ6). */
export type AudienceTransitionVerdict = 'allowed' | 'requires-explicit-act' | 'unchanged';

export function audienceTransition(
  from: TourCaptureAudience,
  to: TourCaptureAudience,
  explicitAct: boolean,
): AudienceTransitionVerdict {
  if (from === to) return 'unchanged';
  if (to === 'public-listing' && !explicitAct) return 'requires-explicit-act';
  return 'allowed';
}
