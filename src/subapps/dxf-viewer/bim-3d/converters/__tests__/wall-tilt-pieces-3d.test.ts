/**
 * ADR-404 — Tilt στον **pieces/prism path** του 3D converter (Δρόμος Β).
 *
 * Bug (Giorgio 2026-06-01): η κλίση (tilt) τοίχου/κολώνας φαινόταν στην 2Δ κάτοψη
 * αλλά ΟΧΙ στο 3Δ όταν το στοιχείο ήταν attached ή είχε ανοίγματα — γιατί το
 * `wallToMesh`/`columnToMesh` πήγαινε στον pieces/prism path που ΔΕΝ καλούσε
 * `applyWallTilt`/`applyColumnTilt`. Fix: `emit()` (wall pieces) + prism path
 * (column) εφαρμόζουν shear αγκυρωμένο στο floor-local ύψος (`baseHeightM`).
 *
 * Στόχος **3D === 2D**: ο shear στο 3Δ χρησιμοποιεί το ίδιο SSoT (`wallTiltShearAt`/
 * `columnTiltShearAt`) με το 2Δ cut-plane (`cut-plane-tilt.ts`). Coord convention
 * (BimToThreeConverter): plan (x,y) → world (x, Y, -y).
 *
 * Στρατηγική: συγκρίνουμε **flat vs tilted** mesh per-vertex (ίδια σειρά κορυφών —
 * το shear εφαρμόζεται τελευταίο, in-place, χωρίς reorder) ώστε να μην εξαρτόμαστε
 * από τις απόλυτες θέσεις των παρειών.
 *
 * @see ../mesh-slope-shear.ts (applyWallTilt/applyColumnTilt + baseHeightM)
 * @see ../BimToThreeConverter.ts (buildStraightWallWithOpenings.emit / columnToMesh prism)
 * @see ../../../bim/geometry/cut-plane-tilt.ts (2Δ — ίδιο SSoT)
 */

import * as THREE from 'three';
import { wallToMesh, columnToMesh } from '../BimToThreeConverter';
import { wallTiltShearAt } from '../../../bim/geometry/wall-tilt';
import { columnTiltShearAt } from '../../../bim/geometry/column-tilt';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import { computeOpeningGeometry } from '../../../bim/geometry/opening-geometry';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { OpeningEntity, OpeningParams } from '../../../bim/types/opening-types';
import type { ColumnEntity } from '../../../bim/types/column-types';
import type { ColumnTopProfile } from '../../../bim/geometry/column-vertical-profile';

const TOL = 5;
const DEG = Math.PI / 180;

interface V { x: number; y: number; z: number }

/**
 * Κορυφές των **primary solids** σε world coords. Φιλτράρουμε `userData.bimType`
 * ώστε να αγνοήσουμε τα edge-overlay child meshes (fat-line meshes με δικό frame).
 */
function solidVerts(obj: THREE.Object3D): V[] {
  const out: V[] = [];
  obj.updateMatrixWorld(true);
  obj.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || !mesh.userData['bimType']) return;
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      out.push({ x: v.x, y: v.y, z: v.z });
    }
  });
  return out;
}

// ── Wall fixtures ─────────────────────────────────────────────────────────────

/** Straight τοίχος κατά +x (start 0,0 → end 5,0), thickness 250mm, sceneUnits m. */
function makeWall(tiltAngle?: number): WallEntity {
  const params = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 }, end: { x: 5, y: 0, z: 0 },
    height: 3000, thickness: 250,
    flip: false, baseBinding: 'storey-floor', topBinding: 'storey-ceiling',
    baseOffset: 0, topOffset: 0, sceneUnits: 'm',
    ...(tiltAngle !== undefined ? { tilt: { angle: tiltAngle } } : {}),
  } as unknown as WallParams;
  return {
    id: 'w', type: 'wall', kind: 'straight', layerId: '0', params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as WallEntity;
}

