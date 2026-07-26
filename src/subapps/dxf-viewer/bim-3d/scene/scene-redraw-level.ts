/**
 * scene-redraw-level — SSoT για το «ΠΟΣΟ» redraw χρωστά η 3D σκηνή (ADR-549 Φ4).
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙ (incident 2026-07-26): η σκηνή είναι on-demand — ο `UnifiedFrameScheduler`
 * καλεί το `tick()` ΜΟΝΟ όταν ένα gate πει «βρώμικη». Το ADR-549 Φ3 πρόσθεσε ΔΕΥΤΕΡΟ επίπεδο
 * ακύρωσης (`markHoverDirty` → blit cache + outline, ~1-2ms αντί ~40ms), αλλά το gate
 * (`isSceneDirtyFromState`) έμεινε με ΕΝΑ boolean (`explicitDirty`). Αποτέλεσμα: το hover σήκωνε τη
 * σημαία του, το gate απαντούσε «καθαρή», το `tick()` δεν καλούνταν ΠΟΤΕ — και το κίτρινο περίγραμμα
 * των BIM στοιχείων (κολώνες) δεν εμφανιζόταν, παρότι ΟΛΗ η αλυσίδα (raycast → highlighter →
 * `SelectionOutlinePass`) δούλευε. Το raw-DXF hover glow επιβίωσε μόνο επειδή είναι Canvas2D overlay
 * με δικό του RAF (`use-hover-glow-pass`) και δεν ρωτά αυτό το gate.
 *
 * Η ΑΙΤΙΑ ΔΕΝ ΗΤΑΝ Η ΞΕΧΑΣΜΕΝΗ ΓΡΑΜΜΗ — ήταν η ΑΝΑΠΑΡΑΣΤΑΣΗ: N ανεξάρτητα booleans απαιτούν
 * χειροκίνητο OR σε ΔΥΟ σημεία (`buildSceneDirtyState` + `isSceneDirtyFromState`). Κάθε νέο επίπεδο
 * είναι μια νέα ευκαιρία να ξεχαστεί, σιωπηλά. Εδώ αντικαθίστανται από ΕΝΑ **ολικά διατεταγμένο**
 * επίπεδο: το «ξέχασα το OR» γίνεται αδύνατο by construction, γιατί δεν υπάρχει δεύτερο πεδίο.
 *
 * ΠΡΑΚΤΙΚΗ ΜΕΓΑΛΩΝ ΠΑΙΧΤΩΝ (σύγκλιση): ο Autodesk Platform Services (Forge) Viewer εκθέτει
 * `Viewer3DImpl.invalidate(needsClear, needsRender, overlayDirty)` — το overlay είναι ΡΗΤΑ ξεχωριστό
 * επίπεδο ακύρωσης από το beauty render. Το three.js `OutlinePass` είναι επίσης ξεχωριστό pass πάνω
 * από το beauty. Εδώ πάμε ΕΝΑ βήμα παραπέρα: αντί για N παράλληλα booleans (που ο καλών πρέπει να
 * συνδυάσει σωστά), ένα ordered level με **monotonic escalation** — ένα φθηνό αίτημα δεν μπορεί ΠΟΤΕ
 * να υποβαθμίσει ένα ακριβό που ήδη εκκρεμεί, χωρίς να το θυμάται ο call site.
 *
 * Pure — μηδέν THREE, μηδέν React, μηδέν state. Jest-friendly.
 *
 * @see ./scene-dirty-state.ts — ο predicate που το καταναλώνει· ./hover-beauty-cache.ts — το blit
 * @see docs/centralized-systems/reference/adrs/ADR-549-3d-cursor-swim-render-loop.md §Φ4
 */

/**
 * Πόσο ακριβό redraw χρωστάει η σκηνή. **Η σειρά είναι ο μηχανισμός** — οι τιμές συγκρίνονται με `>`
 * ώστε το {@link escalateRedraw} να κρατά πάντα το ακριβότερο εκκρεμές αίτημα. Νέο επίπεδο μπαίνει
 * στη σωστή θέση της κλίμακας κόστους, ΟΧΙ στο τέλος.
 */
export const RedrawLevel = {
  /** Τίποτα δεν χρωστάμε — ο scheduler προσπερνά το σύστημα εντελώς. */
  NONE: 0,
  /**
   * Άλλαξε ΜΟΝΟ το overlay (hover/selection silhouette)· το beauty είναι πανομοιότυπο με το
   * προηγούμενο καρέ → blit του `HoverBeautyCache` + επανασχεδίαση μόνο του outline (~1-2ms).
   */
  OVERLAY: 1,
  /** Άλλαξε η ίδια η σκηνή (γεωμετρία/υλικά/κάμερα/φώτα) → πλήρες beauty render (~40ms). */
  FULL: 2,
} as const;

export type RedrawLevel = (typeof RedrawLevel)[keyof typeof RedrawLevel];

/**
 * Συγχώνευση ενός νέου αιτήματος με το εκκρεμές: κρατά το **ακριβότερο** (monotonic escalation).
 *
 * Αυτό είναι το σημείο που εξαφανίζει μια ολόκληρη κατηγορία race: χωρίς αυτό, ένα hover που
 * φτάνει ΜΕΤΑ από ένα `markSceneDirty` θα μπορούσε να υποβαθμίσει το εκκρεμές full render σε
 * overlay-only blit → η γεωμετρική αλλαγή θα «χανόταν» για ένα καρέ. Ιδempotent: `escalate(x, x) === x`.
 */
export function escalateRedraw(current: RedrawLevel, requested: RedrawLevel): RedrawLevel {
  return requested > current ? requested : current;
}

/** True όταν το επίπεδο απαιτεί καρέ — ο μοναδικός ορισμός του «βρώμικη» για ρητά αιτήματα. */
export function needsRedraw(level: RedrawLevel): boolean {
  return level > RedrawLevel.NONE;
}

/**
 * True όταν αρκεί η φθηνή overlay-only διαδρομή (`renderHoverOnlyFrame`). Ρητά ΟΧΙ `!== FULL`:
 * το `NONE` δεν δικαιούται ούτε blit. Ο καλών πέφτει σε πλήρες render και σε cache miss.
 */
export function isOverlayOnlyRedraw(level: RedrawLevel): boolean {
  return level === RedrawLevel.OVERLAY;
}

/** Κάθε επίπεδο εκτός του `NONE` — η βάση των exhaustive anchor tests (ADR-587 pattern). */
export function allDirtyRedrawLevels(): readonly RedrawLevel[] {
  return Object.values(RedrawLevel).filter(needsRedraw);
}
