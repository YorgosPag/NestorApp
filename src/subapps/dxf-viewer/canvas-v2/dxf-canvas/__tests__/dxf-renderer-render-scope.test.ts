/**
 * ADR-909 Β2.7 / ADR-040 — ΑΓΚΥΡΕΣ: ο `DxfRenderer` **έξω από τον ζωντανό καμβά**.
 *
 * Ο αποδότης γράφτηκε για έναν πελάτη (τον ζωντανό καμβά) και σήμερα τον καλούν τέσσερις: ζωντανός καμβάς +
 * bitmap cache · εκτύπωση / δημόσια κάτοψη · read-only προβολή ακινήτου · υπόστρωμα άλλου ορόφου. Τρεις
 * αποφάσεις του ρωτούσαν **καθολική κατάσταση της συνεδρίας** αντί για **αυτό που ζωγραφίζει**. Μετρημένο ζωντανά
 * 2026-10-09 στο «95 τ.μ.», πριν από κάθε κώδικα:
 *
 *   Σ  στρώμα 632 στοιχείων κρυφό+παγωμένο στη read-only κάτοψη: 336.978 px πριν = 336.978 px μετά
 *   Γ  με τη σημαία του στρώματος GPU αναμμένη, η λήψη έχασε 322.771 px (−7,9%) — οι σκέτες γραμμές
 *   Π  παράκαμψη «DXF Σχέδιο» 0,5 mm σε print pass 694 dpi ⇒ 1,89 px αντί 13,65 px (κάτω κι από το δάπεδο 4 px)
 *
 *   Σ1  κρυφό στρώμα **της σκηνής**, άδειο LayerStore ⇒ δεν ζωγραφίζεται
 *   Σ2  παγωμένο στρώμα ⇒ το ίδιο
 *   Σ3  🔑 store «ορατό», σκηνή «κρυφό»: `'session'` (προεπιλογή) ⇒ ζωγραφίζεται, όπως πάντα· `'scene'` ⇒ όχι
 *   Γ1  στρώμα GPU ενεργό, **χωρίς** δήλωση ⇒ οι γραμμές ζωγραφίζονται (ασφαλές εξ ορισμού)
 *   Γ2  🔑 με δήλωση `linesOwnedByGpuLayer` ⇒ καταστέλλονται, όπως πάντα στον ζωντανό καμβά
 *   Γ3  η λήψη εκτός οθόνης (`renderDxfSceneOffscreen`) ζωγραφίζει τις γραμμές ακόμη και με το στρώμα ενεργό
 *   Π1  παράκαμψη πάχους σε print pass ⇒ πραγματικό πάχος στο dpi της απόδοσης
 *   Π2  λεπτή παράκαμψη ⇒ το δάπεδο της απόδοσης
 *   Π3  🔑 οθόνη, «ΠΑΧΟΣ» αναμμένο ⇒ όπως πάντα (96 dpi)
 *   Π4  χρώμα παράκαμψης σε `monochrome` ⇒ μαύρο· στην οθόνη ⇒ το χρώμα της παράκαμψης, όπως πάντα
 */

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));
jest.mock('../../../print/capture/capture-2d-offscreen-canvas', () => ({ createOffscreen2dTarget: jest.fn() }));

import { DxfRenderer } from '../DxfRenderer';
import type { DxfEntityUnion, DxfRenderOptions, DxfScene } from '../dxf-types';
import { createPaintLog, createRecordingCanvas, type PaintLog } from '../../../testing/paint-recorder';
import type { ViewTransform, Viewport } from '../../../rendering/types/Types';
import { __resetLayerStoreForTesting, setLayers } from '../../../stores/LayerStore';
import { __resetLineweightDisplayForTesting } from '../../../stores/LineweightDisplayStore';
import { createSceneLayer } from '../../../types/scene-types';
import type { SceneLayer } from '../../../types/entities';
import { setWebglLineLayerActive, setWebglOwnedEntityIds } from '../../webgl-lines/webgl-line-layer-store';
import { clearPrintColorPolicy, setPrintColorPolicy, type PrintColorPolicy } from '../../../config/print-color-policy';
import { lineweightToPx } from '../../../config/lineweight-iso-catalog';
import { renderWithViewSettings } from '../../../state/bim-render-settings-view-scope';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { createOffscreen2dTarget } from '../../../print/capture/capture-2d-offscreen-canvas';
import { renderDxfSceneOffscreen } from '../../../print/capture/capture-2d';

const VIEWPORT: Viewport = { width: 1280, height: 800 };
const TRANSFORM: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
const PUBLIC_IMAGE: PrintColorPolicy = { style: 'monochrome', dpi: 694, minLineWidthPx: 4 };

/** Οι δύο γραμμές ξεχωρίζουν στο ίχνος από το **μήκος** τους — ανεξάρτητο από τη φορά του άξονα y. */
const LEN_A = 300;
const LEN_B = 500;

