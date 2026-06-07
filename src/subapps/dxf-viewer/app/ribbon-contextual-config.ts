import React from 'react';
import type { SceneModel } from '../types/scene';
import { isColumnRegionTool, isWallRegionTool } from '../systems/tools/region-tool-ids';
import { CONTEXTUAL_TEXT_EDITOR_TAB, TEXT_EDITOR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-text-editor-tab';
import {
  CONTEXTUAL_ARRAY_RECT_TAB, CONTEXTUAL_ARRAY_POLAR_TAB, CONTEXTUAL_ARRAY_PATH_TAB,
  ARRAY_RECT_CONTEXTUAL_TRIGGER, ARRAY_POLAR_CONTEXTUAL_TRIGGER, ARRAY_PATH_CONTEXTUAL_TRIGGER,
} from '../ui/ribbon/data/contextual-array-tab';
import { CONTEXTUAL_STAIR_TAB, STAIR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-stair-tab';
import { CONTEXTUAL_WALL_TAB, WALL_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-wall-tab';
import { CONTEXTUAL_OPENING_TAB, OPENING_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-opening-tab';
import { CONTEXTUAL_SLAB_TAB, SLAB_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-slab-tab';
import { CONTEXTUAL_ROOF_TAB, ROOF_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-roof-tab';
import { CONTEXTUAL_COLUMN_TAB, COLUMN_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-column-tab';
import { CONTEXTUAL_BEAM_TAB, BEAM_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-beam-tab';
import { CONTEXTUAL_SLAB_OPENING_TAB, SLAB_OPENING_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-slab-opening-tab';
import { DIMENSION_CONTEXTUAL_TAB, DIMENSION_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-dimension-tab';
import { CONTEXTUAL_LINE_TOOL_TAB, LINE_TOOL_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-line-tool-tab';
import { CONTEXTUAL_XLINE_MODE_TAB, XLINE_MODE_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-xline-mode-tab';
import { CONTEXTUAL_MULTI_SELECTION_TAB, MULTI_SELECTION_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-multi-selection-tab';
import { CONTEXTUAL_MEP_CIRCUIT_TAB, MEP_CIRCUIT_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-circuit-tab';
import { CONTEXTUAL_MEP_PIPE_NETWORK_TAB, MEP_PIPE_NETWORK_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-pipe-network-tab';
import { CONTEXTUAL_MEP_FIXTURE_TAB, MEP_FIXTURE_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-fixture-tab';
import { CONTEXTUAL_MEP_FLOOR_DRAIN_TAB, MEP_FLOOR_DRAIN_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-floor-drain-tab';
import { CONTEXTUAL_MEP_MANIFOLD_TAB, MEP_MANIFOLD_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-manifold-tab';
import { CONTEXTUAL_DRAINAGE_COLLECTOR_TAB, DRAINAGE_COLLECTOR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-drainage-collector-tab';
import { CONTEXTUAL_MEP_RADIATOR_TAB, MEP_RADIATOR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-radiator-tab';
import { CONTEXTUAL_MEP_BOILER_TAB, MEP_BOILER_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-boiler-tab';
import { CONTEXTUAL_MEP_UNDERFLOOR_TAB, MEP_UNDERFLOOR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-underfloor-tab';
import { CONTEXTUAL_FLOOR_FINISH_TAB, FLOOR_FINISH_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-floor-finish-tab';
import { CONTEXTUAL_MEP_SEGMENT_TAB, MEP_SEGMENT_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-segment-tab';
import { CONTEXTUAL_FURNITURE_TAB, FURNITURE_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-furniture-tab';
import { CONTEXTUAL_FLOORPLAN_SYMBOL_TAB, FLOORPLAN_SYMBOL_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-floorplan-symbol-tab';
import { CONTEXTUAL_MEP_FIXTURE_LIBRARY_TAB, MEP_FIXTURE_LIBRARY_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-fixture-library-tab';
import { ANIMATION_CONTEXTUAL_TAB, ANIMATION_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-animation-tab';
import { selectAnimationToolActive, useAnimationStore } from '../bim-3d/animation/AnimationStore';
import { useMepSystemStore } from '../bim/mep-systems/mep-system-store';
import { resolveManagedSystems } from '../bim/mep-systems/mep-circuit-editor';
import { isPipeNetworkSourceEntity } from '../bim/mep-systems/pipe-network-source';
import { isMepSegmentEntity } from '../types/entities';

const BIM_KIND_TYPES: ReadonlySet<string> = new Set([
  'wall', 'opening', 'slab', 'slab-opening', 'column', 'beam', 'stair', 'roof',
]);

export const RIBBON_CONTEXTUAL_TABS = [
  CONTEXTUAL_TEXT_EDITOR_TAB,
  CONTEXTUAL_ARRAY_RECT_TAB,
  CONTEXTUAL_ARRAY_POLAR_TAB,
  CONTEXTUAL_ARRAY_PATH_TAB,
  CONTEXTUAL_STAIR_TAB,
  CONTEXTUAL_WALL_TAB,
  CONTEXTUAL_OPENING_TAB,
  CONTEXTUAL_SLAB_TAB,
  CONTEXTUAL_ROOF_TAB,
  CONTEXTUAL_COLUMN_TAB,
  CONTEXTUAL_BEAM_TAB,
  CONTEXTUAL_SLAB_OPENING_TAB,
  DIMENSION_CONTEXTUAL_TAB,
  CONTEXTUAL_LINE_TOOL_TAB,
  CONTEXTUAL_XLINE_MODE_TAB,
  CONTEXTUAL_MULTI_SELECTION_TAB,
  CONTEXTUAL_MEP_CIRCUIT_TAB,
  CONTEXTUAL_MEP_PIPE_NETWORK_TAB,
  CONTEXTUAL_MEP_FIXTURE_TAB,
  CONTEXTUAL_MEP_FLOOR_DRAIN_TAB,
  CONTEXTUAL_MEP_MANIFOLD_TAB,
  CONTEXTUAL_DRAINAGE_COLLECTOR_TAB,
  CONTEXTUAL_MEP_RADIATOR_TAB,
  CONTEXTUAL_MEP_BOILER_TAB,
  CONTEXTUAL_MEP_UNDERFLOOR_TAB,
  CONTEXTUAL_MEP_SEGMENT_TAB,
  CONTEXTUAL_MEP_FIXTURE_LIBRARY_TAB,
  CONTEXTUAL_FURNITURE_TAB,
  CONTEXTUAL_FLOORPLAN_SYMBOL_TAB,
  CONTEXTUAL_FLOOR_FINISH_TAB,
  ANIMATION_CONTEXTUAL_TAB,
] as const;

type EntityLike = { readonly type: string; readonly params?: unknown };

function readArrayKind(params: unknown): string | undefined {
  if (params && typeof params === 'object' && 'kind' in params) {
    const k = (params as { kind?: unknown }).kind;
    return typeof k === 'string' ? k : undefined;
  }
  return undefined;
}

/**
 * ADR-408 Φ14 — read a manifold's `kind` from its params. A `drainage-collector`
 * (φρεάτιο) surfaces its own contextual tab; a `floor-manifold` (συλλέκτης) the
 * water-manifold tab. Both are `mep-manifold` entities sharing one bridge.
 */
function readManifoldKind(params: unknown): string | undefined {
  if (params && typeof params === 'object' && 'kind' in params) {
    const k = (params as { kind?: unknown }).kind;
    return typeof k === 'string' ? k : undefined;
  }
  return undefined;
}

/**
 * ADR-408 Φ14 — read a fixture's `kind` from its params. A `floor-drain` (σιφώνι)
 * surfaces «Ιδιότητες Σιφωνιού»; a `light-fixture` the «Ιδιότητες Φωτιστικού» tab.
 * Both are `mep-fixture` entities sharing one bridge (the bridge is kind-agnostic).
 */
function readFixtureKind(params: unknown): string | undefined {
  if (params && typeof params === 'object' && 'kind' in params) {
    const k = (params as { kind?: unknown }).kind;
    return typeof k === 'string' ? k : undefined;
  }
  return undefined;
}

export function useActiveContextualTrigger({
  primarySelectedId, selectedEntityIds, currentScene, activeTool,
}: {
  primarySelectedId: string | null;
  /** ADR-363 Phase 7.1 — all currently selected ids (universal). When 2+ BIM
   *  entities are selected, the multi-selection tab takes priority over the
   *  per-kind tab driven by `primarySelectedId`. */
  selectedEntityIds?: readonly string[];
  currentScene: SceneModel | null;
  activeTool: string;
}): string | null {
  // ADR-366 §C.1.b — surface animation contextual tab when AnimationStore.toolActive flips.
  const animationToolActive = useAnimationStore(selectAnimationToolActive);
  // ADR-408 Φ6 — the circuit tab also surfaces when the selection touches an
  // existing circuit (manage mode), so subscribe to the systems store.
  const mepSystems = useMepSystemStore((s) => s.systems);
  return React.useMemo<string | null>(() => {
    if (animationToolActive) return ANIMATION_CONTEXTUAL_TRIGGER;
    // ADR-408 Φ5: mixed MEP selection (≥1 electrical panel = source + ≥1 light
    // fixture = members) → circuit-creation tab. Checked before the generic
    // structural multi-select since panels/fixtures are not in BIM_KIND_TYPES.
    if (selectedEntityIds && selectedEntityIds.length >= 2 && currentScene) {
      let hasPanel = false;
      let hasFixture = false;
      for (const id of selectedEntityIds) {
        const e = currentScene.entities.find((x) => x.id === id);
        if (e?.type === 'electrical-panel') hasPanel = true;
        else if (e?.type === 'mep-fixture') hasFixture = true;
        if (hasPanel && hasFixture) break;
      }
      if (hasPanel && hasFixture) return MEP_CIRCUIT_CONTEXTUAL_TRIGGER;
    }
    // ADR-408 Φ13 / Εύρος Β #2: mixed plumbing selection (≥1 pipe-network SOURCE —
    // manifold OR boiler, via the SSoT `isPipeNetworkSourceEntity` guard — + ≥1 pipe
    // segment = members) → pipe-network-creation tab (Revit "create a Piping System
    // from the source + its pipes"). Disjoint from the electrical case (source/segment
    // are not panels/fixtures), so order is irrelevant.
    if (selectedEntityIds && selectedEntityIds.length >= 2 && currentScene) {
      let hasNetworkSource = false;
      let hasPipe = false;
      for (const id of selectedEntityIds) {
        const e = currentScene.entities.find((x) => x.id === id);
        if (e && isPipeNetworkSourceEntity(e)) hasNetworkSource = true;
        else if (e && isMepSegmentEntity(e) && e.params.domain === 'pipe') hasPipe = true;
        if (hasNetworkSource && hasPipe) break;
      }
      if (hasNetworkSource && hasPipe) return MEP_PIPE_NETWORK_CONTEXTUAL_TRIGGER;
    }
    // ADR-408 Φ6: selecting an electrical panel that feeds ≥1 circuit surfaces
    // the circuit tab in manage mode (picker → its circuits). Panel-centric so a
    // selected fixture keeps its own fixture-properties tab (Revit shows the
    // circuit from the panel / system browser, not in place of device props).
    // Resolved from the primary selection to match `useMepCircuitEditorSync`.
    if (primarySelectedId && currentScene && mepSystems.length > 0) {
      const primary = currentScene.entities.find((e) => e.id === primarySelectedId);
      if (
        primary?.type === 'electrical-panel' &&
        resolveManagedSystems([primary], mepSystems).length > 0
      ) {
        return MEP_CIRCUIT_CONTEXTUAL_TRIGGER;
      }
    }
    // ADR-408 Φ13 fold-in: a selected manifold ALWAYS shows «Ιδιότητες Συλλέκτη»
    // (resolveContextualTrigger below); its network management is folded into that
    // tab as a self-hiding «Δίκτυο» panel (Revit "System Properties" from the
    // equipment), mirroring the fixture's «Κύκλωμα» panel. So — unlike the panel
    // manage branch above — there is no separate manifold→network-tab branch here.
    // ADR-363 Phase 7.1: multi-selection of BIM entities → dedicated tab.
    if (selectedEntityIds && selectedEntityIds.length >= 2 && currentScene) {
      let bimCount = 0;
      for (const id of selectedEntityIds) {
        const e = currentScene.entities.find((x) => x.id === id);
        if (e && BIM_KIND_TYPES.has(e.type)) {
          bimCount++;
          if (bimCount >= 2) break;
        }
      }
      if (bimCount >= 2) return MULTI_SELECTION_CONTEXTUAL_TRIGGER;
    }

    const entity = primarySelectedId && currentScene
      ? currentScene.entities.find((e) => e.id === primarySelectedId) : null;
    const fromSelection = entity ? resolveContextualTrigger(entity) : null;
    if (fromSelection) return fromSelection;
    if (activeTool === 'stair') return STAIR_CONTEXTUAL_TRIGGER;
    // ADR-363 Phase 1K / «από περίγραμμα» — in-region & outer-perimeter share the
    // wall contextual tab (category/height feed the walls; thickness is geometry-
    // driven from the faces).
    if (
      activeTool === 'wall' ||
      isWallRegionTool(activeTool) ||
      activeTool === 'wall-from-perimeter'
    )
      return WALL_CONTEXTUAL_TRIGGER;
    if (activeTool === 'opening') return OPENING_CONTEXTUAL_TRIGGER;
    if (activeTool === 'slab') return SLAB_CONTEXTUAL_TRIGGER;
    // ADR-417 — roof tool active → show the roof properties tab (shape/slope
    // defaults apply to the next drawn roof, mirror slab tool-active behaviour).
    if (activeTool === 'roof') return ROOF_CONTEXTUAL_TRIGGER;
    // ADR-363 Φάση 3 / 3c + ADR-419 — «Τοιχίο/Κολώνα από περίγραμμα» + «Κολώνα σε
    // περιοχή» μοιράζονται το column contextual tab.
    if (
      activeTool === 'column' ||
      activeTool === 'column-from-perimeter' ||
      activeTool === 'column-discrete-from-perimeter' ||
      activeTool === 'column-discrete-from-perimeter-walls' ||
      isColumnRegionTool(activeTool)
    )
      return COLUMN_CONTEXTUAL_TRIGGER;
    // ADR-363 «Δοκάρι από τοίχο» μοιράζεται το beam contextual tab (depth/elevation/
    // width overrides feed the from-wall build· το width default = πάχος τοίχου).
    if (activeTool === 'beam' || activeTool === 'beam-from-wall') return BEAM_CONTEXTUAL_TRIGGER;
    // ADR-410 — furniture tool active → show the furniture library picker tab.
    if (activeTool === 'furniture') return FURNITURE_CONTEXTUAL_TRIGGER;
    // ADR-415 — floorplan-symbol tool active → show the symbol library picker tab.
    if (activeTool === 'floorplan-symbol') return FLOORPLAN_SYMBOL_CONTEXTUAL_TRIGGER;
    // ADR-419 — floor-finish tool active → show the floor-finish property tab.
    if (activeTool === 'floor-finish') return FLOOR_FINISH_CONTEXTUAL_TRIGGER;
    // ADR-411 — MEP fixture tool active → show the light-fixture library picker
    // tab (choose CC0 mesh or parametric). Selecting a placed fixture instead
    // surfaces the property editor (resolveContextualTrigger, checked earlier).
    if (activeTool === 'mep-fixture') return MEP_FIXTURE_LIBRARY_CONTEXTUAL_TRIGGER;
    if (activeTool === 'slab-opening') return SLAB_OPENING_CONTEXTUAL_TRIGGER;
    // ADR-359 Phase 10.b: xline active → show mode selection panel.
    if (activeTool === 'xline') return XLINE_MODE_CONTEXTUAL_TRIGGER;
    // ADR-357 Phase 17: drawing tools show Quick Style override panel.
    if (
      activeTool === 'line' ||
      activeTool === 'line-perpendicular' ||
      activeTool === 'line-parallel' ||
      activeTool === 'circle' ||
      activeTool === 'circle-diameter' ||
      activeTool === 'circle-2p-diameter' ||
      activeTool === 'circle-3p' ||
      activeTool === 'rectangle' ||
      activeTool === 'polyline' ||
      activeTool === 'arc-3p' ||
      activeTool === 'arc-sce' ||
      activeTool === 'arc-cse' ||
      activeTool === 'polygon' ||
      activeTool === 'ellipse'
    ) return LINE_TOOL_CONTEXTUAL_TRIGGER;
    return null;
  }, [primarySelectedId, selectedEntityIds, currentScene, activeTool, animationToolActive, mepSystems]);
}

export function resolveContextualTrigger(entity: EntityLike): string | null {
  if (entity.type === 'dimension') return DIMENSION_CONTEXTUAL_TRIGGER;
  if (entity.type === 'stair') return STAIR_CONTEXTUAL_TRIGGER;
  if (entity.type === 'wall') return WALL_CONTEXTUAL_TRIGGER;
  if (entity.type === 'opening') return OPENING_CONTEXTUAL_TRIGGER;
  if (entity.type === 'slab') return SLAB_CONTEXTUAL_TRIGGER;
  // ADR-417 — κεκλιμένη στέγη (parametric roof) → contextual properties tab.
  if (entity.type === 'roof') return ROOF_CONTEXTUAL_TRIGGER;
  if (entity.type === 'column') return COLUMN_CONTEXTUAL_TRIGGER;
  if (entity.type === 'beam') return BEAM_CONTEXTUAL_TRIGGER;
  if (entity.type === 'slab-opening') return SLAB_OPENING_CONTEXTUAL_TRIGGER;
  // ADR-406 / ADR-408 Φ14 — point-based MEP fixture. A floor-drain (σιφώνι)
  // surfaces «Ιδιότητες Σιφωνιού»; a light-fixture the «Ιδιότητες Φωτιστικού» tab.
  // Both are `mep-fixture` entities sharing one (kind-agnostic) bridge.
  if (entity.type === 'mep-fixture') {
    return readFixtureKind(entity.params) === 'floor-drain'
      ? MEP_FLOOR_DRAIN_CONTEXTUAL_TRIGGER
      : MEP_FIXTURE_CONTEXTUAL_TRIGGER;
  }
  // ADR-408 Φ12 / Φ14 — point-based manifold. A drainage-collector (φρεάτιο)
  // surfaces «Ιδιότητες Φρεατίου» (N inlets + 1 outlet); a floor-manifold the
  // water «Ιδιότητες Συλλέκτη». Both fold in pipe-network management.
  if (entity.type === 'mep-manifold') {
    return readManifoldKind(entity.params) === 'drainage-collector'
      ? DRAINAGE_COLLECTOR_CONTEXTUAL_TRIGGER
      : MEP_MANIFOLD_CONTEXTUAL_TRIGGER;
  }
  // ADR-408 Εύρος Β — καλοριφέρ (heating radiator, terminal) → «Ιδιότητες Καλοριφέρ».
  if (entity.type === 'mep-radiator') return MEP_RADIATOR_CONTEXTUAL_TRIGGER;
  // ADR-408 Εύρος Β #2 — λέβητας (hydronic boiler, source) → «Ιδιότητες Λέβητα».
  if (entity.type === 'mep-boiler') return MEP_BOILER_CONTEXTUAL_TRIGGER;
  // ADR-408 Εύρος Β #3 — ενδοδαπέδια (hydronic area terminal) → «Ιδιότητες Ενδοδαπέδιας».
  if (entity.type === 'mep-underfloor') return MEP_UNDERFLOOR_CONTEXTUAL_TRIGGER;
  // ADR-419 — floor-finish (IfcCovering FLOORING) → «Ιδιότητες Επικάλυψης Δαπέδου».
  if (entity.type === 'floor-finish') return FLOOR_FINISH_CONTEXTUAL_TRIGGER;
  // ADR-408 Φ8 — σωλήνας / αεραγωγός (MEP segment, one tab for both domains).
  if (entity.type === 'mep-segment') return MEP_SEGMENT_CONTEXTUAL_TRIGGER;
  if (entity.type === 'text' || entity.type === 'mtext') return TEXT_EDITOR_CONTEXTUAL_TRIGGER;
  if (entity.type === 'array') {
    const kind = readArrayKind(entity.params);
    if (kind === 'polar') return ARRAY_POLAR_CONTEXTUAL_TRIGGER;
    if (kind === 'path') return ARRAY_PATH_CONTEXTUAL_TRIGGER;
    return ARRAY_RECT_CONTEXTUAL_TRIGGER;
  }
  return null;
}
