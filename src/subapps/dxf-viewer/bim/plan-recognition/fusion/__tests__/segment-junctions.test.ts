/**
 * ⚓ ADR-929 §6.21.8 (Ε1) — οι κόμβοι των συνορθωμένων τμημάτων: η συνόρθωση κινεί ευθείες, και η γωνία μένει κλειστή.
 *
 * Ταυτοτική ευθυγράμμιση (`fusion-fixture.ts`): 1 px = 20 mm, πινελιά 2 px ⇒ ανοχή κόμβου 4 px (`collinearTolPx`).
 */

import { describe, expect, it } from '@jest/globals';
import type { RasterSegment } from '../../plan-recognition-types';
import { buildFusionFrame, familyNormal, type FusionFrame } from '../fusion-frame';
import { adjustedSegments } from '../fusion-results';
import { DEFAULT_PLAN_FUSION } from '../plan-fusion-types';
import { findSegmentJunctions, segmentCorners } from '../segment-junctions';
import { fusionInput, segment } from './fusion-fixture';

const ALIGNMENT = fusionInput({ segments: [], reading: { status: 'unavailable', reason: 'ai-disabled-for-company' } }).alignment;
const MIN_ANGLE = DEFAULT_PLAN_FUSION.junctionMinAngleDeg;

const frameOf = (segments: readonly RasterSegment[]): FusionFrame => buildFusionFrame(segments, ALIGNMENT, DEFAULT_PLAN_FUSION);
const lineOf = (frame: FusionFrame, id: string) => frame.lineById.get(frame.lineOfSegment.get(id) ?? '')!;

/** Μετακινεί την ευθεία του τμήματος `id` κατά `px` (κατά την κάθετο της οικογένειάς της). */
function offsetsMoving(frame: FusionFrame, moves: Readonly<Record<string, number>>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, px] of Object.entries(moves)) {
    const line = lineOf(frame, id);
    out.set(line.id, line.offsetPx + px);
  }
  return out;
}

function adjust(segments: readonly RasterSegment[], moves: Readonly<Record<string, number>> = {}, frameSegments = segments): RasterSegment[] {
  const frame = frameOf(frameSegments);
  const junctions = findSegmentJunctions(segments, frame, ALIGNMENT.originalToAligned, MIN_ANGLE);
  return adjustedSegments(segments, frame, offsetsMoving(frame, moves), ALIGNMENT, junctions);
}

const byId = (segments: readonly RasterSegment[], id: string): RasterSegment => segments.find((s) => s.id === id)!;
const junctionsOf = (segments: readonly RasterSegment[]) =>
  findSegmentJunctions(segments, frameOf(segments), ALIGNMENT.originalToAligned, MIN_ANGLE).map((j) => `${j.segmentId}.${j.end}→${j.neighbourId}`);

// Γωνία L: A οριζόντια (0,0)→(2000,0) · B κατακόρυφη (2000,0)→(2000,1000).
const lCorner = (): RasterSegment[] => [segment('A', 0, 0, 2000, 0), segment('B', 2000, 0, 2000, 1000)];

describe('segment-junctions — ποιο άκρο ακουμπά ποιο τμήμα (αρχική γεωμετρία)', () => {
  it('γωνία L: τα δύο άκρα της γωνίας δένονται αμοιβαία· τα ελεύθερα άκρα όχι', () => {
    expect(junctionsOf(lCorner())).toEqual(['A.end→B', 'B.start→A']);
  });

  it('διακλάδωση T: το άκρο στο εσωτερικό της παρειάς δένεται· η παρειά δεν αλλάζει', () => {
    const t = [segment('A', 0, 0, 2000, 0), segment('C', 1000, 0, 1000, 1000)];
    expect(junctionsOf(t)).toEqual(['C.start→A']);
  });

  it('συνευθειακά τμήματα με κενό (άνοιγμα) δεν δένονται ποτέ μεταξύ τους', () => {
    expect(junctionsOf([segment('A', 0, 0, 1000, 0), segment('D', 1040, 0, 2000, 0)])).toEqual([]);
  });

  it('κενό πέρα από την ανοχή (5 px > 4 px): κανένα από τα δύο άκρα δεν δένεται', () => {
    expect(junctionsOf([segment('A', 0, 0, 1900, 0), segment('B', 2000, 0, 2000, 1000)])).toEqual([]);
  });

  it('σχεδόν παράλληλα (10° < 20°) δεν δένονται: η τομή τους είναι κακώς ορισμένη', () => {
    const tilt = Math.tan((10 * Math.PI) / 180) * 2000;
    expect(junctionsOf([segment('A', 0, 0, 2000, 0), segment('E', 2000, 0, 4000, tilt)])).toEqual([]);
  });

  it('γραμμή που δεν είναι παρειά (εκτός πλαισίου) δεν γίνεται ποτέ γείτονας', () => {
    const all = [...lCorner(), segment('X', 2000, 0, 2000, -1000)];
    const out = adjust(all, {}, lCorner());
    expect(byId(out, 'X')).toEqual(byId(all, 'X'));
  });
});

