'use client';

import { useMemo } from 'react';
import { BimViewport3D } from '@/subapps/dxf-viewer/bim-3d/viewport/BimViewport3D';
import type { FloorplanBimSnapshot } from '@/components/shared/files/media/useFloorplanBimEntities';
import type { Bim3DEntities } from '@/subapps/dxf-viewer/bim-3d/stores/Bim3DEntitiesStore';

// ADR-371: read-only 3D overlay for Properties floorplan tab.
// Converts FloorplanBimSnapshot (Firestore feed from useFloorplanBimEntities) into
// the Bim3DEntities shape expected by BimViewport3D. Uses `visible` prop to bypass
// global ViewMode3DStore (Q1: state independent from /dxf/viewer).
// ADR-040 compliant: no high-freq store subscriptions here — entities come from Firestore
// (low-freq) already computed by the parent FloorplanGallery.

export interface Bim3DReadOnlyOverlayProps {
  bimSnapshot: FloorplanBimSnapshot;
  projectId: string | null;
  onClose: () => void;
}

export function Bim3DReadOnlyOverlay({ bimSnapshot, projectId, onClose }: Bim3DReadOnlyOverlayProps) {
  const bimEntities = useMemo<Bim3DEntities>(
    () => ({
      walls: bimSnapshot.walls,
      columns: bimSnapshot.columns,
      beams: bimSnapshot.beams,
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
      // ADR-410 — same as above: read-only preview does not load
      // floorplan_furniture yet (deferred). Empty keeps the bundle valid.
      furnitures: [],
      // ADR-408 Φ8 — same as above: read-only preview does not load
      // floorplan_mep_segments yet (deferred). Empty keeps the bundle valid.
      mepSegments: [],
      // ADR-408 Φ11 — same as above: read-only preview does not load
      // floorplan_mep_fittings yet (deferred). Empty keeps the bundle valid.
      mepFittings: [],
      // ADR-417 — same as above: read-only preview does not load
      // floorplan_roofs yet (deferred). Empty keeps the bundle valid.
      roofs: [],
    }),
    [bimSnapshot.walls, bimSnapshot.columns, bimSnapshot.beams, bimSnapshot.slabs, bimSnapshot.slabOpenings, bimSnapshot.openings, bimSnapshot.stairs],
  );

  return (
    <div className="absolute inset-0 z-[100]">
      <BimViewport3D
        readOnly
        visible
        bimEntities={bimEntities}
        projectId={projectId}
        onClose={onClose}
      />
    </div>
  );
}
