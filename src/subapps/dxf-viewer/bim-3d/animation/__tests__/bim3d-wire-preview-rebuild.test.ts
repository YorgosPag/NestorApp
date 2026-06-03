/**
 * ADR-408 Φ7 P2 — bim3d-wire-preview-rebuild: live circuit-wire re-route while a
 * fixture/panel is dragged in the 3D gizmo. Seeds the real zustand stores with
 * minimal hosts + a circuit and asserts: (a) only affected circuits rebuild,
 * (b) the dragged host's endpoint follows the live translation, (c) the
 * multi-floor scope falls back to commit-on-release.
 */

import * as THREE from 'three';
import {
  affectedWireSystemIds,
  buildCircuitWirePreviewObjects,
} from '../bim3d-wire-preview-rebuild';
import { useBim3DEntitiesStore } from '../../stores/Bim3DEntitiesStore';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import { useViewMode3DStore } from '../../stores/ViewMode3DStore';
import type { MepFixtureEntity } from '../../../bim/types/mep-fixture-types';
import type { ElectricalPanelEntity } from '../../../bim/types/electrical-panel-types';
import type { MepSystemEntity } from '../../../bim/types/mep-system-types';

/** Minimal point host (only the fields the resolver reads), cast to the entity type. */
function host<T>(id: string, x: number, y: number, sceneUnits: 'mm' | 'cm' | 'm' = 'mm'): T {
  return {
    id,
    params: {
      position: { x, y, z: 0 },
      rotation: 0,
      mountingElevationMm: 2700,
      sceneUnits,
      connectors: [{ connectorId: 'c1', localPosition: { x: 0, y: 0, z: 0 } }],
    },
  } as unknown as T;
}

function circuit(id: string, source: string, members: string[]): MepSystemEntity {
  return {
    id,
    params: {
      systemType: 'electrical-circuit',
      name: id,
      systemClassification: 'lighting',
      sourceEntityId: source,
      sourceConnectorId: 'c1',
      members: members.map((entityId) => ({ entityId, connectorId: 'c1' })),
    },
  } as unknown as MepSystemEntity;
}

function bbox(mesh: THREE.Mesh): THREE.Box3 {
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox!.clone();
}

describe('bim3d-wire-preview-rebuild', () => {
  beforeEach(() => {
    useBim3DEntitiesStore.setState({
      fixtures: [host<MepFixtureEntity>('fx1', 10, 0)],
      panels: [host<ElectricalPanelEntity>('pnl1', 0, 0)],
      floors: [],
      buildings: [],
    });
    useMepSystemStore.getState().setSystems([circuit('sys1', 'pnl1', ['fx1'])]);
    useViewMode3DStore.getState().setFloor3DScope('single');
  });

  describe('affectedWireSystemIds', () => {
    it('matches when a dragged id is the circuit source', () => {
      expect(affectedWireSystemIds(new Set(['pnl1']))).toEqual(['sys1']);
    });
    it('matches when a dragged id is a circuit member', () => {
      expect(affectedWireSystemIds(new Set(['fx1']))).toEqual(['sys1']);
    });
    it('is empty when nothing dragged participates in any circuit', () => {
      expect(affectedWireSystemIds(new Set(['unrelated']))).toEqual([]);
    });
    it('is empty for an empty drag set', () => {
      expect(affectedWireSystemIds(new Set())).toEqual([]);
    });
  });

  describe('buildCircuitWirePreviewObjects', () => {
    const move = (x: number, y: number, z = 0) =>
      ({ kind: 'move', translation: new THREE.Vector3(x, y, z) }) as const;

    it('rebuilds the affected circuit conduit (one tube)', () => {
      const meshes = buildCircuitWirePreviewObjects(new Set(['fx1']), move(0, 0));
      expect(meshes).toHaveLength(1);
      expect(meshes[0]!.userData['mepWireSystemId']).toBe('sys1');
    });

    it('shifts the dragged fixture endpoint by the live translation (+X → wider bbox)', () => {
      const at0 = buildCircuitWirePreviewObjects(new Set(['fx1']), move(0, 0));
      const moved = buildCircuitWirePreviewObjects(new Set(['fx1']), move(5, 0));
      // The fixture leg of the home run extends further East when dragged +X.
      expect(bbox(moved[0]!).max.x).toBeGreaterThan(bbox(at0[0]!).max.x);
    });

    it('scales the live move delta to scene units in a metre-scene (ADR-402/404 — no 1000× fly-off)', () => {
      // Metre-scene: panel + fixture positions are in metres. A +5 m world drag
      // must shift the endpoint by 5 scene-units (m), NOT 5000 — the pre-fix bug
      // added the mm delta straight onto a metres coordinate → conduit to infinity.
      useBim3DEntitiesStore.setState({
        fixtures: [host<MepFixtureEntity>('fx1', 10, 0, 'm')],
        panels: [host<ElectricalPanelEntity>('pnl1', 0, 0, 'm')],
        floors: [],
        buildings: [],
      });
      const at0 = buildCircuitWirePreviewObjects(new Set(['fx1']), move(0, 0));
      const moved = buildCircuitWirePreviewObjects(new Set(['fx1']), move(5, 0));
      // sceneToM = 1 for metres, so bbox is in metres directly: a 5 m drag ⇒ ~5 m
      // shift. The pre-fix value would be ~5000 m.
      const shift = bbox(moved[0]!).max.x - bbox(at0[0]!).max.x;
      expect(shift).toBeGreaterThan(4.9);
      expect(shift).toBeLessThan(5.1);
    });

    it('orbits the dragged fixture endpoint about the pivot on plan-rotate (P2b)', () => {
      // Pivot at the panel/origin; +90° CCW swings the East fixture leg to North
      // (DXF +Y → Three −Z), so the East extent shrinks and the −Z extent grows.
      const at0 = buildCircuitWirePreviewObjects(new Set(['fx1']), move(0, 0));
      const turned = buildCircuitWirePreviewObjects(new Set(['fx1']), {
        kind: 'rotate',
        pivot: new THREE.Vector3(0, 0, 0),
        angleRad: Math.PI / 2,
      });
      expect(bbox(turned[0]!).max.x).toBeLessThan(bbox(at0[0]!).max.x);
      expect(bbox(turned[0]!).min.z).toBeLessThan(bbox(at0[0]!).min.z);
    });

    it('returns nothing when the dragged host is in no circuit', () => {
      expect(buildCircuitWirePreviewObjects(new Set(['unrelated']), move(5, 0))).toEqual([]);
    });

    it('falls back to commit-on-release for the multi-floor scope', () => {
      useViewMode3DStore.getState().setFloor3DScope('all');
      expect(buildCircuitWirePreviewObjects(new Set(['fx1']), move(5, 0))).toEqual([]);
    });
  });
});
