/**
 * ADR-909 Γ2.1 — ΑΓΚΥΡΕΣ «το χαρτί αποφασίζει το μελάνι»: **επιφάνεια** και **δάπεδο αντίθεσης**.
 *
 * Μετρημένο στην πύλη pixels (CHECK 3.101, 2026-10-09): το περίγραμμα **κάθε τοίχου** έβγαινε στη δημόσια
 * κάτοψη `#aaaaaa` (2,3:1) αντί για μαύρο, και ο σοβάς `#e8e0d0` σχεδόν αόρατος.
 *
 *   Χ1  σε print pass το δομικό μελάνι κρίνεται απέναντι στο ΧΑΡΤΙ: το μαύρο μένει μαύρο, καμία διάσωση
 *   Χ2  🔑 η οθόνη ΟΠΩΣ ΠΡΙΝ: χωρίς print pass η επιφάνεια είναι ο καμβάς, και το σκούρο φωτίζεται
 *   Χ3  δάπεδο σε «Έγχρωμο»: αχνό χρώμα σκουραίνει ΟΣΟ χρειάζεται, ίδια απόχρωση · επαρκές μένει αυτούσιο
 *   Χ4  δάπεδο σε «Γκρι»: το γκρι του κίτρινου σκουραίνει και μένει γκρι
 *   Χ5  🔑 PDF του μηχανικού (χωρίς `minInkContrast`) = όπως πριν: το κίτρινο μένει κίτρινο
 *   Χ6  το δάπεδο αφορά ΜΟΝΟ μελάνι: γέμισμα και τόνος σώματος δεν αγγίζονται
 *   Χ7  ποιος το δηλώνει: η εκτύπωση όχι · όποιος το περάσει στη λήψη, ναι
 *   Χ8  `liveStrokeInk` με `rgba(…)`: ό,τι θα έβλεπε το μάτι πάνω στο χαρτί — ποτέ «άγνωστο ⇒ μαύρο»
 */

import { contrastCasingInk } from '../../bim/renderers/bim-contrast-casing';
import {
  _clearAdaptiveColorCache,
  adaptColorForSurface,
  adaptEntityColorForCanvas,
  adaptStructuralLineInkForCanvas,
  liveStrokeInk,
  MIN_ENTITY_CONTRAST,
} from '../../config/adaptive-entity-color';
import { resolveDxfCanvasBackgroundHex } from '../../config/color-config';
import { contrastRatio, mixHex, parseHex, saturation } from '../../config/color-math';
import {
  PRINT_PAPER_HEX,
  applyPlotColor,
  clearPrintColorPolicy,
  getPrintColorPolicy,
  setPrintColorPolicy,
  type PrintColorPolicy,
} from '../../config/print-color-policy';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import { createOffscreen2dTarget } from '../capture/capture-2d-offscreen-canvas';
import { renderDxfSceneOffscreen } from '../capture/capture-2d';

jest.mock('../capture/capture-2d-offscreen-canvas', () => ({ createOffscreen2dTarget: jest.fn() }));

const WALL_LINE_CONTRAST = 9;
const WALL_DARK = '#2b2f36';
const YELLOW = '#c8c800';
const PLASTER = '#e8e0d0';
const FLOOR = MIN_ENTITY_CONTRAST;

const publicImage = (style: PrintColorPolicy['style']): PrintColorPolicy => ({
  style, dpi: 694, minLineWidthPx: 4, minInkContrast: FLOOR,
});
const paperPdf = (style: PrintColorPolicy['style']): PrintColorPolicy => ({ style, dpi: 300 });
const onPaper = (hex: string): number => contrastRatio(hex, PRINT_PAPER_HEX);

beforeEach(() => {
  clearPrintColorPolicy();
  _clearAdaptiveColorCache();
});
afterEach(clearPrintColorPolicy);

