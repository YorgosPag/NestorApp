/**
 * **Αλήθεια από αρχείο Τέκτονα (.tek)** (ADR-929 §6.9). Επαναχρησιμοποιεί τον υπάρχοντα αναγνώστη του ADR-526/531
 * (`parseTekScene`) και τον αποκωδικοποιητή πίνακα τοίχου (`decodeWallXMatrix`) — κανένας δεύτερος αναγνώστης XML.
 *
 * - **Τοίχος** (`<wall>`, πίνακας: αρχή `(x20,x21)`, άξονας `u=(x00,x01)`, πάχος `v=(x10,x11)`): δύο **παρειές**,
 *   `αρχή→αρχή+u` και `αρχή+v→αρχή+v+u`, **κομμένες στα ανοίγματα** (εκεί η εικόνα δεν έχει γραμμή τοίχου).
 * - **Διάσταση** (`<dim>`): κάθε πατιά `end0→end1` = γραμμή διάστασης · σημεία `<inter>` = βάσεις επεκτάσεων,
 *   δηλαδή τα σημεία που μετρά (ίδιος κανόνας με το `tek-dim-to-dimension.ts`: χωρίς δύο βάσεις ⇒ τα άκρα της γραμμής).
 * - **Κείμενο** (`<text>`) ⇒ σημείωση · **γραμμή** (`<line>`) ⇒ `other` (ο Τέκτων δεν λέει τι είναι).
 * Μονάδες: μέτρα του Τέκτονα, Y προς τα πάνω, χωρίς μετατροπή (τα κανονικοποιεί η καταγραφή).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/testing/cad-truth/tek-truth
 */

import { subtractIntervals, type Interval } from '@/lib/geometry/interval-set';
import type { AffinePoint } from '@/lib/geometry/affine-2x3';
import { parseTekScene } from '../../../../io/tek/tek-scene-extract';
import { decodeOpeningXMatrix } from '../../../../export/core/tek/tek-geometry';
import type { TekDimRecord, TekSceneParseResult, TekWallRecord } from '../../../../io/tek/tek-import-types';
import type { CadTruth, CadTruthDimension, CadTruthSegment } from './cad-truth-types';

const at = (o: AffinePoint, d: AffinePoint, s: number): AffinePoint => ({ x: o.x + d.x * s, y: o.y + d.y * s });

/** Τα διαστήματα του άξονα (μέτρα από την αρχή) που κόβουν τα ανοίγματα του τοίχου. */
function openingIntervals(wall: TekWallRecord, origin: AffinePoint, dir: AffinePoint): Interval[] {
  return wall.openings.map((o) => {
    const { center, widthM } = decodeOpeningXMatrix(o.matrix);
    const s = (center.x - origin.x) * dir.x + (center.y - origin.y) * dir.y;
    return { lo: s - widthM / 2, hi: s + widthM / 2 };
  }).sort((p, q) => p.lo - q.lo);
}

/** Οι δύο παρειές ενός τοίχου, κομμένες στα ανοίγματα. */
export function tekWallFaces(wall: TekWallRecord): CadTruthSegment[] {
  const m = wall.matrix;
  const length = Math.hypot(m.x00, m.x01);
  if (length <= 0) return [];
  const origin = { x: m.x20, y: m.x21 };
  const dir = { x: m.x00 / length, y: m.x01 / length };
  const solid = subtractIntervals([{ lo: 0, hi: length }], openingIntervals(wall, origin, dir));
  const faces: CadTruthSegment[] = [];
  for (const base of [origin, { x: m.x20 + m.x10, y: m.x21 + m.x11 }]) {
    for (const piece of solid) {
      if (piece.hi - piece.lo > 0) faces.push({ a: at(base, dir, piece.lo), b: at(base, dir, piece.hi), role: 'wall-face' });
    }
  }
  return faces;
}

function tekDimensions(rec: TekDimRecord): { dims: CadTruthDimension[]; segs: CadTruthSegment[] } {
  const dims: CadTruthDimension[] = [];
  const segs: CadTruthSegment[] = [];
  for (const seg of rec.segs) {
    const measured: [AffinePoint, AffinePoint] = rec.refPoints.length >= 2 ? [rec.refPoints[0], rec.refPoints[1]] : [seg.end0, seg.end1];
    dims.push({ text: seg.text, measured, line: [seg.end0, seg.end1] });
    segs.push({ a: seg.end0, b: seg.end1, role: 'dimension-line' });
  }
  return { dims, segs };
}

/** Αλήθεια από ήδη αναλυμένο αρχείο Τέκτονα. */
export function tekTruthFromParsed(parsed: TekSceneParseResult): CadTruth {
  const segments: CadTruthSegment[] = parsed.walls.flatMap(tekWallFaces);
  const dimensions: CadTruthDimension[] = [];
  for (const rec of parsed.dims) {
    const { dims, segs } = tekDimensions(rec);
    dimensions.push(...dims);
    segments.push(...segs);
  }
  for (const l of parsed.lines) segments.push({ a: { x: l.v0x, y: l.v0y }, b: { x: l.v1x, y: l.v1y }, role: 'other' });
  const texts = parsed.texts.map((t) => ({ text: t.content, at: { x: t.matrix.x20, y: t.matrix.x21 } }));
  const skipped = { arcs: parsed.arcs.length, hatches: parsed.hatches.length, objects: parsed.objects.length, pillars: parsed.pillars.length, stairs: parsed.stairs.length };
  return { segments, dimensions, texts, skipped };
}

/** Αλήθεια από το περιεχόμενο ενός `.tek` (UTF-8 XML). Ρίχνει `TekParseError` σε μη έγκυρο αρχείο. */
export function tekTruth(content: string): CadTruth {
  return tekTruthFromParsed(parseTekScene(content));
}
