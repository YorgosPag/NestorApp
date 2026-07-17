/**
 * Screen-space γραμμοσκίαση — σταθερές **οθόνης** + η **αντιστοιχία τους στο χαρτί** (SSoT).
 *
 * **Γιατί υπάρχει αυτό το αρχείο:** οι σταθερές ήταν `module-private` στον `HatchRenderer` ⇒ το
 * vector PDF export (ADR-667 Φ3) δεν μπορούσε να τις δει και θα ξανάγραφε `45` / `3` ως σκέτα
 * literals. **Το jscpd ΔΕΝ πιάνει ένα σκέτο literal** (N.18) — η διπλοτυπία θα περνούσε πράσινη
 * και θα ήταν **λάθος** τη μέρα που κάποιος άλλαζε την πυκνότητα στη μία μόνο πλευρά.
 *
 * **Το μοτίβο (ADR-531 Φ5b.6, Τέκτων raster hatch):** ο Τέκτων βάζει `patternSpace:'screen'` σε
 * **ΚΑΘΕ** imported `.tek` hatch με `fillType:'user-defined'` (`tek-hatch-to-bim.ts:102`) — είναι
 * το **πιο κοινό** hatch του συστήματος. Οι γραμμές του έχουν σταθερή απόσταση σε **pixels
 * ΟΘΟΝΗΣ**, zoom-independent (ground truth Giorgio: ~1-2px, σταθερό όσο κι αν αλλάζει το ζουμ).
 *
 * ⚠️ **Η αντιστοιχία οθόνης↔χαρτιού είναι ΡΗΤΗ, ΤΕΚΜΗΡΙΩΜΕΝΗ ΑΠΟΚΛΙΣΗ** (ADR-667 Απόφαση 6),
 * όχι παράλειψη:
 *
 * | | Οθόνη | Χαρτί |
 * |---|---|---|
 * | Πυκνότητα | `SCREEN_HATCH_SPACING_PX` = 3px σταθερά | `SCREEN_HATCH_PAPER_SPACING_MM` = 0.8mm |
 * | Απόδοση | raster `CanvasPattern` tile | **vector** stripe cell (PDF Tiling Pattern) |
 * | Γωνία | `SCREEN_HATCH_DEFAULT_ANGLE_DEG` | ίδια, μέσω pattern `/Matrix` |
 *
 * **Γιατί 0.8mm:** 3px @ 96dpi ≈ 0.79mm ⇒ **ίδια οπτική πυκνότητα** με αυτή που βλέπει ο χρήστης
 * στο 100% zoom. **Γιατί vector αντί για το 3px raster της οθόνης:** ένα 3-pixel bitmap στα 300+
 * dpi του χαρτιού είναι **θολή λάσπη**. Η οθόνη είναι raster επειδή το zoom-independence το
 * απαιτεί· **το χαρτί δεν έχει zoom**.
 *
 * @module subapps/dxf-viewer/rendering/entities/shared/screen-hatch-constants
 * @see docs/centralized-systems/reference/adrs/ADR-667-pdf-native-tiling-patterns.md — Απόφαση 6
 * @see docs/centralized-systems/reference/adrs/ADR-531-tekton-import.md — Φ5b.6 (ο ιδιοκτήτης)
 */

/** Κάθετη απόσταση γραμμών σε **pixels οθόνης** (zoom-independent). */
export const SCREEN_HATCH_SPACING_PX = 3;

/** Πάχος γραμμής σε **pixels οθόνης**. Λόγος μελανιού = `LINE_PX / SPACING_PX` = 1/3. */
export const SCREEN_HATCH_LINE_PX = 1;

/** Πλάτος του tile σε px. >1 για φθηνό repeat — δεν επηρεάζει την εμφάνιση, μόνο το κόστος. */
export const SCREEN_HATCH_TILE_W = 8;

/** Γωνία γραμμών όταν το hatch δεν ορίζει `lineAngle`. */
export const SCREEN_HATCH_DEFAULT_ANGLE_DEG = 45;

// ─── Η αντιστοιχία στο χαρτί (ADR-667 Απόφαση 6) ──────────────────────────────

/**
 * Κάθετη απόσταση γραμμών στο **χαρτί** (mm) — η μετρημένη αντιστοιχία του
 * {@link SCREEN_HATCH_SPACING_PX} στα 96dpi (3px ≈ 0.79mm), στρογγυλεμένη στο 0.8.
 */
export const SCREEN_HATCH_PAPER_SPACING_MM = 0.8;

/**
 * Πάχος γραμμής στο **χαρτί** (mm). **Παράγωγο, όχι νέο magic number:** κρατά τον **ίδιο λόγο
 * μελανιού** (1/3) που βλέπει ο χρήστης στην οθόνη ⇒ 0.267mm — τυπικό λεπτό πάχος σχεδίασης.
 */
export const SCREEN_HATCH_PAPER_LINE_MM =
  SCREEN_HATCH_PAPER_SPACING_MM * (SCREEN_HATCH_LINE_PX / SCREEN_HATCH_SPACING_PX);

/**
 * Πλάτος του **κελιού** μοτίβου στο χαρτί (mm). **Παράγωγο** από την αναλογία του tile της οθόνης
 * (8:3). Όπως και στην οθόνη, **δεν επηρεάζει την εμφάνιση** (η γραμμή διατρέχει όλο το πλάτος και
 * επαναλαμβάνεται) — μόνο το πλήθος των επαναλήψεων που κάνει ο viewer.
 */
export const SCREEN_HATCH_PAPER_CELL_W_MM =
  SCREEN_HATCH_PAPER_SPACING_MM * (SCREEN_HATCH_TILE_W / SCREEN_HATCH_SPACING_PX);
