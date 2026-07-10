'use client';
/**
 * 🏢 ENTERPRISE: useSpecialTools Hook
 *
 * @description Manages special entity creation tools (CircleTTT, LinePerpendicular, LineParallel)
 * @see ADR-XXX: CanvasSection Decomposition
 *
 * Responsibilities:
 * - Initialize and manage Circle TTT tool state
 * - Initialize and manage Line Perpendicular tool state
 * - Initialize and manage Line Parallel tool state
 * - Auto-activate/deactivate based on activeTool
 *
 * Pattern: Single Responsibility Principle - Tool Management
 * Extracted from: CanvasSection.tsx
 */
import { useEffect } from 'react';
import { clearAutoAreaState } from '../../systems/auto-area/AutoAreaResultStore';
import { clearAutoAreaPreview } from '../../systems/auto-area/AutoAreaPreviewStore';
import { useStairTool } from '../drawing/useStairTool';
// ADR-619 — «Σκάλα από περιοχή»: ελεύθερο πολύγωνο → auto BIM σκάλα (shape → type).
import { useStairRegionSketch } from '../drawing/use-stair-region-sketch';
import { useWallTool } from '../drawing/useWallTool';
import { useOpeningTool } from '../drawing/useOpeningTool';
import { useSelfOpeningTool } from '../drawing/useSelfOpeningTool';
import { useColumnTool } from '../drawing/useColumnTool';
import { useFoundationTool } from '../drawing/useFoundationTool';
import { useBeamTool } from '../drawing/useBeamTool';
import { useBeamBetweenMembersTool } from '../drawing/useBeamBetweenMembersTool';
import { useSlabOpeningTool } from '../drawing/useSlabOpeningTool';
import { buildSlabOpeningResolvers } from './useSpecialTools-slab-opening';
import { useWallRetrimEffect } from './useSpecialTools-wall-retrim';
import { buildOpeningResolvers, buildSelfOpeningResolvers } from './useSpecialTools-opening';
// ADR-615 — free-standing (self-hosted) opening tool commandKey SSoT (shared
// with the ribbon `structural-tab.ts` descriptor).
import { SELF_OPENING_TOOL_COMMAND_KEY } from '../../ui/ribbon/hooks/bridge/opening-command-keys';
import { useToolLifecycle } from './useToolLifecycle';
// ADR-419 — region tool-id → method SSoT (split του «σε περιοχή» σε 3 εντολές).
import {
  isColumnRegionTool,
  isWallRegionTool,
  columnRegionMethod,
  wallRegionMethod,
} from '../../systems/tools/region-tool-ids';
import { resolveSceneUnits } from '../../utils/scene-units';
import { useFloorMetadata } from '../data/useFloorMetadata';
import type { StairFloorLinkInput } from '../drawing/stair-completion';
import { useSpecialToolsSelectionTools, type SelectionToolsReturn } from './useSpecialTools-selection-tools';
// ADR-408 — MEP + furnishing single/2-click placement tools extracted (N.7.1).
import { useSpecialToolsPlacementTools, type PlacementToolsReturn } from './useSpecialTools-placement-tools';
// ADR-417/419/422/437 — slab/roof/floor-finish/underfloor/thermal-space/space-separator
// area & space tools extracted to a sub-hook (N.7.1).
import { useSpecialToolsAreaTools, type AreaToolsReturn } from './useSpecialTools-area-tools';
import { addWallToScene } from '../../bim/walls/add-wall-to-scene';
import { useRegionGapClose } from '../drawing/use-region-gap-close';
import { useWallAutoTyping } from '../../bim/family-types/useWallAutoTyping';
import { addColumnToScene, addColumnsToScene } from '../../bim/columns/add-column-to-scene';
// ADR-619 — shared stair append+broadcast SSoT (line-based 'stair' + 'stair-from-region').
import { addStairToScene } from '../../bim/stairs/add-stair-to-scene';
import { addFoundationToScene } from '../../bim/foundations/add-foundation-to-scene';
import { buildFoundationWriteScope } from '../../bim/foundations/foundation-write-scope';
import { useAuth } from '@/auth/hooks/useAuth';
// ADR-397 — slab / roof / beam draw delegate to the `appendEntityToScene` SSoT.
// Column draw + Ctrl-copy go through `addColumnToScene` (same SSoT, 'column' tag).
import { appendEntityToScene } from '../../bim/scene/append-entity-to-scene';
// 🏢 ENTERPRISE: Import actual level system types for type safety
import type { LevelsHookReturn } from '../../systems/levels';

