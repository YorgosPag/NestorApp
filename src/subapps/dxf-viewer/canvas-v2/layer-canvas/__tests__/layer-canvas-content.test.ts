/**
 * ADR-732 §3 — «τι ζωγραφίζει ΠΡΑΓΜΑΤΙΚΑ ο LayerCanvas;»
 *
 * Κάθε test καρφώνει ΜΙΑ πηγή pixel της απογραφής του `layer-canvas-content.ts`
 * (α color layers / β selection box / γ legacy grid / δ debug calibration grid) ή τη
 * fail-mounted πολιτική. Η μετάλλαξη που σκοτώνει το καθένα δηλώνεται στο όνομα:
 * αν αφαιρεθεί μια πηγή από το predicate, το αντίστοιχο test ΠΡΕΠΕΙ να κοκκινίσει.
 */

import {
  hasDrawableColorLayerContent,
  hasLayerCanvasContent,
  MIN_VERTICES_CLOSED_POLYGON,
  MIN_VERTICES_DRAFT,
  type LayerCanvasContentInputs,
  type LayerContentShape,
} from '../layer-canvas-content';

// ── Fixtures ────────────────────────────────────────────────────────────────────

const vertices = (n: number): ReadonlyArray<{ x: number; y: number }> =>
  Array.from({ length: n }, (_, i) => ({ x: i, y: i }));

const layer = (
  over: Partial<LayerContentShape> & { vertexCount?: number } = {},
): LayerContentShape => ({
  visible: over.visible ?? true,
  isDraft: over.isDraft,
  polygons: over.polygons ?? [{ vertices: vertices(over.vertexCount ?? MIN_VERTICES_CLOSED_POLYGON) }],
});

/** Η ΠΑΡΑΓΩΓΙΚΗ ρύθμιση: κανένα σκέλος ενεργό (CanvasLayerStack `layerRenderOptions`). */
const EMPTY: LayerCanvasContentInputs = {
  layers: [],
  draftVertexCount: 0,
  layersVisible: true,
  marqueeActive: false,
  renderOptions: { showGrid: false, showSelectionBox: false, selectionBox: null },
  gridEnabled: false,
  debugCalibrationGridActive: false,
};

const box = { startPoint: { x: 0, y: 0 }, endPoint: { x: 5, y: 5 }, type: 'window' as const };

// ── Βάση ────────────────────────────────────────────────────────────────────────

describe('hasLayerCanvasContent — η βάση', () => {
  it('τίποτα ενεργό ⇒ false (ο καμβάς μπορεί να μην υπάρχει στο DOM)', () => {
    expect(hasLayerCanvasContent(EMPTY)).toBe(false);
  });
});

// ── (α) COLOR LAYERS ────────────────────────────────────────────────────────────

describe('(α) color layers', () => {
  it('ορατό layer με κλειστό polygon (3 κορυφές) ⇒ true', () => {
    expect(hasLayerCanvasContent({ ...EMPTY, layers: [layer({ vertexCount: 3 })] })).toBe(true);
  });

  it('ΜΟΝΟ layer με visible:false ⇒ false (renderColorLayers κάνει continue)', () => {
    expect(hasLayerCanvasContent({ ...EMPTY, layers: [layer({ visible: false })] })).toBe(false);
  });

  it('ορατό layer ΧΩΡΙΣ polygons ⇒ false (ο βρόχος polygons δεν τρέχει ποτέ)', () => {
    expect(hasLayerCanvasContent({ ...EMPTY, layers: [layer({ polygons: [] })] })).toBe(false);
  });

  it('μη-draft polygon με 2 κορυφές ⇒ false (renderPolygonToCanvas: πρόωρη έξοδος <3)', () => {
    expect(hasLayerCanvasContent({ ...EMPTY, layers: [layer({ vertexCount: 2 })] })).toBe(false);
  });

  it('DRAFT layer με 1 κορυφή ⇒ true (renderDraftPartialToCanvas ζωγραφίζει grip)', () => {
    expect(
      hasLayerCanvasContent({ ...EMPTY, layers: [layer({ isDraft: true, vertexCount: 1 })] }),
    ).toBe(true);
  });

  it('draftVertexCount ≥ 1 ⇒ true χωρίς κανένα layer (useDraftPolygonLayer θα φτιάξει το layer)', () => {
    expect(hasLayerCanvasContent({ ...EMPTY, draftVertexCount: MIN_VERTICES_DRAFT })).toBe(true);
    expect(hasLayerCanvasContent({ ...EMPTY, draftVertexCount: 0 })).toBe(false);
  });

  it('layersVisible:false ⇒ τα ΜΗ-draft layers φιλτράρονται έξω (ίδιο φίλτρο με τον render hook)', () => {
    const saved = [layer({ vertexCount: 4 })];
    expect(hasLayerCanvasContent({ ...EMPTY, layers: saved, layersVisible: true })).toBe(true);
    expect(hasLayerCanvasContent({ ...EMPTY, layers: saved, layersVisible: false })).toBe(false);
  });

  it('layersVisible:false ⇒ το DRAFT layer επιβιώνει του φίλτρου', () => {
    expect(
      hasLayerCanvasContent({
        ...EMPTY,
        layers: [layer({ isDraft: true, vertexCount: 2 })],
        layersVisible: false,
      }),
    ).toBe(true);
  });

  it('hasDrawableColorLayerContent: τα κατώφλια κορυφών είναι draft-εξαρτώμενα', () => {
    expect(hasDrawableColorLayerContent([layer({ vertexCount: 2 })], true)).toBe(false);
    expect(hasDrawableColorLayerContent([layer({ vertexCount: 3 })], true)).toBe(true);
    expect(hasDrawableColorLayerContent([layer({ isDraft: true, vertexCount: 1 })], true)).toBe(true);
    expect(hasDrawableColorLayerContent([layer({ isDraft: true, polygons: [] })], true)).toBe(false);
  });

  it('ένα ορατό layer αρκεί, ακόμη κι αν προηγούνται άδεια/αόρατα', () => {
    expect(
      hasDrawableColorLayerContent(
        [layer({ visible: false }), layer({ polygons: [] }), layer({ vertexCount: 5 })],
        true,
      ),
    ).toBe(true);
  });
});

