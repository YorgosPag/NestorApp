/**
 * ADR-529 — Beam Location-Line justification regression. ΤΟ BUG: auto-span north-flush δοκάρι ξαναπέφτει
 * νότια μετά τον auto-sizer (επειδή το flush ήταν θεσιακά κωδικοποιημένο στον άξονα, ΟΧΙ associative με
 * το πλάτος). Αυτό το test κλειδώνει: με `justification` + location line, η flush παρειά ΜΕΝΕΙ όταν αλλάζει
 * το `width`. + center = byte-for-byte back-compat.
 *
 * Πραγματικά νούμερα από τη σκηνή (Firestore baseline 2026-06-25): κολόνες βόρεια παρειά y=11250.
 */

import { computeBeamGeometry } from '../beam-geometry';
import type { BeamParams } from '../../types/beam-types';

const NORTH_FACE = 11250;

/** Οριζόντιο δοκάρι· location line = βόρεια παρειά κολόνων (y=11250)· σώμα προς νότο ('right'). */
function northFlushBeam(width: number): BeamParams {
  return {
    kind: 'straight',
    startPoint: { x: 1917.9, y: NORTH_FACE, z: 0 },
    endPoint: { x: 6951.4, y: NORTH_FACE, z: 0 },
    width,
    depth: 400,
    topElevation: 3000,
    sceneUnits: 'mm',
    justification: 'right', // north-flush: location line = βόρεια παρειά, σώμα νότια
  };
}

function northEdge(params: BeamParams): number {
  const ys = computeBeamGeometry(params).outline.vertices.map((v) => v.y);
  return Math.max(...ys);
}
function southEdge(params: BeamParams): number {
  const ys = computeBeamGeometry(params).outline.vertices.map((v) => v.y);
  return Math.min(...ys);
}

describe('beam-geometry justification — associative north-flush (ADR-529)', () => {
  it('north-flush: βόρεια ακμή = location line (11250) στο width commit (250)', () => {
    expect(northEdge(northFlushBeam(250))).toBeCloseTo(NORTH_FACE, 6);
    // σώμα νότια: width 250 → νότια ακμή 11000
    expect(southEdge(northFlushBeam(250))).toBeCloseTo(11000, 6);
  });

  it('🔴 ΤΟ BUG: μετά τον auto-sizer (width 250→200) η βόρεια ακμή ΜΕΝΕΙ 11250 (όχι 11225)', () => {
    const after = northFlushBeam(200); // ο οργανισμός στένεψε το πλάτος
    expect(northEdge(after)).toBeCloseTo(NORTH_FACE, 6); // associative — flush παρειά σταθερή
    expect(southEdge(after)).toBeCloseTo(11050, 6);      // μόνο η νότια (ελεύθερη) ακμή ανέβηκε
  });

  it('width sweep: η βόρεια ακμή μένει 11250 για ΚΑΘΕ πλάτος (πλήρης associativity)', () => {
    for (const w of [150, 200, 250, 300, 500]) {
      expect(northEdge(northFlushBeam(w))).toBeCloseTo(NORTH_FACE, 6);
    }
  });

  it('center (default/absent justification) → centerline ±width/2 (byte-for-byte back-compat)', () => {
    const centered: BeamParams = { ...northFlushBeam(250), justification: undefined, startPoint: { x: 1917.9, y: 11125, z: 0 }, endPoint: { x: 6951.4, y: 11125, z: 0 } };
    expect(northEdge(centered)).toBeCloseTo(11250, 6);
    expect(southEdge(centered)).toBeCloseTo(11000, 6); // συμμετρικό γύρω από 11125
  });

  it('length/area αμετάβλητα από το justification (perpendicular shift δεν αλλάζει μήκος)', () => {
    const c = computeBeamGeometry({ ...northFlushBeam(250), justification: 'center' });
    const r = computeBeamGeometry(northFlushBeam(250));
    expect(r.length).toBeCloseTo(c.length, 9);
    expect(r.area).toBeCloseTo(c.area, 9);
  });
});
