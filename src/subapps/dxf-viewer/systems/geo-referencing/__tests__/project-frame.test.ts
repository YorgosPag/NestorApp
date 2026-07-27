/**
 * ADR-650 §M10g — ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΟΥ DELTA: ό,τι ψήθηκε στο παλιό πλαίσιο κάθεται, μετά τη
 * μετακίνηση, ΑΚΡΙΒΩΣ εκεί που θα το έβαζε το νέο πλαίσιο.
 *
 * Αυτό δεν είναι έλεγχος «τα νούμερα βγαίνουν». Είναι ο έλεγχος του **αναλλοίωτου**: το
 * πραγματικό (ΕΓΣΑ) σημείο μιας ψημένης οντότητας δεν αλλάζει επειδή άλλαξε η γεωαναφορά.
 * Αν σπάσει, ο κάναβος του χρήστη θα «κουμπώνει» σε λάθος σημείο του οικοπέδου — σιωπηλά.
 */

import {
  UNREFERENCED_FRAME, frameDelta, geoReferenceOfStamp, isSameFrame, isValidFrameStamp,
  stampOfGeoReference, type ProjectFrameStamp,
} from '../project-frame';
import { makeWorldToDisplayProjector } from '../geo-transform';
import type { Point2D } from '../../../rendering/types/Types';

// Το οικόπεδο της υπόθεσης (ADR-650): origin αρχείου + μια κορυφή γύρω του, σε ΕΓΣΑ'87 mm.
const FRAME_A: ProjectFrameStamp = {
  originWorldXMm: 407_565_290, originWorldYMm: 4_502_055_670, rotationDeg: 0,
};
const FRAME_B: ProjectFrameStamp = {
  originWorldXMm: 407_600_000, originWorldYMm: 4_502_100_000, rotationDeg: 0,
};
const FRAME_B_ROTATED: ProjectFrameStamp = { ...FRAME_B, rotationDeg: 17.5 };

const WORLD_POINTS: readonly Point2D[] = [
  { x: 407_723_104, y: 4_502_396_120 },
  { x: 407_680_000, y: 4_502_300_000 },
  { x: 407_565_290, y: 4_502_055_670 }, // ακριβώς στο origin του A
];

/** Εφαρμογή του delta όπως ακριβώς το κάνει ο reconciler: στροφή γύρω από την αρχή, μετά μετατόπιση. */
function applyDelta(
  p: Point2D,
  delta: { rotationDeg: number; translationMm: Point2D },
): Point2D {
  const rad = delta.rotationDeg * Math.PI / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    x: p.x * c - p.y * s + delta.translationMm.x,
    y: p.x * s + p.y * c + delta.translationMm.y,
  };
}

