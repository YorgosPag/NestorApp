'use client';

/**
 * ADR-358 Phase 8 size-extract — top-bar wrapper estratto da `DxfViewerContent`
 * per rispettare N.7.1 (max 500 righe / file). Raggruppa il `RibbonRoot` con
 * gli always-on BIM persistence hosts (Wall/Opening/Slab/Column/Beam/SlabOpening/
 * Stair) + ausiliari (SlabOpeningStack/PsetEditor/IfcExport). Deriva qui i campi
 * di scope `projectId` / `floorplanId` dal `levelManager` (Phase 8 reactive
 * mirrors).
 *
 * 2026-05-27 — `StairAdvancedPanelHost` rimosso (era gated `{false && ...}`
 * dal sidebar dock 2026-05-17); il suo `useStairPersistence` lifecycle è
 * stato spostato dentro `StairPersistenceHost` always-on per parità con gli
 * altri sei BIM hosts e per chiudere il bug "stair drawn ma non saved in
 * `floorplan_stairs`".
 *
 * Zero subscriptions a high-frequency stores: questo wrapper riceve tutto via
 * props e rispetta CHECK 6B/6C (orchestrator non aggiunge `useSyncExternalStore`).
 */

import React from 'react';
import type { RibbonCommandsApi } from '../ui/ribbon/context/RibbonCommandContext';
import type { RibbonTab } from '../ui/ribbon/types/ribbon-types';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import { RibbonRoot } from '../ui/ribbon/components/RibbonRoot';
import { WallPersistenceHost } from './WallPersistenceHost';
import { OpeningPersistenceHost } from './OpeningPersistenceHost';
import { SlabPersistenceHost } from './SlabPersistenceHost';
import { ColumnPersistenceHost } from './ColumnPersistenceHost';
import { FoundationPersistenceHost } from './FoundationPersistenceHost';
import { GridGuidePersistenceHost } from './GridGuidePersistenceHost';
import { HostingReconcilerHost } from './HostingReconcilerHost';
import { MepFixturePersistenceHost } from './MepFixturePersistenceHost';
import { FurniturePersistenceHost } from './FurniturePersistenceHost';
import { FloorplanSymbolPersistenceHost } from './FloorplanSymbolPersistenceHost';
import { ElectricalPanelPersistenceHost } from './ElectricalPanelPersistenceHost';
import { MepManifoldPersistenceHost } from './MepManifoldPersistenceHost';
import { MepRadiatorPersistenceHost } from './MepRadiatorPersistenceHost';
import { MepBoilerPersistenceHost } from './MepBoilerPersistenceHost';
import { MepWaterHeaterPersistenceHost } from './MepWaterHeaterPersistenceHost';
import { MepUnderfloorPersistenceHost } from './MepUnderfloorPersistenceHost';
import { MepSegmentPersistenceHost } from './MepSegmentPersistenceHost';
import { MepFittingPersistenceHost } from './MepFittingPersistenceHost';
import { MepSystemPersistenceHost } from './MepSystemPersistenceHost';
import { RailingPersistenceHost } from './RailingPersistenceHost';
import { RoofPersistenceHost } from './RoofPersistenceHost';
import { FloorFinishPersistenceHost } from './FloorFinishPersistenceHost';
import { ThermalSpacePersistenceHost } from './ThermalSpacePersistenceHost';
import { SpaceSeparatorPersistenceHost } from './SpaceSeparatorPersistenceHost';
import { BeamPersistenceHost } from './BeamPersistenceHost';
import { SlabOpeningPersistenceHost } from './SlabOpeningPersistenceHost';
import { StairPersistenceHost } from './StairPersistenceHost';
import { SlabOpeningStackHost } from './SlabOpeningStackHost';
import { UserMaterialRegistryHost } from './UserMaterialRegistryHost';
import { PsetEditorHost } from './PsetEditorHost';
import { IfcExportHost } from './IfcExportHost';
import { useFloorMetadata } from '../hooks/data/useFloorMetadata';

type LevelManager = ReturnType<typeof useLevels>;

export interface DxfViewerTopBarProps {
  readonly ribbonCommands: RibbonCommandsApi;
  readonly contextualTabs: readonly RibbonTab[];
  readonly activeContextualTrigger: string | null;
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManager;
}

