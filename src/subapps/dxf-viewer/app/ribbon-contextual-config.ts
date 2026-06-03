import React from 'react';
import type { SceneModel } from '../types/scene';
import { CONTEXTUAL_TEXT_EDITOR_TAB, TEXT_EDITOR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-text-editor-tab';
import {
  CONTEXTUAL_ARRAY_RECT_TAB, CONTEXTUAL_ARRAY_POLAR_TAB, CONTEXTUAL_ARRAY_PATH_TAB,
  ARRAY_RECT_CONTEXTUAL_TRIGGER, ARRAY_POLAR_CONTEXTUAL_TRIGGER, ARRAY_PATH_CONTEXTUAL_TRIGGER,
} from '../ui/ribbon/data/contextual-array-tab';
import { CONTEXTUAL_STAIR_TAB, STAIR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-stair-tab';
import { CONTEXTUAL_WALL_TAB, WALL_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-wall-tab';
import { CONTEXTUAL_OPENING_TAB, OPENING_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-opening-tab';
import { CONTEXTUAL_SLAB_TAB, SLAB_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-slab-tab';
import { CONTEXTUAL_COLUMN_TAB, COLUMN_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-column-tab';
import { CONTEXTUAL_BEAM_TAB, BEAM_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-beam-tab';
import { CONTEXTUAL_SLAB_OPENING_TAB, SLAB_OPENING_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-slab-opening-tab';
import { DIMENSION_CONTEXTUAL_TAB, DIMENSION_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-dimension-tab';
import { CONTEXTUAL_LINE_TOOL_TAB, LINE_TOOL_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-line-tool-tab';
import { CONTEXTUAL_XLINE_MODE_TAB, XLINE_MODE_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-xline-mode-tab';
import { CONTEXTUAL_MULTI_SELECTION_TAB, MULTI_SELECTION_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-multi-selection-tab';
import { CONTEXTUAL_MEP_CIRCUIT_TAB, MEP_CIRCUIT_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-circuit-tab';
import { CONTEXTUAL_MEP_FIXTURE_TAB, MEP_FIXTURE_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-fixture-tab';
import { CONTEXTUAL_FURNITURE_TAB, FURNITURE_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-furniture-tab';
import { CONTEXTUAL_MEP_FIXTURE_LIBRARY_TAB, MEP_FIXTURE_LIBRARY_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-fixture-library-tab';
import { ANIMATION_CONTEXTUAL_TAB, ANIMATION_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-animation-tab';
import { selectAnimationToolActive, useAnimationStore } from '../bim-3d/animation/AnimationStore';
import { useMepSystemStore } from '../bim/mep-systems/mep-system-store';
import { resolveManagedCircuits } from '../bim/mep-systems/mep-circuit-editor';

const BIM_KIND_TYPES: ReadonlySet<string> = new Set([
  'wall', 'opening', 'slab', 'slab-opening', 'column', 'beam', 'stair',
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
  CONTEXTUAL_COLUMN_TAB,
  CONTEXTUAL_BEAM_TAB,
  CONTEXTUAL_SLAB_OPENING_TAB,
  DIMENSION_CONTEXTUAL_TAB,
  CONTEXTUAL_LINE_TOOL_TAB,
  CONTEXTUAL_XLINE_MODE_TAB,
  CONTEXTUAL_MULTI_SELECTION_TAB,
  CONTEXTUAL_MEP_CIRCUIT_TAB,
  CONTEXTUAL_MEP_FIXTURE_TAB,
  CONTEXTUAL_MEP_FIXTURE_LIBRARY_TAB,
  CONTEXTUAL_FURNITURE_TAB,
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
    // ADR-408 Φ6: selecting an electrical panel that feeds ≥1 circuit surfaces
    // the circuit tab in manage mode (picker → its circuits). Panel-centric so a
    // selected fixture keeps its own fixture-properties tab (Revit shows the
    // circuit from the panel / system browser, not in place of device props).
    // Resolved from the primary selection to match `useMepCircuitEditorSync`.
    if (primarySelectedId && currentScene && mepSystems.length > 0) {
      const primary = currentScene.entities.find((e) => e.id === primarySelectedId);
      if (
        primary?.type === 'electrical-panel' &&
        resolveManagedCircuits([primary], mepSystems).length > 0
      ) {
        return MEP_CIRCUIT_CONTEXTUAL_TRIGGER;
      }
    }
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
      activeTool === 'wall-in-region' ||
      activeTool === 'wall-from-perimeter'
    )
      return WALL_CONTEXTUAL_TRIGGER;
    if (activeTool === 'opening') return OPENING_CONTEXTUAL_TRIGGER;
    if (activeTool === 'slab') return SLAB_CONTEXTUAL_TRIGGER;
    // ADR-363 Φάση 3 / 3c — «Τοιχίο/Κολώνα από περίγραμμα» μοιράζονται το column contextual tab.
    if (
      activeTool === 'column' ||
      activeTool === 'column-from-perimeter' ||
      activeTool === 'column-discrete-from-perimeter'
    )
      return COLUMN_CONTEXTUAL_TRIGGER;
    // ADR-363 «Δοκάρι από τοίχο» μοιράζεται το beam contextual tab (depth/elevation/
    // width overrides feed the from-wall build· το width default = πάχος τοίχου).
    if (activeTool === 'beam' || activeTool === 'beam-from-wall') return BEAM_CONTEXTUAL_TRIGGER;
    // ADR-410 — furniture tool active → show the furniture library picker tab.
    if (activeTool === 'furniture') return FURNITURE_CONTEXTUAL_TRIGGER;
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
  if (entity.type === 'column') return COLUMN_CONTEXTUAL_TRIGGER;
  if (entity.type === 'beam') return BEAM_CONTEXTUAL_TRIGGER;
  if (entity.type === 'slab-opening') return SLAB_OPENING_CONTEXTUAL_TRIGGER;
  // ADR-406 — φωτιστικό (point-based MEP fixture) → contextual properties tab.
  if (entity.type === 'mep-fixture') return MEP_FIXTURE_CONTEXTUAL_TRIGGER;
  if (entity.type === 'text' || entity.type === 'mtext') return TEXT_EDITOR_CONTEXTUAL_TRIGGER;
  if (entity.type === 'array') {
    const kind = readArrayKind(entity.params);
    if (kind === 'polar') return ARRAY_POLAR_CONTEXTUAL_TRIGGER;
    if (kind === 'path') return ARRAY_PATH_CONTEXTUAL_TRIGGER;
    return ARRAY_RECT_CONTEXTUAL_TRIGGER;
  }
  return null;
}