describe('ADR-650 §M10g — frameDelta: το πραγματικό σημείο ΔΕΝ μετακινείται', () => {
  it.each([
    ['καθαρή μετατόπιση', FRAME_A, FRAME_B],
    ['μετατόπιση + στροφή', FRAME_A, FRAME_B_ROTATED],
    ['στροφή προς τα πίσω', FRAME_B_ROTATED, FRAME_A],
    ['από/προς μη-γεωαναφερμένο', UNREFERENCED_FRAME, FRAME_B_ROTATED],
  ])('%s: delta(από→προς) ≡ επαναπροβολή του ΙΔΙΟΥ world σημείου', (_name, from, to) => {
    const delta = frameDelta(from, to);
    expect(delta).not.toBeNull();

    const projectFrom = makeWorldToDisplayProjector(geoReferenceOfStamp(from));
    const projectTo = makeWorldToDisplayProjector(geoReferenceOfStamp(to));

    for (const world of WORLD_POINTS) {
      const bakedInFrom = projectFrom.project(world.x, world.y);
      const moved = applyDelta(bakedInFrom, delta!);
      const expected = projectTo.project(world.x, world.y);
      // Ανοχή χιλιοστού του mm σε συντεταγμένες τάξης 10⁸ — δηλαδή ~1e-12 σχετικό σφάλμα.
      expect(moved.x).toBeCloseTo(expected.x, 3);
      expect(moved.y).toBeCloseTo(expected.y, 3);
    }
  });

  it('ίδιο πλαίσιο ⇒ `null` (η βάση της idempotency: no delta, no write)', () => {
    expect(frameDelta(FRAME_A, FRAME_A)).toBeNull();
    expect(frameDelta(FRAME_B_ROTATED, { ...FRAME_B_ROTATED })).toBeNull();
  });

  it('δύο διαδοχικά delta ισοδυναμούν με το ένα απευθείας (συνθετικότητα)', () => {
    const viaB = frameDelta(FRAME_A, FRAME_B)!;
    const bToRotated = frameDelta(FRAME_B, FRAME_B_ROTATED)!;
    const direct = frameDelta(FRAME_A, FRAME_B_ROTATED)!;

    const start = makeWorldToDisplayProjector(geoReferenceOfStamp(FRAME_A))
      .project(WORLD_POINTS[0].x, WORLD_POINTS[0].y);
    const twoSteps = applyDelta(applyDelta(start, viaB), bToRotated);
    const oneStep = applyDelta(start, direct);

    expect(twoSteps.x).toBeCloseTo(oneStep.x, 3);
    expect(twoSteps.y).toBeCloseTo(oneStep.y, 3);
  });
});

describe('ADR-650 §M10g — isSameFrame: ανοχή που δεν κρύβει αλλαγή', () => {
  it('θόρυβος επανυπολογισμού (νανόμετρο) ⇒ ΙΔΙΟ πλαίσιο (καμία περιττή εγγραφή)', () => {
    expect(isSameFrame(FRAME_A, { ...FRAME_A, originWorldXMm: FRAME_A.originWorldXMm + 1e-9 }))
      .toBe(true);
  });

  it('ΑΡΝΗΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: μετατόπιση ενός χιλιοστού ⇒ ΑΛΛΟ πλαίσιο (η ανοχή δεν τα καταπίνει)', () => {
    expect(isSameFrame(FRAME_A, { ...FRAME_A, originWorldXMm: FRAME_A.originWorldXMm + 1 }))
      .toBe(false);
    expect(isSameFrame(FRAME_A, { ...FRAME_A, rotationDeg: 0.001 })).toBe(false);
  });
});

describe('ADR-650 §M10g — σφραγίδα: fail-closed είσοδος', () => {
  it('`null` γεωαναφορά ⇒ η σφραγίδα του μη-γεωαναφερμένου έργου', () => {
    expect(stampOfGeoReference(null)).toEqual(UNREFERENCED_FRAME);
  });

  it('round-trip GeoReference ↔ σφραγίδα', () => {
    const geo = { originWorld: { x: 1234.5, y: -9876.5 }, rotationDeg: 33.25 };
    expect(geoReferenceOfStamp(stampOfGeoReference(geo))).toEqual(geo);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['συμβολοσειρά', 'ΕΓΣΑ87'],
    ['λείπει άξονας', { originWorldXMm: 1, rotationDeg: 0 }],
    ['NaN', { originWorldXMm: NaN, originWorldYMm: 0, rotationDeg: 0 }],
    ['Infinity', { originWorldXMm: 0, originWorldYMm: Infinity, rotationDeg: 0 }],
  ])('%s ΔΕΝ είναι έγκυρη σφραγίδα (ποτέ «μάλλον το τρέχον»)', (_name, value) => {
    expect(isValidFrameStamp(value)).toBe(false);
  });

  it('έγκυρη σφραγίδα περνά', () => {
    expect(isValidFrameStamp(FRAME_A)).toBe(true);
    expect(isValidFrameStamp(UNREFERENCED_FRAME)).toBe(true);
  });
});
