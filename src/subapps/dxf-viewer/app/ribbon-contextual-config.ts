import React from 'react';
import type { SceneModel } from '../types/scene';
import type { Entity } from '../types/entities';
// ADR-677 Φάση 2β — ο ΚΑΤΑΛΟΓΟΣ των contextual tabs ζει σε pure data module, ώστε ένα test
// να τον διατρέχει χωρίς να φορτώσει React/stores. Εδώ μένει μόνο ο stateful resolver.
import { RAW_RIBBON_CONTEXTUAL_TABS } from '../ui/ribbon/data/contextual-tabs-registry';
import { DIMENSION_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-dimension-tab';
import { SCALE_TOOL_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-scale-tool-tab';
import { MULTI_SELECTION_CONTEXTUAL_TRIGGER, CONTEXTUAL_TRIGGER_SEPARATOR } from '../ui/ribbon/data/contextual-multi-selection-tab';
import { MEP_CIRCUIT_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-circuit-tab';
import { MEP_PIPE_NETWORK_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-pipe-network-tab';
import { ANIMATION_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-animation-tab';
import { DIMENSIONS_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-dimensions-tab';
import { selectAnimationToolActive, useAnimationStore } from '../bim-3d/animation/AnimationStore';
import { useMepSystemStore } from '../bim/mep-systems/mep-system-store';
import { useMepCircuitEditorStore } from '../bim/mep-systems/mep-circuit-editor-store';
import { isPipeNetworkSourceEntity } from '../bim/mep-systems/pipe-network-source';
import { isMepSegmentEntity } from '../types/entities';
import { useFoundationLevelStore } from '../state/foundation-level-store';
import { resolveSelectedEntityFrom } from '../systems/selection/resolve-selected-entity';
// ADR-587 Φ3a — the entity-keyed selection→contextual-tab resolver moved to a pure
// module (SSoT `ENTITY_CONTEXTUAL_TRIGGER` map + coverage test, testable χωρίς stores).
import { resolveContextualTrigger } from './resolve-contextual-trigger';
// ADR-587 Φ3b-2 (Seam 2) — the tool-active (activeTool-only) resolution: static
// tool→trigger Map + predicate/prefix/sticky escape-hatch (ToolType-keyed, §5.1).
import { resolveToolActiveTrigger, isLineModifyTool } from './resolve-tool-active-trigger';
import { annotationKindForTool } from '../config/annotation-kind-registry';
import { useAnnotationSymbolSelectionStore } from '../state/annotation-symbol-selection-store';
// ADR-363 / ADR-510 Φ4j / ADR-581 — SSoT leading-panel normaliser («Κλείσιμο» + σύριγγα).
import { withStandardLeadPanel } from '../ui/ribbon/data/contextual-lead-panel';

const BIM_KIND_TYPES: ReadonlySet<string> = new Set([
  'wall', 'opening', 'slab', 'slab-opening', 'column', 'beam', 'foundation', 'stair', 'roof',
]);

// ADR-363 / ADR-510 Φ4j / ADR-581 — every contextual tab opens with the SAME leading
// panel (Revit «Modify | …» far-left): «Κλείσιμο» (returns to Home) + the «Αντιγραφή
// Ιδιοτήτων» syringe, in that order. Central injection = SSoT: `withStandardLeadPanel`
// strips any button that belongs to that panel (legacy per-tab close, stray syringe → no
// duplicate) and prepends the unified panel, so ALL current AND future contextual tabs get
// it with zero per-file work. New contextual tabs must NOT declare their own close button
// or syringe — the registry owns them.
export const RIBBON_CONTEXTUAL_TABS = RAW_RIBBON_CONTEXTUAL_TABS.map(withStandardLeadPanel);

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
  // restore the context it was pressed from (see `isLineModifyTool` in
  // `resolve-tool-active-trigger.ts`).
  const lastNonModifyTriggerRef = React.useRef<string | null>(null);
  const trigger = React.useMemo<string | null>(() => {
    if (animationToolActive) return ANIMATION_CONTEXTUAL_TRIGGER;
    // ADR-646 Φ4 #6 — the modal Scale operation OWNS the ribbon context while active
    // (mirror the animation tool): its C/R/N options must take priority over the
    // selected entity's own tab, which would otherwise shadow it — the selection IS
    // the scale target (e.g. a line → «Στυλ Γραμμής»). Resolved from `activeTool`
    // directly (no store), so it stays a pure early return above the selection rules.
    if (activeTool === 'scale') return SCALE_TOOL_CONTEXTUAL_TRIGGER;
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
    // ADR-587 Φ3b-2 (Seam 2) — the pure, activeTool-only resolution (static tool→trigger
    // map + predicate/prefix/sticky escape-hatch) lives in `resolve-tool-active-trigger.ts`
    // (ToolType-keyed SSoT, §5.1). Reached only after every stateful pre-rule above misses.
    return resolveToolActiveTrigger(activeTool, lastNonModifyTriggerRef.current);
  }, [primarySelectedId, selectedEntityIds, currentScene, entityIndex, activeTool, animationToolActive, mepSystems, activeSystemId, crossLevelEntities]);
  // ADR-510 Φ4i — record the last NON-modify resolution so the sticky branch inside
  // `resolveToolActiveTrigger` can restore it when a tab-neutral line-modify tool activates.
  React.useEffect(() => {
    if (!isLineModifyTool(activeTool)) lastNonModifyTriggerRef.current = trigger;
  }, [trigger, activeTool]);
  // ADR-583 Φ1 — keep the annotation-symbol selection store's active kind in sync
  // with the active placement tool, so the contextual picker shows the right kind's
  // variants and per-kind defaults never leak across tools (one tab, all kinds).
  React.useEffect(() => {
    const kind = annotationKindForTool(activeTool);
    if (kind) useAnnotationSymbolSelectionStore.getState().setActiveKind(kind);
  }, [activeTool]);
  return trigger;
}

// ADR-587 Φ3a — re-export ώστε το public API να παραμείνει σταθερό (ο resolver
// μετακόμισε στο `./resolve-contextual-trigger` ως καθαρό, entity-keyed SSoT module).
export { resolveContextualTrigger } from './resolve-contextual-trigger';