// TYPES & INTERFACES
/**
 * Props for useSpecialTools hook
 */
export interface UseSpecialToolsProps {
  /** Current active tool */
  activeTool: string;
  /** Level manager for scene access - uses actual LevelsHookReturn type */
  levelManager: LevelsHookReturn;
}
/**
 * Return type of useSpecialTools hook
 * Uses ReturnType to automatically match the actual hook return types
 */
export interface UseSpecialToolsReturn extends SelectionToolsReturn, PlacementToolsReturn, AreaToolsReturn {
  // SelectionToolsReturn provides: circleTTT, lineParallel, angleEntityMeasurement
  // (extracted to useSpecialTools-selection-tools.ts). ADR-060: «κάθετη γραμμή» έγινε drawing tool.
  // PlacementToolsReturn provides: mepFixtureTool, furnitureTool,
  // floorplanSymbolTool, electricalPanelTool, mepManifoldTool, mepRadiatorTool,
  // mepBoilerTool, mepWaterHeaterTool, mepSegmentTool, railingTool (extracted to useSpecialTools-placement-tools.ts).
  // AreaToolsReturn provides: slabTool, roofTool, floorFinishTool, mepUnderfloorTool,
  // thermalSpaceTool, spaceSeparatorTool (extracted to useSpecialTools-area-tools.ts).
  stairTool: ReturnType<typeof useStairTool>;
  /** ADR-619 — «Σκάλα από περιοχή» polygon-sketch tool (shape → stair type). */
  stairRegionTool: ReturnType<typeof useStairRegionSketch>;
  wallTool: ReturnType<typeof useWallTool>;
  openingTool: ReturnType<typeof useOpeningTool>;
  selfOpeningTool: ReturnType<typeof useSelfOpeningTool>;
  columnTool: ReturnType<typeof useColumnTool>;
  foundationTool: ReturnType<typeof useFoundationTool>; // ADR-436
  beamTool: ReturnType<typeof useBeamTool>;
  beamBetweenMembersTool: ReturnType<typeof useBeamBetweenMembersTool>;
  slabOpeningTool: ReturnType<typeof useSlabOpeningTool>;
}
// HOOK IMPLEMENTATION
/**
 * 🏢 ENTERPRISE: Special entity creation tools hook
 *
 * This hook manages the state and activation of special drawing tools
 * that require entity selection (CircleTTT, LineParallel).
 *
 * @example
 * ```tsx
 * const {
 *   circleTTT,
 *   lineParallel,
 * } = useSpecialTools({
 *   activeTool,
 *   levelManager,
 * });
 * ```
 */
