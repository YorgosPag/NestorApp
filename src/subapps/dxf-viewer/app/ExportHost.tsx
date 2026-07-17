'use client';

/**
 * ADR-505 — Export host (lifecycle owner for the «Εξαγωγή» dialog).
 *
 * Mirror of `PrintHost` (ADR-453): subscribes to the ribbon EventBus signal,
 * owns the dialog open state, gathers live deps (every level's loaded scene,
 * active level, drawing name, date) and routes a submitted `ExportRequest`.
 *
 * Format routing (full SSoT — no duplicated engines):
 *   - DXF / TEK / OBJ / glTF → the unified `runExport` pipeline (scope filter +
 *           multi-floor here). The 3Δ mesh formats (ADR-668) additionally need the
 *           building's storey elevations — gathered here, like every other live dep.
 *   - IFC → delegates to the canonical IFC4 flow (`bim:ifc-export-requested`,
 *           served by `IfcExportHost`, ADR-369) — whole project, BIM-only.
 *   - PDF → delegates to the canonical Print engine (`dxf:print-dialog-requested`,
 *           served by `PrintHost`, ADR-453).
 *
 * Mounted as a React.Suspense leaf in `DxfViewerDialogs`. ADR-040: zero canvas
 * subscriptions, zero useSyncExternalStore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-505-unified-export-system.md
 */

import * as React from 'react';

import { EventBus } from '../systems/events/EventBus';
import { useEventGatedDialog } from './dialog-hosts/useEventGatedDialog';
import { useLevels } from '../systems/levels';
// ADR-668 — storey elevations for the 3Δ export, from the SAME canonical Firestore source the
// floor tabs and the live «Όλοι οι όροφοι» 3Δ view use (`useFloors3DAggregator` reads exactly
// this hook). NOT `Bim3DEntitiesStore.floors`, whose `elevation` arrives undefined → every
// storey would stack at Y=0.
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { nowISO } from '@/lib/date-local';
import { runExport } from '../export/export-service';
import type { ExportDeps, ExportLevelScene, ExportRequest } from '../export/types';
import { ExportDialog } from '../ui/components/export/ExportDialog';

export interface ExportHostProps {
  /** Active project id — forwarded to the canonical IFC export flow. */
  readonly projectId?: string;
  /** Active building id — scopes the IFC export to one building. */
  readonly buildingId?: string;
}

/**
 * Thin gate (ADR-532 Stage 3): listens for «Εξαγωγή» and mounts the dialog body
 * ONLY while open. Closed → `null`, so the always-listed host costs nothing in
 * the per-selection commit (was re-rendering ExportDialog while closed).
 */
export function ExportHost({ projectId, buildingId }: ExportHostProps): React.ReactElement | null {
  const { open, close } = useEventGatedDialog('dxf:export-dialog-requested');
  if (!open) return null;
  return <ExportBody projectId={projectId} buildingId={buildingId} onClose={close} />;
}

interface ExportBodyProps {
  readonly projectId?: string;
  readonly buildingId?: string;
  readonly onClose: () => void;
}

function ExportBody({ projectId, buildingId, onClose }: ExportBodyProps): React.JSX.Element {
  const { levels, currentLevelId, getLevelScene } = useLevels();

  const projectName = React.useMemo(() => {
    const level = levels.find((l) => l.id === currentLevelId);
    return level?.name ?? level?.sceneFileName ?? 'drawing';
  }, [levels, currentLevelId]);

  // ADR-668 — derived from the ACTIVE LEVEL (not the `buildingId` prop, which scopes the IFC
  // flow): this mirrors `useFloors3DAggregator` exactly, so the exported stack matches what the
  // live 3Δ view shows. Falls back to the prop when the level carries no building.
  const activeBuildingId = React.useMemo(
    () => levels.find((l) => l.id === currentLevelId)?.buildingId ?? buildingId ?? null,
    [levels, currentLevelId, buildingId],
  );
  // Fetched while the dialog is open (it only mounts on open), so the storey elevations are
  // ready before submit. DXF/TEK ignore them; the 3Δ exporter fails closed without them.
  const { floors: buildingFloors } = useFloorsByBuilding(activeBuildingId, true);

  const handleSubmit = React.useCallback(
    async (request: ExportRequest) => {
      // IFC / PDF → delegate to the canonical engines (SSoT, no duplication).
      if (request.format === 'ifc') {
        EventBus.emit('bim:ifc-export-requested', {
          projectId,
          buildingIds: buildingId ? [buildingId] : undefined,
          includePsets: true,
        });
        return;
      }
      if (request.format === 'pdf') {
        EventBus.emit('dxf:print-dialog-requested', {});
        return;
      }

      // DXF / TEK / OBJ / glTF → unified pipeline (content scope + multi-floor live here).
      const levelScenes: ExportLevelScene[] = [];
      for (const level of levels) {
        const scene = getLevelScene(level.id);
        if (scene) levelScenes.push({ level, scene });
      }
      const deps: ExportDeps = {
        levelScenes,
        activeLevelId: currentLevelId,
        projectName,
        dateStr: nowISO().slice(0, 10),
        // ADR-668 — 3Δ-only: real storey elevations, so «όλοι οι όροφοι» stacks a building
        // instead of flattening every floor onto Z=0.
        floors: buildingFloors,
        activeBuildingId,
      };
      await runExport(request, deps);
    },
    [levels, getLevelScene, currentLevelId, projectName, projectId, buildingId,
     buildingFloors, activeBuildingId],
  );

  const handleOpenChange = React.useCallback(
    (next: boolean) => { if (!next) onClose(); },
    [onClose],
  );

  return <ExportDialog open onOpenChange={handleOpenChange} onSubmit={handleSubmit} />;
}
