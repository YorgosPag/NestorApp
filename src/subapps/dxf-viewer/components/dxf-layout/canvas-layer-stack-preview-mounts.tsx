/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * After any architectural change → update the ADR changelog (same commit).
 *
 * CanvasLayerStack — composite preview/ghost mounts (Phase E, ADR-040).
 *
 * Split out of canvas-layer-stack-leaves.tsx (500-LOC cap). Holds the single
 * `PreviewCanvasMounts` composite that wires every dedicated-canvas preview /
 * ghost overlay sharing the same `getCanvas` / `getViewportElement` getters,
 * keeping the shell CanvasLayerStack lean (one JSX node instead of ~30 lines
 * of props). The micro-leaf subscriber components stay in -leaves.tsx.
 */

'use client';
import React from 'react';
// ADR-532 B4 — Move/Rotate/Mirror ghosts are selection-driven; this composite
// self-subscribes so the Shell/orchestrator stay inert on entity selection.
import { useSelectedEntityIds } from '../../systems/selection/useSelectedEntities';
import { MepFixtureGhostPreviewMount, type MepFixtureGhostPreviewMountProps } from './canvas-layer-stack-mep-fixture-ghost';
// ADR-415 — floorplan-symbol 2D placement ghost (sibling of the MEP fixture ghost).
import { FloorplanSymbolGhostPreviewMount, type FloorplanSymbolGhostPreviewMountProps } from './canvas-layer-stack-floorplan-symbol-ghost';
// ADR-581 Φ6 — «σύριγγα» live hover ghost (store-driven: hover / brush / activeTool).
import { MatchHoverGhostPreviewMount } from './canvas-layer-stack-match-ghost';
import { ElectricalPanelGhostPreviewMount, type ElectricalPanelGhostPreviewMountProps } from './canvas-layer-stack-electrical-panel-ghost';
import { MepManifoldGhostPreviewMount, type MepManifoldGhostPreviewMountProps } from './canvas-layer-stack-mep-manifold-ghost';
import { MepRadiatorGhostPreviewMount, type MepRadiatorGhostPreviewMountProps } from './canvas-layer-stack-mep-radiator-ghost';
import { MepBoilerGhostPreviewMount, type MepBoilerGhostPreviewMountProps } from './canvas-layer-stack-mep-boiler-ghost';
import { MepWaterHeaterGhostPreviewMount, type MepWaterHeaterGhostPreviewMountProps } from './canvas-layer-stack-mep-water-heater-ghost';
import { MepSegmentGhostPreviewMount, type MepSegmentGhostPreviewMountProps } from './canvas-layer-stack-mep-segment-ghost';
// ADR-554 — the 7 separate proposal-ghost canvases (water/drainage/heating/electrical/hvac/fire/gas)
// are folded into ONE zero-lag dispatch canvas (ADR-551 §5.2 #2).
import { ProposalDispatchCanvas } from './proposal-overlays/ProposalDispatchCanvas';
// ADR-441 Slice 3-perf — zero-lag associative follow ghost (hosted foundation strips
// follow a dragged guide frame-for-frame on a dedicated canvas).
import { GuideFollowGhostPreviewMount } from './GuideFollowGhostOverlay';
import { ClashOverlayMount } from './canvas-layer-stack-clash-overlay';
// ADR-650 M5α — topography QA «καμπανάκι» markers (sibling of ClashOverlayMount, same shared layer).
import { TopoQaOverlayMount } from './canvas-layer-stack-topo-qa-overlay';
import { SlabOpeningGhostPreviewMount, type SlabOpeningGhostPreviewMountProps } from './canvas-layer-stack-slab-opening-ghost';
import { OpeningGhostPreviewMount, type OpeningGhostPreviewMountProps } from './canvas-layer-stack-opening-ghost';
import { OpeningTagDragMount } from './canvas-layer-stack-opening-tag-drag';
import { MepWireWaypointDragMount } from './canvas-layer-stack-mep-wire-waypoint';
import { GripDimAnnotationMount } from './canvas-layer-stack-grip-dim-annotation';
// ADR-362 Phase J4 — live associative-dimension follow during a Move/grip drag
// (dim value + ext lines + text recompute frame-for-frame, preview ≡ commit).
import { DimAssociationGhostPreviewMount } from '../../hooks/dimensions/useDimAssociationGhostPreview';
// ADR-362 Phase I (Round 22) — live dimension ghost while dragging a dim grip.
import { DimGripGhostPreviewMount } from '../../hooks/dimensions/useDimGripGhostPreview';
// ADR-557 — live «Ύψος»/«Πλάτος» ribbon sync while dragging a TEXT/MTEXT resize grip
// (pure data-sync leaf, no canvas — writes the live values to the text-toolbar store).
import { TextGripRibbonSyncMount } from '../../hooks/grips/useTextGripRibbonSync';
import { ImagePropsGripSyncMount } from '../../hooks/grips/useImagePropsGripSync';
import { TrimPreviewMount } from './TrimPreviewMount';
import { OffsetPreviewMount } from './OffsetPreviewMount';
import { FilletPreviewMount } from './FilletPreviewMount';
import { ChamferPreviewMount } from './ChamferPreviewMount';
import { ExtendPreviewOverlay } from './ExtendPreviewOverlay';
import {
  RotationPreviewMount,
  MovePreviewMount,
  MirrorPreviewMount,
  ScalePreviewMount,
  StretchPreviewMount,
  EntityBodyDragPreviewMount,
  GripDragPreviewMount,
  WallSplitKnifePreviewMount,
  BeamBetweenMembersPreviewMount,
  type RotationPreviewMountProps,
  type MovePreviewMountProps,
  type MirrorPreviewMountProps,
  type ScalePreviewMountProps,
  type StretchPreviewMountProps,
} from './canvas-layer-stack-tool-preview-mounts';
import type { DxfGripDragPreview } from '../../hooks/grip-computation';
import type { ViewTransform } from '../../rendering/types/Types';
import type { SceneModel } from '../../types/scene';

