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