export function useSpecialTools(props: UseSpecialToolsProps): UseSpecialToolsReturn {
  const { activeTool, levelManager } = props;
  // ADR-484 — auth scope για το Revit-canonical foundation level redirect
  // (πέδιλα πάντα στον foundation level μέσω cross-level writer όταν ο ενεργός διαφέρει).
  const { user } = useAuth();
  // ADR-358 Phase 9 — Q17 floor link source for the stair tool. Any populated
  // `floorId` on the save context activates the bridge; the builder seeds
  // `multiStoryConfig.storyHeight` (mm) from the floor `height` (m) at commit
  // time. Building-level / property-level contexts have no floorId and the
  // builder falls back to Phase 7a behavior (no auto-init).
  const floorIdForStair = levelManager.saveContext?.floorId ?? null;
  const floorForStair = useFloorMetadata(floorIdForStair);

  // ADR-397/419 — the scene-units resolver + live-entities reader every tool config below
  // needs, defined ONCE (N.18) instead of copy-pasted as an inline arrow per tool. Both close
  // over `levelManager`; `resolveSceneUnits` prefers the real `$INSUNITS` units and falls back
  // to the bounds heuristic. Recreated each render exactly like the former inline callbacks.
  const getSceneUnitsForLevel = () => {
    const levelId = levelManager.currentLevelId;
    if (!levelId) return 'mm';
    return resolveSceneUnits(levelManager.getLevelScene(levelId));
  };
  const getSceneEntitiesForLevel = () => {
    const levelId = levelManager.currentLevelId;
    if (!levelId) return [];
    return levelManager.getLevelScene(levelId)?.entities ?? [];
  };

  // Selection-based geometry tools (CircleTTT / LineParallel / AngleEntityMeasurement)
  // — extracted to useSpecialTools-selection-tools.ts (N.7.1). ADR-060: «κάθετη γραμμή» → drawing tool.
  const { circleTTT, lineParallel, angleEntityMeasurement } =
    useSpecialToolsSelectionTools({ activeTool, levelManager });

  // ADR-358 Phase 5a — STAIR TOOL

  /**
   * Stair drawing tool — 2-click placement (basePoint + direction) + commit.
   * State machine in `useStairTool`. Variant fixed to 'straight' Phase 5a;
   * contextual ribbon variant selector lands Phase 7a.
   */
  // ADR-358 Phase 9 — Q17 floor link bridge (SSoT shared by BOTH the line-based
  // stair tool and «Σκάλα από περιοχή», ADR-619). Returns a snapshot of the floor
  // in scope so the stair builder seeds `multiStoryConfig`.
  const getStairFloorLink = (): StairFloorLinkInput | null => {
    if (!floorForStair) return null;
    return {
      floorId: floorForStair.id,
      name: floorForStair.name,
      height: floorForStair.height,
    };
  };
  // ADR-358 Phase 9C — floor stamp (floorId + buildingId) που κολλάει στη σκάλα για
  // το Firestore link (required για Plan B batch update). Κοινό και στα δύο tools.
  const stairFloorStamp = { floorId: floorIdForStair, buildingId: floorForStair?.buildingId };

  const stairTool = useStairTool({
    currentLevelId: levelManager.currentLevelId || '0',
    // ADR-358 Phase 8 unit-aware builder — convert mm defaults into the active
    // scene's coordinate units so the stair geometry matches the host DXF.
    // `resolveSceneUnits` (utils/scene-units SSoT) prefers the real
    // `$INSUNITS`-propagated `scene.units` and falls back to the bounds
    // heuristic for legacy / unitless scenes.
    getSceneUnits: getSceneUnitsForLevel,
    getFloorLink: getStairFloorLink,
    // ADR-397/619 — append + broadcast via the shared `addStairToScene` SSoT (ίδιο
    // path με το «Σκάλα από περιοχή»· floorId/buildingId stamp + setLevelScene + emit).
    onStairCreated: (stairEntity) =>
      addStairToScene(stairEntity, levelManager, stairFloorStamp, 'stair'),
  });

  useToolLifecycle(activeTool === 'stair', stairTool.activate, stairTool.deactivate);

  // ADR-619 — «ΣΚΑΛΑ ΑΠΟ ΠΕΡΙΟΧΗ» (stair-from-region)
  //
  // Ο χρήστης σχεδιάζει ελεύθερα κλειστό πολύγωνο γύρω από το κλιμακοστάσιο (κοινό
  // vertex-chain FSM με slab/column-from-polygon)· στο commit το ΣΧΗΜΑ ταξινομείται
  // (ευθεία/τεταρτοστροφική/ημιστροφική/ελικοειδής) και χτίζεται αυτόματα BIM σκάλα
  // «χωμένη» στην περιοχή. Ίδιο append+broadcast path με το line-based tool.
  const stairRegionTool = useStairRegionSketch({
    currentLevelId: levelManager.currentLevelId || '0',
    getSceneUnits: getSceneUnitsForLevel,
    getSceneEntities: getSceneEntitiesForLevel,
    getFloorLink: getStairFloorLink,
    onStairCreated: (stairEntity) =>
      addStairToScene(stairEntity, levelManager, stairFloorStamp, 'stair-from-region'),
  });
  useToolLifecycle(
    activeTool === 'stair-from-region',
    stairRegionTool.activate,
    stairRegionTool.deactivate,
  );
  // ADR-412 — auto-type-on-create (Revit «Generic Wall»): give every freshly
  // drawn wall a shared family type before it lands in the scene (SSoT host).
  const { ensureAutoWallType } = useWallAutoTyping();
  // ADR-363 Phase 1B — WALL TOOL
  /**
   * Wall drawing tool — 2-click placement (startPoint → endPoint) + commit.
   * State machine in `useWallTool`. Default kind = 'straight' (Phase 1B);
   * curved + polyline land Phase 1.5. Continuous draw (chains walls back-to-
   * back, ESC returns to 'select'). The created `WallEntity` is appended to
   * the scene AND broadcast via `EventBus` so `useWallPersistence` can
   * schedule the first Firestore save without waiting for user selection.
   */
  const wallTool = useWallTool({
    currentLevelId: levelManager.currentLevelId || '0',
    getSceneUnits: getSceneUnitsForLevel,
    // ADR-363 Phase 1J — live scene entities for the on-entity placement mode
    // (hit-test of existing 2D lines/rectangles under the click).
    getSceneEntities: getSceneEntitiesForLevel,
    // ADR-363 Phase 1G.4 — append + trim + broadcast via the shared SSoT
    // (`addWallToScene`) so the DRAW path and the Ctrl-COPY hot-grip path use
    // ONE insertion routine (N.0.2 — no copy-paste of the persistence trigger).
    onWallCreated: (wallEntity) => addWallToScene(ensureAutoWallType(wallEntity), levelManager),
  });
  // ADR-363 Phase 1J — both the freehand wall tool ('wall') and the on-entity
  // variant ('wall-on-entity') share ONE useWallTool instance; lifecycle covers
  // both ids and the placement mode is driven by the active tool id.
  // ADR-363 Phase 1J/1K — the freehand wall ('wall'), the on-entity variant
  // ('wall-on-entity') and the in-region variant ('wall-in-region') all share
  // ONE useWallTool instance; the placement mode is driven by the active tool id.
  const isWallTool =
    activeTool === 'wall' ||
    activeTool === 'wall-on-entity' ||
    isWallRegionTool(activeTool) ||
    activeTool === 'wall-from-perimeter';
  useToolLifecycle(isWallTool, wallTool.activate, wallTool.deactivate);
  useEffect(() => {
    if (activeTool === 'wall') wallTool.setPlacementMode('freehand');
    else if (activeTool === 'wall-on-entity') wallTool.setPlacementMode('on-entity');
    else if (activeTool === 'wall-from-perimeter') wallTool.setPlacementMode('outer-perimeter');
    else {
      // ADR-419 — wall-region-lines/inside/box → in-region + αντίστοιχο method.
      const method = wallRegionMethod(activeTool);
      if (method) {
        wallTool.setPlacementMode('in-region');
        wallTool.setRegionMethod(method);
      }
    }
  }, [activeTool, wallTool.setPlacementMode, wallTool.setRegionMethod]);
  // ADR-363 Phase 2 — OPENING TOOL (resolvers extracted: useSpecialTools-opening.ts)
  const openingTool = useOpeningTool(buildOpeningResolvers(levelManager));
  useToolLifecycle(activeTool === 'opening', openingTool.activate, openingTool.deactivate);
  // ADR-615 — FREE-STANDING (self-hosted) OPENING TOOL. Mirrors the wall-hosted
  // opening tool wiring above (resolvers extracted: useSpecialTools-opening.ts),
  // but built on `createSingleClickPlacementTool` (ADR-600) instead of a bespoke
  // FSM — activation gate is the shared `SELF_OPENING_TOOL_COMMAND_KEY` literal.
  const selfOpeningTool = useSelfOpeningTool(buildSelfOpeningResolvers(levelManager));
  useToolLifecycle(
    activeTool === SELF_OPENING_TOOL_COMMAND_KEY,
    selfOpeningTool.activate,
    selfOpeningTool.deactivate,
  );
  // ADR-417/419/422/437 — slab / roof / floor-finish / underfloor / thermal-space /
  // space-separator area & space tools (footprint-polygon + click-in-region + 2-click
  // line). Extracted to a sub-hook (N.7.1); each shares the scene-units resolver +
  // lifecycle pattern and the active tool id drives activation.
  const {
    slabTool,
    roofTool,
    floorFinishTool,
    wallCoveringTool,
    mepUnderfloorTool,
    thermalSpaceTool,
    spaceSeparatorTool,
  } = useSpecialToolsAreaTools({ activeTool, levelManager });
  // ADR-363 Phase 4 — COLUMN TOOL
  /**
   * Column drawing tool — single-click placement με 9-position anchor + Tab
   * cycling + free rotation. State machine in `useColumnTool`. Continuous chain.
   * The created `ColumnEntity` is appended to the scene AND broadcast via
   * `EventBus` so `useColumnPersistence` can schedule the first Firestore save.
   */
  const columnTool = useColumnTool({
    currentLevelId: levelManager.currentLevelId || '0',
    // ADR-397 — append + broadcast via the shared SSoT (`addColumnToScene`) so
    // the DRAW path and the Ctrl-COPY hot-grip path use ONE insertion routine.
    onColumnCreated: (columnEntity) => addColumnToScene(columnEntity, levelManager),
    // ADR-524 — multi-column paths (region box / discrete-perimeter / batch-fill) μέσω
    // ΕΝΟΣ adapter (`addColumnsToScene`): N× single-add → stale-scene race → χάνονται
    // κολόνες + σπάει το auto-foundation. Batch = όλες μαζί + ΕΝΑ undo.
    onColumnsCreated: (columnEntities) => addColumnsToScene(columnEntities, levelManager),
    getSceneUnits: getSceneUnitsForLevel,
    // ADR-363 Φάση 3 — live scene entities για το «Τοιχίο από περίγραμμα» (ανάλυση
    // των παρειών στο box-select / click-inside).
    getSceneEntities: getSceneEntitiesForLevel,
  });
  // ADR-363 Φ3/3c — freehand + «από περίγραμμα» (outer/discrete) μοιράζονται ΕΝΑ
  // useColumnTool· το placement mode οδηγείται από το active tool id.
  const isColumnTool =
    activeTool === 'column' ||
    activeTool === 'column-from-perimeter' ||
    activeTool === 'column-discrete-from-perimeter' ||
    activeTool === 'column-discrete-from-perimeter-walls' ||
    activeTool === 'column-from-polygon' ||
    isColumnRegionTool(activeTool);
  useToolLifecycle(isColumnTool, columnTool.activate, columnTool.deactivate);
  useEffect(() => {
    if (activeTool === 'column') columnTool.setPlacementMode('freehand');
    // ADR-363 §column-polygon-sketch — σχεδιασμένο πολύγωνο (vertex chain, όπως slab).
    else if (activeTool === 'column-from-polygon') columnTool.setPlacementMode('polygon');
    else if (activeTool === 'column-from-perimeter') columnTool.setPlacementMode('outer-perimeter');
    // ADR-419 — «Πολλαπλή δημιουργία»: ίδιο discrete-perimeter mode, διαφορετικό intent.
    else if (activeTool === 'column-discrete-from-perimeter') {
      columnTool.setPlacementMode('discrete-perimeter');
      columnTool.setDiscreteIntent('columns');
    } else if (activeTool === 'column-discrete-from-perimeter-walls') {
      columnTool.setPlacementMode('discrete-perimeter');
      columnTool.setDiscreteIntent('walls');
    } else {
      // ADR-419 — column-region-lines/inside/box → in-region + αντίστοιχο method.
      const method = columnRegionMethod(activeTool);
      if (method) {
        columnTool.setPlacementMode('in-region');
        columnTool.setRegionMethod(method);
      }
    }
  }, [activeTool, columnTool.setPlacementMode, columnTool.setRegionMethod, columnTool.setDiscreteIntent]);

  // ADR-436 Slice 1 — foundation pad tool (point-based single-click + Tab anchor).
  // The created `FoundationEntity` is appended + broadcast via `addFoundationToScene`
  // (shared `appendEntityToScene` SSoT, 'foundation' tag).
  const foundationTool = useFoundationTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onFoundationCreated: (foundationEntity) => {
      const scope = buildFoundationWriteScope(user, levelManager.levels, levelManager.currentLevelId);
      addFoundationToScene(foundationEntity, levelManager, scope);
    },
    getSceneUnits: getSceneUnitsForLevel,
    // ADR-436 Slice 2 «Πεδιλοδοκός από τοίχο» — live scene entities for the from-wall pick.
    getSceneEntities: getSceneEntitiesForLevel,
  });
  // ADR-436 — the 3 freehand foundation tools + the from-wall variant share ONE
  // useFoundationTool instance; the `kind` is fixed by the active tool id (Revit
  // 3 separate foundation tools, NOT a switchable combobox) and placement mode
  // follows the tool. The pad single-click FSM and the strip/tie-beam line FSM
  // both live in the same hook.
  const isFoundationTool =
    activeTool === 'foundation-pad' ||
    activeTool === 'foundation-strip' ||
    activeTool === 'foundation-tie-beam' ||
    activeTool === 'foundation-strip-from-wall';
  useToolLifecycle(isFoundationTool, foundationTool.activate, foundationTool.deactivate);
  useEffect(() => {
    if (activeTool === 'foundation-pad') { foundationTool.setKind('pad'); foundationTool.setPlacementMode('freehand'); }
    else if (activeTool === 'foundation-strip') { foundationTool.setKind('strip'); foundationTool.setPlacementMode('freehand'); }
    else if (activeTool === 'foundation-tie-beam') { foundationTool.setKind('tie-beam'); foundationTool.setPlacementMode('freehand'); }
    else if (activeTool === 'foundation-strip-from-wall') { foundationTool.setKind('strip'); foundationTool.setPlacementMode('from-wall'); }
  }, [activeTool, foundationTool.setKind, foundationTool.setPlacementMode]);
  // ADR-406/407/408/410/415 — MEP + furnishing single/2-click placement tools
  // (mepFixture, furniture, floorplanSymbol, electricalPanel, mepManifold,
  // mepRadiator, mepBoiler, mepSegment, railing). Extracted to a sub-hook (N.7.1) — each
  // shares the same scene-units resolver + lifecycle pattern; the active tool id
  // drives activation and preset selection.
  const {
    mepFixtureTool,
    furnitureTool,
    floorplanSymbolTool,
    electricalPanelTool,
    mepManifoldTool,
    mepRadiatorTool,
    mepBoilerTool,
    mepWaterHeaterTool,
    mepSegmentTool,
    mepRiserTool,
    railingTool,
  } = useSpecialToolsPlacementTools({ activeTool, levelManager });

  // ============================================================================
  // ADR-363 Phase 5 — BEAM TOOL
  // ============================================================================
  /**
   * Beam drawing tool — 2-click (straight/cantilever) ή 3-click (curved).
   * State machine in `useBeamTool`. Continuous chain. The created `BeamEntity`
   * is appended to the scene AND broadcast via `EventBus` so
   * `useBeamPersistence` can schedule the first Firestore save.
   */
  const beamTool = useBeamTool({
    currentLevelId: levelManager.currentLevelId || '0',
    getSceneUnits: getSceneUnitsForLevel,
    // ADR-363 «Δοκάρι από τοίχο» — live scene entities for the from-wall pick.
    getSceneEntities: getSceneEntitiesForLevel,
    onBeamCreated: (beamEntity) => appendEntityToScene(levelManager, beamEntity, 'beam'),
  });
  // ADR-363 — the freehand beam ('beam') and the from-wall variant
  // ('beam-from-wall') share ONE useBeamTool instance; placement mode follows
  // the active tool id. Creating the beam broadcasts `drawing:entity-created`,
  // so `useStructuralAutoAttach` (ADR-401 D) auto-attaches the wall top.
  const isBeamTool = activeTool === 'beam' || activeTool === 'beam-from-wall';
  useToolLifecycle(isBeamTool, beamTool.activate, beamTool.deactivate);
  useEffect(() => {
    if (activeTool === 'beam') beamTool.setPlacementMode('freehand');
    else if (activeTool === 'beam-from-wall') beamTool.setPlacementMode('from-wall');
  }, [activeTool, beamTool.setPlacementMode]);
  // ============================================================================
  // ADR-569 — «ΔΟΚΑΡΙ ΑΝΑΜΕΣΑ ΣΕ ΜΕΛΗ»
  // ============================================================================
  // Σειριακά κλικ σε κολόνες/τοιχία → δοκάρι ανά διαδοχικό ζεύγος (παρειά→παρειά). Reuse του ΙΔΙΟΥ
  // commit path με το freehand δοκάρι (`appendEntityToScene(..., 'beam')` → undo + Firestore autosave
  // + ADR-567 overlap guard). Αντίστροφη ροή: ≥2 προεπιλεγμένα μέλη → άμεσο δοκάρι στην ενεργοποίηση.
  const beamBetweenMembersTool = useBeamBetweenMembersTool({
    currentLevelId: levelManager.currentLevelId || '0',
    getSceneUnits: getSceneUnitsForLevel,
    getSceneEntities: getSceneEntitiesForLevel,
    onBeamCreated: (beamEntity) => appendEntityToScene(levelManager, beamEntity, 'beam'),
  });
  useToolLifecycle(activeTool === 'beam-between-members', beamBetweenMembersTool.activate, beamBetweenMembersTool.deactivate);
  // ADR-363 Phase 3.7 — SLAB-OPENING TOOL (resolvers extracted: useSpecialTools-slab-opening.ts)
  const slabOpeningTool = useSlabOpeningTool(buildSlabOpeningResolvers(levelManager));
  useToolLifecycle(activeTool === 'slab-opening', slabOpeningTool.activate, slabOpeningTool.deactivate);
  // ADR-363 Phase 1E — Re-trim all walls after a grip commit settles (extracted helper).
  useWallRetrimEffect(levelManager);
  // ADR-419 §gap-close — «Να κλείσω το κενό;» όταν το region/perimeter pick βρίσκει
  // ανοιχτό βρόχο· «Ναι» προσθέτει τη γραμμή-ένωσης (levelManager = scene accessor).
  useRegionGapClose(levelManager);
  // AUTO AREA — clear result panel when tool changes away
  useEffect(() => {
    if (activeTool !== 'auto-measure-area') {
      clearAutoAreaState();
      clearAutoAreaPreview();
    }
  }, [activeTool]);
  // RETURN
  return {
    circleTTT,
    lineParallel,
    angleEntityMeasurement,
    stairTool,
    stairRegionTool,
    wallTool,
    openingTool,
    selfOpeningTool,
    slabTool,
    roofTool,
    floorFinishTool,
    wallCoveringTool,
    mepUnderfloorTool,
    thermalSpaceTool,
    spaceSeparatorTool,
    columnTool,
    foundationTool,
    mepFixtureTool,
    furnitureTool,
    floorplanSymbolTool,
    electricalPanelTool,
    mepManifoldTool,
    mepRadiatorTool,
    mepBoilerTool,
    mepWaterHeaterTool,
    mepSegmentTool,
    mepRiserTool,
    railingTool,
    beamTool,
    beamBetweenMembersTool,
    slabOpeningTool,
  };
}
export default useSpecialTools;
