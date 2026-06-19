/**
 * structural-auto-study-core — ADR-500 (ADR-487 §7: «Αυτόματη Μελέτη»).
 *
 * Ο ντετερμινιστικός βρόχος σύγκλισης «δοκίμασε → έλεγξε → διόρθωσε → ξανά μέχρι μηδέν
 * κόκκινο» (ΟΡΑΜΑ ADR-487 §7). **ΔΕΝ είναι νέος engine** — ΕΝΟΡΧΗΣΤΡΩΝΕΙ τα υπάρχοντα
 * SSoT cores σε σειρά, σύγχρονα, μέσα σε ένα command (atomic undo):
 *
 *   1. `runStructuralLoadTakedown`  — φορτία (prereq, ΟΧΙ convergence driver)
 *   2. `runMemberAutoSize`          — μεγάλωσε διατομές (geometry ΠΡΩΤΑ)
 *   3. `runOrganismAutoReinforce`   — όπλισε (steel)
 *   4. `runAutoFoundationDesign`    — διόρθωσε πέδιλα (μετά το column-N)
 *   5. `runOrganismDiagnostics`     — re-derive ΣΥΓΧΡΟΝΑ (graph + αναλυτικός φορέας +
 *                                     diagnostics) → το convergence signal
 *   6. FEM solve (engaged-gated)    — refresh M/V/N για τον επόμενο γύρο (reuse SSoT)
 *
 * **🚨 Κανένα νέο reactive trigger** (μαθήματα ADR-491/488): one-shot σύγχρονο command.
 * Τα events που εκπέμπουν τα cores προγραμματίζουν τους reactive proactive hooks σε
 * microtask που τρέχει ΜΕΤΑ τον σύγχρονο βρόχο — αλλά τότε όλα έχουν συγκλίνει, οπότε
 * είναι idempotent no-ops (convergence guards κάθε core → μηδέν patch → μηδέν command).
 *
 * **🚨 Όριο γύρων + exit-to-human** (§7.4): `MAX_STUDY_ROUNDS=10` (oscillation guard) +
 * «no change → stop». Αν μετά MAX μένουν blocking diagnostics → επιστρέφονται ως
 * `remaining` ώστε ο caller να πει «εδώ χρειάζομαι εσένα» (ADR-490 overlay τα δείχνει ήδη).
 *
 * **Atomic undo:** 1ο command → `execute` (νέο undo entry)· όλα τα υπόλοιπα →
 * `executeGrouped` (`appendToLast`). Σύγχρονος βρόχος (ms) → εντός `mergeTimeWindow` →
 * ΟΛΟΙ οι γύροι = ΕΝΑ `CompositeCommand` → ΕΝΑ Ctrl+Z αναιρεί όλη τη μελέτη.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-500-auto-study-convergence-loop.md
 * @see docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md §7
 */

import type { ICommand } from '../core/commands/interfaces';
import { runStructuralLoadTakedown } from './structural-load-takedown-core';
import { runMemberAutoSize } from './member-auto-size-core';
import { runOrganismAutoReinforce } from './structural-auto-reinforce-core';
import {
  runAutoFoundationDesign,
  foundationChangeCount,
  type FoundationDesignLevelManager,
} from './auto-foundation-design-core';
import { runOrganismDiagnostics } from './structural-organism-core';
import { runStructuralAnalysis } from './structural-analysis-core';
import { AnalyticalModelStore } from '../bim/structural/analytical/analytical-model-store';
import { useAnalysisDiagramViewStore, isAnalysisEngaged } from '../state/analysis-diagram-view-store';
import type { StructuralDiagnostic } from '../bim/structural/organism/structural-organism-types';
import type { StructuralCodeProvider } from '../bim/structural/codes/structural-code-types';
import type { TakedownSettings } from '../bim/structural/loads/load-takedown';
import type { GuideOffsetLookup } from '../bim/hosting/derive-slots';
import type { FoundationWriterUser } from '../bim/foundations/foundation-write-scope';
import {
  isColumnEntity,
  isBeamEntity,
  isSlabEntity,
  isFoundationEntity,
  type Entity,
} from '../types/entities';

