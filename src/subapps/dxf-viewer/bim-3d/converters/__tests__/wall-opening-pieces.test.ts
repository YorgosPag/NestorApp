/**
 * ADR-363/396 — `computeWallOpeningPieces`: η 3D παρειά ανοίγματος ΚΑΘΕΤΗ στον άξονα
 * (κοινό `outline` SSoT) ακόμη και σε mitered τοίχο.
 *
 * Root που κλειδώνει: η παλιά έκδοση έκανε `lerp(outerEdge, sF)` + `lerp(innerEdge, sF)`
 * με κοινό fraction → σε miters (outer/inner διαφορετικού μήκους) η παρειά έβγαινε
 * λοξή/τραπεζοειδής (ο τοίχος μαζευόταν στη μία όψη, επεκτεινόταν στην άλλη) → κενά/
 * υπερβάσεις με τη μόνωση Z4. Τώρα η παρειά = κάθετες γωνίες του outline.
 */

import { computeWallOpeningPieces } from '../wall-opening-pieces';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import { computeOpeningGeometry } from '../../../bim/geometry/opening-geometry';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { OpeningEntity, OpeningParams } from '../../../bim/types/opening-types';

function makeWall(o?: Partial<WallParams>): WallEntity {
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 }, end: { x: 5, y: 0, z: 0 }, // 'm' scene
    height: 3000, thickness: 250,
    flip: false, baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
    sceneUnits: 'm', ...o,
  };
  return { id: 'w', type: 'wall', kind: 'straight', layerId: '0', params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as WallEntity;
}

function makeOpening(wall: WallEntity, o?: Partial<OpeningParams>): OpeningEntity {
  const params: OpeningParams = {
    kind: 'window', wallId: 'w', offsetFromStart: 2000, width: 1000, height: 1400,
    sillHeight: 900, handing: 'left', openDirection: 'inward', ...o,
  };
  return { id: 'op', type: 'opening', kind: params.kind, layerId: '0', params,
    geometry: computeOpeningGeometry(params, wall, wall.params.sceneUnits ?? 'mm'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as OpeningEntity;
}

/** Mitered τοίχος (σε ΜΕΤΡΑ): asymmetric outer edge ως προς τον άξονα. */
function miteredWall(): WallEntity {
  return makeWall({
    startMiter: { outer: { x: -0.3, y: 0.35 }, inner: { x: 0.08, y: -0.1 } },
    endMiter: { outer: { x: 5.0, y: 0.1 }, inner: { x: 5.0, y: -0.1 } },
  } as Partial<WallParams>);
}

const axisDot = (wall: WallEntity, p: { x: number; y: number }, q: { x: number; y: number }) => {
  const ax = wall.params.end.x - wall.params.start.x, ay = wall.params.end.y - wall.params.start.y;
  const al = Math.hypot(ax, ay);
  const vx = q.x - p.x, vy = q.y - p.y, vl = Math.hypot(vx, vy) || 1;
  return (vx * (ax / al) + vy * (ay / al)) / vl; // cos μεταξύ jamb & axis (0 = κάθετο)
};

describe('computeWallOpeningPieces — κάθετη παρειά (outline SSoT)', () => {
  it('η παρειά στο άνοιγμα είναι ΚΑΘΕΤΗ στον άξονα σε mitered τοίχο', () => {
    const wall = miteredWall();
    const op = makeOpening(wall);
    const pieces = computeWallOpeningPieces(wall, [op])!;
    expect(pieces).not.toBeNull();

    // Leading jamb piece (cursor→opening start). quad = [a.outer, b.outer, b.inner, a.inner].
    // b = opening start jamb → quad[1] (outer) & quad[2] (inner) πρέπει να είναι κάθετα.
    const lead = pieces[0];
    const cos = axisDot(wall, lead.quad[1], lead.quad[2]);
    expect(Math.abs(cos)).toBeLessThan(1e-6); // κάθετο

    // Και ταυτίζονται με τις κάθετες γωνίες του outline (κοινό SSoT).
    const verts = op.geometry!.outline!.vertices;
    const startCorners = [verts[0], verts[3]];
    const matchOuter = startCorners.some(c => Math.hypot(c.x - lead.quad[1].x, c.y - lead.quad[1].y) < 1e-6);
    const matchInner = startCorners.some(c => Math.hypot(c.x - lead.quad[2].x, c.y - lead.quad[2].y) < 1e-6);
    expect(matchOuter && matchInner).toBe(true);
  });

  it('παρειά κάθετη ΚΑΙ σε ευθύ (μη-mitered) τοίχο (control)', () => {
    const wall = makeWall();
    const op = makeOpening(wall);
    const pieces = computeWallOpeningPieces(wall, [op])!;
    const lead = pieces[0];
    expect(Math.abs(axisDot(wall, lead.quad[1], lead.quad[2]))).toBeLessThan(1e-6);
  });

  it('fallback fraction-lerp όταν λείπει outline (legacy) — δεν σκάει', () => {
    const wall = makeWall();
    const op = makeOpening(wall);
    // Σβήσε το outline → fallback path.
    (op.geometry as { outline?: unknown }).outline = { vertices: [] };
    const pieces = computeWallOpeningPieces(wall, [op]);
    expect(pieces).not.toBeNull();
    // window (sill>0, top<height): jamb + ποδιά + πρέκι + trailing jamb = 4.
    expect(pieces!.length).toBe(4);
  });

  it('door (sill 0) → leading jamb + πρέκι + trailing jamb = 3 κομμάτια', () => {
    const wall = makeWall();
    const op = makeOpening(wall, { kind: 'door', sillHeight: 0, height: 2100 });
    const pieces = computeWallOpeningPieces(wall, [op])!;
    expect(pieces.length).toBe(3);
  });
});

describe('computeWallOpeningPieces — structural reveal (η μόνωση τρώει τον τοίχο)', () => {
  const REVEAL = { materialId: 'mat-eps-graphite', thickness_m: 0.05, zone: 'Z4' } as const;

  it('με reveal: η τρύπα τοίχου διευρύνεται κατά t σε κάθε άκρο (1.95 αντί 2.0)', () => {
    // 'm' scene: opening @2.0m width 1.0m· reveal 0.05m → structural start στο 1.95m.
    const wall = makeWall();
    const opNo = makeOpening(wall);
    const opRev = makeOpening(wall, { revealInsulation: { ...REVEAL } });
    const leadB = (op: OpeningEntity) => computeWallOpeningPieces(wall, [op])![0].quad[1].x; // outer@opening-start
    expect(leadB(opNo)).toBeCloseTo(2.0, 3);
    expect(leadB(opRev)).toBeCloseTo(1.95, 3);
  });

  it('με reveal: ποδιά παραθύρου χαμηλώνει σε sill−t (0.85m)', () => {
    const wall = makeWall();
    const opRev = makeOpening(wall, { revealInsulation: { ...REVEAL } }); // window sill 900
    const pieces = computeWallOpeningPieces(wall, [opRev])!;
    const sill = pieces.find((p) => p.zBotAM === 0 && p.zTopAM < 1);
    expect(sill).toBeDefined();
    expect(sill!.zTopAM).toBeCloseTo(0.85, 3); // 0.9 − 0.05 (επίπεδη ποδιά: zTopAM === zTopBM)
  });
});
