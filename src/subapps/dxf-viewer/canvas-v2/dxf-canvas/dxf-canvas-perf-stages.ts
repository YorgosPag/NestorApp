/**
 * DXF CANVAS — ΟΝΟΜΑΤΑ STAGE ΓΙΑ ΤΗΝ ATTRIBUTION (ADR-743 Φ0)
 *
 * ⚠️ **ΜΗΔΕΝ νέο σύστημα μετρήσεων.** Αυτό το αρχείο είναι **μόνο ένα λεξιλόγιο**: οι σταθερές
 * που περνούν στο ΥΠΑΡΧΟΝ `withPerf` / `recordSample` (`systems/cursor/mouse-handler-perf.ts`),
 * πίσω από το ΥΠΑΡΧΟΝ flag `localStorage['dxf-perf-trace'] === '1'`. Ίδιος aggregator, ίδιο
 * `console.table`, ίδιο `window.__dxfPerf`.
 *
 * ## Γιατί υπάρχει (ADR-743 §1)
 *
 * Το `frame:dxf-canvas` είναι **ΜΙΑ γραμμή** που καλύπτει ΟΛΟΚΛΗΡΟ το `renderScene()` — bitmap
 * cache, hit-testing, overlays ανά οντότητα, guides, axis-cut, χάρακες, selection box. Μετρήθηκε
 * σε production p90 **120,2ms** στο zoom (99,2% του JS χρόνου) και p95 **80,4ms** στο pan (91%),
 * αλλά **κανείς δεν ξέρει τι μέσα του κοστίζει**.
 *
 * Ακριβώς το ίδιο σχήμα με το `frame:snap-detection`: ήταν μία γραμμή μέχρι η Φ0.1 του ADR-728 να
 * το σπάσει σε 26 και να αποκαλύψει ότι **4 μηχανές** έτρωγαν το 98%. Χωρίς εκείνη τη διάσπαση, η
 * θεραπεία του ADR-735 θα είχε σχεδιαστεί στα τυφλά.
 *
 * ## Τρία namespace, τρία διαφορετικά ερωτήματα
 *
 * | Πρόθεμα | Ερώτημα | Ιδιοκτήτης |
 * |---|---|---|
 * | `frame:` | «πόσο κοστίζει κάθε ΣΥΣΤΗΜΑ του scheduler;» | `frame-scheduler-perf-bridge` — **ΔΕΝ το ακουμπάμε** |
 * | `dxfc:`  | «πόσο κοστίζει κάθε ΤΜΗΜΑ του `renderScene`;» | εδώ |
 * | `raster:`| «πόσο κοστίζει κάθε ΤΜΗΜΑ του re-raster;» | εδώ |
 *
 * 🔴 **Ο έλεγχος ορθότητας της attribution:** το άθροισμα των `dxfc:*` ΟΦΕΙΛΕΙ να προσεγγίζει το
 * `frame:dxf-canvas`. Αν δεν το κάνει, λείπει stage — και το συμπέρασμα είναι άκυρο, όχι απλώς
 * ελλιπές. Ίδιος κανόνας με ADR-728 Φ0.1.
 *
 * ## 🔴 ΜΕΤΡΗΤΕΣ ≠ ΧΡΟΝΟΣ — το πρόθεμα `n:` είναι δεσμευτικό
 *
 * Ο πίνακας του aggregator ταξινομείται κατά `sum` και **όλες** οι στήλες του λένε «ms». Ένα
 * stage που καταγράφει ΠΛΗΘΟΣ (τιμή `1` ανά συμβάν) εμφανίζεται δίπλα σε χρόνους και διαβάζεται
 * ως χρόνος. Αυτό ακριβώς κόστισε μια λάθος ανάγνωση στο ADR-728 (`snap:ENTITIES` p50 = 14 —
 * **οντότητες**, όχι ms, αλλά κορύφωνε τον πίνακα). Εδώ κάθε μετρητής ξεκινά με {@link COUNTER_PREFIX}
 * ώστε η διάκριση να είναι **ορατή στο ίδιο το όνομα**, όχι σε σχόλιο που ο επόμενος θα προσπεράσει.
 *
 * @module canvas-v2/dxf-canvas/dxf-canvas-perf-stages
 * @see systems/cursor/mouse-handler-perf — ο ΕΝΑΣ aggregator (withPerf / recordSample)
 * @see rendering/core/frame-scheduler-perf-bridge — ο ιδιοκτήτης του `frame:` namespace
 * @see ADR-743 §3 — η διάσπαση και τα ερωτήματα που απαντά
 */

