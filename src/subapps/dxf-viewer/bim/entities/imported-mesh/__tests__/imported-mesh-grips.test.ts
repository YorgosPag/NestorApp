/**
 * ADR-683 Φ3 §10.1 — λαβές εισαγόμενου πλέγματος.
 *
 * Αυτό το αρχείο φυλάει **το όριο του §3**: όσο κι αν εξελιχθεί ο κώδικας, ένα εισαγόμενο πλέγμα
 * δεν αποκτά ποτέ λαβή σχήματος. Αν κάποιος προσθέσει γωνιακές λαβές «για ευκολία», εδώ σπάει.
 */

import {
  getImportedMeshGrips,
  applyImportedMeshGripDrag,
  IMPORTED_MESH_MOVE_KIND,
  IMPORTED_MESH_ROTATION_KIND,
} from '../imported-mesh-grips';
import { computeImportedMeshGeometry } from '../imported-mesh-geometry';
import type { ImportedMeshEntity, ImportedMeshParams } from '../imported-mesh-types';

const params: ImportedMeshParams = {
  kind: 'imported',
  uploadId: 'imesh_abc',
  nodeName: 'Rail_01',
  storagePath: 'projects/p1/imported-meshes/imesh_abc.glb',
  sourceFileName: 'Ισόγειο.glb',
  position: { x: 0, y: 0, z: 0 },
  rotationDeg: 0,
  measuredWidthMm: 2000,
  measuredDepthMm: 1000,
  measuredHeightMm: 900,
  mountingElevationMm: 0,
  sceneUnits: 'mm',
};

const entity = {
  id: 'im_1',
  type: 'imported-mesh',
  layerId: 'L',
  kind: 'imported',
  params,
  geometry: computeImportedMeshGeometry(params),
} as unknown as ImportedMeshEntity;

describe('getImportedMeshGrips', () => {
  it('εκπέμπει ΑΚΡΙΒΩΣ δύο λαβές: MOVE + ROTATION', () => {
    const grips = getImportedMeshGrips(entity);
    expect(grips).toHaveLength(2);
    expect(grips[0].gripKind).toEqual({ on: 'imported-mesh', kind: IMPORTED_MESH_MOVE_KIND });
    expect(grips[1].gripKind).toEqual({ on: 'imported-mesh', kind: IMPORTED_MESH_ROTATION_KIND });
  });

  it('ΚΑΜΙΑ λαβή σχήματος — το όριο του §3 (αν σπάσει: κάποιος πρόσθεσε resize)', () => {
    const kinds = getImportedMeshGrips(entity).map((g) => g.gripKind?.kind ?? '');
    expect(kinds.some((k) => k.includes('corner'))).toBe(false);
    expect(kinds.some((k) => k.includes('vertex'))).toBe(false);
    expect(kinds.some((k) => k.includes('resize'))).toBe(false);
  });

  it('μόνο η λαβή MOVE μετακινεί ολόκληρη την οντότητα', () => {
    const grips = getImportedMeshGrips(entity);
    expect(grips[0].movesEntity).toBe(true);
    expect(grips[1].movesEntity).toBe(false);
  });

  it('εκφυλισμένο ίχνος → καμία λαβή (αντί για crash)', () => {
    const broken = { ...entity, geometry: { ...entity.geometry, footprint: { vertices: [] } } };
    expect(getImportedMeshGrips(broken as unknown as ImportedMeshEntity)).toEqual([]);
  });
});

describe('applyImportedMeshGripDrag', () => {
  it('MOVE μετατοπίζει τη θέση, ΧΩΡΙΣ να αγγίζει τις μετρημένες διαστάσεις', () => {
    const next = applyImportedMeshGripDrag(IMPORTED_MESH_MOVE_KIND, {
      originalParams: params,
      delta: { x: 50, y: -30 },
    });
    expect(next.position.x).toBeCloseTo(50);
    expect(next.position.y).toBeCloseTo(-30);
    expect(next.measuredWidthMm).toBe(params.measuredWidthMm);
    expect(next.measuredDepthMm).toBe(params.measuredDepthMm);
    expect(next.measuredHeightMm).toBe(params.measuredHeightMm);
  });

  it('ROTATION αλλάζει μόνο τη γωνία — οι διαστάσεις μένουν ανέγγιχτες', () => {
    const next = applyImportedMeshGripDrag(IMPORTED_MESH_ROTATION_KIND, {
      originalParams: params,
      delta: { x: 10, y: 10 },
    });
    expect(next.rotationDeg).not.toBe(params.rotationDeg);
    expect(next.measuredWidthMm).toBe(params.measuredWidthMm);
    expect(next.measuredDepthMm).toBe(params.measuredDepthMm);
  });

  it('μηδενικό delta → ΙΔΙΟ αντικείμενο (short-circuit commit, μηδέν undo θόρυβος)', () => {
    const next = applyImportedMeshGripDrag(IMPORTED_MESH_MOVE_KIND, {
      originalParams: params,
      delta: { x: 0, y: 0 },
    });
    expect(next).toBe(params);
  });

  it('διατηρεί τον δείκτη πηγής σε κάθε drag (αλλιώς χάνεται το πλέγμα)', () => {
    const next = applyImportedMeshGripDrag(IMPORTED_MESH_MOVE_KIND, {
      originalParams: params,
      delta: { x: 5, y: 5 },
    });
    expect(next.uploadId).toBe(params.uploadId);
    expect(next.nodeName).toBe(params.nodeName);
    expect(next.storagePath).toBe(params.storagePath);
  });
});