describe('Χ1–Χ2 — η επιφάνεια του δομικού μελανιού', () => {
  it('Χ1 print pass: κρίνεται απέναντι στο χαρτί — το μαύρο μένει μαύρο, χωρίς casing', () => {
    setPrintColorPolicy(publicImage('monochrome'));
    const black = adaptStructuralLineInkForCanvas('#000000', WALL_LINE_CONTRAST);
    expect(black).toMatchObject({ kind: 'sufficient', ink: '#000000' });
    expect(contrastCasingInk(black)).toBeNull();

    // «Έγχρωμο»: το σκούρο χρώμα του τοίχου φτάνει ήδη το 9:1 στο λευκό ⇒ αυτούσιο.
    expect(onPaper(WALL_DARK)).toBeGreaterThan(WALL_LINE_CONTRAST);
    expect(adaptStructuralLineInkForCanvas(WALL_DARK, WALL_LINE_CONTRAST).ink).toBe(WALL_DARK);
    expect(adaptEntityColorForCanvas(WALL_DARK, WALL_LINE_CONTRAST)).toBe(WALL_DARK);
  });

  it('Χ1β print pass: κανένα χρώμα δεν βγάζει shortfall στο χαρτί ⇒ το casing δεν ζωγραφίζεται ποτέ', () => {
    setPrintColorPolicy(paperPdf('colour'));
    for (const hex of ['#000000', '#ffffff', '#808080', '#ffff00', '#ff0000', WALL_DARK, PLASTER]) {
      const verdict = adaptStructuralLineInkForCanvas(hex, WALL_LINE_CONTRAST);
      expect(verdict.kind).toBe('sufficient');
      expect(contrastCasingInk(verdict)).toBeNull();
    }
  });

  it('Χ2 οθόνη όπως πριν: η επιφάνεια είναι ο καμβάς, και το σκούρο φωτίζεται', () => {
    expect(getPrintColorPolicy()).toBeNull();
    const canvas = resolveDxfCanvasBackgroundHex();
    for (const hex of ['#000000', WALL_DARK, '#6b7280', '#ff0000', '#ffffff']) {
      expect(adaptEntityColorForCanvas(hex)).toBe(adaptColorForSurface(hex, canvas, MIN_ENTITY_CONTRAST));
      expect(adaptEntityColorForCanvas(hex, WALL_LINE_CONTRAST)).toBe(adaptColorForSurface(hex, canvas, WALL_LINE_CONTRAST));
    }
    const wall = adaptStructuralLineInkForCanvas(WALL_DARK, WALL_LINE_CONTRAST);
    expect(wall.ink).toBe(adaptColorForSurface(WALL_DARK, canvas, WALL_LINE_CONTRAST));
    expect(wall.ink).not.toBe(WALL_DARK);
    expect(contrastRatio(wall.ink, canvas)).toBeGreaterThan(contrastRatio(WALL_DARK, canvas));
  });
});

describe('Χ3–Χ6 — το δάπεδο αντίθεσης μελανιού', () => {
  it('Χ3 «Έγχρωμο»: αχνό χρώμα σκουραίνει όσο χρειάζεται, ίδια απόχρωση · επαρκές μένει αυτούσιο', () => {
    const policy = publicImage('colour');
    expect(onPaper(YELLOW)).toBeLessThan(FLOOR);
    const ink = applyPlotColor(YELLOW, null, policy);
    expect(onPaper(ink)).toBeGreaterThanOrEqual(FLOOR);
    expect(onPaper(ink)).toBeLessThan(FLOOR + 0.1); // όσο χρειάζεται, όχι μαύρο
    const rgb = parseHex(ink);
    expect(rgb).not.toBeNull();
    expect(rgb?.r).toBe(rgb?.g); // κίτρινο ⇒ r = g, b = 0: η απόχρωση κρατήθηκε
    expect(rgb?.b).toBe(0);

    expect(onPaper(applyPlotColor(PLASTER, null, policy))).toBeGreaterThanOrEqual(FLOOR);
    for (const kept of ['#000000', '#ff0000', '#1d4ed8', WALL_DARK]) {
      expect(onPaper(kept)).toBeGreaterThanOrEqual(FLOOR);
      expect(applyPlotColor(kept, null, policy)).toBe(kept);
    }
    expect(applyPlotColor(YELLOW, null, { ...policy, style: 'by-pen' })).toBe(ink);
  });

  it('Χ4 «Γκρι»: το γκρι του κίτρινου σκουραίνει και μένει γκρι', () => {
    const plain = applyPlotColor(YELLOW, null, paperPdf('grayscale'));
    expect(onPaper(plain)).toBeLessThan(FLOOR);
    const ink = applyPlotColor(YELLOW, null, publicImage('grayscale'));
    expect(onPaper(ink)).toBeGreaterThanOrEqual(FLOOR);
    const rgb = parseHex(ink);
    expect(rgb !== null && saturation(rgb)).toBe(0);
  });

  it('Χ5 PDF του μηχανικού (χωρίς minInkContrast): όπως πριν — το κίτρινο μένει κίτρινο', () => {
    expect(applyPlotColor(YELLOW, null, paperPdf('colour'))).toBe(YELLOW);
    expect(applyPlotColor(PLASTER, null, paperPdf('colour'))).toBe(PLASTER);
    expect(applyPlotColor(YELLOW, null, paperPdf('by-pen'))).toBe(YELLOW);
    expect(applyPlotColor('#ffffff', null, paperPdf('colour'))).toBe('#000000');
    expect(applyPlotColor(YELLOW, null, paperPdf('monochrome'))).toBe('#000000');
  });

  it('Χ6 μόνο μελάνι: γέμισμα και τόνος σώματος δεν αγγίζονται · monochrome όπως πριν', () => {
    for (const style of ['colour', 'grayscale', 'by-pen', 'monochrome'] as const) {
      for (const role of ['fill', 'tint'] as const) {
        expect(applyPlotColor(YELLOW, null, publicImage(style), role)).toBe(applyPlotColor(YELLOW, null, paperPdf(style), role));
        expect(applyPlotColor('#ededed', null, publicImage(style), role)).toBe(applyPlotColor('#ededed', null, paperPdf(style), role));
      }
    }
    expect(applyPlotColor(YELLOW, null, publicImage('monochrome'))).toBe('#000000');
    expect(applyPlotColor(null, null, publicImage('colour'))).toBe('#000000');
  });
});

