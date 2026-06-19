/**
 * clear-height-under-beam — SSoT για το **ελάχιστο επιτρεπόμενο καθαρό ύψος κάτω από
 * δοκό** ανά χρήση ορόφου, και το παράγωγο «πρακτικό» άνω όριο ύψους δοκαριού (ADR-504
 * Φάση 1).
 *
 * Ο auto-sizer (ADR-475/499) βγάζει μηχανικά σωστή αλλά σχεδιαστικά μη-πρακτική διατομή
 * όταν το άνοιγμα μεγαλώνει υπερβολικά (π.χ. 16m → 250×1450mm): η δοκός είναι τόσο βαθιά
 * που κόβει το ελεύθερο ύψος κάτω της — εκεί όπου περνούν κουφώματα/πόρτες. Αυτό το module
 * κωδικοποιεί **πόσο καθαρό ύψος απαιτείται κάτω από τη δοκό** ώστε το soft warning
 * (`practical-span-checks`) να προτείνει ενδιάμεσες κολόνες πριν φτάσουμε στο hard cap.
 *
 * **Δυναμικό, ΟΧΙ σκληροκωδικοποιημένο (Giorgio 2026-06-19):** το πρακτικό όριο = ύψος
 * ορόφου − required clear, δηλαδή προσαρμόζεται ΚΑΙ στο πραγματικό ύψος ορόφου (SSoT
 * `ActiveStoreyContext.storeyHeightMm`) ΚΑΙ στη χρήση (`FloorKind`). Σύμβαση ADR-369: η
 * δοκός κρέμεται από την οροφή → καθαρό ύψος κάτω της = ύψος ορόφου − depth.
 *
 * **Κανονιστική τεκμηρίωση (έρευνα 2026-06-19):**
 *   · Κτιριοδομικός Κανονισμός, Άρθρο 8 — ελάχιστο ελεύθερο ύψος κάτω από δοκούς/
 *     προεξέχοντα δομικά στοιχεία = **2,00 m** (απόλυτο κατώφλι).
 *   · Τυπικό κούφωμα/πόρτα = **2,20 m** → σε όροφο όπου περνά πόρτα, το soffit της δοκού
 *     πρέπει να καθαρίζει ≥ 2,20 m (αυστηρότερο, binding).
 *   · ΚΠΝ στάθμευσης — κάτω από στοιχείο οροφής σε χώρο στάθμευσης/πυλωτή = **1,90 m**
 *     (γι' αυτό η πυλωτή μπορεί να δεχτεί βαθύτερη δοκό — βλ. DEFER παρακάτω).
 *
 * Pure — zero React/DOM/Firestore. Όλα σε mm (Nestor convention).
 *
 * @see ./organism/practical-span-checks.ts — ο καταναλωτής (soft warning + πρόταση)
 * @see ../../../systems/levels/active-storey-context.ts — storeyHeightMm + storeyKind (SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-504-practical-span-intermediate-columns.md
 */

import type { FloorKind } from '@/utils/floor-naming';

/**
 * Ελάχιστο καθαρό ύψος κάτω από δοκό σε **κατοικήσιμο** όροφο (mm). Driven από το τυπικό
 * ύψος κουφώματος/πόρτας (2,20 m) — η δοκός δεν πρέπει να κόβει την πόρτα. Αυστηρότερο
 * από το απόλυτο 2,00 m του Κτιριοδομικού (Άρθρο 8), επειδή εκεί μπαίνουν κουφώματα.
 */
export const LIVING_CLEAR_HEIGHT_UNDER_BEAM_MM = 2200;

/**
 * Ελάχιστο καθαρό ύψος κάτω από δοκό σε **βοηθητικό/ειδικό** χώρο (mm) — Κτιριοδομικός
 * Άρθρο 8 απόλυτο κατώφλι «κάτω από δοκούς ή προεξέχοντα δομικά στοιχεία». Ισχύει για
 * υπόγειο / απόληξη κλιμακοστασίου / δώμα όπου δεν περνά τυπικό κούφωμα.
 */
export const AUXILIARY_CLEAR_HEIGHT_UNDER_BEAM_MM = 2000;

/**
 * Required ελάχιστο καθαρό ύψος κάτω από δοκό (mm) ανά είδος ορόφου:
 *   · ground / standard / mezzanine / `null` → 2200 (κατοικήσιμος, κούφωμα-driven).
 *   · basement / stair-penthouse / roof / foundation → 2000 (Άρθρο 8 απόλυτο).
 *
 * **Πυλωτή:** δεν υπάρχει διακριτό `FloorKind 'pilotis'` σήμερα (μοντελοποιείται ως
 * `ground` με χρήση στάθμευσης) → αντιμετωπίζεται **συντηρητικά** ως κατοικήσιμος (2200).
 * Επειδή το warning είναι soft/opt-in, αυτό απλώς προειδοποιεί όπου δεν χρειάζεται — ο
 * μηχανικός το αγνοεί ελεύθερα στην πυλωτή. (Under-warning σε ισόγειο-κατοικία θα έχανε
 * πραγματική σύγκρουση πόρτας — γι' αυτό 2200 default.)
 * **DEFER (Φάση 2):** ρητό pilotis flag ή per-storey clearance override → 1900 (ΚΠΝ).
 */
export function requiredClearHeightUnderBeamMm(kind: FloorKind | null): number {
  switch (kind) {
    case 'basement':
    case 'stair-penthouse':
    case 'roof':
    case 'foundation':
      return AUXILIARY_CLEAR_HEIGHT_UNDER_BEAM_MM;
    default: // ground / standard / mezzanine / null → κατοικήσιμος
      return LIVING_CLEAR_HEIGHT_UNDER_BEAM_MM;
  }
}

/**
 * Πρακτικό άνω όριο ύψους δοκαριού (mm): το βαθύτερο δοκάρι που αφήνει το απαιτούμενο
 * καθαρό ύψος κάτω του = `ύψος ορόφου − required clear`. Πάντα ≥ 0 (degenerate guard).
 */
export function practicalBeamDepthLimitMm(storeyHeightMm: number, kind: FloorKind | null): number {
  return Math.max(0, storeyHeightMm - requiredClearHeightUnderBeamMm(kind));
}

/**
 * Καθαρό ύψος (mm) κάτω από δοκό βάθους `depthMm` σε όροφο ύψους `storeyHeightMm` — η
 * δοκός κρέμεται από την οροφή (ADR-369). Για το diagnostic message (το «γιατί»).
 */
export function clearHeightUnderBeamMm(storeyHeightMm: number, depthMm: number): number {
  return Math.max(0, storeyHeightMm - depthMm);
}
