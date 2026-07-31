/**
 * Τα ghost-preview payloads που το `CanvasSection` περνά στο `CanvasLayerStack`.
 *
 * Ήταν 11 γραμμές inline JSX props μέσα στον orchestrator — μία γραμμή ανά εργαλείο
 * τοποθέτησης, καθεμιά με τη δική της logic (host resolver, μονάδες σκηνής, mm→scene).
 * Κάθε νέο εργαλείο μεγάλωνε το `CanvasSection.tsx` προς το όριο των 500 γραμμών χωρίς
 * να προσθέτει τίποτα στην ευθύνη του: ο orchestrator ενορχηστρώνει, δεν χτίζει payloads.
 *
 * ⚠️ ADR-040: καθαρή συνάρτηση, ΚΑΜΙΑ συνδρομή σε store. Καλείται στο render και οι
 * κλειστές συναρτήσεις (`getHostSlab`, `getSceneUnits`, …) διαβάζουν στον χρόνο του
 * event — ίδια σημασιολογία με το inline block που αντικατέστησε.
 */

import { gripKindOf } from '../../hooks/grip-kinds';
import { resolveSceneUnits, mmToSceneUnits } from '../../utils/scene-units';
import { DEFAULT_DUCT_WIDTH_MM, DEFAULT_PIPE_DIAMETER_MM } from '../../bim/types/mep-segment-types';
import { isWallEntity, isSlabEntity } from '../../types/entities';
import type { WallEntity } from '../../bim/types/wall-types';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { useSpecialTools } from '../../hooks/tools';
import type { UnifiedGripInfo } from '../../hooks/grips/unified-grip-types';
import type { CanvasLayerStackProps } from './canvas-layer-stack-types';

/** Τα ghost-preview props του stack — Pick, ώστε το σχήμα να μένει SSoT στο types module. */
export type CanvasSectionGhostPreviews = Pick<
  CanvasLayerStackProps,
  | 'mepFixtureGhostPreview'
  | 'floorplanSymbolGhostPreview'
  | 'attachImageGhostPreview'
  | 'electricalPanelGhostPreview'
  | 'mepManifoldGhostPreview'
  | 'mepRadiatorGhostPreview'
  | 'mepBoilerGhostPreview'
  | 'mepWaterHeaterGhostPreview'
  | 'mepSegmentGhostPreview'
  | 'slabOpeningGhostPreview'
  | 'openingGhostPreview'
>;

export interface CanvasSectionGhostPreviewDeps {
  /** Ολόκληρο το αποτέλεσμα του `useSpecialTools` — τα εργαλεία διαβάζονται ονομαστικά. */
  tools: ReturnType<typeof useSpecialTools>;
  levelManager: CanvasLayerStackProps['levelManager'];
  /** Η λαβή κάτω από τον κέρσορα (ADR-574 Σ2b — edge-midpoint highlight στο slab opening). */
  hoveredGrip: UnifiedGripInfo | null;
}

/** Χτίζει τα ghost-preview payloads για ένα render του `CanvasLayerStack`. */
export function buildCanvasSectionGhostPreviews(
  deps: CanvasSectionGhostPreviewDeps,
): CanvasSectionGhostPreviews {
  const { tools, levelManager, hoveredGrip } = deps;
  const getSceneUnits = () => {
    const lvl = levelManager.currentLevelId;
    return resolveSceneUnits(lvl ? levelManager.getLevelScene(lvl) : null);
  };
  /** «Βρες τον host στο τρέχον level» — ΕΝΑ resolver για slab-opening + opening. */
  const findOnCurrentLevel = (id: string | null | undefined) => {
    const lvl = levelManager.currentLevelId;
    if (!id || !lvl) return null;
    const scene = levelManager.getLevelScene(lvl);
    return scene?.entities.find((x) => x.id === id) ?? null;
  };

  return {
    mepFixtureGhostPreview: { isAwaitingPosition: tools.mepFixtureTool.isAwaitingPosition, getGhostFootprint: tools.mepFixtureTool.getGhostFootprint },
    floorplanSymbolGhostPreview: { isAwaitingPosition: tools.floorplanSymbolTool.isAwaitingPosition, getGhostFootprint: tools.floorplanSymbolTool.getGhostFootprint },
    attachImageGhostPreview: { isAwaitingPosition: tools.attachImageTool.isAwaitingPosition },
    electricalPanelGhostPreview: { isAwaitingPosition: tools.electricalPanelTool.isAwaitingPosition, getGhostFootprint: tools.electricalPanelTool.getGhostFootprint },
    mepManifoldGhostPreview: { isAwaitingPosition: tools.mepManifoldTool.isAwaitingPosition, getGhostFootprint: tools.mepManifoldTool.getGhostFootprint },
    mepRadiatorGhostPreview: { isAwaitingPosition: tools.mepRadiatorTool.isAwaitingPosition, getGhostFootprint: tools.mepRadiatorTool.getGhostFootprint },
    mepBoilerGhostPreview: { isAwaitingPosition: tools.mepBoilerTool.isAwaitingPosition, getGhostFootprint: tools.mepBoilerTool.getGhostFootprint, getGhostSymbol: tools.mepBoilerTool.getGhostSymbol },
    mepWaterHeaterGhostPreview: { isAwaitingPosition: tools.mepWaterHeaterTool.isAwaitingPosition, getGhostFootprint: tools.mepWaterHeaterTool.getGhostFootprint },
    mepSegmentGhostPreview: {
      isAwaitingEnd: tools.mepSegmentTool.isAwaitingEnd,
      getGhostSegment: () => {
        const st = tools.mepSegmentTool.state;
        if (!st.startPoint) return null;
        const widthMm = st.domain === 'pipe'
          ? (st.overrides.diameter ?? DEFAULT_PIPE_DIAMETER_MM)
          : (st.overrides.width ?? DEFAULT_DUCT_WIDTH_MM);
        return { startPoint: st.startPoint, sectionWidthCanvas: widthMm * mmToSceneUnits(getSceneUnits()), domain: st.domain };
      },
    },
    slabOpeningGhostPreview: {
      isAwaitingPosition: tools.slabOpeningTool.isAwaitingPosition,
      kind: tools.slabOpeningTool.state.kind,
      overrides: tools.slabOpeningTool.state.overrides,
      getHostSlab: () => {
        const e = findOnCurrentLevel(tools.slabOpeningTool.state.hostSlabId);
        return e && isSlabEntity(e) ? (e as SlabEntity) : null;
      },
      hoveredEdgeMidpointGrip: hoveredGrip && gripKindOf(hoveredGrip, 'slab-opening')?.startsWith('slab-opening-edge-midpoint-') ? hoveredGrip : null,
      getSceneUnits,
    },
    openingGhostPreview: {
      isAwaitingPosition: tools.openingTool.isAwaitingPosition,
      kind: tools.openingTool.state.kind,
      overrides: tools.openingTool.state.overrides,
      getHostWall: () => {
        const e = findOnCurrentLevel(tools.openingTool.state.hostWallId);
        return e && isWallEntity(e) ? (e as WallEntity) : null;
      },
      getSceneUnits,
    },
  };
}
