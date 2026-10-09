/**
 * ADR-909 Β2.5 / ADR-454 — ΑΓΚΥΡΕΣ του print pass: **επιφάνεια**, **τόνος σώματος**, **δάπεδο πάχους**.
 *
 * Μετρημένο ζωντανά (2026-10-09, «95 τ.μ.», 3732×4096): κάθε κολόνα BIM έβγαινε στη δημόσια κάτοψη συμπαγές
 * `rgb(23,32,46)` — το φόντο του θέματος `#1d283a` × 0,78 — και, μια μέρα νωρίτερα, κάθε γραμμή 1–2 px.
 *
 *   Ε1  η αδιαφανής βάση ενός σώματος BIM είναι ΧΑΡΤΙ σε print pass — ποτέ το φόντο του ζωντανού καμβά
 *   Ε2  χωρίς print pass η βάση είναι ο καμβάς, όπως πάντα · `beyond` δεν στρώνει βάση πουθενά
 *   Ε3  `monochrome` + σώμα BIM ⇒ γκρι της ΔΙΚΗΣ του φωτεινότητας, ίδια διαφάνεια (Revit «Black Lines»)
 *   Ε4  `colour` ⇒ το δικό του χρώμα · μελάνι και αδιαφανές γέμισμα στο `monochrome` ⇒ μαύρα, όπως πριν
 *   Ε5  δάπεδο πάχους: σκέτη γραμμή DXF ≥ `minLineWidthPx`, ΚΑΙ στους δύο κλάδους (με / χωρίς στρώμα)
 *   Ε6  🔑 PDF (χωρίς `minLineWidthPx`) = όπως πριν: δάπεδο 1 px, πραγματικό πάχος στο dpi
 *   Ε7  η εκτύπωση ΔΕΝ δηλώνει δάπεδο· η πολιτική καθαρίζεται ακόμη κι αν ο αποδότης πετάξει
 *   Ε8  ο σοβάς (finish outline) είναι ΜΕΛΑΝΙ: χρώμα πολιτικής + πένα στο δάπεδο· στην οθόνη όπως πάντα
 */

import { collectFinishOutlinePlanPolylines } from '../../bim/finishes/structural-finish-plan-geometry';
import { drawStructuralFinishOutline } from '../../bim/renderers/structural-finish-outline-2d';
import { fillBimBodyPath, resolveBimBodyFill } from '../../bim/utils/bim-body-fill';
import { liveDrawingSurfaceHex } from '../../config/adaptive-entity-color';
import { resolveDxfCanvasBackgroundHex } from '../../config/color-config';
import { parseColor } from '../../config/color-math';
import { lineweightToPx } from '../../config/lineweight-iso-catalog';
import {
  PRINT_PAPER_HEX,
  applyPlotColor,
  clearPrintColorPolicy,
  getPrintColorPolicy,
  setPrintColorPolicy,
  type PrintColorPolicy,
} from '../../config/print-color-policy';
import { resolveEntityRenderStyle } from '../../canvas-v2/dxf-canvas/dxf-renderer-style-resolve';
import type { DxfEntityUnion, DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import { __resetLineweightDisplayForTesting } from '../../stores/LineweightDisplayStore';
import { __resetLinetypeRegistryForTesting } from '../../stores/LinetypeRegistry';
import { createSceneLayer } from '../../types/entities';
import { createOffscreen2dTarget } from '../capture/capture-2d-offscreen-canvas';
import { renderDxfSceneOffscreen } from '../capture/capture-2d';

jest.mock('../capture/capture-2d-offscreen-canvas', () => ({ createOffscreen2dTarget: jest.fn() }));
jest.mock('../../bim/finishes/structural-finish-plan-geometry', () => ({ collectFinishOutlinePlanPolylines: jest.fn() }));

const COLUMN_FILL = 'rgba(47, 102, 144, 0.22)';
const PUBLIC_IMAGE: PrintColorPolicy = { style: 'monochrome', dpi: 694, minLineWidthPx: 4 };
const PAPER_PDF: PrintColorPolicy = { style: 'monochrome', dpi: 300 };

/** Πλαστό context: θυμάται με ποιο `fillStyle` έγινε κάθε `fill()`. */
function recordingCtx(): { ctx: CanvasRenderingContext2D; fills: string[] } {
  const fills: string[] = [];
  const ctx = { fillStyle: 'initial', fill(): void { fills.push(this.fillStyle); } };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills };
}

