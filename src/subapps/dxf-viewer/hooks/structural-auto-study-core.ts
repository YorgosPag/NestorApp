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
import type { Entity } from '../types/entities';

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

/** Αποτέλεσμα της μελέτης (για report + exit-to-human). */
export interface AutoStudyResult {
  readonly rounds: number;
  /** Σύνολο διαστασιολογήσεων μελών (αθροισμένο ανά γύρο). */
  readonly sized: number;
  /** Σύνολο οπλισμών μελών (αθροισμένο ανά γύρο). */
  readonly reinforced: number;
  /** Σύνολο αλλαγών πεδίλων (create+update+remove, αθροισμένο ανά γύρο). */
  readonly footed: number;
  /** True αν μηδέν blocking diagnostics στο τέλος (πλήρης σύγκλιση). */
  readonly converged: boolean;
  /** Τα blocking (error|warning) diagnostics που απομένουν → «χρειάζομαι εσένα». */
  readonly remaining: readonly StructuralDiagnostic[];
}

/** Blocking = error ή warning (το «κόκκινο» που πρέπει να λυθεί). */
function isBlocking(d: StructuralDiagnostic): boolean {
  return d.severity === 'error' || d.severity === 'warning';
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

  let sizedTotal = 0;
  let reinforcedTotal = 0;
  let footedTotal = 0;
  let rounds = 0;
  let remaining: readonly StructuralDiagnostic[] = [];

  for (let round = 0; round < maxRounds; round++) {
    rounds = round + 1;
    // 1. φορτία (prereq) — κάθε γύρος ξεκινά από φρέσκο tributary takedown.
    runStructuralLoadTakedown(levelManager, deps.loadSettings, deps.getOffset, exec);
    // 2→4. μεγάλωσε → όπλισε → διόρθωσε πέδιλα (geometry → steel → foundation).
    const sized = runMemberAutoSize(levelManager, deps.provider, exec);
    const reinforced = runOrganismAutoReinforce(levelManager, [], deps.provider, exec);
    const footed = foundationChangeCount(
      runAutoFoundationDesign(levelManager, { user: deps.user, exec }),
    );
    // 5. re-derive ΣΥΓΧΡΟΝΑ → convergence signal (graph + αναλυτικός φορέας + diagnostics).
    const diags = runOrganismDiagnostics(levelManager, { storeyCount: deps.storeyCount });
    // 6. FEM refresh για τον επόμενο γύρο (engaged-gated reuse).
    maybeSolveFem(levelManager);

    sizedTotal += sized;
    reinforcedTotal += reinforced;
    footedTotal += footed;
    remaining = diags.filter(isBlocking);

    if (sized + reinforced + footed === 0) break; // τίποτα δεν άλλαξε → σύγκλιση/κόλλημα
    if (remaining.length === 0) break; // μηδέν κόκκινο → πλήρης σύγκλιση
  }

  return {
    rounds,
    sized: sizedTotal,
    reinforced: reinforcedTotal,
    footed: footedTotal,
    converged: remaining.length === 0,
    remaining,
  };
}
