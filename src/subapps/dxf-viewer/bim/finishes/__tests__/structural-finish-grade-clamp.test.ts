/**
 * ADR-713 — ο ΣΟΒΑΣ σταματά στη στάθμη τελειωμένου εδάφους.
 *
 * Ο ενιαίος silhouette (ADR-449 Slice 7) είναι η διαδρομή που όντως ζωγραφίζει το επίχρισμα
 * στη σκηνή, ΚΑΙ στο 2Δ ΚΑΙ στο 3Δ. Αν δεν κόψει στο ΙΔΙΟ ύψος με την επένδυση του πυρήνα,
 * μένει ορατή λωρίδα σοβά μέσα στο χώμα (ή γυμνό μπετόν πάνω από το έδαφος).
 *
 * Κρίσιμο: το `columnGradeById` είναι **ο ίδιος χάρτης** που κόβει τον πυρήνα — εδώ
 * κλειδώνεται ότι όντως τον διαβάζει, και ότι χωρίς αυτόν τίποτα δεν αλλάζει.
 */

import { computeStructuralFinishSilhouette, type SilhouetteColumnSource } from '../structural-finish-scene-silhouette';
import type { StructuralFinishSpec } from '../structural-finish-types';

const SPEC: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
  exteriorThickness: 25,
};

/** Κολώνα 500×500 στο (0,0), ύψος 3000, βάση στο FFL. */
function column(id: string): SilhouetteColumnSource {
  return {
    id,
    params: { finish: SPEC, sceneUnits: 'mm', baseOffset: 0, height: 3000 },
    geometry: {
      footprint: {
        vertices: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 500 }, { x: 0, y: 500 }],
      },
    },
  };
}

/** Το κατακόρυφο εύρος που καλύπτουν οι ζώνες σοβά (mm). ⚠️ Το πεδίο είναι `zBottomMm`. */
function coveredZRange(bands: readonly { zBottomMm: number; zTopMm: number }[]): { bot: number; top: number } {
  return {
    bot: Math.min(...bands.map((b) => b.zBottomMm)),
    top: Math.max(...bands.map((b) => b.zTopMm)),
  };
}

describe('ADR-713 — clamp του σοβά στη στάθμη εδάφους', () => {
  const base = { beams: [], walls: [], floorElevationMm: 0 } as const;

  it('χωρίς χάρτη στάθμης → πλήρες ύψος από τη βάση (byte-for-byte)', () => {
    const bands = computeStructuralFinishSilhouette({ ...base, columns: [column('c1')] });
    expect(bands.length).toBeGreaterThan(0);
    expect(coveredZRange(bands)).toEqual({ bot: 0, top: 3000 });
  });

  it('η κολώνα με χαμηλότερο zBot (έδραση) ΔΕΝ σοβατίζεται κάτω από τη στάθμη', () => {
    // Ο πυρήνας κατεβαίνει στα −1000 (πέδιλο)· ο σοβάς πρέπει να ξεκινά στη στάθμη (−300).
    const bands = computeStructuralFinishSilhouette({
      ...base,
      columns: [column('c1')],
      columnExtents: new Map([['c1', { zBotMm: -1000, zTopMm: 3000 }]]),
      columnGradeById: new Map([['c1', -300]]),
    });
    expect(coveredZRange(bands).bot).toBe(-300);
  });

  it('χωρίς στάθμη, ο σοβάς θα κατέβαινε ως το πέδιλο (η συμπεριφορά που διορθώνεται)', () => {
    const bands = computeStructuralFinishSilhouette({
      ...base,
      columns: [column('c1')],
      columnExtents: new Map([['c1', { zBotMm: -1000, zTopMm: 3000 }]]),
    });
    expect(coveredZRange(bands).bot).toBe(-1000);
  });

  it('στάθμη ΨΗΛΟΤΕΡΑ από τη βάση (επικλινές) ανεβάζει το κάτω άκρο του σοβά', () => {
    const bands = computeStructuralFinishSilhouette({
      ...base,
      columns: [column('c1')],
      columnGradeById: new Map([['c1', 500]]),
    });
    expect(coveredZRange(bands).bot).toBe(500);
  });

  it('στάθμη ΚΑΤΩ από το στερεό δεν επεκτείνει σοβά μέσα στο πέδιλο (clamp)', () => {
    const bands = computeStructuralFinishSilhouette({
      ...base,
      columns: [column('c1')],
      columnGradeById: new Map([['c1', -9999]]),
    });
    expect(coveredZRange(bands).bot).toBe(0); // η βάση της κολώνας, όχι το −9999
  });

  it('στάθμη πάνω από την κορυφή → clamp στην κορυφή, καμία ανάποδη ζώνη', () => {
    const bands = computeStructuralFinishSilhouette({
      ...base,
      columns: [column('c1')],
      columnGradeById: new Map([['c1', 9999]]),
    });
    for (const b of bands) expect(b.zTopMm).toBeGreaterThanOrEqual(b.zBottomMm);
  });

  it('entry για ΑΛΛΗ κολώνα δεν επηρεάζει αυτήν', () => {
    const bands = computeStructuralFinishSilhouette({
      ...base,
      columns: [column('c1')],
      columnGradeById: new Map([['other', -300]]),
    });
    expect(coveredZRange(bands)).toEqual({ bot: 0, top: 3000 });
  });
});
