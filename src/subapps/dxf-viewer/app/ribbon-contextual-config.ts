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
import { ANIMATION_CONTEXTUAL_TAB, ANIMATION_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-animation-tab';
import { selectAnimationToolActive, useAnimationStore } from '../bim-3d/animation/AnimationStore';

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
  return React.useMemo<string | null>(() => {
    if (animationToolActive) return ANIMATION_CONTEXTUAL_TRIGGER;
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
    // ADR-363 Φάση 3 — «Τοιχίο από περίγραμμα» μοιράζεται το column contextual tab.
    if (activeTool === 'column' || activeTool === 'column-from-perimeter')
      return COLUMN_CONTEXTUAL_TRIGGER;
    if (activeTool === 'beam') return BEAM_CONTEXTUAL_TRIGGER;
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
  }, [primarySelectedId, selectedEntityIds, currentScene, activeTool, animationToolActive]);
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
  if (entity.type === 'text' || entity.type === 'mtext') return TEXT_EDITOR_CONTEXTUAL_TRIGGER;
  if (entity.type === 'array') {
    const kind = readArrayKind(entity.params);
    if (kind === 'polar') return ARRAY_POLAR_CONTEXTUAL_TRIGGER;
    if (kind === 'path') return ARRAY_PATH_CONTEXTUAL_TRIGGER;
    return ARRAY_RECT_CONTEXTUAL_TRIGGER;
  }
  return null;
}