/** Όριο γύρων (§7.4 — ταλάντωση Α↔Β). Χωρίς αυτό = ατέρμονος βρόχος. */
export const MAX_STUDY_ROUNDS = 10;

/** Ο level manager καλύπτει τις απαιτήσεις και των 5 cores (foundation = superset). */
export type AutoStudyLevelManager = FoundationDesignLevelManager;

/** Injected dependencies — ο caller (hook) τα διαβάζει από stores/auth. */
export interface AutoStudyDeps {
  readonly provider: StructuralCodeProvider;
  readonly loadSettings: TakedownSettings;
  readonly getOffset: GuideOffsetLookup;
  readonly user: FoundationWriterUser;
  /** Μετρούμενοι όροφοι (raft bearing diagnostics). */
  readonly storeyCount: number;
  /** Νέο undo entry (1η αλλαγή της μελέτης). */
  readonly execute: (cmd: ICommand) => void;
  /** Append στο τελευταίο undo entry (όλες οι επόμενες αλλαγές → ΕΝΑ group). */
  readonly executeGrouped: (cmd: ICommand) => void;
  /** Override του ορίου γύρων (tests). Default `MAX_STUDY_ROUNDS`. */
  readonly maxRounds?: number;
}

/**
 * Αποτέλεσμα της μελέτης (για report + exit-to-human). ADR-500 DEFER A — **unique
 * per-kind counts** (όπως το όραμα §7.2 «6 κολώνες, 3 δοκάρια, 2 πέδιλα»): κάθε μέλος
 * μετριέται ΜΙΑ φορά, ακόμη κι αν άλλαξε σε πολλούς γύρους ή και διαστασιολογήθηκε ΚΑΙ
 * οπλίστηκε.
 */
export interface AutoStudyResult {
  readonly rounds: number;
  readonly columns: number;
  readonly beams: number;
  readonly slabs: number;
  readonly footings: number;
  /** True αν μηδέν blocking diagnostics στο τέλος (πλήρης σύγκλιση). */
  readonly converged: boolean;
  /** Τα blocking (error|warning) diagnostics που απομένουν → «χρειάζομαι εσένα». */
  readonly remaining: readonly StructuralDiagnostic[];
}

/** Συσσωρευτές unique ids ανά τύπο μέλους (de-dup σε γύρους + size↔reinforce overlap). */
interface ChangedMembers {
  readonly columns: Set<string>;
  readonly beams: Set<string>;
  readonly slabs: Set<string>;
  readonly footings: Set<string>;
}

/** Blocking = error ή warning (το «κόκκινο» που πρέπει να λυθεί). */
function isBlocking(d: StructuralDiagnostic): boolean {
  return d.severity === 'error' || d.severity === 'warning';
}

/**
 * Ταξινομεί τα αλλαγμένα member ids ανά τύπο (από τη σκηνή του ενεργού ορόφου) στους
 * unique συσσωρευτές. Πέδιλα του ορόφου Θεμελίωσης προστίθενται ξεχωριστά (footingIds).
 */
function classifyChangedMembers(
  levelManager: AutoStudyLevelManager,
  memberIds: readonly string[],
  acc: ChangedMembers,
): void {
  if (memberIds.length === 0) return;
  const levelId = levelManager.currentLevelId;
  if (!levelId) return;
  const scene = levelManager.getLevelScene(levelId);
  if (!scene) return;
  const byId = new Map((scene.entities as unknown as readonly Entity[]).map((e) => [e.id, e]));
  for (const id of memberIds) {
    const e = byId.get(id);
    if (!e) continue;
    if (isColumnEntity(e)) acc.columns.add(id);
    else if (isBeamEntity(e)) acc.beams.add(id);
    else if (isSlabEntity(e)) acc.slabs.add(id);
    else if (isFoundationEntity(e)) acc.footings.add(id);
  }
}

