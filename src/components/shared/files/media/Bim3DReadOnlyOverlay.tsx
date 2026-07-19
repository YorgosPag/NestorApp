'use client';

import { useMemo } from 'react';
import { BimViewport3D } from '@/subapps/dxf-viewer/bim-3d/viewport/BimViewport3D';
import type { FloorplanBimSnapshot } from '@/components/shared/files/media/useFloorplanBimEntities';
import type { Bim3DEntities } from '@/subapps/dxf-viewer/bim-3d/stores/Bim3DEntitiesStore';
import type { DxfScene } from '@/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-types';

// ADR-371 / ADR-370 Phase 11-12: read-only 3D overlay for Properties floorplan tab.
// Converts the scene-derived FloorplanBimSnapshot into the Bim3DEntities shape and
// forwards the loaded DxfScene, so BimViewport3D shows BOTH the BIM elements AND the
// DXF linework/κάτοψη (with a working cut-plane). Uses `visible` to bypass the global
// ViewMode3DStore (Q1: state independent from /dxf/viewer).
// ADR-040 compliant: no high-freq store subscriptions here — both feeds are scene-derived
// (low-freq), already computed by the parent FloorplanGallery. The public read-only page is
// unauthenticated with projectId=null, so the persisted scene.json — never Firestore — is
// the sole data source (ADR-370 Phase 11).

export interface Bim3DReadOnlyOverlayProps {
  bimSnapshot: FloorplanBimSnapshot;
  /**
   * ADR-370 Phase 12 — the loaded floor-plan `DxfScene` (same WeakMap-cached instance
   * the 2D read-only render uses, via `getFloorplanDxfScene`). Feeds the 3D DXF overlay
   * so the linework/κάτοψη renders in 3D exactly as the editor shows it, and the
   * cut-plane has geometry to clip. Null when there is no scene.
   */
  dxfScene: DxfScene | null;
  projectId: string | null;
  onClose: () => void;
}

export function Bim3DReadOnlyOverlay({ bimSnapshot, dxfScene, projectId, onClose }: Bim3DReadOnlyOverlayProps) {
  const bimEntities = useMemo<Bim3DEntities>(
    () => ({
      walls: bimSnapshot.walls,
      columns: bimSnapshot.columns,
      beams: bimSnapshot.beams,
      // ADR-370 v2 — foundations now loaded read-only (ADR-436 deferral resolved).
      foundations: bimSnapshot.foundations,
      slabs: bimSnapshot.slabs,
      slabOpenings: bimSnapshot.slabOpenings,
      openings: bimSnapshot.openings,
      stairs: bimSnapshot.stairs,
      // ADR-406 — the read-only media preview loader does not query the
      // floorplan_mep_fixtures collection yet (deferred). Empty keeps the 3D
      // overlay valid; fixtures show in the full DXF viewer.
      fixtures: [],
      // ADR-407 — same as fixtures: read-only preview does not load
      // floorplan_railings yet (deferred). Empty keeps the bundle valid.
      railings: [],
      // ADR-408 Φ3 — same as fixtures/railings: read-only preview does not load
      // floorplan_electrical_panels yet (deferred). Empty keeps the bundle valid.
      panels: [],
      // ADR-408 Φ12 — same as above: read-only preview does not load
      // floorplan_mep_manifolds yet (deferred). Empty keeps the bundle valid.
      manifolds: [],
      // ADR-408 Εύρος Β — same as above: read-only preview does not load
      // floorplan_mep_radiators yet (deferred). Empty keeps the bundle valid.
      radiators: [],
      // ADR-408 Εύρος Β — same as above: read-only preview does not load
      // floorplan_mep_boilers yet (deferred). Empty keeps the bundle valid.
      boilers: [],
      // ADR-408 DHW — same as above: read-only preview does not load
      // floorplan_mep_water_heaters yet (deferred). Empty keeps the bundle valid.
      waterHeaters: [],
      // ADR-370 v2 — furniture now loaded read-only (ADR-410 deferral resolved).
      furnitures: bimSnapshot.furnitures,
      // ADR-408 Φ8 — same as above: read-only preview does not load
      // floorplan_mep_segments yet (deferred). Empty keeps the bundle valid.
      mepSegments: [],
      // ADR-408 Φ11 — same as above: read-only preview does not load
      // floorplan_mep_fittings yet (deferred). Empty keeps the bundle valid.
      mepFittings: [],
      // ADR-417 — same as above: read-only preview does not load
      // floorplan_roofs yet (deferred). Empty keeps the bundle valid.
      roofs: [],
      // ADR-419 — same as above: read-only preview does not load
      // floorplan_floor_finishes yet (deferred). Empty keeps the bundle valid.
      floorFinishes: [],
      // ADR-408 Εύρος Β #3 — same as above: read-only preview does not load
      // floorplan_mep_underfloors yet (deferred). Empty keeps the bundle valid.
      underfloors: [],
    }),
    [bimSnapshot.walls, bimSnapshot.columns, bimSnapshot.beams, bimSnapshot.slabs, bimSnapshot.slabOpenings, bimSnapshot.openings, bimSnapshot.stairs, bimSnapshot.foundations, bimSnapshot.furnitures],
  );

  return (
    <div className="absolute inset-0 z-[100]">
      <BimViewport3D
        readOnly
        visible
        bimEntities={bimEntities}
        dxfScene={dxfScene}
        projectId={projectId}
        onClose={onClose}
      />
    </div>
  );
}
