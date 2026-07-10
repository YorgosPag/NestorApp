/**
 * ADR-526 — «αντικατάσταση, όχι overlay»: όταν εισάγεται σκάλα, τα 2Δ generator primitives
 * (γραμμές ακμών βαθμίδων + αριθμοί) που πέφτουν ΜΕΣΑ στο footprint της αφαιρούνται, ώστε να
 * μένει μόνο το native BIM μοντέλο. Πρωτόγονα ΕΚΤΟΣ σκάλας (γνήσιες annotations) διατηρούνται.
 */

import { buildSceneFromTekScene } from '../tek-scene-builder';
import type {
  TekSceneParseResult, TekStairRecord, TekLineRecord, TekTextRecord, TekXMatrix,
} from '../tek-import-types';

/** Ελάχιστη ευθεία σκάλα 1.2m × 3m (x: 6.55→7.75, y: 11.2→6.8· κέντρο 7.15). */
const STAIR: TekStairRecord = {
  rawXml: '<record><type>21</type></record>',
  polylines: [
    [{ x: 6.55, y: 11.2 }, { x: 6.55, y: 6.8 }],
    [{ x: 7.75, y: 11.2 }, { x: 7.75, y: 6.8 }],
  ],
  startElevationM: 0,
  endElevationM: 3,
  steps: 16,
  landings: 0,
  stairWidthM: 1.2,
  treadGoingM: 0.275,
  riserHeightM: 3 / 17,
  waistThicknessM: 0.15,
  walklineLengthM: 4.4,
  minStepWidthM: 0.07,
  stepsNumbering: true,
};

/** Text matrix με θέση (x20/x21 σε μέτρα, Y-up) + μικρή κλίμακα γλύφου. */
function textMatrix(x: number, y: number): TekXMatrix {
  return { x00: 0.1, x01: 0, x10: 0, x11: 0.1, x20: x, x21: y };
}

/** Ελάχιστο parsed scene με μία σκάλα + γραμμές/κείμενα εντός & εκτός σκάλας. */
function parsedScene(): TekSceneParseResult {
  const lines: TekLineRecord[] = [
    { v0x: 6.7, v0y: 9.0, v1x: 7.6, v1y: 9.0, color: 'FF5A5A' }, // ΕΝΤΟΣ (ακμή βαθμίδας)
    { v0x: 50, v0y: 50, v1x: 51, v1y: 51, color: '000000' }, // ΕΚΤΟΣ (γνήσια γραμμή)
  ];
  const texts: TekTextRecord[] = [
    { content: '1', matrix: textMatrix(7.15, 9.0), color: 'FFFFFF', hAlign: 1, fontFamily: 'Arial' }, // ΕΝΤΟΣ
    { content: 'ΚΟΥΖΙΝΑ', matrix: textMatrix(100, 100), color: 'FFFFFF', hAlign: 0, fontFamily: 'Arial' }, // ΕΚΤΟΣ
  ];
  return {
    fileVersion: 516,
    tektonVersion: '9.1.0.46',
    floorCount: 1,
    stairs: [STAIR],
    lines,
    texts,
    arcs: [],
    dims: [],
    walls: [],
    pillars: [],
    hatches: [],
    objects: [],
    planes: [],
    warnings: [],
  };
}

describe('buildSceneFromTekScene — generator suppression (ADR-526)', () => {
  it('κρατά τη native BIM σκάλα', () => {
    const { scene } = buildSceneFromTekScene(parsedScene(), 'level-1', 'mm');
    expect(scene.entities.filter((e) => e.type === 'stair')).toHaveLength(1);
  });

  it('αφαιρεί γραμμές/κείμενα ΕΝΤΟΣ σκάλας, κρατά τα ΕΚΤΟΣ', () => {
    const { scene } = buildSceneFromTekScene(parsedScene(), 'level-1', 'mm');
    const lines = scene.entities.filter((e) => e.type === 'line');
    const texts = scene.entities.filter((e) => e.type === 'text');
    expect(lines).toHaveLength(1); // μόνο η εκτός σκάλας
    expect(texts).toHaveLength(1); // μόνο το "ΚΟΥΖΙΝΑ"
  });

  it('εκπέμπει warning για όσα αφαιρέθηκαν', () => {
    const { warnings } = buildSceneFromTekScene(parsedScene(), 'level-1', 'mm');
    expect(warnings.some((w) => w.includes('Αφαιρέθηκαν'))).toBe(true);
  });
});