describe('Χ7 — ποιος δηλώνει το δάπεδο αντίθεσης', () => {
  const scene = { entities: [], layers: [], bounds: null } as unknown as DxfScene;
  const raster = { widthPx: 800, heightPx: 600, effectiveDpi: 300 };

  function policyDuringRender(input: { minInkContrast?: number }): PrintColorPolicy | null {
    let seen: PrintColorPolicy | null = null;
    (createOffscreen2dTarget as jest.Mock).mockReturnValue({
      canvas: {},
      renderer: { render: (): void => { seen = getPrintColorPolicy(); } },
    });
    renderDxfSceneOffscreen(scene, { width: 800, height: 600 }, {
      scene: null, raster, fitMode: 'fit-to-page', plotStyle: 'colour', ...input,
    });
    return seen;
  }

  it('Χ7 η εκτύπωση δεν το δηλώνει · η λήψη που το περνά το βλέπει ο αποδότης · καθαρίζεται', () => {
    expect(policyDuringRender({})).not.toHaveProperty('minInkContrast');
    expect(policyDuringRender({ minInkContrast: FLOOR })).toMatchObject({ minInkContrast: FLOOR });
    expect(getPrintColorPolicy()).toBeNull();
  });
});

describe('Χ8 — ημιδιαφανές μελάνι (`rgba`)', () => {
  const EDGE = 'rgba(139, 94, 52, 0.55)';
  const seenOnPaper = mixHex(PRINT_PAPER_HEX, '#8b5e34', 0.55);

  it('Χ8 οθόνη ⇒ αυτούσιο · «Έγχρωμο» ⇒ ό,τι φαίνεται στο χαρτί, όχι μαύρο · monochrome ⇒ μαύρο', () => {
    expect(liveStrokeInk(EDGE)).toBe(EDGE);
    expect(liveStrokeInk('#8b5e34')).toBe('#8b5e34');

    setPrintColorPolicy(paperPdf('colour'));
    expect(liveStrokeInk(EDGE)).toBe(seenOnPaper);
    expect(liveStrokeInk(EDGE)).not.toBe('#000000');
    expect(liveStrokeInk('#8b5e34')).toBe('#8b5e34');
    expect(liveStrokeInk('rgb(139, 94, 52)')).toBe('#8b5e34');

    setPrintColorPolicy(paperPdf('monochrome'));
    expect(liveStrokeInk(EDGE)).toBe('#000000');
  });

  it('Χ8β δημόσια κάτοψη: το δάπεδο κρίνει το ΣΥΝΘΕΤΟ χρώμα, άρα η αχνή ακμή φτάνει το 3:1', () => {
    expect(onPaper(seenOnPaper)).toBeLessThan(FLOOR);
    setPrintColorPolicy(publicImage('colour'));
    expect(onPaper(liveStrokeInk(EDGE))).toBeGreaterThanOrEqual(FLOOR);
    setPrintColorPolicy(publicImage('grayscale'));
    expect(onPaper(liveStrokeInk(EDGE))).toBeGreaterThanOrEqual(FLOOR);
  });
});
