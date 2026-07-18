/**
 * Tool preview mounts (Rotation / Move / Mirror / Scale / Stretch / GripDrag).
 *
 * Each mount: `React.memo(() => { useXxxPreview(props); return null; })`.
 * No JSX — draws to PreviewCanvas via imperative API. Internal subscriptions
 * (cursor world position, tool store) keep parent CanvasLayerStack inert.
 *
 * Architectural rule: see ADR-040 micro-leaf pattern. Extracted from
 * canvas-layer-stack-leaves.tsx for 500-line ratchet compliance.
 */
'use client';
import React from 'react';
import { useRotationPreview } from '../../hooks/tools/useRotationPreview';
import { useMovePreview } from '../../hooks/tools/useMovePreview';
import { useGripGhostPreview } from '../../hooks/tools/useGripGhostPreview';
import { useMirrorPreview } from '../../hooks/tools/useMirrorPreview';
import { useScalePreview } from '../../hooks/tools/useScalePreview';
import { useStretchPreview } from '../../hooks/tools/useStretchPreview';
import { useEntityBodyDragPreview } from '../../hooks/tools/useEntityBodyDragPreview';
import { useWallSplitKnifePreview } from '../../hooks/tools/useWallSplitKnifePreview';
import { useWallSplitFirstPoint } from '../../systems/wall-split/WallSplitStore';
import { useBeamBetweenMembersPreview } from '../../hooks/tools/useBeamBetweenMembersPreview';
import { useBeamBetweenAnchor } from '../../systems/beam-between-members/BeamBetweenMembersStore';
import { useParallelGuideAnchorPreview } from '../../hooks/tools/useParallelGuideAnchorPreview';
import { useCanvasNumericAnchor } from '../../systems/canvas-numeric-input/CanvasNumericInputStore';
import type { MovePhase } from '../../hooks/tools/useMoveTool';
import type { MirrorPhase } from '../../hooks/tools/useMirrorTool';
import type { DxfGripDragPreview } from '../../hooks/grip-computation';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';

export interface RotationPreviewMountProps {
  phase: import('../../hooks/tools/useRotationTool').RotationPhase;
  basePoint: Point2D | null;
  referencePoint: Point2D | null;
  currentAngle: number;
  selectedEntityIds: string[];
  levelManager: Parameters<typeof useRotationPreview>[0]['levelManager'];
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const RotationPreviewMount = React.memo(function RotationPreviewMount(
  props: RotationPreviewMountProps,
) {
  useRotationPreview(props);
  return null;
});

export interface MovePreviewMountProps {
  phase: MovePhase;
  basePoint: Point2D | null;
  selectedEntityIds: string[];
  selectedOverlayIds?: string[];
  getOverlay?: Parameters<typeof useMovePreview>[0]['getOverlay'];
  levelManager: Parameters<typeof useMovePreview>[0]['levelManager'];
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const MovePreviewMount = React.memo(function MovePreviewMount(
  props: MovePreviewMountProps,
) {
  useMovePreview(props);
  return null;
});

export interface MirrorPreviewMountProps {
  phase: MirrorPhase;
  firstPoint: Point2D | null;
  secondPoint: Point2D | null;
  selectedEntityIds: string[];
  levelManager: Parameters<typeof useMirrorPreview>[0]['levelManager'];
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const MirrorPreviewMount = React.memo(function MirrorPreviewMount(
  props: MirrorPreviewMountProps,
) {
  useMirrorPreview(props);
  return null;
});

export interface ScalePreviewMountProps {
  levelManager: Parameters<typeof useScalePreview>[0]['levelManager'];
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const ScalePreviewMount = React.memo(function ScalePreviewMount(
  props: ScalePreviewMountProps,
) {
  useScalePreview(props);
  return null;
});

export interface StretchPreviewMountProps {
  levelManager: Parameters<typeof useStretchPreview>[0]['levelManager'];
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const StretchPreviewMount = React.memo(function StretchPreviewMount(
  props: StretchPreviewMountProps,
) {
  useStretchPreview(props);
  return null;
});

export interface EntityBodyDragPreviewMountProps {
  levelManager: Parameters<typeof useEntityBodyDragPreview>[0]['levelManager'];
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const EntityBodyDragPreviewMount = React.memo(function EntityBodyDragPreviewMount(
  props: EntityBodyDragPreviewMountProps,
) {
  useEntityBodyDragPreview(props);
  return null;
});

export interface GripDragPreviewMountProps {
  dragPreview: DxfGripDragPreview | null;
  levelManager: Parameters<typeof useGripGhostPreview>[0]['levelManager'];
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const GripDragPreviewMount = React.memo(function GripDragPreviewMount(
  props: GripDragPreviewMountProps,
) {
  useGripGhostPreview(props);
  return null;
});

// ── Wall-split knife-line preview (ADR-363 Phase 5.6) ─────────────────────────

export interface WallSplitKnifePreviewMountProps {
  levelManager: Parameters<typeof useWallSplitKnifePreview>[0]['levelManager'];
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

/**
 * Store-driven: self-subscribes to the knife first point (WallSplitStore) — the
 * orchestrator stays inert (ADR-040). The live cursor + RAF live in the harness.
 */
export const WallSplitKnifePreviewMount = React.memo(function WallSplitKnifePreviewMount(
  props: WallSplitKnifePreviewMountProps,
) {
  const firstPoint = useWallSplitFirstPoint();
  useWallSplitKnifePreview({ ...props, firstPoint });
  return null;
});

// ── Beam-between-members preview (ADR-569) ────────────────────────────────────

export interface BeamBetweenMembersPreviewMountProps {
  levelManager: Parameters<typeof useBeamBetweenMembersPreview>[0]['levelManager'];
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

/**
 * Store-driven: self-subscribes στο anchor-μέλος (BeamBetweenMembersStore) — ο
 * orchestrator μένει inert (ADR-040). Ζωγραφίζει το δοκάρι-φάντασμα από την παρειά του
 * anchor προς το μέλος/κέρσορα. Live cursor + RAF ζουν στο harness.
 */
export const BeamBetweenMembersPreviewMount = React.memo(function BeamBetweenMembersPreviewMount(
  props: BeamBetweenMembersPreviewMountProps,
) {
  const anchor = useBeamBetweenAnchor();
  useBeamBetweenMembersPreview({ ...props, anchor });
  return null;
});

// ── Παράλληλος οδηγός: anchor ＋ δυναμική διακεκομμένη (ADR-189 §3.13) ─────────

export interface ParallelGuideAnchorPreviewMountProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

/**
 * Store-driven: αυτο-εγγράφεται στο anchor (CanvasNumericInputStore) — ο orchestrator
 * μένει inert (ADR-040). Χωρίς `levelManager`: το preview δεν διαβάζει καμία οντότητα.
 */
export const ParallelGuideAnchorPreviewMount = React.memo(function ParallelGuideAnchorPreviewMount(
  props: ParallelGuideAnchorPreviewMountProps,
) {
  const anchor = useCanvasNumericAnchor();
  useParallelGuideAnchorPreview({ ...props, anchor });
  return null;
});
