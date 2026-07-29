/**
 * ADR-507 — **contour pen στο ΧΑΡΤΙ**, με ΑΛΗΘΙΝΟ jsPDF (ίδιο ιδίωμα με το `scene-hatch-collapse`).
 *
 * 🔴 **Το περιστατικό που φυλάει (2026-07-29):** το contour pen μπήκε στην οθόνη και **σταμάτησε
 * εκεί**. Το vector PDF είχε δικό του `emitBoundaryOutline` που καλούνταν **άνευ όρων** ως
 * «ΔΑΠΕΔΟ» (ADR-667 Απόφαση 8) — με αιτιολογία «κάτοπτρο της οθόνης, που ζωγραφίζει το
 * περίγραμμα σε **κάθε** κλάδο». Μόλις η οθόνη έπαψε να το κάνει αυτό, η αιτιολογία έγινε ψευδής
 * και **κανένα test δεν το έπιασε**: η διπλή γραμμή έφυγε από την οθόνη και **έμεινε στο PDF**.
 *
 * Γι' αυτό η συνθήκη ζει πλέον σε **ΕΝΑ** σημείο (`isHatchContourVisible`, `bim/hatch/
 * hatch-properties`) και τη ρωτούν **και οι δύο** pipelines. Τα tests εδώ ελέγχουν το **αρχείο**,
 * όχι την πρόθεση: αν κάποιος ξαναβάλει άνευ όρων outline, το `l` operator θα τον προδώσει.
 */

import { jsPDF } from 'jspdf';
import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import { emitSceneToPdf } from '../scene-vector-emitter';
import { resolveSceneHatchLines } from '../scene-hatch-line-resolver';
import type { PrintColorPolicy } from '../../../config/print-color-policy';

const POLICY: PrintColorPolicy = { style: 'colour', dpi: 150 };
const MONO: PrintColorPolicy = { style: 'monochrome', dpi: 150 };
const PAPER_SCALE = 1;
const toPaper = (p: Point2D): Point2D => ({ x: p.x + 10, y: p.y + 10 });

const EMPTY_IMAGES = {
  images: new Map(), patternCells: new Map(), solidFallbacks: new Map(), warnings: [],
};

/**
 * Γραμμοσκίαση **χωρίς καμία γραμμή μοτίβου** (άγνωστο όνομα ⇒ catalog MISS ⇒ μηδέν segments).
 * Έτσι ό,τι `l` operator φτάσει στο αρχείο προέρχεται **αποκλειστικά** από το περίγραμμα —
 * μηδέν θόρυβος από τις γραμμές του μοτίβου.
 */
function bareHatch(over: Partial<Entity> & { id: string }): Entity {
  return {
    type: 'hatch', layerId: '0', fillType: 'predefined', patternName: 'ΑΝΥΠΑΡΚΤΟ_ΜΟΤΙΒΟ',
    color: '#ff0000',
    boundaryPaths: [[
      { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 },
    ]],
    ...over,
  } as unknown as Entity;
}

/** Γραμμοσκίαση **με** πραγματικές γραμμές μοτίβου (user-defined, αραιή ⇒ κανένα collapse). */
function linedHatch(over: Partial<Entity> & { id: string }): Entity {
  return bareHatch({ fillType: 'user-defined', lineAngle: 45, lineSpacing: 5, ...over });
}

function emitRaw(entities: Entity[], policy: PrintColorPolicy = POLICY): string {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: false });
  emitSceneToPdf(pdf, {
    entities,
    toPaper,
    worldToPaperScale: PAPER_SCALE,
    colorPolicy: policy,
    images: EMPTY_IMAGES,
    hatchLines: resolveSceneHatchLines(entities, policy, PAPER_SCALE),
  });
  return Buffer.from(pdf.output('arraybuffer')).toString('latin1');
}

/** Πλήθος `l` (lineTo) operators που πράγματι γράφτηκαν στο content stream. */
const lineOps = (raw: string): number => (raw.match(/ l\r?\n/g) ?? []).length;