// PREVIEW CANVAS MOUNTS — composite zero-jsx preview mounts
export interface PreviewCanvasMountsProps {
  rotation: Omit<RotationPreviewMountProps, 'selectedEntityIds' | 'levelManager' | 'transform' | 'getCanvas' | 'getViewportElement'>;
  move: Omit<MovePreviewMountProps, 'selectedEntityIds' | 'levelManager' | 'transform' | 'getCanvas' | 'getViewportElement'>;
  mirror: Omit<MirrorPreviewMountProps, 'selectedEntityIds' | 'levelManager' | 'transform' | 'getCanvas' | 'getViewportElement'>;
  scale: Omit<ScalePreviewMountProps, 'levelManager' | 'transform' | 'getCanvas' | 'getViewportElement'>;
  stretch: Omit<StretchPreviewMountProps, 'levelManager' | 'transform' | 'getCanvas' | 'getViewportElement'>;
  /** ADR-350: TRIM overlay has no extra payload — full state lives in TrimToolStore. */
  trim?: Record<string, never>;
  /** ADR-406 — MEP fixture 2D placement ghost payload. */
  mepFixtureGhost: Omit<MepFixtureGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  /** ADR-415 — floorplan-symbol 2D placement ghost payload. */
  floorplanSymbolGhost: Omit<FloorplanSymbolGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  /** ADR-408 Φ3 — electrical panel 2D placement ghost payload. */
  electricalPanelGhost: Omit<ElectricalPanelGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  /** ADR-408 Φ12 — MEP manifold (plumbing) 2D placement ghost payload. */
  mepManifoldGhost: Omit<MepManifoldGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  /** ADR-408 Εύρος Β — heating radiator 2D placement ghost payload. */
  mepRadiatorGhost: Omit<MepRadiatorGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  /** ADR-408 Εύρος Β #2 — heating boiler 2D placement ghost payload. */
  mepBoilerGhost: Omit<MepBoilerGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  /** ADR-408 DHW — domestic water heater 2D placement ghost payload. */
  mepWaterHeaterGhost: Omit<MepWaterHeaterGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  /** ADR-408 Φ8 — MEP segment (duct/pipe) 2D rubber-band ghost payload. */
  mepSegmentGhost: Omit<MepSegmentGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  slabOpeningGhost: Omit<SlabOpeningGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  openingGhost: Omit<OpeningGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  gripDragPreview: DxfGripDragPreview | null;
  levelManager: MovePreviewMountProps['levelManager'] & {
    setLevelScene: (levelId: string, scene: SceneModel) => void;
  };
  transform: ViewTransform;
  /** ADR-040 SSoT — viewport size for the dedicated-canvas proposal ghost overlays. */
  viewport: { width: number; height: number };
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}
/**
 * Renders the 3 PreviewCanvas mounts (Rotation / Move / GripDrag) sharing
 * the same `getCanvas` / `getViewportElement` getters. Keeps the shell
 * CanvasLayerStack lean (single JSX node instead of 30 lines of props).
 */
