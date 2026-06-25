/**
 * structural-auto-reinforce-core — ADR-459 Phase 8 (proactive organism reinforce).
 *
 * SSoT πυρήνας του αυτόματου οπλισμού οργανισμού, εξαγμένος από το
 * `useStructuralAutoReinforce` ώστε να τον μοιράζονται **δύο** triggers χωρίς
 * διπλότυπο:
 *   · `useStructuralAutoReinforce` — ribbon κουμπί (`bim:auto-reinforce-requested`).
 *   · `useProactiveOrganismReinforce` — proactive geometry growth (Φ8).
 *
 * Resolve scope (επιλεγμένα ids → επιλεγμένα μέλη· κενό → όλος ο reinforceable
 * οργανισμός του ενεργού ορόφου) → build ΕΝΑ undoable `AutoReinforceOrganismCommand`
 * → `exec(cmd)` (execute ή executeGrouped, αποφασίζει ο caller) → emit
 * `bim:structural-auto-reinforced` (→ `useStructuralOrganism` re-derive διαγνωστικά).
 *
 * **Light module (Σκόπιμα χωρίς firebase/store imports):** ο `provider` περνιέται
 * injected από τον caller (που διαβάζει `structural-settings-store`) → ο πυρήνας
 * μένει jest-clean (καμία firebase chain). Το command είναι idempotent ως προς
 * ήδη-οπλισμένα μέλη → ασφαλές για επαναλαμβανόμενο proactive run.
 *
 * @see core/commands/entity-commands/AutoReinforceOrganismCommand.ts — το command
 * @see hooks/useStructuralAutoReinforce.ts — ribbon trigger
 * @see hooks/useProactiveOrganismReinforce.ts — proactive trigger (Φ8)
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 8
 */