function line(lineweightMm: number | undefined, layerId = 'lyr_x'): DxfEntityUnion {
  return {
    id: 'e1', type: 'line', layerId, visible: true,
    start: { x: 0, y: 0 }, end: { x: 100, y: 0 },
    ...(lineweightMm === undefined ? {} : { lineweightMm }),
  } as unknown as DxfEntityUnion;
}

beforeEach(() => {
  clearPrintColorPolicy();
  __resetLineweightDisplayForTesting();
  __resetLinetypeRegistryForTesting();
});
afterEach(clearPrintColorPolicy);

describe('Ε1–Ε2 — η βάση του σώματος', () => {
  it('Ε1 σε print pass η βάση είναι ΧΑΡΤΙ, όχι το φόντο του καμβά', () => {
    expect(resolveDxfCanvasBackgroundHex().toLowerCase()).not.toBe(PRINT_PAPER_HEX);
    setPrintColorPolicy(PUBLIC_IMAGE);
    const { ctx, fills } = recordingCtx();
    fillBimBodyPath(ctx, 'rgba(1, 2, 3, 0.5)', 'cut');
    expect(fills).toEqual([PRINT_PAPER_HEX, 'rgba(1, 2, 3, 0.5)']);
    expect(liveDrawingSurfaceHex()).toBe(PRINT_PAPER_HEX);
  });

  it('Ε2 χωρίς print pass η βάση είναι ο καμβάς · `beyond` δεν στρώνει βάση', () => {
    const live = recordingCtx();
    fillBimBodyPath(live.ctx, 'rgba(1, 2, 3, 0.5)', 'projection');
    expect(live.fills).toEqual([resolveDxfCanvasBackgroundHex(), 'rgba(1, 2, 3, 0.5)']);
    expect(liveDrawingSurfaceHex()).toBe(resolveDxfCanvasBackgroundHex());

    setPrintColorPolicy(PUBLIC_IMAGE);
    const beyond = recordingCtx();
    fillBimBodyPath(beyond.ctx, 'rgba(1, 2, 3, 0.5)', 'beyond');
    expect(beyond.fills).toEqual(['rgba(1, 2, 3, 0.5)']);
  });
});

describe('Ε3–Ε4 — ο τόνος του σώματος', () => {
  const bodyFill = (): ReturnType<typeof parseColor> =>
    parseColor(resolveBimBodyFill('column', 'cut', undefined, COLUMN_FILL));

  it('Ε3 monochrome ⇒ γκρι της δικής του φωτεινότητας, ίδια διαφάνεια', () => {
    setPrintColorPolicy(PUBLIC_IMAGE);
    const c = bodyFill();
    expect(c).not.toBeNull();
    expect(c?.r).toBe(c?.g);
    expect(c?.g).toBe(c?.b);
    // Rec.601 του (47,102,144) ≈ 90 — ούτε μαύρο (0) ούτε το μπλε κανάλι (144).
    expect(c?.r).toBeGreaterThan(80);
    expect(c?.r).toBeLessThan(100);
    expect(c?.a).toBeCloseTo(0.22, 5);
  });

  it('Ε3β ανοιχτό και σκούρο υλικό μένουν ΔΙΑΚΡΙΤΑ στο monochrome', () => {
    const light = parseColor(applyPlotColor('#e0d090', null, PUBLIC_IMAGE, 'tint'));
    const dark = parseColor(applyPlotColor('#203050', null, PUBLIC_IMAGE, 'tint'));
    expect((light?.r ?? 0) - (dark?.r ?? 0)).toBeGreaterThan(100);
  });

  it('Ε4 colour ⇒ δικό του χρώμα · μελάνι και αδιαφανές γέμισμα στο monochrome ⇒ μαύρα', () => {
    setPrintColorPolicy({ style: 'colour', dpi: 300 });
    expect(bodyFill()).toMatchObject({ r: 47, g: 102, b: 144 });

    expect(applyPlotColor('#2f6690', null, PUBLIC_IMAGE)).toBe('#000000');
    expect(applyPlotColor('#2f6690', null, PUBLIC_IMAGE, 'fill')).toBe('#000000');
    expect(applyPlotColor(null, null, PUBLIC_IMAGE, 'tint')).toBe('#000000');
  });
});

