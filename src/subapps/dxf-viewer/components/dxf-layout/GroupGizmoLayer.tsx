/**
 * GroupGizmoLayer — ADR-575 §8 / ADR-040: the whole-GROUP interactive GIZMO.
 *
 * Thin wrapper over the shared {@link ContainerGizmoLayer} (the ONE canvas painter for a
 * group's and a block's gizmo) — it only injects the GROUP-specific grip resolution
 * (`resolveSelectedGroups` → `computeGroupSelectionBounds` → `getGroupGizmoGrips`). ALL the
 * canvas / DPR / paint / temperature logic lives once in `ContainerGizmoLayer` (N.18), which
 * self-subscribes to selection + the reactive scene so the CanvasLayerStack shell stays
 * subscription-free (ADR-040 cardinal rule #1).
 *
 * @see components/dxf-layout/ContainerGizmoLayer.tsx — the shared painter (ADR-040-critical)
 * @see systems/group/group-gizmo-grips.ts — `getGroupGizmoGrips` (the grips, SSoT)
 * @see components/dxf-layout/GroupSelectionOverlaySubscriber.tsx — sibling box+pill leaf
 */
'use client';

import React from 'react';
import {
  resolveSelectedGroups,
  computeGroupSelectionBounds,
} from '../../systems/group/group-selection-bounds';
import { getGroupGizmoGrips } from '../../systems/group/group-gizmo-grips';
import type { GripInfo } from '../../hooks/grip-types';
import type { Entity } from '../../types/entities';
import { ContainerGizmoLayer, type ContainerGripResolver } from './ContainerGizmoLayer';
import type { ViewTransform } from '../../rendering/types/Types';
import type { DxfGripInteractionState } from '../../hooks/grip-computation';

interface GroupGizmoLayerProps {
  sceneLevelId: string | null;
  transform: ViewTransform;
  viewport: { width: number; height: number };
  gripInteractionState: DxfGripInteractionState | undefined;
  gripSize?: number;
  className?: string;
}

/** GROUP-specific gizmo grip resolution (stable module-level identity for the memo dep). */
const resolveGroupGizmoGrips: ContainerGripResolver = (
  entities: readonly Entity[] | undefined,
  selectedIds: string[],
): GripInfo[] => {
  const selectedGroups = resolveSelectedGroups(entities, selectedIds);
  if (selectedGroups.length === 0) return [];
  const out: GripInfo[] = [];
  for (const group of selectedGroups) {
    const bounds = computeGroupSelectionBounds(group);
    if (bounds) out.push(...getGroupGizmoGrips(group, bounds));
  }
  return out;
};

export const GroupGizmoLayer = React.memo(function GroupGizmoLayer(props: GroupGizmoLayerProps) {
  return <ContainerGizmoLayer {...props} resolveGrips={resolveGroupGizmoGrips} />;
});