export function DxfViewerTopBar({
  ribbonCommands,
  contextualTabs,
  activeContextualTrigger,
  primarySelectedId,
  currentScene,
  levelManager,
}: DxfViewerTopBarProps) {
  // ADR-395 Phase 1 (G3+G7) — resolve buildingId + floorId once for all BIM
  // persistence hosts. Import-σε-όροφο δίνει `saveContext.floorId` αλλά ΟΧΙ
  // `buildingId` → χωρίς resolution ο BimToBoqBridge έκανε σιωπηρό skip και η
  // καρτέλα «Επιμετρήσεις» έμενε κενή. 3-tier fallback (saveContext → linked
  // Level → FLOORS doc μέσω useFloorMetadata) + floorId για per-floor grouping.
  const currentLevel = levelManager.levels?.find((l) => l.id === levelManager.currentLevelId);
  // 🛡️ ADR-420 (cross-floor scope leak, incident 2026-06-17) — derive the BIM
  // persistence `floorId` from the DURABLE `Level.floorId`, which TRACKS floor
  // navigation, NOT the volatile `saveContext.floorId` (the DXF save-target of
  // the last import/save, sticky across level switches). Preferring saveContext
  // pinned every floor's BIM scope to the last-imported floor → columns/footings
  // drawn on floor B were queried/written under floor A's `floorId` → they
  // appeared on ALL floors as the same doc (shared delete/undo). Import-σε-όροφο
  // stays correct: `findOrCreateLevelForFloor` links+switches the Level, so
  // `currentLevel.floorId === saveContext.floorId` at import time. A level with
  // no linked floor (manual/project-level) falls back to `saveContext`. Mirrors
  // the durable-first precedence already used for `projectId` below.
  const floorId = currentLevel?.floorId ?? levelManager.saveContext?.floorId ?? undefined;
  // 🛡️ ADR-420 / ADR-399 (incident 2026-06-16) — derive `projectId` from the DURABLE
  // Level identity, not only the volatile DXF save target. The cross-floor guard
  // (`useLevelSceneLoader.resetDxfAutoSaveTarget`) nulls `saveContext`, which used to
  // drop `projectId` → every BIM persistence service de-instantiated → entities drawn
  // on that floor were never saved. The `Level` doc carries a durable `projectId`
  // (wizard-set, ADR-309), so a floor whose own DXF file is missing/cross-linked keeps
  // a valid persistence scope. Pairs with the SSoT gate `resolveBimPersistenceScope`.
  const projectId = levelManager.saveContext?.projectId ?? currentLevel?.projectId ?? undefined;
  const floorMeta = useFloorMetadata(floorId ?? null);
  const buildingId =
    levelManager.saveContext?.buildingId
    ?? currentLevel?.buildingId
    ?? (floorMeta?.buildingId || undefined);

  return (
    <>
      <RibbonRoot
        commands={ribbonCommands}
        contextualTabs={contextualTabs}
        activeContextualTrigger={activeContextualTrigger}
      />
      {/*
        ADR-358 Phase 8 sidebar dock (2026-05-17) — Stair properties moved
        from a right-floating overlay into the left sidebar as the third
        "Properties" tab (industry pattern: VS Code Side Bar / ArchiCAD
        Tray / Revit dockable palettes). The right-floating host is
        disabled to free the canvas right side; flip the conditional back
        on if a future option wants both surfaces.
      */}
      <WallPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={buildingId}
        floorId={floorId}
      />
      <OpeningPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={buildingId}
        floorId={floorId}
      />
      <SlabPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={buildingId}
        floorId={floorId}
      />
      <ColumnPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={buildingId}
        floorId={floorId}
      />
      <FoundationPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        floorId={floorId}
      />
      <GridGuidePersistenceHost
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        floorId={floorId}
      />
      <HostingReconcilerHost levelManager={levelManager} />
      <BeamPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={buildingId}
        floorId={floorId}
      />
      <MepFixturePersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        floorId={floorId}
      />
      <FurniturePersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        floorId={floorId}
      />
      <FloorplanSymbolPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        floorId={floorId}
      />
      <ElectricalPanelPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        floorId={floorId}
      />
      <MepManifoldPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        floorId={floorId}
        buildingId={buildingId}
      />
      <MepRadiatorPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        floorId={floorId}
        buildingId={buildingId}
      />
      <MepBoilerPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        floorId={floorId}
        buildingId={buildingId}
      />
      <MepWaterHeaterPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        floorId={floorId}
        buildingId={buildingId}
      />
      <MepUnderfloorPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        floorId={floorId}
        buildingId={buildingId}
      />
      <MepSegmentPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        floorId={floorId}
        buildingId={buildingId}
      />
      <MepFittingPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        floorId={floorId}
      />
      <MepSystemPersistenceHost
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        floorId={floorId}
        currentScene={currentScene}
        levelManager={levelManager}
        primarySelectedId={primarySelectedId}
      />
      <RailingPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={buildingId}
        floorId={floorId}
      />
      <RoofPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={buildingId}
        floorId={floorId}
      />
      <FloorFinishPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={buildingId}
        floorId={floorId}
      />
      <ThermalSpacePersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={buildingId}
        floorId={floorId}
      />
      <SpaceSeparatorPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={buildingId}
        floorId={floorId}
      />
      <SlabOpeningPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={buildingId}
        floorId={floorId}
      />
      <SlabOpeningStackHost levelManager={levelManager} />
      <StairPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={projectId}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={buildingId}
        floorId={floorId}
      />
      <UserMaterialRegistryHost
        projectId={projectId}
      />
      <PsetEditorHost levelManager={levelManager} />
      <IfcExportHost />
    </>
  );
}
