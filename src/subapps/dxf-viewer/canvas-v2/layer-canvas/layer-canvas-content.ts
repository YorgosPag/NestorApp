/**
 * LAYER CANVAS CONTENT PREDICATE — «τι ζωγραφίζει ΠΡΑΓΜΑΤΙΚΑ ο LayerRenderer;»
 *
 * ADR-732 §3 «Επιπλέον unmount-when-empty»: το unmount του `LayerCanvas` αναβλήθηκε
 * επειδή το «είμαι άδειος;» ΔΕΝ κρίνεται με `colorLayers.length === 0 && !draft` — ο
 * καμβάς δέχεται 6 ομάδες ρυθμίσεων και ένα prop (`showSnapIndicators`) που ΔΕΝ
 * ζωγραφίζει τίποτα. Αυτό το module είναι το ρητό predicate που έλειπε.
 *
 * ── Απογραφή πηγών pixel (από ανάγνωση του `LayerRenderer.ts`, 2026-07-30) ───────
 *
 * (α) COLOR LAYERS — `renderColorLayers` (ΚΑΙ στα δύο μονοπάτια, unified + legacy).
 *     Φίλτρα που εφαρμόζονται πριν φτάσουν εδώ (`layer-canvas-hooks.renderLayers`):
 *       `layersVisible ? layers : layers.filter(l => l.isDraft)`
 *     και μέσα στον renderer: `if (!layer.visible) continue`.
 *     Ανά polygon (`layer-polygon-renderer.renderPolygonToCanvas`):
 *       `vertices.length < 3` → ΕΞΟΔΟΣ χωρίς ζωγραφική, ΕΚΤΟΣ αν `layer.isDraft`
 *       (τότε `renderDraftPartialToCanvas`: γραμμές για ≥2 κορυφές, grips για ≥1).
 *     Το drag preview (`draggingOverlay` / `dragState`) ΜΕΤΑΚΙΝΕΙ υπάρχουσες κορυφές —
 *     δεν παράγει νέο περιεχόμενο, άρα δεν είναι ξεχωριστή πηγή.
 *
 * (β) SELECTION BOX (marquee) — legacy: `options.showSelectionBox && options.selectionBox`·
 *     unified: `createLayerUISettings` → μοναδικός registered renderer `'selection'`.
 *     ⚠️ Η ΖΩΝΤΑΝΗ πηγή ΔΕΝ είναι τα props: το `layer-canvas-hooks` ΠΑΡΑΚΑΜΠΤΕΙ τα
 *     `showSelectionBox/selectionBox` με το `SelectionStore` σε κάθε καρέ. Άρα το
 *     πραγματικό σήμα είναι το `SelectionStore.getIsSelecting()` — γι' αυτό το
 *     `marqueeActive` είναι ξεχωριστή είσοδος (και το props-μονοπάτι κρατιέται ως δεύτερη,
 *     υπερσύνολο: αν κάποιος περάσει στατικό box, ο καμβάς παραμένει mounted).
 *
 * (γ) LEGACY GRID — `renderLegacy`: `options.showGrid && gridSettings.enabled`.
 *     Στην ΠΑΡΑΓΩΓΗ και τα δύο σκέλη είναι false (`CanvasLayerStack`: `layerRenderOptions
 *     .showGrid: false` + `gridSettingsDisabled`), και επιπλέον το legacy μονοπάτι δεν
 *     τρέχει καν (`CanvasSettings.useUnifiedRendering === true`). Κρατιέται ως είσοδος
 *     γιατί το predicate δεν πρέπει να εξαρτάται από ΠΟΙΟ μονοπάτι έτυχε να τρέχει.
 *
 * (δ) DEBUG CALIBRATION GRID — `renderLegacy`, `window.rulerDebugOverlay` (dev-only).
 *
 * ΤΙ **ΔΕΝ** ΕΙΝΑΙ ΠΗΓΗ: `showSnapIndicators`. Νεκρή είσοδος — ADR-137 μετέφερε τα snap
 * glyphs στο SVG `SnapIndicatorOverlay` και ο canvas `SnapRenderer` ΑΦΑΙΡΕΘΗΚΕ
 * (`initializeUIRenderers`: register ΜΟΝΟ `'selection'`). Ομοίως crosshair/cursor
 * (ADR-040 Φ10, compositor) και rulers (κανένας registered renderer).
 *
 * ── Πολιτική: FAIL-MOUNTED ────────────────────────────────────────────────────────
 * Κάθε αβεβαιότητα ⇒ `true`. Το κόστος είναι ασύμμετρο (ίδιο σκεπτικό με το fail-open
 * του ADR-728 Φ2): ένας άσκοπα mounted καμβάς κοστίζει ΕΝΑ compositor στρώμα σε ηρεμία·
 * ένας λάθος unmounted κόβει ΟΡΑΤΑ pixels. Γι' αυτό οι κανόνες παρακάτω είναι σκόπιμα
 * ΥΠΕΡΣΥΝΟΛΑ του «θα μπει έστω κι ένα pixel» (π.χ. δεν κοιτάμε `opacity === 0`, δεν
 * αναπαράγουμε τον έλεγχο `activeTool === 'pan'` του render hook, δεν ελέγχουμε αν οι
 * κορυφές πέφτουν εντός viewport).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-732-2d-canvas-layer-consolidation.md §3
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { LayerRenderOptions } from './layer-types';

/**
 * Ελάχιστο δομικό σχήμα layer που χρειάζεται η απόφαση. Το `ColorLayer` το ικανοποιεί·
 * τα tests μπορούν να φτιάξουν minimal fixtures χωρίς 20 άσχετα πεδία.
 */
