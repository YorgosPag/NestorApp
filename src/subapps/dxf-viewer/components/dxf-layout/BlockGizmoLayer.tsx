/**
 * BlockGizmoLayer — ADR-640 / ADR-040: the whole-BLOCK interactive GIZMO (mirror of
 * GroupGizmoLayer, ADR-575 §8).
 *
 * Thin wrapper over the shared {@link ContainerGizmoLayer} (the ONE canvas painter for a
 * group's and a block's gizmo) — it only injects the BLOCK-specific grip resolution
 * (`resolveSelectedBlocks` → `computeBlockSelectionBounds` → `getBlockGizmoGrips`). ALL the
 * canvas / DPR / paint / temperature logic lives once in `ContainerGizmoLayer` (N.18), which
 * self-subscribes to selection + the reactive scene so the CanvasLayerStack shell stays
 * subscription-free (ADR-040 cardinal rule #1).
 *
 * @see components/dxf-layout/ContainerGizmoLayer.tsx — the shared painter (ADR-040-critical)
 * @see systems/block/block-gizmo-grips.ts — `getBlockGizmoGrips` (the grips, SSoT)
 * @see components/dxf-layout/BlockSelectionOverlaySubscriber.tsx — sibling box+pill leaf
 */
'use client';

import React from 'react';
import {
  resolveSelectedBlocks,
  computeBlockSelectionBounds,
} from '../../systems/block/block-selection-bounds';
import { getBlockGizmoGrips } from '../../systems/block/block-gizmo-grips';
import type { GripInfo } from '../../hooks/grip-types';
import type { Entity } from '../../types/entities';
import { ContainerGizmoLayer, type ContainerGripResolver } from './ContainerGizmoLayer';
import type { ViewTransform } from '../../rendering/types/Types';
import type { DxfGripInteractionState } from '../../hooks/grip-computation';

interface BlockGizmoLayerProps {
  sceneLevelId: string | null;
  transform: ViewTransform;
  viewport: { width: number; height: number };
  gripInteractionState: DxfGripInteractionState | undefined;
  gripSize?: number;
  className?: string;
}

/** BLOCK-specific gizmo grip resolution (stable module-level identity for the memo dep). */
const resolveBlockGizmoGrips: ContainerGripResolver = (
  entities: readonly Entity[] | undefined,
  selectedIds: string[],
): GripInfo[] => {
  const selectedBlocks = resolveSelectedBlocks(entities, selectedIds);
  if (selectedBlocks.length === 0) return [];
  const out: GripInfo[] = [];
  for (const block of selectedBlocks) {
    const bounds = computeBlockSelectionBounds(block);
    if (bounds) out.push(...getBlockGizmoGrips(block, bounds));
  }
  return out;
};

export const BlockGizmoLayer = React.memo(function BlockGizmoLayer(props: BlockGizmoLayerProps) {
  return <ContainerGizmoLayer {...props} resolveGrips={resolveBlockGizmoGrips} />;
});