// ── (β) SELECTION BOX ───────────────────────────────────────────────────────────

describe('(β) selection box (marquee)', () => {
  it('marqueeActive (SelectionStore) ⇒ true — το ζωντανό σήμα, όχι τα props', () => {
    expect(hasLayerCanvasContent({ ...EMPTY, marqueeActive: true })).toBe(true);
  });

  it('props μονοπάτι: χρειάζονται ΚΑΙ τα δύο σκέλη (showSelectionBox && selectionBox)', () => {
    expect(
      hasLayerCanvasContent({
        ...EMPTY,
        renderOptions: { ...EMPTY.renderOptions, showSelectionBox: true, selectionBox: box },
      }),
    ).toBe(true);
    expect(
      hasLayerCanvasContent({
        ...EMPTY,
        renderOptions: { ...EMPTY.renderOptions, showSelectionBox: true, selectionBox: null },
      }),
    ).toBe(false);
    expect(
      hasLayerCanvasContent({
        ...EMPTY,
        renderOptions: { ...EMPTY.renderOptions, showSelectionBox: false, selectionBox: box },
      }),
    ).toBe(false);
  });
});

// ── (γ) LEGACY GRID ─────────────────────────────────────────────────────────────

describe('(γ) legacy grid pass', () => {
  it('χρειάζονται ΚΑΙ τα δύο σκέλη (options.showGrid && gridSettings.enabled)', () => {
    expect(
      hasLayerCanvasContent({
        ...EMPTY,
        renderOptions: { ...EMPTY.renderOptions, showGrid: true },
        gridEnabled: true,
      }),
    ).toBe(true);
    expect(
      hasLayerCanvasContent({
        ...EMPTY,
        renderOptions: { ...EMPTY.renderOptions, showGrid: true },
        gridEnabled: false,
      }),
    ).toBe(false);
    expect(hasLayerCanvasContent({ ...EMPTY, gridEnabled: true })).toBe(false);
  });
});

// ── (δ) DEBUG CALIBRATION GRID ──────────────────────────────────────────────────

describe('(δ) debug calibration grid', () => {
  it('window.rulerDebugOverlay ενεργό ⇒ true', () => {
    expect(hasLayerCanvasContent({ ...EMPTY, debugCalibrationGridActive: true })).toBe(true);
  });
});

// ── Νεκρές είσοδοι + fail-mounted πολιτική ──────────────────────────────────────

describe('πολιτική', () => {
  it('τα κατώφλια είναι ρητές σταθερές (SSoT με τον renderer)', () => {
    expect(MIN_VERTICES_CLOSED_POLYGON).toBe(3);
    expect(MIN_VERTICES_DRAFT).toBe(1);
  });

  it('FAIL-MOUNTED: η διαφάνεια ΔΕΝ κρίνει unmount (opacity:0 layer μένει «περιεχόμενο»)', () => {
    // Ο renderer θέτει globalAlpha = layer.opacity· ένα opacity:0 layer δεν βάζει pixel,
    // αλλά ΔΕΝ το χρησιμοποιούμε ως λόγο unmount — ασύμμετρο κόστος (ADR-732 §3).
    expect(hasDrawableColorLayerContent([layer({ vertexCount: 3 })], true)).toBe(true);
  });
});
