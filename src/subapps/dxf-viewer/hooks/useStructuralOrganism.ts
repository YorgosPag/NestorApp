'use client';

/**
 * useStructuralOrganism — ADR-459 Phase 1 (cross-entity diagnostics bridge).
 *
 * Thin, decoupled shell hook (mirror του `useStructuralAutoAttach`): ακούει τα
 * structural lifecycle events, ξανα-χτίζει τον DERIVED στατικό οργανισμό
 * (`buildStructuralGraph` → `runOrganismChecks`) από τη σκηνή του ενεργού ορόφου,
 * και γράφει τα ευρήματα στο `StructuralDiagnosticsStore` (low-freq → ADR-040 safe).
 *
 * Mounted ΜΙΑ φορά από το viewer shell (δίπλα στο `useStructuralAutoAttach`).
 * Re-derive coalesced ανά microtask: πολλά events στο ίδιο tick → ΕΝΑ recompute.
 *
 * @see bim/structural/organism/organism-checks.ts — buildStructuralGraph + runOrganismChecks
 * @see bim/structural/organism/structural-diagnostics-store.ts — ο store που γράφεται
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md
 */

import { useEffect, useRef } from 'react';
import { EventBus, type DrawingEventType } from '../systems/events/EventBus';
import { useBuildingStoreyCount } from './useBuildingStoreyCount';
import {
  buildStructuralGraph,
  runOrganismChecks,
} from '../bim/structural/organism/organism-checks';
import { runReinforcementChecks } from '../bim/structural/organism/reinforcement-checks';
import { runFootingDesignChecks } from '../bim/structural/footing-design/footing-design-checks';
import { buildActiveFootingFemAxialMap } from '../bim/structural/active-reinforcement';
import { StructuralDiagnosticsStore } from '../bim/structural/organism/structural-diagnostics-store';
// ADR-486 — DERIVED topology-aware τύπος στήριξης δοκαριού → transient store για το render path.
import { buildBeamSupportTypeMap } from '../bim/structural/organism/derive-beam-support';
import { BeamSupportConditionStore } from '../bim/structural/organism/beam-support-condition-store';
// ADR-488 §6.1 — DERIVED effective βάση κολώνας (στατική συνέχεια κολώνα→πέδιλο) → transient store.
import { buildColumnBaseContinuityMap } from '../bim/structural/organism/derive-column-base-continuity';
import { ColumnBaseContinuityStore } from '../bim/structural/organism/column-base-continuity-store';
import { buildOrganismScene } from '../bim/structural/organism/cross-level-organism-scene';
import { runStructuralAnalyticalModel } from './structural-analytical-core';
import { makeGuideOffsetLookup } from '../bim/hosting/guide-store-offset-lookup';
import { resolveStructuralCode } from '../bim/structural/codes';
import { useStructuralSettingsStore } from '../state/structural-settings-store';
import { useFoundationLevelStore } from '../state/foundation-level-store';
import type { Entity } from '../types/entities';
import type { SceneModel } from '../types/scene';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
}

/** Structural mutations που επηρεάζουν τον οργανισμό → trigger recompute. */
const ORGANISM_EVENTS: readonly DrawingEventType[] = [
  'drawing:entity-created',
  'bim:column-params-updated',
  'bim:entities-moved', // ADR-459 Φ7 — drag-move μέλους → re-derive organism (bearing edge follows)
  'bim:column-delete-requested',
  'bim:beam-params-updated',
  'bim:beam-delete-requested',
  'bim:foundation-params-updated',
  'bim:foundation-delete-requested',
  'bim:columns-from-grid',
  'bim:foundations-from-grid',
  'bim:beams-from-grid',
  'bim:columns-auto-attached',
  'bim:columns-auto-attached-base',
  'bim:column-footing-attached',
  'bim:column-footing-attached-manual',
  'bim:column-footing-detached',
  'bim:structural-auto-reinforced',
  // ADR-464 Slice 4 — αυτόματα φορτία πεδίλων υπολογίστηκαν → re-derive έδραση.
  'bim:structural-loads-computed',
];

