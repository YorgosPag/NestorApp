/**
 * ADR-416 — composite (multi-layer) slab 3D mesh.
 *
 * Verifies that a slab carrying a multi-layer `SlabDna` renders through
 * `slabToMesh` as a vertical STACK of per-layer sub-solids (Revit Compound
 * Structure / IFC IfcMaterialLayerSet), while a single-layer / untyped slab keeps
 * the legacy single-extrude Mesh (back-compat):
 *   - layer count + order (top→bottom) + per-layer material/layerId tags
 *   - Y-stack: contiguous bands, top face @FFL, bottom face @slab bottom
 *   - per-layer thickness === layer.thickness (the stack fills the envelope exactly)
 *   - tilted slab → every band shears by the SAME slope plane (constant thickness)
 */

import * as THREE from 'three';
import { slabToMesh } from '../BimToThreeConverter';
import { slabSlopeOffsetZmm } from '../../../bim/geometry/slab-slope';
import type { SlabDna } from '../../../bim/types/slab-dna-types';
import { computeSlabTotalThickness } from '../../../bim/types/slab-dna-types';
import type { SlabEntity, SlabParams } from '../../../bim/types/slab-types';

const MM_TO_M = 0.001;
const TOL = 5;

/** 10×10 (canvas units) τετράγωνο, γωνία στο (0,0). */
const SQUARE = {
  vertices: [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 10, y: 10, z: 0 },
    { x: 0, y: 10, z: 0 },
  ],
};

/** Deterministic 3-layer build-up (top tile 50 / core RC 100 / bottom plaster 30 = 180mm). */
const DNA: SlabDna = {
  layers: [
    { id: 'L-top', name: 'Tile', thickness: 50, materialId: 'mat-tile', zone: 'top' },
    { id: 'L-core', name: 'RC', thickness: 100, materialId: 'mat-concrete', zone: 'core' },
    { id: 'L-bot', name: 'Plaster', thickness: 30, materialId: 'mat-plaster', zone: 'bottom' },
  ],
  totalThickness: computeSlabTotalThickness([
    { id: 'L-top', name: 'Tile', thickness: 50, materialId: 'mat-tile', zone: 'top' },
    { id: 'L-core', name: 'RC', thickness: 100, materialId: 'mat-concrete', zone: 'core' },
    { id: 'L-bot', name: 'Plaster', thickness: 30, materialId: 'mat-plaster', zone: 'bottom' },
  ]),
};

function makeSlab(over: Partial<SlabParams> = {}): SlabEntity {
  const params: SlabParams = {
    kind: 'floor',
    outline: SQUARE,
    levelElevation: 3000,
    thickness: DNA.totalThickness,
    geometryType: 'box',
    sceneUnits: 'm',
    dna: DNA,
    ...over,
  } as SlabParams;
  return {
    id: 's', type: 'slab', kind: params.kind, ifcType: 'IfcSlab', layerId: '0', params,
    geometry: {} as SlabEntity['geometry'],
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as SlabEntity;
}

/** Vertical extent of a mesh's geometry in geo-local Y. */
function geoExtentY(mesh: THREE.Mesh): { min: number; max: number } {
  const p = mesh.geometry.getAttribute('position');
  let min = Infinity; let max = -Infinity;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return { min, max };
}

describe('slabToMesh — composite (multi-layer) build-up', () => {
  it('multi-layer DNA → Group με 1 band ανά layer, στη σειρά top→bottom', () => {
    const result = slabToMesh(makeSlab());
    expect(result).toBeInstanceOf(THREE.Group);
    const group = result as THREE.Group;
    expect(group.children).toHaveLength(3);
    expect(group.userData['bimId']).toBe('s');
    expect(group.userData['bimType']).toBe('slab');
    group.children.forEach((child, i) => {
      expect(child.userData['layerId']).toBe(DNA.layers[i].id);
      expect(child.userData['matId']).toBe(DNA.layers[i].materialId);
      expect(child.userData['bimType']).toBe('slab');
    });
  });

  it('single-layer / untyped slab → κρατά legacy single Mesh (back-compat)', () => {
    const single = slabToMesh(makeSlab({ dna: undefined, thickness: 200 }));
    expect(single).toBeInstanceOf(THREE.Mesh);
    expect(single).not.toBeInstanceOf(THREE.Group);
  });

  it('Y-stack: contiguous bands, top face @FFL, bottom face @slab bottom', () => {
    const group = slabToMesh(makeSlab()) as THREE.Group;
    const ffl = 3000 * MM_TO_M;
    const slabBottom = (3000 - DNA.totalThickness) * MM_TO_M;
    const worldRanges = group.children.map((c) => {
      const m = c as THREE.Mesh;
      const ext = geoExtentY(m);
      return { bottom: m.position.y + ext.min, top: m.position.y + ext.max };
    });
    // Topmost band top === FFL· bottom-most band bottom === slab bottom.
    expect(worldRanges[0].top).toBeCloseTo(ffl, TOL);
    expect(worldRanges[2].bottom).toBeCloseTo(slabBottom, TOL);
    // Each band's bottom === previous band's top (no gap / overlap).
    expect(worldRanges[1].top).toBeCloseTo(worldRanges[0].bottom, TOL);
    expect(worldRanges[2].top).toBeCloseTo(worldRanges[1].bottom, TOL);
  });

  it('per-layer thickness === layer.thickness (η στοίβα γεμίζει ακριβώς το envelope)', () => {
    const group = slabToMesh(makeSlab()) as THREE.Group;
    group.children.forEach((c, i) => {
      const ext = geoExtentY(c as THREE.Mesh);
      expect(ext.max - ext.min).toBeCloseTo(DNA.layers[i].thickness * MM_TO_M, TOL);
    });
  });
});

describe('slabToMesh — composite + tilted (per-layer slope plane)', () => {
  const slope = { direction: 0, angle: 10, pivotEdge: 'center' as const };
  const tilted = { geometryType: 'tilted' as const, slope };

  it('κάθε band shear-άρεται με το ΙΔΙΟ slope επίπεδο (slabSlopeOffsetZmm SSoT)', () => {
    const flatGroup = slabToMesh(makeSlab()) as THREE.Group;
    const tiltGroup = slabToMesh(makeSlab(tilted)) as THREE.Group;
    expect(tiltGroup.children).toHaveLength(flatGroup.children.length);
    tiltGroup.children.forEach((c, li) => {
      const tiltMesh = c as THREE.Mesh;
      const flatMesh = flatGroup.children[li] as THREE.Mesh;
      const tp = tiltMesh.geometry.getAttribute('position');
      const fp = flatMesh.geometry.getAttribute('position');
      expect(tp.count).toBe(fp.count);
      for (let i = 0; i < tp.count; i++) {
        // X/Z αμετάβλητα· Y = flatY + slopeOffset(plan-point)·MM_TO_M, plan = {x, y:−z}.
        expect(tp.getX(i)).toBeCloseTo(fp.getX(i), TOL);
        expect(tp.getZ(i)).toBeCloseTo(fp.getZ(i), TOL);
        const offsetM = slabSlopeOffsetZmm(
          makeSlab(tilted).params, { x: fp.getX(i), y: -fp.getZ(i) },
        ) * MM_TO_M;
        expect(tp.getY(i)).toBeCloseTo(fp.getY(i) + offsetM, TOL);
      }
    });
  });
});