/** Πρόθεμα των τμημάτων του `renderScene` (ό,τι ζωγραφίζει ο DxfCanvas ανά καρέ). */
export const DXF_CANVAS_STAGE_PREFIX = 'dxfc:';

/** Πρόθεμα των τμημάτων του re-raster (ό,τι τρέχει ΜΕΣΑ στο `DxfBitmapCache`). */
export const RASTER_STAGE_PREFIX = 'raster:';

/**
 * Πρόθεμα **μετρητή** — η τιμή είναι ΠΛΗΘΟΣ (πάντα `1` ανά συμβάν), ΟΧΙ χιλιοστά του δευτερολέπτου.
 * Διάβασε τη στήλη `count`· η `sum`/`avg`/`p90` μιας τέτοιας γραμμής **δεν σημαίνει τίποτα**.
 */
export const COUNTER_PREFIX = 'n:';

/** Τα τμήματα του `renderScene` (ADR-743 Φ0 βήμα 5). */
export const DXF_CANVAS_STAGES = {
  /** `CanvasUtils.sizeCanvasToViewport` — συγχρονισμός backing store στο καρέ. */
  size: `${DXF_CANVAS_STAGE_PREFIX}size`,
  /** `hitTesting.updateScene` — ενημέρωση του hit-test index. */
  hitScene: `${DXF_CANVAS_STAGE_PREFIX}hit-scene`,
  /** Ολόκληρη η διαδρομή bitmap cache: κρίση + (τυχόν) rebuild + blit. */
  cache: `${DXF_CANVAS_STAGE_PREFIX}cache`,
  /** Interactive overlays ανά οντότητα (hover + selection, ADR-040 cardinal rule #3). */
  overlays: `${DXF_CANVAS_STAGE_PREFIX}overlays`,
  /** Guides + ghost guides + construction points. */
  guides: `${DXF_CANVAS_STAGE_PREFIX}guides`,
  /** ADR-455 — γραμμές τομής X/Y. */
  axisCut: `${DXF_CANVAS_STAGE_PREFIX}axis-cut`,
  /** Χάρακες + guide bubbles/dimensions. */
  rulers: `${DXF_CANVAS_STAGE_PREFIX}rulers`,
  /** Selection box + lasso polygon. */
  selection: `${DXF_CANVAS_STAGE_PREFIX}selection`,
} as const;

/** Τα τμήματα του re-raster (ADR-743 Φ0 βήματα 2-4). */
export const RASTER_STAGES = {
  /** `isDirty()` — η κρίση «μπορεί το raster να εξυπηρετήσει αυτό το καρέ;». */
  judge: `${RASTER_STAGE_PREFIX}judge`,
  /** `ensureOffscreen()` — δημιουργία/αλλαγή μεγέθους του offscreen καμβά. */
  ensureOffscreen: `${RASTER_STAGE_PREFIX}ensure-offscreen`,
  /** Ολόκληρο το `rebuild()` — ο παρονομαστής των τριών από κάτω. */
  rebuild: `${RASTER_STAGE_PREFIX}rebuild`,
  /** Τα 5 ευρετήρια σκηνής (`buildFrameIndices`) — O(n) ΠΡΙΝ από κάθε culling. */
  indices: `${RASTER_STAGE_PREFIX}indices`,
  /** Ο κύριος βρόχος οντοτήτων (batching + per-entity draw + culling). */
  entities: `${RASTER_STAGE_PREFIX}entities`,
  /** Scene-level passes: σοβάς + οπλισμός μελών + οπλισμός θεμελίωσης. */
  sceneOverlays: `${RASTER_STAGE_PREFIX}scene-overlays`,
  /** `blit()` — η προβολή του anchored raster (ένα `drawImage`). */
  blit: `${RASTER_STAGE_PREFIX}blit`,
} as const;