export const PreviewCanvasMounts = React.memo(function PreviewCanvasMounts(
  props: PreviewCanvasMountsProps,
) {
  const { rotation, move, mirror, scale, stretch, mepFixtureGhost, floorplanSymbolGhost, electricalPanelGhost, mepManifoldGhost, mepRadiatorGhost, mepBoilerGhost, mepWaterHeaterGhost, mepSegmentGhost, slabOpeningGhost, openingGhost, gripDragPreview, levelManager, transform, viewport, getCanvas, getViewportElement } = props;
  // ADR-532 B4 — leaf subscription: ghost mounts need the CURRENT selection at the
  // moment a Move/Rotate/Mirror tool engages, without re-rendering CanvasSection.
  const selectedEntityIds = useSelectedEntityIds();
  return (
    <>
      <RotationPreviewMount
        {...rotation}
        selectedEntityIds={selectedEntityIds}
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <MirrorPreviewMount
        {...mirror}
        selectedEntityIds={selectedEntityIds}
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <MovePreviewMount
        {...move}
        selectedEntityIds={selectedEntityIds}
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <ScalePreviewMount
        {...scale}
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <StretchPreviewMount
        {...stretch}
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      {/* Body-drag (grab entity body → move; Ctrl+drag → copy). Store-driven:
          activation + anchor live in EntityBodyDragStore (no payload prop). */}
      <EntityBodyDragPreviewMount
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      {/* ADR-363 Phase 5.6 — wall-split knife-line: dashed segment [p1 → cursor]
          + per-crossing cut indicators. Store-driven first point (self-subscribes). */}
      <WallSplitKnifePreviewMount
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      {/* ADR-569 — «Δοκάρι ανάμεσα σε μέλη»: rubber-band δοκάρι-φάντασμα από την παρειά
          του anchor-μέλους προς το μέλος/κέρσορα. Store-driven anchor (self-subscribes). */}
      <BeamBetweenMembersPreviewMount
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <TrimPreviewMount
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <OffsetPreviewMount
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      {/* ADR-510 Φ4e — FILLET live ghost (tangent arc + trims / rounded polyline).
          Reads the live scene at frame time for the hover hit-test (levelManager). */}
      <FilletPreviewMount
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
        levelManager={levelManager}
      />
      {/* ADR-510 Φ4f — CHAMFER live ghost (bevel line + trims / beveled polyline). */}
      <ChamferPreviewMount
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
        levelManager={levelManager}
      />
      <ExtendPreviewOverlay
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <GripDragPreviewMount
        dragPreview={gripDragPreview}
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      {/* ADR-362 Phase I (Round 22) — live dimension ghost while a dim grip is dragged
          (applyDimensionGripDrag + renderPreviewDimension, preview ≡ commit). Layers on
          top of the grip-ghost frame (skip-clear); the generic ghost paints nothing for
          dimensions (no apply-entity-preview branch → transformed === entity). */}
      <DimGripGhostPreviewMount
        dragPreview={gripDragPreview}
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      {/* ADR-557 — live «Ύψος»/«Πλάτος» ribbon sync during a TEXT/MTEXT resize grip drag.
          Pure data-sync (no canvas): projects the dragged text + runs the SAME
          applyTextGripDrag SSoT, pushing the live height/widthFactor to the text-toolbar
          store's preview channel (command bridge suppressed via isPreviewing). */}
      <TextGripRibbonSyncMount dragPreview={gripDragPreview} levelManager={levelManager} />
      {/* ADR-654 — live «Ιδιότητες» panel sync during an entourage IMAGE move/resize/rotate drag.
          Pure data-sync (no canvas): runs the SAME applyImageGripDrag SSoT the commit/ghost run,
          pushing the live position/width/height/rotation to EntityPropsLivePreviewStore so the
          left object inspector tracks the drag (sibling of TextGripRibbonSyncMount, ADR-557). */}
      <ImagePropsGripSyncMount dragPreview={gripDragPreview} levelManager={levelManager} />
      {/* ADR-581 Φ6 — «σύριγγα» live hover ghost: self-subscribes to hover / brush /
          activeTool; paints the WYSIWYG preview (style + reshaped geometry) of the
          hovered target BEFORE the click. Store-driven → no payload prop. */}
      <MatchHoverGhostPreviewMount
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <MepFixtureGhostPreviewMount
        {...mepFixtureGhost}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      {/* ADR-415 — floorplan-symbol 2D placement ghost (WYSIWYG, sibling of the MEP fixture ghost). */}
      <FloorplanSymbolGhostPreviewMount
        {...floorplanSymbolGhost}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <ElectricalPanelGhostPreviewMount
        {...electricalPanelGhost}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <MepManifoldGhostPreviewMount
        {...mepManifoldGhost}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <MepRadiatorGhostPreviewMount
        {...mepRadiatorGhost}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <MepBoilerGhostPreviewMount
        {...mepBoilerGhost}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <MepWaterHeaterGhostPreviewMount
        {...mepWaterHeaterGhost}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <MepSegmentGhostPreviewMount
        {...mepSegmentGhost}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      {/* ADR-554 — ONE proposal dispatch canvas replaces the 7 separate ProposalGhostOverlay canvases
          (water/drainage/heating/electrical/hvac/fire/gas — ADR-426–434 Slice 2). Pull model with
          zero-lag immediate transform; paint verbatim; z-order water→gas (topmost). Persists across
          idle/pan/zoom on its own canvas, never wiped by the shared PreviewCanvas. */}
      <ProposalDispatchCanvas viewport={viewport} />
      {/* ADR-441 Slice 3-perf — zero-lag follow ghost: hosted πεδιλοδοκοί ακολουθούν
          τον dragged οδηγό frame-for-frame (dedicated canvas, mount μόνο όσο σύρεται). */}
      <GuideFollowGhostPreviewMount transform={transform} viewport={viewport} levelManager={levelManager} />
      {/* ADR-435 Slice 1 — clash-detection report overlay (low-freq store, inert while idle). */}
      <ClashOverlayMount transform={transform} getCanvas={getCanvas} getViewportElement={getViewportElement} />
      {/* ADR-650 M5α — topography QA markers (low-freq report store, inert until «Έλεγχος ποιότητας»). */}
      <TopoQaOverlayMount transform={transform} getCanvas={getCanvas} getViewportElement={getViewportElement} />
      <SlabOpeningGhostPreviewMount {...slabOpeningGhost} transform={transform} getCanvas={getCanvas} getViewportElement={getViewportElement} />
      <OpeningGhostPreviewMount {...openingGhost} transform={transform} getCanvas={getCanvas} getViewportElement={getViewportElement} />
      <GripDimAnnotationMount dragPreview={gripDragPreview} levelManager={levelManager} transform={transform} getCanvas={getCanvas} getViewportElement={getViewportElement} />
      {/* ADR-362 Phase J4 (Round 21) + Round 23 — associated dimensions follow a
          Move/grip/rotate/mirror/scale/stretch drag LIVE (recompute per frame via the
          SAME applyAssociationUpdates SSoT the release commits). Rotate/mirror state =
          props (same the entity ghost mounts get); scale/stretch read their own stores
          inside the hook. Mounted AFTER the entity-ghost mounts so its skip-clear layer
          paints on top of their frame. */}
      <DimAssociationGhostPreviewMount
        movePhase={move.phase}
        moveBasePoint={move.basePoint}
        moveSelectedEntityIds={selectedEntityIds}
        gripDragPreview={gripDragPreview}
        rotationPhase={rotation.phase}
        rotationBasePoint={rotation.basePoint}
        rotationAngle={rotation.currentAngle}
        mirrorPhase={mirror.phase}
        mirrorFirstPoint={mirror.firstPoint}
        mirrorSecondPoint={mirror.secondPoint}
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <OpeningTagDragMount
        transform={transform}
        getViewportElement={getViewportElement}
        currentLevelId={levelManager.currentLevelId}
        getLevelScene={levelManager.getLevelScene}
        setLevelScene={levelManager.setLevelScene}
      />
      {/* ADR-408 Φ7 FU#3 — editable home-run wire waypoints (active circuit). */}
      <MepWireWaypointDragMount
        transform={transform}
        getViewportElement={getViewportElement}
        currentLevelId={levelManager.currentLevelId}
        getLevelScene={levelManager.getLevelScene}
      />
    </>
  );
});
