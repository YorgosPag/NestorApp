/**
 * ADR-909 Γ2.3 — `applyLiveStroke`: το ένα σημείο όπου οι ζωγράφοι Η/Μ (και τα σχήματα 3Δ) αποκτούν μελάνι
 * και πάχος, και οι παλέτες Η/Μ που πλέον **παράγονται** από τον πίνακα κατηγοριών.
 *
 * Λ1 οθόνη όπως πριν · Λ2 «Ασπρόμαυρο» ⇒ μαύρο + δάπεδο πάχους · Λ3 «Γκρι» ⇒ άχρωμο ≥ 3:1 · Λ4 «Έγχρωμο» ⇒ το
 * χρώμα του συστήματος μένει · Λ5 το PDF του μηχανικού χωρίς δάπεδο πάχους · Λ6 οι παραγόμενες παλέτες δίνουν
 * **ακριβώς** τις συμβολοσειρές που ήταν γραμμένες με το χέρι (η οθόνη όπως πριν).
 */

import { BIM_CATEGORY_LINE_COLORS } from '../../../../config/bim-object-styles';
import { contrastRatio, hexToRgba, parseHex, saturation } from '../../../../config/color-math';
import { MIN_ENTITY_CONTRAST } from '../../../../config/contrast-adaptation';
import {
  clearPrintColorPolicy,
  PRINT_PAPER_HEX,
  setPrintColorPolicy,
  type PrintColorPolicy,
} from '../../../../config/print-color-policy';
import { MEP_DOMAIN_DEFAULT_STROKE } from '../../../mep-systems/mep-system-color';
import { applyLiveStroke } from '../live-stroke';

const FLOOR_PX = 4;
/** Τα χρώματα γραμμής των ζωγράφων Η/Μ της πύλης pixels (ADR-909 §6.9). */
const MEP_INKS = [
  BIM_CATEGORY_LINE_COLORS.hydronicHeating,
  BIM_CATEGORY_LINE_COLORS.domesticHotWater,
  MEP_DOMAIN_DEFAULT_STROKE.pipe,
  MEP_DOMAIN_DEFAULT_STROKE.duct,
  MEP_DOMAIN_DEFAULT_STROKE.fuel,
  '#2563eb',
];

const publicImage = (style: PrintColorPolicy['style']): PrintColorPolicy => ({
  style, dpi: 694, minLineWidthPx: FLOOR_PX, minInkContrast: MIN_ENTITY_CONTRAST,
});

function stroked(color: string, widthPx: number): { ink: string; width: number } {
  const ctx = { strokeStyle: '', lineWidth: 0 };
  applyLiveStroke(ctx as unknown as CanvasRenderingContext2D, color, widthPx);
  return { ink: ctx.strokeStyle, width: ctx.lineWidth };
}

afterEach(clearPrintColorPolicy);

describe('applyLiveStroke (ADR-909 Γ2.3)', () => {
  it('Λ1 οθόνη όπως πριν: χρώμα και πάχος αυτούσια', () => {
    for (const ink of MEP_INKS) {
      expect(stroked(ink, 2)).toStrictEqual({ ink, width: 2 });
      expect(stroked(ink, 1)).toStrictEqual({ ink, width: 1 });
    }
  });

  it('Λ2 🔴 «Ασπρόμαυρο»: μαύρο και στο δάπεδο πάχους — ο θερμοσίφωνας δεν βγαίνει μπλε', () => {
    setPrintColorPolicy(publicImage('monochrome'));
    for (const ink of MEP_INKS) {
      expect(stroked(ink, 2)).toStrictEqual({ ink: '#000000', width: FLOOR_PX });
      expect(stroked(ink, 1)).toStrictEqual({ ink: '#000000', width: FLOOR_PX });
    }
  });

  it('Λ3 «Γκρι»: άχρωμο και ≥ 3:1 προς το χαρτί', () => {
    setPrintColorPolicy(publicImage('grayscale'));
    for (const ink of MEP_INKS) {
      const out = stroked(ink, 2).ink;
      expect(saturation(parseHex(out)!)).toBe(0);
      expect(contrastRatio(out, PRINT_PAPER_HEX)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
    }
  });

  it('Λ4 «Έγχρωμο»: επαρκές χρώμα συστήματος μένει αυτούσιο · αχνό (κίτρινο αερίου) σκουραίνει στο 3:1', () => {
    setPrintColorPolicy(publicImage('colour'));
    expect(stroked(BIM_CATEGORY_LINE_COLORS.hydronicHeating, 2).ink).toBe(BIM_CATEGORY_LINE_COLORS.hydronicHeating);
    const gas = stroked(MEP_DOMAIN_DEFAULT_STROKE.fuel, 2).ink;
    expect(contrastRatio(MEP_DOMAIN_DEFAULT_STROKE.fuel, PRINT_PAPER_HEX)).toBeLessThan(MIN_ENTITY_CONTRAST);
    expect(contrastRatio(gas, PRINT_PAPER_HEX)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
  });

  it('Λ5 PDF του μηχανικού (χωρίς δάπεδα): άχρωμο σε «Ασπρόμαυρο», το πάχος όπως ζητήθηκε', () => {
    setPrintColorPolicy({ style: 'monochrome', dpi: 300 });
    expect(stroked('#1d4ed8', 2)).toStrictEqual({ ink: '#000000', width: 2 });
    expect(stroked('#1d4ed8', 1)).toStrictEqual({ ink: '#000000', width: 1 });
  });
});

describe('παλέτες Η/Μ — παράγονται, και η οθόνη μένει όπως πριν (ADR-909 Γ2.3)', () => {
  it('Λ6 οι παραγόμενες συμβολοσειρές είναι ΑΚΡΙΒΩΣ οι παλιές χειρόγραφες', () => {
    expect(BIM_CATEGORY_LINE_COLORS.hydronicHeating).toBe('#dc2626');
    expect(BIM_CATEGORY_LINE_COLORS.domesticHotWater).toBe('#1d4ed8');
    expect(hexToRgba(BIM_CATEGORY_LINE_COLORS.hydronicHeating, 0.16)).toBe('rgba(220, 38, 38, 0.16)');
    expect(hexToRgba(BIM_CATEGORY_LINE_COLORS.hydronicHeating, 0.1)).toBe('rgba(220, 38, 38, 0.1)');
    expect(hexToRgba(BIM_CATEGORY_LINE_COLORS.domesticHotWater, 0.14)).toBe('rgba(29, 78, 216, 0.14)');
    expect(MEP_DOMAIN_DEFAULT_STROKE).toStrictEqual({ duct: '#64748b', pipe: '#b45309', fuel: '#eab308' });
    expect(hexToRgba(MEP_DOMAIN_DEFAULT_STROKE.duct, 0.15)).toBe('rgba(100, 116, 139, 0.15)');
    expect(hexToRgba(MEP_DOMAIN_DEFAULT_STROKE.pipe, 0.15)).toBe('rgba(180, 83, 9, 0.15)');
    expect(hexToRgba(MEP_DOMAIN_DEFAULT_STROKE.fuel, 0.15)).toBe('rgba(234, 179, 8, 0.15)');
  });
});