describe('segment-junctions — ο κόμβος μετά τη συνόρθωση', () => {
  it('γωνία L: η B μετακινείται 5 px ⇒ τα δύο άκρα της γωνίας στο ΙΔΙΟ σημείο, πάνω στη νέα B', () => {
    const before = lCorner();
    const out = adjust(before, { B: 5 });
    const frame = frameOf(before);
    const n = familyNormal(frame.families[lineOf(frame, 'B').familyId]);
    const a = byId(out, 'A');
    const b = byId(out, 'B');
    expect(a.end.x).toBeCloseTo(b.start.x, 9);
    expect(a.end.y).toBeCloseTo(b.start.y, 9);
    expect(b.start.x).toBeCloseTo(byId(before, 'B').start.x + 5 * n.x, 9);
    // Το ελεύθερο άκρο της A δεν αγγίζεται.
    expect(a.start).toEqual(byId(before, 'A').start);
  });

  it('γωνία L: κινούνται ΚΑΙ οι δύο ευθείες ⇒ η γωνία μένει κλειστή', () => {
    const out = adjust(lCorner(), { A: -3, B: 4 });
    const a = byId(out, 'A');
    const b = byId(out, 'B');
    expect(Math.hypot(a.end.x - b.start.x, a.end.y - b.start.y)).toBeLessThan(1e-9);
  });

  it('διακλάδωση T: η A μετακινείται ⇒ το άκρο της C την ακολουθεί', () => {
    const t = [segment('A', 0, 0, 2000, 0), segment('C', 1000, 0, 1000, 1000)];
    const out = adjust(t, { A: 3 });
    expect(byId(out, 'C').start.y).toBeCloseTo(byId(out, 'A').start.y, 9);
    expect(byId(out, 'C').end).toEqual(byId(t, 'C').end);
  });

  it('επιλογή α: κόμβος ανοιχτός 2 px στο σχέδιο κλείνει και χωρίς συνόρθωση (δ = 0)', () => {
    const open = [segment('A', 0, 0, 1960, 0), segment('B', 2000, 0, 2000, 1000)];
    const out = adjust(open);
    expect(byId(out, 'A').end.x).toBeCloseTo(byId(open, 'B').start.x, 9);
    expect(byId(out, 'B')).toEqual(byId(open, 'B'));
  });

  it('ιδεμποτία: ξανά πάνω στο αποτέλεσμα (δ = 0) ⇒ ίδια άκρα', () => {
    const once = adjust(lCorner(), { B: 5 });
    const twice = adjust(once);
    for (const s of once) {
      const t = byId(twice, s.id);
      expect(t.start.x).toBeCloseTo(s.start.x, 9);
      expect(t.start.y).toBeCloseTo(s.start.y, 9);
      expect(t.end.x).toBeCloseTo(s.end.x, 9);
      expect(t.end.y).toBeCloseTo(s.end.y, 9);
    }
  });
});

describe('segment-junctions — §6.21.9 (Ε2): οι ΓΩΝΙΕΣ της τοπολογίας, για την επικάλυψη', () => {
  const cornersOf = (segments: readonly RasterSegment[]) =>
    segmentCorners(findSegmentJunctions(segments, frameOf(segments), ALIGNMENT.originalToAligned, MIN_ANGLE))
      .map((c) => `${c.a.segmentId}.${c.a.end}+${c.b.segmentId}.${c.b.end}`);

  it('γωνία L: ΜΙΑ γωνία, από τα δύο αμοιβαία άκρα', () => {
    expect(cornersOf(lCorner())).toEqual(['A.end+B.start']);
  });

  it('διακλάδωση T: ΚΑΜΙΑ γωνία — δένεται μόνο το ένα άκρο, και μένει απόληξη', () => {
    expect(cornersOf([segment('A', 0, 0, 2000, 0), segment('C', 1000, 0, 1000, 1000)])).toEqual([]);
  });

  it('ορθογώνιο: τέσσερις γωνίες, μία ανά κορυφή', () => {
    const rect = [
      segment('A', 0, 0, 2000, 0), segment('B', 2000, 0, 2000, 1000),
      segment('C', 2000, 1000, 0, 1000), segment('D', 0, 1000, 0, 0),
    ];
    expect(cornersOf(rect)).toHaveLength(4);
  });

  it('τα δύο άκρα κάθε γωνίας είναι ΤΟ ΙΔΙΟ σημείο μετά τη συνόρθωση (η επικάλυψη ενώνει ό,τι είναι ήδη κλειστό)', () => {
    const out = adjust(lCorner(), { A: 1.5, B: -2 });
    const frame = frameOf(lCorner());
    for (const c of segmentCorners(findSegmentJunctions(lCorner(), frame, ALIGNMENT.originalToAligned, MIN_ANGLE))) {
      expect(byId(out, c.a.segmentId)[c.a.end]).toEqual(byId(out, c.b.segmentId)[c.b.end]);
    }
  });
});