function makeDoor(wall: WallEntity): OpeningEntity {
  const params = {
    kind: 'door', wallId: 'w', offsetFromStart: 2000, width: 1000, height: 2100,
    sillHeight: 0, handing: 'left', openDirection: 'inward',
  } as unknown as OpeningParams;
  return {
    id: 'op', type: 'opening', kind: 'door', layerId: '0', params,
    geometry: computeOpeningGeometry(params, wall, 'm'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as OpeningEntity;
}

describe('ADR-404 — wall tilt στον pieces path (με ανοίγματα → Δρόμος Β)', () => {
  it('μπαίνει στον pieces path (group) όχι στον solid', () => {
    const wall = makeWall();
    const mesh = wallToMesh(wall, [makeDoor(wall)], 0, 'L1')!;
    expect((mesh as THREE.Group).isGroup).toBe(true);
  });

  it('tilt 20° → κάθε vertex: tilted.z == flat.z − worldY·tanθ (βάση@Y=0 αμετάβλητη, κορυφή sheared)', () => {
    const angle = 20;
    const tan = Math.tan(angle * DEG);
    const flat = solidVerts(wallToMesh(makeWall(), [makeDoor(makeWall())], 0, 'L1')!);
    const wt = makeWall(angle);
    const tilted = solidVerts(wallToMesh(wt, [makeDoor(wt)], 0, 'L1')!);
    expect(tilted.length).toBe(flat.length);
    expect(tilted.length).toBeGreaterThan(0);
    let sawTop = false;
    for (let i = 0; i < tilted.length; i++) {
      expect(tilted[i].x).toBeCloseTo(flat[i].x, TOL); // x-aligned wall → perp dx=0
      expect(tilted[i].y).toBeCloseTo(flat[i].y, TOL); // το ύψος δεν αλλάζει (ADR-369)
      expect(tilted[i].z).toBeCloseTo(flat[i].z - tilted[i].y * tan, TOL);
      if (tilted[i].y > 2.5) {
        sawTop = true;
        expect(Math.abs(tilted[i].z - flat[i].z)).toBeGreaterThan(0.5); // κορυφή ΟΝΤΩΣ μετακινήθηκε
      }
      if (tilted[i].y < 1e-6) {
        expect(tilted[i].z).toBeCloseTo(flat[i].z, TOL); // βάση αγκυρωμένη
      }
    }
    expect(sawTop).toBe(true);
  });

  it('flat (no tilt) → ταυτόσημο με flat (κανένα shear· regression guard)', () => {
    const a = solidVerts(wallToMesh(makeWall(), [makeDoor(makeWall())], 0, 'L1')!);
    const b = solidVerts(wallToMesh(makeWall(0), [makeDoor(makeWall(0))], 0, 'L1')!);
    expect(b.length).toBe(a.length);
    for (let i = 0; i < a.length; i++) {
      expect(b[i].x).toBeCloseTo(a[i].x, TOL);
      expect(b[i].y).toBeCloseTo(a[i].y, TOL);
      expect(b[i].z).toBeCloseTo(a[i].z, TOL); // angle 0 → fast-path no-op
    }
  });

  it('3D === 2D: η μετατόπιση κορυφής == wallTiltShearAt(params, h) (ίδιο SSoT με cut-plane)', () => {
    const angle = 15;
    const h = 3.0;
    const expected = wallTiltShearAt(makeWall(angle).params, h);
    expect(expected.dx).toBeCloseTo(0, TOL);
    expect(expected.dy).toBeCloseTo(h * Math.tan(angle * DEG), TOL);
    const wt = makeWall(angle);
    const tilted = solidVerts(wallToMesh(wt, [makeDoor(wt)], 0, 'L1')!);
    const flat = solidVerts(wallToMesh(makeWall(), [makeDoor(makeWall())], 0, 'L1')!);
    // Vertex με worldY≈3: η μετατόπιση στο Z == -expected.dy.
    const topIdx = tilted.findIndex((v) => Math.abs(v.y - h) < 1e-3);
    expect(topIdx).toBeGreaterThanOrEqual(0);
    expect(flat[topIdx].z - tilted[topIdx].z).toBeCloseTo(expected.dy, 3);
  });
});

// ── Column prism path ─────────────────────────────────────────────────────────

/** Τετράγωνη κολώνα 1×1 (CCW, scene units m), top attach @3000mm. */
function makeColumn(tilt?: { direction: number; angle: number }): ColumnEntity {
  return {
    id: 'c', type: 'column', layerId: '0',
    params: {
      kind: 'rectangular', position: { x: 0.5, y: 0.5, z: 0 }, anchor: 'center',
      width: 1000, depth: 1000, height: 3000, rotation: 0, baseOffset: 0,
      material: 'elem-column', sceneUnits: 'm',
      ...(tilt ? { tilt } : {}),
    },
    geometry: { footprint: { vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as ColumnEntity;
}

/** Top profile attach (flat top @3000mm, hasAttach → prism path). */
const TOP_ATTACH: ColumnTopProfile = {
  baseZmm: 0, cornerTopZmm: [3000, 3000, 3000, 3000],
  maxTopZmm: 3000, minTopZmm: 3000, hasAttach: true, missingHostIds: [],
};

describe('ADR-404 — column tilt στον attached prism path', () => {
  it('flat attached prism → base ring @Y=0, top ring @Y=3 (regression guard)', () => {
    const verts = solidVerts(columnToMesh(makeColumn(), 0, 'L1', 0, TOP_ATTACH)!);
    const ys = [...new Set(verts.map((v) => +v.y.toFixed(4)))].sort((a, b) => a - b);
    expect(ys).toEqual([0, 3]);
    for (const v of verts) expect(Math.min(Math.abs(v.x), Math.abs(v.x - 1))).toBeLessThan(1e-6);
  });

  it('tilt 25° dir 0° → tilted.x == flat.x + worldY·tanθ (base αμετάβλητη, top shifted)', () => {
    const angle = 25;
    const tan = Math.tan(angle * DEG);
    const flat = solidVerts(columnToMesh(makeColumn(), 0, 'L1', 0, TOP_ATTACH)!);
    const tilted = solidVerts(columnToMesh(makeColumn({ direction: 0, angle }), 0, 'L1', 0, TOP_ATTACH)!);
    expect(tilted.length).toBe(flat.length);
    let sawTop = false;
    for (let i = 0; i < tilted.length; i++) {
      expect(tilted[i].y).toBeCloseTo(flat[i].y, TOL);
      expect(tilted[i].z).toBeCloseTo(flat[i].z, TOL);              // dir 0 → dy=0
      expect(tilted[i].x).toBeCloseTo(flat[i].x + tilted[i].y * tan, TOL); // dx=h·tanθ
      if (tilted[i].y > 2.5) sawTop = true;
    }
    expect(sawTop).toBe(true);
    // 3D === 2D: shift κορυφής == columnTiltShearAt(params, 3).dx
    const shift = columnTiltShearAt(makeColumn({ direction: 0, angle }).params, 3.0);
    expect(shift.dx).toBeCloseTo(3.0 * tan, TOL);
  });

  it('flat (no tilt) prism → ταυτόσημο (angle 0 fast-path no-op)', () => {
    const a = solidVerts(columnToMesh(makeColumn(), 0, 'L1', 0, TOP_ATTACH)!);
    const b = solidVerts(columnToMesh(makeColumn({ direction: 0, angle: 0 }), 0, 'L1', 0, TOP_ATTACH)!);
    for (let i = 0; i < a.length; i++) {
      expect(b[i].x).toBeCloseTo(a[i].x, TOL);
      expect(b[i].z).toBeCloseTo(a[i].z, TOL);
    }
  });
});
