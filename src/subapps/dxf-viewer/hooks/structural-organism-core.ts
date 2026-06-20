/**
 * structural-organism-core — ADR-459 Phase 1 (cross-entity diagnostics SSoT πυρήνας).
 *
 * SSoT πυρήνας του re-derive του στατικού οργανισμού, εξαγμένος από το
 * `useStructuralOrganism` ώστε να τον μοιράζονται **δύο** callers χωρίς διπλότυπο:
 *   · `useStructuralOrganism` — reactive shell hook (coalesced ανά microtask).
 *   · `runAutoStudy` (ADR-500) — **σύγχρονος** convergence loop που χρειάζεται φρέσκα
 *     diagnostics ΜΕΣΑ στον γύρο (το store γράφεται async από το hook → stale read).
 *
 * Χτίζει τον DERIVED graph από τη σκηνή του ενεργού ορόφου (cross-level merge των
 * πεδίλων Θεμελίωσης), δημοσιεύει τα transient stores (support/torsion/continuity) για
 * το per-entity render path, και γράφει το ΕΝΑ `StructuralDiagnosticsStore` σε single
 * pass (διατηρείται ο single-writer). Επιστρέφει τα diagnostics ώστε ο σύγχρονος
 * caller να διαβάσει το convergence signal χωρίς να περιμένει microtask.
 *
 * **Light module (σκόπιμα χωρίς firebase imports):** το `storeyCount` περνιέται
 * injected (ο hook το διαβάζει από `useBuildingStoreyCount`) → ο πυρήνας μένει
 * jest-clean. Pure ως προς τα entities (μηδέν mutation).
 *
 * @see hooks/useStructuralOrganism.ts — ο reactive caller (single diagnostics writer)
 * @see hooks/structural-auto-study-core.ts — ο σύγχρονος caller (ADR-500)
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md
 * @see docs/centralized-systems/reference/adrs/ADR-500-auto-study-convergence-loop.md
 */

import { EventBus } from '../systems/events/EventBus';
import {
  buildStructuralGraph,
  runOrganismChecks,
} from '../bim/structural/organism/organism-checks';
import { runReinforcementChecks } from '../bim/structural/organism/reinforcement-checks';
import { runFootingDesignChecks } from '../bim/structural/footing-design/footing-design-checks';
import {
  buildActiveFootingFemAxialMap,
  buildActiveColumnDesignMomentMap,
} from '../bim/structural/active-reinforcement';
import { StructuralDiagnosticsStore } from '../bim/structural/organism/structural-diagnostics-store';
// ADR-486/504 — DERIVED span model δοκαριού (topology-aware τύπος στήριξης incl. 'continuous'
// + sizing-span) → 2 transient stores για το render/sizing path.
import { buildBeamSpanModelMap } from '../bim/structural/organism/derive-beam-span-model';
import type { BeamSupportType } from '../bim/types/beam-types';
import { BeamSupportConditionStore } from '../bim/structural/organism/beam-support-condition-store';
import { BeamSpanStore } from '../bim/structural/organism/beam-span-store';
import { computeSlabSupportConditions } from '../bim/structural/loads/slab-beam-support';
import { SlabSupportConditionStore } from '../bim/structural/organism/slab-support-condition-store';
import { computeBeamDesignTorsion } from '../bim/structural/loads/beam-torsion';
import { BeamTorsionStore } from '../bim/structural/organism/beam-torsion-store';
// ADR-506 — DERIVED άνω όριο πλάτους δοκαριού (κάθετη προβολή στηρίζουσας κολώνας) → transient store.
import { buildBeamMaxWidthMap } from '../bim/structural/organism/derive-beam-max-width';
import { BeamMaxWidthStore } from '../bim/structural/organism/beam-max-width-store';
// ADR-502 §Slice2 — DERIVED στατική ροπή στηρίζουσας κολώνας από δοκάρι-πρόβολο → transient store.
import { buildColumnSupportMomentMap } from '../bim/structural/loads/column-support-moment';
import { ColumnSupportMomentStore } from '../bim/structural/organism/column-support-moment-store';
import { runSlabChecks } from '../bim/structural/organism/slab-checks';
import { runBeamTorsionChecks } from '../bim/structural/organism/beam-torsion-checks';
import { runFeasibilityChecks } from '../bim/structural/organism/feasibility-checks';
// ADR-504 §Φ1 — practical-span advisory (μη-πρακτικά βαθιά δοκός → πρόταση ενδιάμεσων κολωνών).
import { runPracticalSpanChecks } from '../bim/structural/organism/practical-span-checks';
import { readActiveStoreyContext } from '../systems/levels/storey-creation-defaults';
import { DEFAULT_STOREY_HEIGHT_MM } from '../systems/levels/active-storey-context';
// ADR-488 §6.1 — DERIVED effective βάση κολώνας (στατική συνέχεια κολώνα→πέδιλο) → transient store.
import { buildColumnBaseContinuityMap } from '../bim/structural/organism/derive-column-base-continuity';
import { ColumnBaseContinuityStore } from '../bim/structural/organism/column-base-continuity-store';
import { buildOrganismScene } from '../bim/structural/organism/cross-level-organism-scene';
import { runStructuralAnalyticalModel } from './structural-analytical-core';
import { makeGuideOffsetLookup } from '../bim/hosting/guide-store-offset-lookup';
import { resolveStructuralCode } from '../bim/structural/codes';
import { useStructuralSettingsStore } from '../state/structural-settings-store';
import { useFoundationLevelStore } from '../state/foundation-level-store';
import type { StructuralDiagnostic } from '../bim/structural/organism/structural-organism-types';
import type { Entity } from '../types/entities';
import type { SceneModel } from '../types/scene';

