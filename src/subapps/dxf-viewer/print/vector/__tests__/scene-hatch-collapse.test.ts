/**
 * ADR-667 Φ3.1 — **collapsed tint** στο vector PDF, με **ΑΛΗΘΙΝΟ jsPDF**.
 *
 * ⚠️ **Γιατί αληθινό jsPDF και όχι mock:** ό,τι κλειδώνεται εδώ είναι **η πραγματική έξοδος**.
 * Ένα mock θα κατέγραφε ευτυχώς `setGState(...)` και θα περνούσε **πράσινο** ακόμη κι αν:
 *   • ο jsPDF **δεν έγραφε ποτέ** `/ca` στο αρχείο (καμία διαφάνεια ⇒ **πάλι μαύρη μάζα**), ή
 *   • η **επαναφορά** δεν έφτανε στο stream ⇒ **όλη η υπόλοιπη σελίδα στο 45%**, σιωπηλά.
 * Ακριβώς το μάθημα του ADR: **τα tests είναι το δίχτυ· η επαλήθευση είναι το PDF.**
 *
 * Το περιστατικό που φυλάει: γραμμοσκίαση «Διαγώνιες 45°» βγήκε **συμπαγής μαύρη μάζα** (0,089mm
 * απόσταση με 0,18mm μελάνι = ~200% κάλυψη), ενώ ο καμβάς την έδειχνε σωστά.
 */

import { jsPDF } from 'jspdf';
import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import { emitSceneToPdf } from '../scene-vector-emitter';
import { resolveSceneHatchLines } from '../scene-hatch-line-resolver';
import { HATCH_COLLAPSE_ALPHA } from '../../../rendering/entities/shared/hatch-density-lod';

const POLICY = { style: 'colour' as const, dpi: 150 };
/** Plot 1:1 ⇒ `lineSpacing` σε μονάδες σχεδίου == mm χαρτιού (μηδέν νοητή αριθμητική). */
const PAPER_SCALE = 1;
const toPaper = (p: Point2D): Point2D => ({ x: p.x + 10, y: p.y + 10 });

const EMPTY_IMAGES = {
  images: new Map(), patternCells: new Map(), solidFallbacks: new Map(), warnings: [],
};

function hatch(over: Partial<Entity> & { id: string }): Entity {
  return {
    type: 'hatch', layerId: '0', fillType: 'user-defined', lineAngle: 45, color: '#ff0000',
    boundaryPaths: [[
      { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 },
    ]],
    ...over,
  } as unknown as Entity;
}

/** Εκπέμπει τη σκηνή σε ΑΛΗΘΙΝΟ jsPDF και επιστρέφει το ωμό (ασυμπίεστο) αρχείο. */
function emitRaw(entities: Entity[]): string {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: false });
  emitSceneToPdf(pdf, {
    entities,
    toPaper,
    worldToPaperScale: PAPER_SCALE,
    colorPolicy: POLICY,
    images: EMPTY_IMAGES,
    hatchLines: resolveSceneHatchLines(entities, POLICY, PAPER_SCALE),
  });
  return Buffer.from(pdf.output('arraybuffer')).toString('latin1');
}

/** Τα `/ca <n>` ExtGState dicts που πράγματι γράφτηκαν στο αρχείο, με τη σειρά. */
function fillAlphas(raw: string): string[] {
  return [...raw.matchAll(/\/ca ([\d.]+)/g)].map((m) => m[1]);
}

/** Το βήμα (mm) κάτω από το οποίο ο density-LOD κόβει. Πραγματικό περιστατικό: 0,089mm. */
const BLACK_MASS_SPACING_MM = 0.089;

describe('Φ3.1 — υπερπυκνό μοτίβο → tint με ΠΡΑΓΜΑΤΙΚΗ διαφάνεια PDF', () => {
  it('🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ — γράφεται `/ca 0.45` στο αρχείο, όχι συμπαγές μελάνι', () => {
    const raw = emitRaw([hatch({ id: 'mass', lineSpacing: BLACK_MASS_SPACING_MM })]);
    // Αν ο jsPDF σταματήσει να γράφει `/ca`, η γραμμοσκίαση ξαναγίνεται ΣΥΜΠΑΓΗΣ ΜΑΖΑ.
    expect(fillAlphas(raw)).toContain(String(HATCH_COLLAPSE_ALPHA));
  });

  it('🔴 ΤΟ GSTATE ΕΠΑΝΑΦΕΡΕΤΑΙ — αλλιώς ΟΛΗ η υπόλοιπη σελίδα βγαίνει στο 45%', () => {
    const raw = emitRaw([hatch({ id: 'mass', lineSpacing: BLACK_MASS_SPACING_MM })]);
    const alphas = fillAlphas(raw);
    // Το `/ca` της επαναφοράς γράφεται από τον jsPDF ως `1.` (όχι `1`) — γι' αυτό parseFloat.
    expect(alphas.map(parseFloat)).toEqual([HATCH_COLLAPSE_ALPHA, 1]);
    // Και τα ΔΥΟ πρέπει να φτάσουν στο content stream ως operators, όχι μόνο ως resources.
    expect(raw.match(/\/GS\d+ gs/g)).toHaveLength(2);
  });

  it('το tint ΑΝΤΙΚΑΘΙΣΤΑ τις γραμμές — δεν τυπώνονται και τα δύο', () => {
    const dense = emitRaw([hatch({ id: 'mass', lineSpacing: BLACK_MASS_SPACING_MM })]);
    const sparse = emitRaw([hatch({ id: 'ok', lineSpacing: 5 })]);
    const lineOps = (raw: string) => (raw.match(/ l\r?\n/g) ?? []).length;
    // Το αραιό βγάζει πραγματικές γραμμές μοτίβου· το πυκνό μόνο το γέμισμα + το περίγραμμα.
    expect(lineOps(sparse)).toBeGreaterThan(lineOps(dense));
    expect(fillAlphas(sparse)).toEqual([]);
  });

  it('αραιό μοτίβο → ΚΑΜΙΑ διαφάνεια πουθενά (μηδέν παρενέργεια στο κοινό μονοπάτι)', () => {
    expect(fillAlphas(emitRaw([hatch({ id: 'ok', lineSpacing: 5 })]))).toEqual([]);
  });

  it('το tint σέβεται το plot-style policy (mono → μαύρο, όχι το κόκκινο της οθόνης)', () => {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: false });
    const entities = [hatch({ id: 'mass', lineSpacing: BLACK_MASS_SPACING_MM })];
    const mono = { style: 'monochrome' as const, dpi: 150 };
    emitSceneToPdf(pdf, {
      entities,
      toPaper,
      worldToPaperScale: PAPER_SCALE,
      colorPolicy: mono,
      images: EMPTY_IMAGES,
      hatchLines: resolveSceneHatchLines(entities, mono, PAPER_SCALE),
    });
    const raw = Buffer.from(pdf.output('arraybuffer')).toString('latin1');
    // ⚠️ Μετρημένο, ΟΧΙ υποτιθέμενο: ο jsPDF γράφει το μαύρο ως **grayscale shorthand** (`0. g`),
    // ενώ το κόκκινο ως `1. 0. 0. rg`. Ένα `expect('0 0 0 rg')` θα απέτυχε για λάθος λόγο.
    expect(raw).toContain('0. g');
    expect(raw).not.toContain('1. 0. 0. rg');
  });
});