/**
 * FEM solve μόνο όταν ο μηχανικός «παρατηρεί» στατικά (engaged latch, ADR-488) — δεν
 * ανάβουμε διαγράμματα μόνοι μας. Reuse του SSoT solver (`runStructuralAnalysis`),
 * silent· refresh-άρει το `AnalysisResultsStore` ώστε ο reinforce του επόμενου γύρου
 * να διαβάσει φρέσκα M/V/N (μέσω `resolveEngagedAnalysisResult`). Εκτός engaged → no-op
 * (όπως ο reactive `useProactiveStructuralAnalysis`).
 */
function maybeSolveFem(levelManager: AutoStudyLevelManager): void {
  if (!isAnalysisEngaged(useAnalysisDiagramViewStore.getState())) return;
  const levelId = levelManager.currentLevelId;
  if (!levelId) return;
  const scene = levelManager.getLevelScene(levelId);
  if (!scene) return;
  const model = AnalyticalModelStore.get();
  if (model.members.length === 0) return;
  runStructuralAnalysis(
    { entities: scene.entities as unknown as readonly Entity[], model },
    { silent: true },
  );
}

/**
 * Εκτελεί την «Αυτόματη Μελέτη» — ντετερμινιστικός βρόχος σύγκλισης. Συγχρονη, one-shot.
 */
export function runAutoStudy(
  levelManager: AutoStudyLevelManager,
  deps: AutoStudyDeps,
): AutoStudyResult {
  const maxRounds = deps.maxRounds ?? MAX_STUDY_ROUNDS;
  // Atomic undo: 1η αλλαγή = νέο entry, οι υπόλοιπες = append → ΕΝΑ CompositeCommand.
  let firstCommand = true;
  const exec = (cmd: ICommand): void => {
    if (firstCommand) {
      deps.execute(cmd);
      firstCommand = false;
    } else {
      deps.executeGrouped(cmd);
    }
  };

  const changed: ChangedMembers = {
    columns: new Set(),
    beams: new Set(),
    slabs: new Set(),
    footings: new Set(),
  };
  let rounds = 0;
  let remaining: readonly StructuralDiagnostic[] = [];

  for (let round = 0; round < maxRounds; round++) {
    rounds = round + 1;
    // 1. φορτία (prereq) — κάθε γύρος ξεκινά από φρέσκο tributary takedown.
    runStructuralLoadTakedown(levelManager, deps.loadSettings, deps.getOffset, exec);
    // 2→4. μεγάλωσε → όπλισε → διόρθωσε πέδιλα (geometry → steel → foundation).
    const sized = runMemberAutoSize(levelManager, deps.provider, exec);
    const reinforced = runOrganismAutoReinforce(levelManager, [], deps.provider, exec);
    const foundation = runAutoFoundationDesign(levelManager, { user: deps.user, exec });
    // 5. re-derive ΣΥΓΧΡΟΝΑ → convergence signal (graph + αναλυτικός φορέας + diagnostics).
    const diags = runOrganismDiagnostics(levelManager, { storeyCount: deps.storeyCount });
    // 6. FEM refresh για τον επόμενο γύρο (engaged-gated reuse).
    maybeSolveFem(levelManager);

    // Unique per-kind (DEFER A): size∪reinforce ταξινομημένα + designed πέδιλα.
    classifyChangedMembers(levelManager, [...sized, ...reinforced], changed);
    for (const id of foundation.footingIds) changed.footings.add(id);
    remaining = diags.filter(isBlocking);

    const changedThisRound = sized.length + reinforced.length + foundationChangeCount(foundation);
    if (changedThisRound === 0) break; // τίποτα δεν άλλαξε → σύγκλιση/κόλλημα
    if (remaining.length === 0) break; // μηδέν κόκκινο → πλήρης σύγκλιση
  }

  return {
    rounds,
    columns: changed.columns.size,
    beams: changed.beams.size,
    slabs: changed.slabs.size,
    footings: changed.footings.size,
    converged: remaining.length === 0,
    remaining,
  };
}