/**
 * Γιατί χρειάστηκε rebuild. **Το κρίσιμο ερώτημα του ADR-743**: στο zoom μετρήθηκαν n=155
 * ζωγραφιές σε 20΄΄ με p90 120ms — «πόσες ήταν πλήρη re-raster και ΓΙΑΤΙ» δεν το απαντά κανένας
 * χρόνος, μόνο μια αιτία.
 */
export type RasterRebuildReason =
  /** Δεν υπάρχει καθόλου raster (πρώτο χτίσιμο ή μετά από `invalidate()`/`dispose()`). */
  | 'no-raster'
  /** ADR-726 Φ3 — ο idle timer χτύπησε: re-raster στο ηρεμημένο transform. */
  | 'idle-due'
  /** Άλλαξε δομική είσοδος (σκηνή / viewport / dpr / κλίμακα / BIM settings / toggles). */
  | 'structural'
  /** Η προβολή είναι αριθμητικά άκυρη — `drawImage` θα έκανε no-op. Ποτέ δεν αναστέλλεται. */
  | 'unusable'
  /** Κριτήρια ηρεμίας (τρύπα ή υπερβολική μεγέθυνση) — ΔΕΝ τρέχει μέσα σε χειρονομία (Φ3.1). */
  | 'quality';

/**
 * Το όνομα του **μετρητή** για μια αιτία rebuild, χωρισμένο κατά «μέσα σε χειρονομία / σε ηρεμία».
 *
 * 🔴 Ο διαχωρισμός `@gesture` / `@rest` **είναι** το πείραμα, όχι διακόσμηση. Το `RASTER_IDLE`
 * (120ms) είναι ΜΙΚΡΟΤΕΡΟ από το `WHEEL_IDLE` (220ms) και το `rerasterDue` ελέγχεται ΠΡΙΝ τον
 * gesture guard, άρα ένα ανθρώπινο κενό 120-220ms μέσα σε ριπή ροδέλας **μπορεί** να πυροδοτεί
 * πλήρες re-raster ενώ η προστασία ADR-726 Φ3.1 νομίζει ότι η χειρονομία τρέχει. Ένα
 * `n:raster-why-idle-due@gesture` με μεγάλο `count` το αποδεικνύει· ένα με μηδέν το διαψεύδει.
 * Χωρίς τον διαχωρισμό, τα δύο σενάρια δίνουν **τον ίδιο** αριθμό.
 */
export function rasterRebuildReasonCounter(
  reason: RasterRebuildReason,
  duringGesture: boolean,
): string {
  return `${COUNTER_PREFIX}raster-why-${reason}@${duringGesture ? 'gesture' : 'rest'}`;
}

/**
 * Το flag του **πειράματος οροφής** (ADR-743 Φ0 βήμα 6).
 *
 * Όταν είναι `'1'`, το σύστημα `dxf-canvas` **δεν ζωγραφίζει καθόλου** — η εικόνα παγώνει. Η ίδια
 * χειρονομία μετρά τότε `frame:INTERVAL` με **μηδέν** JS από αυτό το σύστημα, δηλαδή το κατώφλι
 * του software compositing.
 *
 * 🔴 **Γιατί είναι υποχρεωτικό πριν από κάθε θεραπεία:** μετρήθηκε ότι το **86,4%** του καρέ στο
 * pan **δεν είναι JS** (main thread άδειος· ανεξάρτητη επιβεβαίωση από το LoAF του ADR-726 §4.Γ:
 * «median 42ms αναμονή πριν το renderStart»). Άρα υπάρχει όριο κάτω από το οποίο **καμία**
 * βελτιστοποίηση JS δεν κατεβαίνει. Χωρίς αυτή τη μέτρηση, η Φ1 θα σχεδιαζόταν με στόχο που
 * ίσως είναι φυσικά ανέφικτος — και θα «αποτύγχανε» ενώ θα είχε δουλέψει τέλεια.
 */
export const CEILING_PROBE_FLAG = 'dxf-perf-ceiling';

/** Τρέχει τώρα το πείραμα οροφής; Διαβάζεται ανά καρέ ⇒ ανάβει/σβήνει χωρίς reload. */
export function isCeilingProbeActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CEILING_PROBE_FLAG) === '1';
  } catch {
    return false;
  }
}
