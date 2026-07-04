import React from 'react';
import type { SceneModel } from '../types/scene';
import type { Entity } from '../types/entities';
import { isColumnRegionTool, isWallDrawingTool } from '../systems/tools/region-tool-ids';
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
import { CONTEXTUAL_FOUNDATION_TAB, FOUNDATION_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-foundation-tab';
import { CONTEXTUAL_SLAB_OPENING_TAB, SLAB_OPENING_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-slab-opening-tab';
import { DIMENSION_CONTEXTUAL_TAB, DIMENSION_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-dimension-tab';
import { CONTEXTUAL_LINE_TOOL_TAB, LINE_TOOL_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-line-tool-tab';
import { CONTEXTUAL_XLINE_MODE_TAB, XLINE_MODE_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-xline-mode-tab';
import { CONTEXTUAL_MULTI_SELECTION_TAB, MULTI_SELECTION_CONTEXTUAL_TRIGGER, CONTEXTUAL_TRIGGER_SEPARATOR } from '../ui/ribbon/data/contextual-multi-selection-tab';
import { CONTEXTUAL_MEP_CIRCUIT_TAB, MEP_CIRCUIT_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-circuit-tab';
import { CONTEXTUAL_MEP_PIPE_NETWORK_TAB, MEP_PIPE_NETWORK_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-pipe-network-tab';
import { CONTEXTUAL_MEP_FIXTURE_TAB, MEP_FIXTURE_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-fixture-tab';
import { CONTEXTUAL_MEP_FLOOR_DRAIN_TAB, MEP_FLOOR_DRAIN_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-floor-drain-tab';
import { CONTEXTUAL_MEP_SANITARY_FIXTURE_TAB, MEP_SANITARY_FIXTURE_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-sanitary-fixture-tab';
import { CONTEXTUAL_MEP_APPLIANCE_FIXTURE_TAB, MEP_APPLIANCE_FIXTURE_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-appliance-fixture-tab';
import { CONTEXTUAL_MEP_SOCKET_TAB, MEP_SOCKET_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-socket-tab';
import { CONTEXTUAL_MEP_DATA_OUTLET_TAB, MEP_DATA_OUTLET_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-data-outlet-tab';
import { isSanitaryKind } from '../bim/sanitary/sanitary-symbol-spec';
import { isApplianceKind } from '../bim/appliances/appliance-symbol-spec';
import { isSocketKind } from '../bim/mep-fixtures/socket-symbol-spec';
import { isDataOutletKind } from '../bim/mep-fixtures/data-outlet-symbol-spec';
import { CONTEXTUAL_MEP_MANIFOLD_TAB, MEP_MANIFOLD_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-manifold-tab';
import { CONTEXTUAL_DRAINAGE_COLLECTOR_TAB, DRAINAGE_COLLECTOR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-drainage-collector-tab';
import { CONTEXTUAL_MEP_RADIATOR_TAB, MEP_RADIATOR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-radiator-tab';
import { CONTEXTUAL_MEP_BOILER_TAB, MEP_BOILER_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-boiler-tab';
import { CONTEXTUAL_MEP_WATER_HEATER_TAB, MEP_WATER_HEATER_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-water-heater-tab';
import { CONTEXTUAL_MEP_UNDERFLOOR_TAB, MEP_UNDERFLOOR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-underfloor-tab';
import { CONTEXTUAL_FLOOR_FINISH_TAB, FLOOR_FINISH_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-floor-finish-tab';
import { CONTEXTUAL_WALL_COVERING_TAB, WALL_COVERING_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-wall-covering-tab';
import { CONTEXTUAL_HATCH_TAB, HATCH_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-hatch-tab';
import { CONTEXTUAL_THERMAL_SPACE_TAB, THERMAL_SPACE_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-thermal-space-tab';
import { CONTEXTUAL_MEP_SEGMENT_TAB, MEP_SEGMENT_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-segment-tab';
import { CONTEXTUAL_FURNITURE_TAB, FURNITURE_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-furniture-tab';
import { CONTEXTUAL_FLOORPLAN_SYMBOL_TAB, FLOORPLAN_SYMBOL_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-floorplan-symbol-tab';
import { CONTEXTUAL_MEP_FIXTURE_LIBRARY_TAB, MEP_FIXTURE_LIBRARY_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-fixture-library-tab';
import { CONTEXTUAL_MEP_RISER_TAB, MEP_RISER_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-riser-tab';
import { ANIMATION_CONTEXTUAL_TAB, ANIMATION_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-animation-tab';
import { CONTEXTUAL_GUIDES_TAB, GUIDES_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-guides-tab';
import { CONTEXTUAL_DIMENSIONS_TAB, DIMENSIONS_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-dimensions-tab';
import { selectAnimationToolActive, useAnimationStore } from '../bim-3d/animation/AnimationStore';
import { useMepSystemStore } from '../bim/mep-systems/mep-system-store';
import { useMepCircuitEditorStore } from '../bim/mep-systems/mep-circuit-editor-store';
import { CONTEXTUAL_ELECTRICAL_PANEL_TAB, ELECTRICAL_PANEL_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-electrical-panel-tab';
import { isPipeNetworkSourceEntity } from '../bim/mep-systems/pipe-network-source';
import { isMepSegmentEntity } from '../types/entities';
import { useFoundationLevelStore } from '../state/foundation-level-store';
import { resolveSelectedEntityFrom } from '../systems/selection/resolve-selected-entity';
import { isStyleEditablePrimitiveType } from '../types/style-editable-primitives';

const BIM_KIND_TYPES: ReadonlySet<string> = new Set([
  'wall', 'opening', 'slab', 'slab-opening', 'column', 'beam', 'foundation', 'stair', 'roof',
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
  CONTEXTUAL_FOUNDATION_TAB,
  CONTEXTUAL_SLAB_OPENING_TAB,
  DIMENSION_CONTEXTUAL_TAB,
  CONTEXTUAL_LINE_TOOL_TAB,
  CONTEXTUAL_XLINE_MODE_TAB,
  CONTEXTUAL_MULTI_SELECTION_TAB,
  CONTEXTUAL_MEP_CIRCUIT_TAB,
  CONTEXTUAL_MEP_PIPE_NETWORK_TAB,
  CONTEXTUAL_MEP_FIXTURE_TAB,
  CONTEXTUAL_MEP_FLOOR_DRAIN_TAB,
  CONTEXTUAL_MEP_SANITARY_FIXTURE_TAB,
  CONTEXTUAL_MEP_APPLIANCE_FIXTURE_TAB,
  CONTEXTUAL_MEP_SOCKET_TAB,
  CONTEXTUAL_MEP_DATA_OUTLET_TAB,
  CONTEXTUAL_ELECTRICAL_PANEL_TAB,
  CONTEXTUAL_MEP_MANIFOLD_TAB,
  CONTEXTUAL_DRAINAGE_COLLECTOR_TAB,
  CONTEXTUAL_MEP_RADIATOR_TAB,
  CONTEXTUAL_MEP_BOILER_TAB,
  CONTEXTUAL_MEP_WATER_HEATER_TAB,
  CONTEXTUAL_MEP_UNDERFLOOR_TAB,
  CONTEXTUAL_MEP_SEGMENT_TAB,
  CONTEXTUAL_MEP_FIXTURE_LIBRARY_TAB,
  CONTEXTUAL_MEP_RISER_TAB,
  CONTEXTUAL_FURNITURE_TAB,
  CONTEXTUAL_FLOORPLAN_SYMBOL_TAB,
  CONTEXTUAL_FLOOR_FINISH_TAB,
  CONTEXTUAL_WALL_COVERING_TAB,
  CONTEXTUAL_HATCH_TAB,
  CONTEXTUAL_THERMAL_SPACE_TAB,
  ANIMATION_CONTEXTUAL_TAB,
  CONTEXTUAL_GUIDES_TAB,
  CONTEXTUAL_DIMENSIONS_TAB,
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

// ADR-510 Φ4i — line-modify tools (Revit «Modify | Lines»: Trim/Extend/Offset/
// Fillet/Chamfer). They are TAB-NEUTRAL: pressing one must NOT switch the ribbon
// tab. It preserves the current context — stays on the «Στυλ Γραμμής» contextual
// tab if it was open, stays on Home otherwise — instead of collapsing the tab
// (trigger → null) and snapping to Home. Same 5 keys as the modify panel + Home.
const LINE_MODIFY_TOOLS: ReadonlySet<string> = new Set([
  'trim', 'extend', 'offset', 'fillet', 'chamfer',
]);

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
  // Revit "click a wire to select it": a directly-selected circuit (wire click,
  // no entity selected) surfaces the «Κύκλωμα» tab — the wire IS the selection.
  const activeSystemId = useMepCircuitEditorStore((s) => s.activeSystemId);
  // ADR-484 — cross-level footings (foundation-level store, low-freq → ADR-040-safe)
  // ώστε ένα cross-level πέδιλο να εμφανίζει το «Ιδιότητες Θεμελίωσης» contextual tab.
  const crossLevelEntities = useFoundationLevelStore((s) => s.entities);
  // ADR-532 Stage B: O(1) id→entity lookup built once per scene. Replaces the
  // previous O(selectedIds × scene.entities) `.find()` scans in the mixed-selection
  // branches below (electrical panel+fixture, pipe source+segment, multi-BIM).
  const entityIndex = React.useMemo(() => {
    const index = new Map<string, Entity>();
    for (const e of currentScene?.entities ?? []) index.set(e.id, e);
    return index;
  }, [currentScene]);
  // ADR-510 Φ4i — last NON-modify trigger, so a tab-neutral line-modify tool can
  // restore the context it was pressed from (see LINE_MODIFY_TOOLS below).
  const lastNonModifyTriggerRef = React.useRef<string | null>(null);
  const trigger = React.useMemo<string | null>(() => {
    if (animationToolActive) return ANIMATION_CONTEXTUAL_TRIGGER;
    // Wire-selected circuit (no competing entity selection) → «Κύκλωμα» tab.
    if (!primarySelectedId && activeSystemId && mepSystems.some((s) => s.id === activeSystemId)) {
      return MEP_CIRCUIT_CONTEXTUAL_TRIGGER;
    }
    // ADR-408 Φ5: mixed MEP selection (≥1 electrical panel = source + ≥1 light
    // fixture = members) → circuit-creation tab. Checked before the generic
    // structural multi-select since panels/fixtures are not in BIM_KIND_TYPES.
    if (selectedEntityIds && selectedEntityIds.length >= 2 && currentScene) {
      let hasPanel = false;
      let hasFixture = false;
      for (const id of selectedEntityIds) {
        const e = entityIndex.get(id);
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
        const e = entityIndex.get(id);
        if (e && isPipeNetworkSourceEntity(e)) hasNetworkSource = true;
        else if (e && isMepSegmentEntity(e) && e.params.domain === 'pipe') hasPipe = true;
        if (hasNetworkSource && hasPipe) break;
      }
      if (hasNetworkSource && hasPipe) return MEP_PIPE_NETWORK_CONTEXTUAL_TRIGGER;
    }
    // ADR-408 Φ3/Φ6 fold-in: a selected electrical panel ALWAYS shows its OWN
    // «Ιδιότητες Ηλεκτρικού Πίνακα» tab (resolveContextualTrigger below), NOT the
    // circuit tab — a panel feeds MANY circuits, so showing one circuit's props is
    // ambiguous + loses the panel's identity (Revit "Electrical Equipment" props +
    // "Edit Circuits"). Its circuit management is folded into that tab as a
    // self-hiding «Κυκλώματα» panel, mirroring the manifold/boiler «Δίκτυο» panel.
    // (The mixed panel+fixtures CREATE case is handled above; wire-select stays the
    // circuit tab.)
    // ADR-408 Φ13 fold-in: a selected manifold ALWAYS shows «Ιδιότητες Συλλέκτη»
    // (resolveContextualTrigger below); its network management is folded into that
    // tab as a self-hiding «Δίκτυο» panel (Revit "System Properties" from the
    // equipment), mirroring the fixture's «Κύκλωμα» panel. So — unlike the panel
    // manage branch above — there is no separate manifold→network-tab branch here.
    // ADR-363 Phase 7.1: multi-selection of BIM entities → dedicated tab.
    // ADR-566: όταν η πολλαπλή επιλογή είναι ΟΜΟΙΟΓΕΝΗΣ (π.χ. 2 τοίχοι) →
    // κράτα ΕΝΕΡΓΟ το per-kind properties tab (Ιδιότητες Τοίχου) ΚΑΙ εμφάνισε
    // ΚΑΙ το multi-selection tab (composite trigger, per-kind ΠΡΩΤΟ = active).
    // Μεικτά είδη → μόνο multi-selection (κανένας single per-kind editor δεν ισχύει).
    if (selectedEntityIds && selectedEntityIds.length >= 2 && currentScene) {
      let bimCount = 0;
      let firstBim: Entity | null = null;
      let homogeneous = true;
      for (const id of selectedEntityIds) {
        const e = entityIndex.get(id);
        if (e && BIM_KIND_TYPES.has(e.type)) {
          bimCount++;
          if (!firstBim) firstBim = e;
          else if (e.type !== firstBim.type) homogeneous = false;
        }
      }
      if (bimCount >= 2) {
        if (homogeneous && firstBim) {
          const perKind = resolveContextualTrigger(firstBim);
          if (perKind) return `${perKind}${CONTEXTUAL_TRIGGER_SEPARATOR}${MULTI_SELECTION_CONTEXTUAL_TRIGGER}`;
        }
        return MULTI_SELECTION_CONTEXTUAL_TRIGGER;
      }
    }

    const entity = resolveSelectedEntityFrom(
      primarySelectedId, currentScene?.entities, crossLevelEntities,
    );
    const fromSelection = entity ? resolveContextualTrigger(entity) : null;
    // Giorgio 2026-07-04 — a SELECTED placed dimension surfaces a COMPOSITE
    // trigger: the «Ιδιότητες Διάστασης» edit tab (`dim-selected`, first token →
    // becomes active) AND the «Διαστάσεις» creation tab (`dim-tool-active`) stay
    // OPEN together — never one replacing the other. Mirrors the ADR-566
    // homogeneous multi-select composite (per-kind first = active, extra beside).
    if (fromSelection === DIMENSION_CONTEXTUAL_TRIGGER) {
      return `${DIMENSION_CONTEXTUAL_TRIGGER}${CONTEXTUAL_TRIGGER_SEPARATOR}${DIMENSIONS_CONTEXTUAL_TRIGGER}`;
    }
    if (fromSelection) return fromSelection;
    if (activeTool === 'stair') return STAIR_CONTEXTUAL_TRIGGER;
    // ADR-363 Phase 1K / «από περίγραμμα» — in-region & outer-perimeter share the
    // wall contextual tab (category/height feed the walls; thickness is geometry-
    // driven from the faces).
    if (isWallDrawingTool(activeTool))
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
      activeTool === 'column-from-polygon' ||
      isColumnRegionTool(activeTool)
    )
      return COLUMN_CONTEXTUAL_TRIGGER;
    // ADR-363 «Δοκάρι από τοίχο» μοιράζεται το beam contextual tab (depth/elevation/
    // width overrides feed the from-wall build· το width default = πάχος τοίχου).
    if (activeTool === 'beam' || activeTool === 'beam-from-wall') return BEAM_CONTEXTUAL_TRIGGER;
    // ADR-436 — foundation tools active → show the foundation property tab. Slice 1
    // pad (single-click) + Slice 2 strip / tie-beam / strip-from-wall (line, 2-click).
    // The active kind is fixed by the tool id; the tab shows kind-conditional panels.
    if (
      activeTool === 'foundation-pad' ||
      activeTool === 'foundation-strip' ||
      activeTool === 'foundation-tie-beam' ||
      activeTool === 'foundation-strip-from-wall'
    ) return FOUNDATION_CONTEXTUAL_TRIGGER;
    // ADR-410 — furniture tool active → show the furniture library picker tab.
    if (activeTool === 'furniture') return FURNITURE_CONTEXTUAL_TRIGGER;
    // ADR-415 — floorplan-symbol tool active → show the symbol library picker tab.
    if (activeTool === 'floorplan-symbol') return FLOORPLAN_SYMBOL_CONTEXTUAL_TRIGGER;
    // ADR-419 — floor-finish tool active → show the floor-finish property tab.
    if (activeTool === 'floor-finish') return FLOOR_FINISH_CONTEXTUAL_TRIGGER;
    // ADR-511 — wall-covering tool active (manual ή room-fill) → show the property tab.
    if (activeTool === 'wall-covering' || activeTool === 'wall-covering-room') return WALL_COVERING_CONTEXTUAL_TRIGGER;
    // ADR-507 S2 — hatch tool active → show the «Γραμμοσκίαση» tab (defaults for the
    // next drawn hatch; a selected hatch surfaces the same tab via resolveContextualTrigger).
    if (activeTool === 'hatch') return HATCH_CONTEXTUAL_TRIGGER;
    // ADR-422 — thermal-space tool active → show the thermal-space property tab.
    if (activeTool === 'thermal-space') return THERMAL_SPACE_CONTEXTUAL_TRIGGER;
    // ADR-411 — MEP fixture tool active → show the light-fixture library picker
    // tab (choose CC0 mesh or parametric). Selecting a placed fixture instead
    // surfaces the property editor (resolveContextualTrigger, checked earlier).
    if (activeTool === 'mep-fixture') return MEP_FIXTURE_LIBRARY_CONTEXTUAL_TRIGGER;
    // ADR-408 Φ15 — MEP riser tool active → show the «Κατακόρυφη Στήλη» tab
    // (base/top span via «Έως όροφο» + diameter) before the placement click.
    if (activeTool === 'mep-drain-riser') return MEP_RISER_CONTEXTUAL_TRIGGER;
    // ADR-408 Φ8 #2b — general pipe/duct tool active → show the segment tab so the
    // draw-time «Ύψος άξονα» (Revit Options Bar "Offset") field is available. Changing
    // it between the 2 clicks authors a freehand riser/slope (no connector snap needed).
    if (
      activeTool === 'mep-pipe' ||
      activeTool === 'mep-duct' ||
      activeTool === 'mep-drain-pipe'
    )
      return MEP_SEGMENT_CONTEXTUAL_TRIGGER;
    // ADR-442 — any guide tool active → surface the «Οδηγοί» contextual tab.
    // Guides have no persistent selection (selection lives only while a guide
    // tool is active, `useGuideWorkflowState`), so this single tool-active check
    // covers both the tool-active and the guide-selected case. All guide tool
    // ids share the `guide-` prefix; `guides-visibility`/grid actions don't set
    // `activeTool`, so toggling them keeps this tab open.
    if (activeTool.startsWith('guide-')) return GUIDES_CONTEXTUAL_TRIGGER;
    // ADR-362 Phase E3 — any dimension creation tool active → «Διαστάσεις» tab
    // (mirror of guides). All dim ToolTypes share the `dim-` prefix. A SELECTED
    // dimension surfaces the edit tab (`dim-selected`) COMPOSED with this creation
    // tab (resolved earlier via `fromSelection`), so both stay open together.
    if (activeTool.startsWith('dim-')) return DIMENSIONS_CONTEXTUAL_TRIGGER;
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
    // ADR-510 Φ4i — a line-modify tool is TAB-NEUTRAL: preserve the context it was
    // pressed from (last non-modify trigger). If «Στυλ Γραμμής» was open it stays
    // open; if you were on Home (trigger null) you stay on Home. No tab snapping.
    if (LINE_MODIFY_TOOLS.has(activeTool)) return lastNonModifyTriggerRef.current;
    return null;
  }, [primarySelectedId, selectedEntityIds, currentScene, entityIndex, activeTool, animationToolActive, mepSystems, activeSystemId, crossLevelEntities]);
  // ADR-510 Φ4i — record the last NON-modify resolution so the sticky branch above
  // can restore it when a tab-neutral line-modify tool becomes active.
  React.useEffect(() => {
    if (!LINE_MODIFY_TOOLS.has(activeTool)) lastNonModifyTriggerRef.current = trigger;
  }, [trigger, activeTool]);
  return trigger;
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
  // ADR-436 — structural foundation (pad/strip/tie-beam) → contextual properties tab.
  if (entity.type === 'foundation') return FOUNDATION_CONTEXTUAL_TRIGGER;
  if (entity.type === 'slab-opening') return SLAB_OPENING_CONTEXTUAL_TRIGGER;
  // ADR-406 / ADR-408 Φ14 — point-based MEP fixture. A floor-drain (σιφώνι)
  // surfaces «Ιδιότητες Σιφωνιού»; a light-fixture the «Ιδιότητες Φωτιστικού» tab.
  // Both are `mep-fixture` entities sharing one (kind-agnostic) bridge.
  if (entity.type === 'mep-fixture') {
    const fixtureKind = readFixtureKind(entity.params);
    if (fixtureKind === 'floor-drain') return MEP_FLOOR_DRAIN_CONTEXTUAL_TRIGGER;
    // ADR-408 Δρόμος B — an appliance (washing machine, …) surfaces «Ιδιότητες
    // Συσκευής» (checked BEFORE sanitary: distinct family, same kind-agnostic bridge).
    if (fixtureKind && isApplianceKind(fixtureKind)) return MEP_APPLIANCE_FIXTURE_CONTEXTUAL_TRIGGER;
    // ADR-408 Φ14 — a sanitary terminal (WC/basin/…) surfaces «Ιδιότητες Είδους
    // Υγιεινής»; same kind-agnostic bridge, richer geometry presets + rotation.
    if (fixtureKind && isSanitaryKind(fixtureKind)) return MEP_SANITARY_FIXTURE_CONTEXTUAL_TRIGGER;
    // ADR-430 — a power socket (πρίζα, Revit "Electrical Fixtures", IfcOutlet) surfaces
    // «Ιδιότητες Πρίζας»; ADR-431 — a data outlet (πρίζα δικτύου, Revit "Communication
    // Devices") surfaces «Ιδιότητες Πρίζας Δικτύου». Distinct Revit categories → distinct
    // tabs (both reuse the kind-agnostic fixture bridge). Checked BEFORE the light-fixture
    // default so an electrical device never mislabels as «Ιδιότητες Φωτιστικού».
    if (fixtureKind && isSocketKind(fixtureKind)) return MEP_SOCKET_CONTEXTUAL_TRIGGER;
    if (fixtureKind && isDataOutletKind(fixtureKind)) return MEP_DATA_OUTLET_CONTEXTUAL_TRIGGER;
    return MEP_FIXTURE_CONTEXTUAL_TRIGGER;
  }
  // ADR-408 Φ12 / Φ14 — point-based manifold. A drainage-collector (φρεάτιο)
  // surfaces «Ιδιότητες Φρεατίου» (N inlets + 1 outlet); a floor-manifold the
  // water «Ιδιότητες Συλλέκτη». Both fold in pipe-network management.
  if (entity.type === 'mep-manifold') {
    return readManifoldKind(entity.params) === 'drainage-collector'
      ? DRAINAGE_COLLECTOR_CONTEXTUAL_TRIGGER
      : MEP_MANIFOLD_CONTEXTUAL_TRIGGER;
  }
  // ADR-408 Φ3/Φ6 — electrical panel (πίνακας διανομής, Revit "Electrical
  // Equipment") → «Ιδιότητες Ηλεκτρικού Πίνακα». Its own identity tab (geometry) +
  // a folded self-hiding «Κυκλώματα» management panel; NOT the circuit tab (a panel
  // feeds many circuits). Mirrors the manifold/boiler equipment-tab fold-in.
  if (entity.type === 'electrical-panel') return ELECTRICAL_PANEL_CONTEXTUAL_TRIGGER;
  // ADR-408 Εύρος Β — καλοριφέρ (heating radiator, terminal) → «Ιδιότητες Καλοριφέρ».
  if (entity.type === 'mep-radiator') return MEP_RADIATOR_CONTEXTUAL_TRIGGER;
  // ADR-408 Εύρος Β #2 — λέβητας (hydronic boiler, source) → «Ιδιότητες Λέβητα».
  if (entity.type === 'mep-boiler') return MEP_BOILER_CONTEXTUAL_TRIGGER;
  // ADR-408 DHW — θερμοσίφωνας (domestic hot water heater, DHW source) → «Ιδιότητες Θερμοσίφωνα».
  if (entity.type === 'mep-water-heater') return MEP_WATER_HEATER_CONTEXTUAL_TRIGGER;
  // ADR-408 Εύρος Β #3 — ενδοδαπέδια (hydronic area terminal) → «Ιδιότητες Ενδοδαπέδιας».
  if (entity.type === 'mep-underfloor') return MEP_UNDERFLOOR_CONTEXTUAL_TRIGGER;
  // ADR-419 — floor-finish (IfcCovering FLOORING) → «Ιδιότητες Επικάλυψης Δαπέδου».
  if (entity.type === 'floor-finish') return FLOOR_FINISH_CONTEXTUAL_TRIGGER;
  // ADR-511 — wall-covering (IfcCovering CLADDING/INTERIOR) → «Ιδιότητες Φινιρίσματος Τοίχου».
  if (entity.type === 'wall-covering') return WALL_COVERING_CONTEXTUAL_TRIGGER;
  // ADR-507 S2 — γραμμοσκίαση (hatch) → «Γραμμοσκίαση» tab.
  if (entity.type === 'hatch') return HATCH_CONTEXTUAL_TRIGGER;
  // ADR-422 — thermal-space (IfcSpace) → «Ιδιότητες Θερμικού Χώρου».
  if (entity.type === 'thermal-space') return THERMAL_SPACE_CONTEXTUAL_TRIGGER;
  // ADR-408 Φ8 — σωλήνας / αεραγωγός (MEP segment, one tab for both domains).
  if (entity.type === 'mep-segment') return MEP_SEGMENT_CONTEXTUAL_TRIGGER;
  if (entity.type === 'text' || entity.type === 'mtext') return TEXT_EDITOR_CONTEXTUAL_TRIGGER;
  if (entity.type === 'array') {
    const kind = readArrayKind(entity.params);
    if (kind === 'polar') return ARRAY_POLAR_CONTEXTUAL_TRIGGER;
    if (kind === 'path') return ARRAY_PATH_CONTEXTUAL_TRIGGER;
    return ARRAY_RECT_CONTEXTUAL_TRIGGER;
  }
  // ADR-510 Φ2E — μια επιλεγμένη «καθαρή» γεωμετρική οντότητα (γραμμή/πολυγραμμή/
  // κύκλος/τόξο/έλλειψη/spline/ορθογώνιο) εμφανίζει το ΙΔΙΟ Line-Tool style tab με
  // τη σχεδίαση (mirror του hatch: ΕΝΑ trigger, δύο modes). Ο `useRibbonLineToolBridge`
  // διακρίνει selected-edit vs draw-defaults μέσω του ίδιου SSoT predicate.
  if (isStyleEditablePrimitiveType(entity.type)) return LINE_TOOL_CONTEXTUAL_TRIGGER;
  return null;
}
