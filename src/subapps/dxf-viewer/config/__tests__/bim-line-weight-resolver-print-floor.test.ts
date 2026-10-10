/**
 * ADR-909 Γ2.5 (Η3) — το δάπεδο πάχους της απόδοσης μπαίνει στη **ρίζα** (`resolveSubcategoryStyle`), όχι σε
 * κάθε ζωγράφο.
 *
 * Πριν: mm → px στο DPI της εκτύπωσης **χωρίς δάπεδο**. Το άνοιγμα πλάκας (πένα 3, 0,13 mm) έβγαινε 3,55 px στη
 * δημόσια κάτοψη των 4096 px (πύλη pixels: `K3:*:slab-opening`).
 *
 * Ρ1 οθόνη όπως πριν, και από τους πέντε δρόμους πάχους · Ρ2 δημόσια κάτοψη ⇒ ποτέ κάτω από το δάπεδο, και από
 * τους πέντε · Ρ3 το δάπεδο δεν αγγίζει ό,τι είναι ήδη παχύ · Ρ4 το PDF του μηχανικού χωρίς δάπεδο 4 px ·
 * Ρ5 το κρυμμένο μένει μηδέν.
 */

import { resolveSubcategoryStyle, type SubcategoryResolutionContext } from '../bim-line-weight-resolver';
import { lineweightToPx } from '../lineweight-iso-catalog';
import { clearPrintColorPolicy, setPrintColorPolicy } from '../print-color-policy';
import {
  ENGINEER_PDF,
  FLOOR_PX,
  PLOT_STYLES,
  PUBLIC_IMAGE_DPI,
  publicImage,
} from '../../bim/renderers/__tests__/print-pass-policies';

const BASE: SubcategoryResolutionContext = { category: 'wall-covering', cutState: 'projection', scaleDenominator: 100 };

/** Οι πέντε δρόμοι από τους οποίους ένα στοιχείο παίρνει πάχος — ο καθένας με λεπτή πένα, κάτω από το δάπεδο. */
const ROUTES: ReadonlyArray<readonly [string, SubcategoryResolutionContext, number]> = [
  ['πένα στοιχείου', { ...BASE, elementOverride: { projectionPen: 2 } }, 0.05],
  ['πένα υποκατηγορίας', {
    ...BASE,
    subcategoryKey: 'edge',
    objectStyles: { 'wall-covering': { projectionPen: 3, cutPen: 3, subcategories: { edge: { projectionPen: 2 } } } },
  }, 0.05],
  ['πένα V/G', { ...BASE, objectStyles: { 'wall-covering': { projectionPen: 2, cutPen: 2 } } }, 0.05],
  ['πάχος στρώματος', { ...BASE, layerOverride: { lineweightMm: 0.05 } }, 0.05],
  ['προεπιλογή κατηγορίας', BASE, 0.13],
];

afterEach(clearPrintColorPolicy);

describe.each(ROUTES)('resolveSubcategoryStyle — %s (ADR-909 Γ2.5 Η3)', (_route, ctx, mm) => {
  it('Ρ1 οθόνη όπως πριν: το ίδιο px με τη σκέτη μετατροπή mm → px', () => {
    expect(lineweightToPx(mm, 96)).toBeLessThan(1);
    expect(resolveSubcategoryStyle(ctx).lineWidthPx).toBe(lineweightToPx(mm, 96));
  });

  it.each(PLOT_STYLES)('Ρ2 🔴 δημόσια κάτοψη «%s»: ποτέ κάτω από το δάπεδο πάχους', (style) => {
    setPrintColorPolicy(publicImage(style));
    expect(lineweightToPx(mm, PUBLIC_IMAGE_DPI)).toBeLessThan(FLOOR_PX);
    expect(resolveSubcategoryStyle(ctx).lineWidthPx).toBe(FLOOR_PX);
  });

  it('Ρ4 PDF του μηχανικού: κανένα δάπεδο 4 px — το πάχος του μένει κάτω από αυτό', () => {
    setPrintColorPolicy(ENGINEER_PDF);
    const px = resolveSubcategoryStyle(ctx).lineWidthPx;
    expect(px).toBe(Math.max(1, lineweightToPx(mm, ENGINEER_PDF.dpi)));
    expect(px).toBeLessThan(FLOOR_PX);
  });
});

describe('resolveSubcategoryStyle — ό,τι δεν πρέπει να αγγίξει το δάπεδο (ADR-909 Γ2.5 Η3)', () => {
  it('Ρ3 ό,τι είναι ήδη παχύ μένει όπως το ζήτησε η πένα του', () => {
    setPrintColorPolicy(publicImage('monochrome'));
    const thick = resolveSubcategoryStyle({ ...BASE, cutState: 'cut', elementOverride: { cutPen: 9 } }).lineWidthPx;
    expect(thick).toBe(lineweightToPx(0.5, PUBLIC_IMAGE_DPI));
    expect(thick).toBeGreaterThan(FLOOR_PX);
  });

  it('Ρ5 το κρυμμένο μένει μηδέν — το δάπεδο δεν «ανασταίνει» γραμμή που δεν ζωγραφίζεται', () => {
    setPrintColorPolicy(publicImage('monochrome'));
    expect(resolveSubcategoryStyle({ ...BASE, cutState: 'hidden' }).lineWidthPx).toBe(0);
    expect(resolveSubcategoryStyle({ ...BASE, elementOverride: { visible: false } }).lineWidthPx).toBe(0);
  });
});