export interface OrganismLevelManager {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
}

/** Injected dependencies (κρατούν τον πυρήνα jest-clean — μηδέν React hooks μέσα). */
export interface OrganismDiagnosticsDeps {
  /** Μετρούμενοι όροφοι (raft bearing) — από `useBuildingStoreyCount`. */
  readonly storeyCount: number;
}

/**
 * (Επαν)παράγει τον στατικό οργανισμό του ενεργού ορόφου, δημοσιεύει τα transient
 * stores + το `StructuralDiagnosticsStore`, και επιστρέφει τα DERIVED diagnostics.
 *
 * @returns τα τρέχοντα diagnostics (ίδια αναφορά με το store) — convergence signal.
 */
export function runOrganismDiagnostics(
  levelManager: OrganismLevelManager,
  deps: OrganismDiagnosticsDeps,
): readonly StructuralDiagnostic[] {
  const levelId = levelManager.currentLevelId;
  const scene = levelId ? levelManager.getLevelScene(levelId) : null;
  if (!levelId || !scene) {
    StructuralDiagnosticsStore.set([]);
    return StructuralDiagnosticsStore.getAll();
  }
  const activeEntities = scene.entities as unknown as readonly Entity[];
  // ADR-459 Phase 0 — cross-level: merge τα πέδιλα του ορόφου Θεμελίωσης σε απόλυτα Z
  // ώστε η footing-bearing ακμή (πέδιλο Θεμελίωσης ↔ κολόνα ισογείου) να προκύπτει σωστά.
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
  // ADR-486/498/499/488 — δημοσίευσε τους DERIVED transient χάρτες για το per-entity
  // render path (synchronous reads, μηδέν re-build του graph σε κάθε render — ADR-040 safe).
  // ADR-486/504 — ΕΝΑ DERIVED span-model pass: ο τύπος στήριξης (incl. 'continuous') ΚΑΙ το
  // υπο-άνοιγμα ζευγαρώνουν → 2 stores από την ίδια πηγή (μηδέν διπλή αλήθεια). Span μόνο για
  // συνεχείς (αλλιώς undefined → fallback πλήρες μήκος στον consumer).
  const beamSpanModels = buildBeamSpanModelMap(graph, entities);
  const beamSupportTypes = new Map<string, BeamSupportType>();
  const beamSpans = new Map<string, number>();
  for (const [id, m] of beamSpanModels) {
    beamSupportTypes.set(id, m.supportType);
    if (m.supportType === 'continuous') beamSpans.set(id, m.sizingSpanMm);
  }
  BeamSupportConditionStore.set(beamSupportTypes);
  BeamSpanStore.set(beamSpans);
  SlabSupportConditionStore.set(computeSlabSupportConditions(entities));
  BeamTorsionStore.set(computeBeamDesignTorsion(entities));
  BeamMaxWidthStore.set(buildBeamMaxWidthMap(graph, entities)); // ADR-506 — width-sizing cap
  ColumnSupportMomentStore.set(buildColumnSupportMomentMap(entities, graph)); // ADR-502 §Slice2
  ColumnBaseContinuityStore.set(buildColumnBaseContinuityMap(graph));

  const settings = useStructuralSettingsStore.getState();
  const provider = resolveStructuralCode(settings.codeId);
  // ADR-504 §Φ1 — δυναμικό practical-span threshold από τον ενεργό όροφο (ύψος ορόφου +
  // χρήση)· degenerate (χωρίς active storey) → τυπικός όροφος 3,0m/κατοικία (μηδέν regression).
  const storeyCtx = readActiveStoreyContext();
  const practicalSpanStorey = {
    storeyHeightMm: storeyCtx?.storeyHeightMm ?? DEFAULT_STOREY_HEIGHT_MM,
    storeyKind: storeyCtx?.storeyKind ?? null,
  };
  const diagnostics = [
    ...runOrganismChecks(graph),
    ...runReinforcementChecks(graph, entities, provider),
    ...runFootingDesignChecks(entities, provider, settings.soilBearingCapacityKpa, {
      storeyCount: deps.storeyCount,
      deadAreaLoadKpa: settings.deadAreaLoadKpa ?? 0,
      liveAreaLoadKpa: settings.liveAreaLoadKpa ?? 0,
    }, buildActiveFootingFemAxialMap(entities)),
    ...runSlabChecks(entities, provider),
    ...runBeamTorsionChecks(entities),
    ...runFeasibilityChecks(entities, provider, buildActiveColumnDesignMomentMap(entities)),
    ...runPracticalSpanChecks(entities, graph, provider, practicalSpanStorey),
    ...runStructuralAnalyticalModel({ entities, graph, getOffset: makeGuideOffsetLookup() }),
  ];
  StructuralDiagnosticsStore.set(diagnostics);
  EventBus.emit('bim:structural-organism-updated', {
    diagnosticCount: diagnostics.length,
    levelId,
  });
  return StructuralDiagnosticsStore.getAll();
}