describe('ADR-507 — contour pen: το χαρτί είναι ΚΑΤΟΠΤΡΟ της οθόνης', () => {
  it('🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ — `visible:false` ⇒ ΚΑΝΕΝΑ περίγραμμα στο PDF', () => {
    const raw = emitRaw([bareHatch({ id: 'imported', contourPen: { visible: false } })]);
    // Πριν τη διόρθωση εδώ τυπώνονταν οι 4 ακμές του ορίου, πάνω από την πολυγραμμή του DXF.
    expect(lineOps(raw)).toBe(0);
  });

  it('πεδίο ΑΠΟΝ ⇒ περίγραμμα (backward-compat για ήδη αποθηκευμένα έγγραφα)', () => {
    expect(lineOps(emitRaw([bareHatch({ id: 'legacy' })]))).toBeGreaterThan(0);
  });

  it('`visible:true` (user-created) ⇒ περίγραμμα', () => {
    const raw = emitRaw([bareHatch({ id: 'mine', contourPen: { visible: true } })]);
    expect(lineOps(raw)).toBeGreaterThan(0);
  });

  it('σβήνει ΜΟΝΟ το περίγραμμα — οι γραμμές του μοτίβου μένουν άθικτες', () => {
    const off = emitRaw([linedHatch({ id: 'a', contourPen: { visible: false } })]);
    const on = emitRaw([linedHatch({ id: 'a' })]);
    // Η γραμμοσκίαση ΔΕΝ εξαφανίζεται: εξακολουθεί να τυπώνει τις γραμμές της…
    expect(lineOps(off)).toBeGreaterThan(0);
    // …απλώς χωρίς τις ακμές του ορίου από πάνω.
    expect(lineOps(off)).toBeLessThan(lineOps(on));
  });

  it('ρητό `contourPen.color` φτάνει στο αρχείο ως χρώμα ΓΡΑΜΜΗΣ (RG), όχι γεμίσματος', () => {
    const raw = emitRaw([bareHatch({
      id: 'blue', color: '#ff0000', contourPen: { visible: true, color: '#0000ff' },
    })]);
    // Η πένα νικά το χρώμα της γραμμοσκίασης — όπως ακριβώς κάνει η οθόνη (`contour?.color ?? color`).
    expect(raw).toContain('0. 0. 1. RG');
  });

  it('η πένα σέβεται το plot-style policy (mono ⇒ μαύρο μελάνι, όχι το μπλε της οθόνης)', () => {
    const raw = emitRaw([bareHatch({
      id: 'blue', contourPen: { visible: true, color: '#0000ff' },
    })], MONO);
    // ⚠️ Μετρημένο: ο jsPDF γράφει το μαύρο ως grayscale shorthand (`0. G`), όχι `0. 0. 0. RG`.
    expect(raw).toContain('0. G');
    expect(raw).not.toContain('0. 0. 1. RG');
  });

  it('ρητό `lineweightMm` γίνεται πάχος γραμμής στο PDF (AutoCAD LWT)', () => {
    const raw = emitRaw([bareHatch({
      id: 'thick', contourPen: { visible: true, lineweightMm: 0.7 },
    })]);
    // ⚠️ Μετρημένο, ΟΧΙ υποτιθέμενο: ο jsPDF σειριοποιεί το πάχος σε **points** (native μονάδα
    // του PDF), όχι στα mm του API — `0,7mm → 1,984… w`. Ένα `toContain('0.70 w')` θα αποτύγχανε
    // για λάθος λόγο. Σύγκριση αριθμητικά, ώστε να μη σπάει σε αλλαγή float formatting.
    const MM_TO_PT = 72 / 25.4;
    const widthsPt = [...raw.matchAll(/([\d.]+) w\b/g)].map((m) => parseFloat(m[1]));
    expect(widthsPt.some((w) => Math.abs(w - 0.7 * MM_TO_PT) < 1e-6)).toBe(true);
  });
});