export interface LayerContentShape {
  readonly visible: boolean;
  readonly isDraft?: boolean;
  readonly polygons: ReadonlyArray<{ readonly vertices: ReadonlyArray<unknown> }>;
}

/** Κλειστό polygon: ο renderer βγαίνει νωρίς κάτω από 3 κορυφές (μη-draft layer). */
export const MIN_VERTICES_CLOSED_POLYGON = 3;
/** Draft: το `renderDraftPartialToCanvas` ζωγραφίζει grip ήδη από την 1η κορυφή. */
export const MIN_VERTICES_DRAFT = 1;

/**
 * Πηγή (α) — υπάρχει έστω ένα layer που θα βάλει pixel;
 *
 * Αναπαράγει ΑΚΡΙΒΩΣ την αλυσίδα φίλτρων `layer-canvas-hooks` → `renderColorLayers` →
 * `renderPolygonToCanvas`, με fail-mounted στρογγυλοποίηση στο κατώφλι κορυφών του draft
 * (μετράμε ≥1 ακόμη κι όταν το `showGrips` είναι false — υπερσύνολο, όχι λάθος).
 */
export function hasDrawableColorLayerContent(
  layers: readonly LayerContentShape[],
  layersVisible: boolean,
): boolean {
  for (const layer of layers) {
    const isDraft = layer.isDraft === true;
    // `layersVisible === false` ⇒ ο render hook κρατά ΜΟΝΟ τα draft layers.
    if (!layersVisible && !isDraft) continue;
    // `renderColorLayers`: τα αόρατα layers προσπερνιούνται ολόκληρα.
    if (!layer.visible) continue;
    const minVertices = isDraft ? MIN_VERTICES_DRAFT : MIN_VERTICES_CLOSED_POLYGON;
    for (const polygon of layer.polygons) {
      if (polygon.vertices.length >= minVertices) return true;
    }
  }
  return false;
}

/** Είσοδοι του predicate — μία ανά πηγή pixel της απογραφής. */
export interface LayerCanvasContentInputs {
  /** (α) Τα ΑΠΟΘΗΚΕΥΜΕΝΑ color layers (ΧΩΡΙΣ το draft — αυτό δηλώνεται χωριστά). */
  readonly layers: readonly LayerContentShape[];
  /**
   * (α) Πλήθος σημείων του draft polygon. `useDraftPolygonLayer` παράγει draft layer
   * ακριβώς όταν `draftPolygon.length >= 1` — έτσι ο outer gate αποφασίζει ΧΩΡΙΣ να
   * χρειαστεί το high-freq `useCursorWorldPosition` (ADR-040: μηδέν subscription στην
   * άδεια περίπτωση).
   */
  readonly draftVertexCount: number;
  /** (α) Το `layersVisible` prop του LayerCanvas. */
  readonly layersVisible: boolean;
  /** (β) `SelectionStore.getIsSelecting()` — η ζωντανή marquee, ΟΧΙ τα props. */
  readonly marqueeActive: boolean;
  /** (β)+(γ) Το props-μονοπάτι του renderer, κανονικοποιημένο από τον καλούντα. */
  readonly renderOptions: Pick<LayerRenderOptions, 'showSelectionBox' | 'selectionBox' | 'showGrid'>;
  /** (γ) `gridSettings.enabled` — το δεύτερο σκέλος της legacy grid πύλης. */
  readonly gridEnabled: boolean;
  /** (δ) `window.rulerDebugOverlay` ενεργό (dev-only calibration grid). */
  readonly debugCalibrationGridActive: boolean;
}

/**
 * Ζωγραφίζει ο LayerCanvas οτιδήποτε; `false` ⇒ ο καμβάς μπορεί να μην υπάρχει καθόλου
 * στο DOM (ADR-732 §3 unmount-when-empty). FAIL-MOUNTED — βλ. header.
 */
export function hasLayerCanvasContent(inputs: LayerCanvasContentInputs): boolean {
  // (α) color layers + draft polygon
  if (inputs.draftVertexCount >= MIN_VERTICES_DRAFT) return true;
  if (hasDrawableColorLayerContent(inputs.layers, inputs.layersVisible)) return true;

  // (β) selection box — ζωντανό store ΠΡΩΤΑ, props ως δεύτερο (υπερσύνολο)
  if (inputs.marqueeActive) return true;
  if (inputs.renderOptions.showSelectionBox && inputs.renderOptions.selectionBox !== null) return true;

  // (γ) legacy grid pass
  if (inputs.renderOptions.showGrid && inputs.gridEnabled) return true;

  // (δ) dev-only calibration grid
  if (inputs.debugCalibrationGridActive) return true;

  return false;
}