function line(id: string, layerId: string, lengthPx: number, y: number): DxfEntityUnion {
  return {
    id, type: 'line', layerId, visible: true,
    start: { x: 100, y }, end: { x: 100 + lengthPx, y },
  } as unknown as DxfEntityUnion;
}

function layer(id: string, flags: { visible?: boolean; frozen?: boolean } = {}): SceneLayer {
  return { ...createSceneLayer({ id, name: id, visible: flags.visible ?? true }), frozen: flags.frozen ?? false };
}

function scene(layers: SceneLayer[]): DxfScene {
  return {
    entities: [line('ent_a', 'lyr_a', LEN_A, 200), line('ent_b', 'lyr_b', LEN_B, 400)],
    layers: [],
    layersById: Object.fromEntries(layers.map((l) => [l.id, l])),
    bounds: { min: { x: 0, y: 0 }, max: { x: 1280, y: 800 } },
    units: 'mm',
  } as unknown as DxfScene;
}

const BASE: DxfRenderOptions = {
  showGrid: false, showLayerNames: false, wireframeMode: false, selectedEntityIds: [], skipInteractive: true,
};

function paint(target: DxfScene, extra: Partial<DxfRenderOptions> = {}): PaintLog {
  const log = createPaintLog();
  new DxfRenderer(createRecordingCanvas(log, VIEWPORT)).render(target, TRANSFORM, VIEWPORT, { ...BASE, ...extra });
  return log;
}

/** Τα μήκη (σε px, στρογγυλεμένα) κάθε ευθύγραμμου τμήματος που χαράχτηκε. */
function strokedLengths(log: PaintLog): number[] {
  const out: number[] = [];
  for (const s of log.strokes) {
    for (let i = 0; i + 1 < s.points.length; i += 2) {
      out.push(Math.round(Math.hypot(s.points[i + 1].x - s.points[i].x, s.points[i + 1].y - s.points[i].y)));
    }
  }
  return out.sort((a, b) => a - b);
}

/** Το πάχος / χρώμα με το οποίο χαράχτηκε το τμήμα μήκους `lengthPx`. */
function penOf(log: PaintLog, lengthPx: number): { lineWidth: number; color: string } {
  const hit = log.strokes.find((s) =>
    s.points.length >= 2 && Math.round(Math.hypot(s.points[1].x - s.points[0].x, s.points[1].y - s.points[0].y)) === lengthPx);
  if (!hit) throw new Error(`κανένα τμήμα μήκους ${lengthPx} στο ίχνος`);
  return { lineWidth: hit.lineWidth, color: hit.color };
}

beforeEach(() => {
  __resetLayerStoreForTesting();
  __resetLineweightDisplayForTesting();
  clearPrintColorPolicy();
  setWebglOwnedEntityIds(new Set());
  setWebglLineLayerActive(false);
});
afterEach(() => {
  clearPrintColorPolicy();
  setWebglOwnedEntityIds(new Set());
  setWebglLineLayerActive(false);
});

describe('Σ — τα στρώματα τα λέει η σκηνή που ζωγραφίζεται', () => {
  it('Σ0 μάρτυρας: με όλα ορατά, χαράζονται ΚΑΙ οι δύο γραμμές', () => {
    expect(strokedLengths(paint(scene([layer('lyr_a'), layer('lyr_b')])))).toEqual([LEN_A, LEN_B]);
  });

  it('Σ1 κρυφό στρώμα της σκηνής, άδειο LayerStore ⇒ δεν ζωγραφίζεται', () => {
    expect(strokedLengths(paint(scene([layer('lyr_a', { visible: false }), layer('lyr_b')])))).toEqual([LEN_B]);
  });

  it('Σ2 παγωμένο στρώμα της σκηνής ⇒ δεν ζωγραφίζεται', () => {
    expect(strokedLengths(paint(scene([layer('lyr_a'), layer('lyr_b', { frozen: true })])))).toEqual([LEN_A]);
  });

  it('Σ3 store «ορατό», σκηνή «κρυφό»: session ⇒ ζωγραφίζεται · scene ⇒ όχι', () => {
    setLayers([layer('lyr_a'), layer('lyr_b')]);
    const foreign = scene([layer('lyr_a', { visible: false }), layer('lyr_b')]);
    expect(strokedLengths(paint(foreign))).toEqual([LEN_A, LEN_B]);
    expect(strokedLengths(paint(foreign, { layerSource: 'session' }))).toEqual([LEN_A, LEN_B]);
    expect(strokedLengths(paint(foreign, { layerSource: 'scene' }))).toEqual([LEN_B]);
  });

  it('Σ3β store «κρυφό», σκηνή «ορατό»: session ⇒ όχι (ο ζωντανός καμβάς αμετάβλητος) · scene ⇒ ζωγραφίζεται', () => {
    setLayers([layer('lyr_a', { visible: false }), layer('lyr_b')]);
    const foreign = scene([layer('lyr_a'), layer('lyr_b')]);
    expect(strokedLengths(paint(foreign))).toEqual([LEN_B]);
    expect(strokedLengths(paint(foreign, { layerSource: 'scene' }))).toEqual([LEN_A, LEN_B]);
  });
});