describe('Ε5–Ε6 — το δάπεδο πάχους', () => {
  const layer = createSceneLayer({ name: 'L', color: '#FFFFFF', colorAci: 7, linetype: 'Continuous', lineweight: 0.05 });
  const layersById = { [layer.id]: layer };
  const widths = (mm: number | undefined): number[] => [
    resolveEntityRenderStyle(line(mm, layer.id), layersById).lineWidthPx,
    resolveEntityRenderStyle(line(mm)).lineWidthPx,
  ];

  it('Ε5 δημόσια εικόνα: λεπτή γραμμή ≥ 4 px και στους δύο κλάδους · παχιά αμετάβλητη', () => {
    setPrintColorPolicy(PUBLIC_IMAGE);
    expect(lineweightToPx(0.05, 694)).toBeLessThan(4);
    expect(widths(0.05)).toEqual([4, 4]);
    expect(widths(undefined)).toEqual([4, 4]);
    const thick = lineweightToPx(0.5, 694);
    expect(thick).toBeGreaterThan(4);
    widths(0.5).forEach((px) => expect(px).toBeCloseTo(thick, 5));
  });

  it('Ε6 PDF χωρίς minLineWidthPx: δάπεδο 1 px, πραγματικό πάχος στο dpi', () => {
    setPrintColorPolicy(PAPER_PDF);
    expect(widths(0.05)).toEqual([1, 1]);
    const real = lineweightToPx(0.5, 300);
    widths(0.5).forEach((px) => expect(px).toBeCloseTo(real, 5));
  });
});

describe('Ε7 — ποιος δηλώνει το δάπεδο', () => {
  const scene = { entities: [], layers: [], bounds: null } as unknown as DxfScene;
  const raster = { widthPx: 800, heightPx: 600, effectiveDpi: 300 };
  const target = createOffscreen2dTarget as jest.Mock;

  function capturePolicyDuringRender(input: { minLineWidthPx?: number }, fail = false): PrintColorPolicy | null {
    let seen: PrintColorPolicy | null = null;
    target.mockReturnValue({
      canvas: {},
      renderer: {
        render: (): void => {
          seen = getPrintColorPolicy();
          if (fail) throw new Error('boom');
        },
      },
    });
    const run = (): unknown =>
      renderDxfSceneOffscreen(scene, { width: 800, height: 600 }, {
        scene: null, raster, fitMode: 'fit-to-page', plotStyle: 'monochrome', ...input,
      });
    if (fail) expect(run).toThrow('boom');
    else run();
    return seen;
  }

  it('Ε7 η εκτύπωση δεν δηλώνει δάπεδο · η δημόσια λήψη το δηλώνει · καθαρίζεται πάντα', () => {
    const pdf = capturePolicyDuringRender({});
    expect(pdf).toEqual({ style: 'monochrome', dpi: 300 });
    expect(pdf).not.toHaveProperty('minLineWidthPx');
    expect(getPrintColorPolicy()).toBeNull();

    expect(capturePolicyDuringRender({ minLineWidthPx: 4 })).toMatchObject({ minLineWidthPx: 4 });

    capturePolicyDuringRender({}, true);
    expect(getPrintColorPolicy()).toBeNull();
  });
});

describe('Ε8 — ο σοβάς είναι μελάνι', () => {
  const PLASTER = '#e8e1d2';
  const strokeOnce = (): { color: string; width: number } => {
    (collectFinishOutlinePlanPolylines as jest.Mock).mockReturnValue([
      { colorHex: PLASTER, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
    ]);
    const seen = { color: '', width: 0 };
    const ctx = {
      strokeStyle: '', lineWidth: 0,
      save: jest.fn(), restore: jest.fn(), setLineDash: jest.fn(), beginPath: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(),
      stroke(): void { seen.color = this.strokeStyle; seen.width = this.lineWidth; },
    };
    drawStructuralFinishOutline(ctx as unknown as CanvasRenderingContext2D, undefined, 'mm', (p) => p);
    return seen;
  };

  it('Ε8 monochrome ⇒ μαύρο, πένα στο dpi (πάνω από το δάπεδο) · colour ⇒ δικό του χρώμα στο dpi · οθόνη ⇒ αμετάβλητο', () => {
    expect(strokeOnce()).toEqual({ color: PLASTER, width: 0.75 });

    setPrintColorPolicy(PUBLIC_IMAGE);
    const image = strokeOnce();
    expect(image.color).toBe('#000000');
    expect(image.width).toBeCloseTo(lineweightToPx(0.18, 694), 5);
    expect(image.width).toBeGreaterThanOrEqual(4);

    setPrintColorPolicy({ style: 'colour', dpi: 600 });
    const pdf = strokeOnce();
    expect(pdf.color).toBe(PLASTER);
    expect(pdf.width).toBeCloseTo(lineweightToPx(0.18, 600), 5);
  });
});