export function useStructuralOrganism(props: { levelManager: LevelManagerLike }): void {
  const { levelManager } = props;
  // ADR-464 Slice 5 — μετρούμενοι όροφοι για τον raft bearing (ref → no re-subscribe).
  const storeyCount = useBuildingStoreyCount();
  const storeyCountRef = useRef(storeyCount);
  storeyCountRef.current = storeyCount;

  useEffect(() => {
    let scheduled = false;

    const recompute = (): void => {
      scheduled = false;
      const levelId = levelManager.currentLevelId;
      const scene = levelId ? levelManager.getLevelScene(levelId) : null;
      if (!levelId || !scene) {
        StructuralDiagnosticsStore.set([]);
        return;
      }
      const activeEntities = scene.entities as unknown as readonly Entity[];
      // ADR-459 Phase 0 — cross-level: merge τα πέδιλα του ορόφου Θεμελίωσης
      // (foundation-level-store) σε απόλυτα Z ώστε η footing-bearing ακμή
      // (πέδιλο Θεμελίωσης ↔ κολόνα ισογείου) να προκύπτει σωστά. Single-level
      // (κενός store target) → active-only + empty offset map → byte-for-byte η παλιά συμπεριφορά.
      const fl = useFoundationLevelStore.getState();
      const merged = fl.target
        ? buildOrganismScene({
            activeEntities,
            activeFloorElevationMm: fl.activeFloorElevationMm,
            foundationEntities: fl.entities,
            foundationFloorElevationMm: fl.target.floorElevationMm,
          })
        : { entities: activeEntities, floorElevationByEntityId: undefined };
      const entities = merged.entities;
      const graph = buildStructuralGraph(entities, {
        floorElevationByEntityId: merged.floorElevationByEntityId,
      });
      // ADR-486 — publish τον DERIVED topology-aware τύπο στήριξης (πρόβολος όταν 1 στήριξη)
      // στο transient store ώστε το per-entity render path (active-reinforcement) να τον
      // διαβάζει synchronous, χωρίς να ξαναχτίζει τον graph σε κάθε render (ADR-040 safe).
      BeamSupportConditionStore.set(buildBeamSupportTypeMap(graph));
      // ADR-488 §6.1 — publish την DERIVED effective βάση κάθε κολώνας (άνω παρειά
      // στηρίζοντος πεδίλου) στο transient store ώστε το 3Δ render path (syncColumns)
      // να κατεβάζει τη βάση στο πέδιλο (στατική συνέχεια), χωρίς να ξαναχτίζει graph.
      ColumnBaseContinuityStore.set(buildColumnBaseContinuityMap(graph));
      // ADR-459 Φ4d — geometry connectivity (graph-only) + reinforcement διαγνωστικά
      // (entities + active code provider) σε ΕΝΑ low-freq store write (ADR-040 safe).
      const settings = useStructuralSettingsStore.getState();
      const provider = resolveStructuralCode(settings.codeId);
      const diagnostics = [
        ...runOrganismChecks(graph),
        ...runReinforcementChecks(graph, entities, provider),
        // ADR-464 — έλεγχος έδρασης πεδίλου + raft (αδρανές χωρίς σ_allow / φορτίο).
        // ADR-497 — engaged FEM αντίδραση βάσης ανά πέδιλο (πρόβολος → single source of truth).
        ...runFootingDesignChecks(entities, provider, settings.soilBearingCapacityKpa, {
          storeyCount: storeyCountRef.current,
          deadAreaLoadKpa: settings.deadAreaLoadKpa ?? 0,
          liveAreaLoadKpa: settings.liveAreaLoadKpa ?? 0,
        }, buildActiveFootingFemAxialMap(entities)),
        // ADR-480 (T2) — χτίσε & δημοσίευσε τον DERIVED αναλυτικό φορέα + προκαταρκτικά
        // diagnostics ευστάθειας στο ΙΔΙΟ low-freq pass (single diagnostics writer).
        ...runStructuralAnalyticalModel({ entities, graph, getOffset: makeGuideOffsetLookup() }),
      ];
      StructuralDiagnosticsStore.set(diagnostics);
      EventBus.emit('bim:structural-organism-updated', {
        diagnosticCount: diagnostics.length,
        levelId,
      });
    };

    const schedule = (): void => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(recompute);
    };

    const unsubs = ORGANISM_EVENTS.map((ev) => EventBus.on(ev, schedule));
    // Αλλαγή building-level κανονισμού (Ευρωκώδικες↔ΕΚΩΣ) μεταβάλλει τα ρ-όρια →
    // re-derive τα reinforcement warnings (low-freq → ADR-040 safe).
    const unsubSettings = useStructuralSettingsStore.subscribe(schedule);
    // ADR-459 Phase 0 — αλλαγή του foundation-level snapshot (φόρτωση/μεταβολή
    // πεδίλων Θεμελίωσης) → re-derive ο cross-level οργανισμός (low-freq, ADR-040 safe).
    const unsubFoundation = useFoundationLevelStore.subscribe(schedule);
    schedule(); // initial pass
    return () => {
      unsubs.forEach((u) => u());
      unsubSettings();
      unsubFoundation();
    };
  }, [levelManager]);
}