describe('Γ — η καταστολή γραμμών του στρώματος GPU είναι δήλωση του καλούντος', () => {
  const visible = (): DxfScene => scene([layer('lyr_a'), layer('lyr_b')]);
  const gpuOwnsEverything = (): void => {
    setWebglOwnedEntityIds(new Set(['ent_a', 'ent_b']));
    setWebglLineLayerActive(true);
  };

  it('Γ1 στρώμα GPU ενεργό, χωρίς δήλωση ⇒ οι γραμμές ζωγραφίζονται', () => {
    gpuOwnsEverything();
    expect(strokedLengths(paint(visible()))).toEqual([LEN_A, LEN_B]);
  });

  it('Γ2 με δήλωση linesOwnedByGpuLayer ⇒ καταστέλλονται · χωρίς ενεργό στρώμα η δήλωση δεν κρύβει τίποτα', () => {
    expect(strokedLengths(paint(visible(), { linesOwnedByGpuLayer: true }))).toEqual([LEN_A, LEN_B]);
    gpuOwnsEverything();
    expect(strokedLengths(paint(visible(), { linesOwnedByGpuLayer: true }))).toEqual([]);
  });

  it('Γ3 η λήψη εκτός οθόνης ζωγραφίζει τις γραμμές ακόμη και με το στρώμα GPU ενεργό', () => {
    const log = createPaintLog();
    const canvas = createRecordingCanvas(log, VIEWPORT);
    (createOffscreen2dTarget as jest.Mock).mockReturnValue({ canvas, renderer: new DxfRenderer(canvas) });
    gpuOwnsEverything();
    renderDxfSceneOffscreen(visible(), VIEWPORT, {
      scene: null, raster: { widthPx: 1280, heightPx: 800, effectiveDpi: 300 }, fitMode: 'fit-to-page', plotStyle: 'monochrome',
    });
    expect(strokedLengths(log)).toHaveLength(2);
  });
});

describe('Π — η παράκαμψη «DXF Σχέδιο» ρωτά το dpi και το δάπεδο της απόδοσης', () => {
  const visible = (): DxfScene => scene([layer('lyr_a'), layer('lyr_b')]);
  const withOverride = (override: { mm?: number; color?: string | null }, policy: PrintColorPolicy | null): PaintLog => {
    const live = useBimRenderSettingsStore.getState();
    const dxfImport = {
      ...live.dxfImport,
      projectionLineweightMm: override.mm ?? 0,
      projectionColor: override.color ?? null,
    };
    return renderWithViewSettings({ dxfImport }, () => {
      if (policy) setPrintColorPolicy(policy);
      try {
        return paint(visible());
      } finally {
        clearPrintColorPolicy();
      }
    });
  };

  it('Π1 print pass 694 dpi, 0,5 mm ⇒ πραγματικό πάχος στο dpi (όχι 96)', () => {
    const real = lineweightToPx(0.5, 694);
    expect(real).toBeGreaterThan(13);
    expect(penOf(withOverride({ mm: 0.5 }, PUBLIC_IMAGE), LEN_A).lineWidth).toBeCloseTo(real, 5);
  });

  it('Π2 λεπτή παράκαμψη ⇒ το δάπεδο της απόδοσης · PDF χωρίς δάπεδο ⇒ πραγματικό πάχος', () => {
    expect(lineweightToPx(0.05, 694)).toBeLessThan(4);
    expect(penOf(withOverride({ mm: 0.05 }, PUBLIC_IMAGE), LEN_A).lineWidth).toBe(4);
    const pdf = penOf(withOverride({ mm: 0.5 }, { style: 'monochrome', dpi: 300 }), LEN_A).lineWidth;
    expect(pdf).toBeCloseTo(lineweightToPx(0.5, 300), 5);
  });

  it('Π3 οθόνη, «ΠΑΧΟΣ» αναμμένο ⇒ όπως πάντα (96 dpi)', () => {
    expect(penOf(withOverride({ mm: 0.5 }, null), LEN_A).lineWidth).toBeCloseTo(lineweightToPx(0.5), 5);
  });

  it('Π4 χρώμα παράκαμψης: monochrome ⇒ μαύρο · οθόνη ⇒ το χρώμα της παράκαμψης', () => {
    expect(penOf(withOverride({ color: '#ff0000' }, PUBLIC_IMAGE), LEN_A).color).toBe('#000000');
    expect(penOf(withOverride({ color: '#ff0000' }, null), LEN_A).color.toLowerCase()).toBe('#ff0000');
  });
});