import type { ICommand } from '../core/commands/interfaces';
import { EventBus } from '../systems/events/EventBus';
import { createLevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { AutoReinforceOrganismCommand } from '../core/commands/entity-commands/AutoReinforceOrganismCommand';
// ADR-486/504 — DERIVED span model δοκαριού (topology-aware τύπος στήριξης incl. 'continuous'
// + sizing-span, pure· κρατά το module jest-clean).
import { buildStructuralGraph } from '../bim/structural/organism/structural-graph';
import { buildBeamSpanModelMap } from '../bim/structural/organism/derive-beam-span-model';
import type { BeamSupportType } from '../bim/types/beam-types';
// ADR-498 — DERIVED topology-aware συνθήκη στήριξης πλάκας (spatial· πρόβολος → hogging άνω σχάρα).
import { computeSlabSupportConditions } from '../bim/structural/loads/slab-beam-support';
// ADR-499 §6.3-c — DERIVED στρεπτική ροπή δοκού (μονόπλευρη πρόβολος-πλάκα → στρεπτικός οπλισμός).
import { computeBeamDesignTorsion } from '../bim/structural/loads/beam-torsion';
import { isColumnEntity, isBeamEntity, isFoundationEntity, isSlabEntity } from '../types/entities';
// ADR-491 — DERIVED FEM ροπή φορέα ανά κολώνα στήριξης. Το engaged gate ζει στο ΕΝΑ SSoT
// `resolveEngagedAnalysisResult` (κοινό με τον render path active-reinforcement — μηδέν διπλό gate).
import { buildColumnFemMomentMap } from '../bim/structural/analytical/column-fem-moment';
import { resolveEngagedAnalysisResult } from '../bim/structural/analytical/engaged-analysis-result';
import type { Entity } from '../types/entities';
import type { SceneModel } from '../types/scene';
import type { StructuralCodeProvider } from '../bim/structural/codes/structural-code-types';

export interface ReinforceLevelManager {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

/** Δομικό μέλος που δέχεται οπλισμό (κολόνα/δοκάρι/πέδιλο/πλάκα — ADR-459 Φ4e/E3 + ADR-476). */
export function isReinforceable(e: Entity): boolean {
  return isColumnEntity(e) || isBeamEntity(e) || isFoundationEntity(e) || isSlabEntity(e);
}

/**
 * Εκτελεί τον αυτόματο οπλισμό του οργανισμού του ενεργού ορόφου.
 *
 * @param levelManager  ενεργός όροφος + scene accessors
 * @param entityIds     ρητό scope (selection)· κενό → όλος ο reinforceable οργανισμός
 * @param provider      ενεργός κανονισμός (injected — light module)
 * @param exec          executor από command history (`execute` ή `executeGrouped`)
 * @returns τα ids των μελών που πράγματι οπλίστηκαν (κενό = idempotent no-op). ADR-500 —
 *          ο convergence loop τα ταξινομεί ανά τύπο για το per-kind report (§7.2).
 */
export function runOrganismAutoReinforce(
  levelManager: ReinforceLevelManager,
  entityIds: readonly string[],
  provider: StructuralCodeProvider,
  exec: (cmd: ICommand) => void,
): readonly string[] {
  const levelId = levelManager.currentLevelId;
  if (!levelId) return [];
  const scene = levelManager.getLevelScene(levelId);
  if (!scene) return [];

  const entities = scene.entities as unknown as readonly Entity[];
  // Scope (Revit-grade): επιλογή → επιλεγμένα· αλλιώς όλος ο οργανισμός ορόφου.
  const ids = entityIds.length > 0 ? entityIds : entities.filter(isReinforceable).map((e) => e.id);
  if (ids.length === 0) {
    EventBus.emit('bim:structural-auto-reinforced', { entityIds: [], count: 0 });
    return [];
  }

  const sm = createLevelSceneManagerAdapter(
    levelManager.getLevelScene,
    levelManager.setLevelScene,
    levelId,
  );
  // ADR-486/504 — span model ανά δοκάρι από τη ζωντανή συνδεσιμότητα: ο πρόβολος (wL²/2) & ο
  // συνεχής δοκός (wL_sub²/10 + συμμετρικός χάλυβας) ξανα-σχεδιάζονται σωστά (αλλιώς stale 'simple').
  const beamSpanModels = buildBeamSpanModelMap(buildStructuralGraph(entities), entities);
  const supportTypeByBeamId = new Map<string, BeamSupportType>();
  const beamSpanByBeamId = new Map<string, number>();
  for (const [id, m] of beamSpanModels) {
    supportTypeByBeamId.set(id, m.supportType);
    if (m.supportType === 'continuous') beamSpanByBeamId.set(id, m.sizingSpanMm);
  }
  // ADR-491 — FEM ροπή φορέα ανά κολώνα (engaged-gated μέσω του ΕΝΟΣ SSoT): η κολώνα στήριξης
  // προβόλου οπλίζεται M-N για wL²/2. Μη-engaged → EMPTY → κενός χάρτης → μηδέν override (e₀).
  const columnFemMomentById = buildColumnFemMomentMap(
    resolveEngagedAnalysisResult(),
    entities.filter(isColumnEntity).map((e) => e.id),
  );
  // ADR-498 — συνθήκη στήριξης ανά πλάκα (spatial): ο πρόβολος ξανα-σχεδιάζεται με q·L²/2 άνω σχάρα.
  const slabSupportConditionBySlabId = computeSlabSupportConditions(entities);
  // ADR-499 §6.3-c — στρεπτική ροπή ανά δοκάρι (μονόπλευρη πρόβολος-πλάκα): η φέρουσα δοκός
  // παίρνει στρεπτικούς κλειστούς συνδετήρες + γωνιακούς διαμήκεις (ΕΝΑ SSoT με τον sensor/store).
  const beamTorsionByBeamId = computeBeamDesignTorsion(entities);
  const command = new AutoReinforceOrganismCommand(
    ids, sm, provider, supportTypeByBeamId, columnFemMomentById, slabSupportConditionBySlabId,
    beamTorsionByBeamId, beamSpanByBeamId,
  );
  const reinforced = command.getReinforcedEntityIds();
  if (reinforced.length === 0) {
    // Όλα ήδη οπλισμένα / μη-δομικά — no-op (κανένα undo entry).
    EventBus.emit('bim:structural-auto-reinforced', { entityIds: [], count: 0 });
    return [];
  }

  exec(command);
  EventBus.emit('bim:structural-auto-reinforced', {
    entityIds: reinforced,
    count: reinforced.length,
  });
  return reinforced;
}
