/**
 * 🎭 SNAP ORCHESTRATOR
 * Main orchestrator that coordinates snap engines using specialized components
 *
 * ⚠️  ΠΡΙΝ ΤΡΟΠΟΠΟΙΗΣΕΙΣ ΤΟ SNAPPING SYSTEM:
 * 📖 Architecture Guide: src/subapps/dxf-viewer/docs/CENTRALIZED_SYSTEMS.md
 * 🔍 Section: "Snapping Systems" - Κατάλαβε την αρχιτεκτονική πριν αλλάξεις
 *
 * @see docs/features/snapping/SNAP_INDICATOR_LINE.md - Τεκμηρίωση ενδείξεων έλξης
 * @see docs/features/snapping/ARCHITECTURE.md - Αρχιτεκτονική snap system
 *
 * 🏢 ENTERPRISE PATTERN: Orchestrator για coordination πολλαπλών snap engines
 *
 * @example
 * // ✅ ΣΩΣΤΑ - Χρήση μέσω orchestrator
 * const snap = orchestrator.findSnap(cursor, entities, viewport);
 *
 * // ❌ ΛΑΘΟΣ - Direct engine usage
 * const snap = snapEngine.findSnap(...); // Παρακάμπτει το orchestrator
 */

// DEBUG FLAG - Set to true for debugging snap issues
const DEBUG_SNAP_ORCHESTRATOR = false;

import type { Point2D } from '../../rendering/types/Types';
import { ExtendedSnapType, type Entity, type SnapEngineStats, type ProSnapSettings, type ProSnapResult, type SnapCandidate } from '../extended-types';
import { SnapEngineRegistry } from './SnapEngineRegistry';
import { SnapCandidateProcessor } from './SnapCandidateProcessor';
import { SnapContextManager } from './SnapContextManager';
// 🏢 ADR-728 Φ0.1 — attribution ΑΝΑ ENGINE μέσω του ΥΠΑΡΧΟΝΤΟΣ aggregator (μηδέν νέο σύστημα).
import { withPerf, isPerfEnabled, recordSample } from '../../systems/cursor/mouse-handler-perf';
import type { SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
// 🏢 ADR-728 Φ2 — ΕΝΑ broad phase, εδώ, πριν από τον βρόχο των engines.
import { buildSnapBroadPhase, selectBroadPhaseCandidates, type SnapBroadPhase } from './snap-broad-phase';

/**
 * 🏢 ADR-728 Φ0.1 — πρόθεμα των per-engine γραμμών στο κοινό `console.table`.
 *
 * Ίδιο ιδίωμα με το `FRAME_STAGE_PREFIX` (`rendering/core/frame-scheduler-perf-bridge.ts`), ώστε οι
 * γραμμές να ομαδοποιούνται οπτικά και να ξεχωρίζουν από τα cursor stages του ίδιου aggregator.
 *
 * **Γιατί υπάρχει:** η μέτρηση της 2026-07-29 έδειξε `frame:snap-detection` = **97,4%** του χρόνου
 * του καρέ (122/411 καρέ × **50,2ms**), αλλά είναι **ΜΙΑ γραμμή** — δεν λέει *ποια* από τις 26
 * engines το τρώει. Το ADR-726 έπεσε **τέσσερις** φορές σε ακριβώς αυτό το κενό (διόρθωση πριν από
 * attribution). Το ADR-728 §5 Φ0.1 το κάνει προϋπόθεση: **καμία διόρθωση πριν από αυτόν τον πίνακα.**
 */
export const SNAP_ENGINE_STAGE_PREFIX = 'snap:';

/**
 * 🏢 ADR-728 Φ0.1 — το **μέγεθος του προβλήματος**, όχι χρόνος: πόσες οντότητες παραδίδονται σε
 * κάθε engine ανά αναζήτηση.
 *
 * Σήμερα είναι **ολόκληρη η σκηνή** (2.910), επειδή δεν υπάρχει broad phase (ADR-728 §3.1). Είναι
 * το ίδιο μέγεθος που η Φ2 υποχρεούται να ρίξει σε ~5-20 — άρα η **ίδια** γραμμή που τεκμηριώνει
 * το πρόβλημα θα αποδείξει και τη θεραπεία, χωρίς δεύτερο όργανο.
 */
export const SNAP_ENTITY_COUNT_STAGE = `${SNAP_ENGINE_STAGE_PREFIX}ENTITIES`;

/**
 * 🏢 ADR-728 Φ2 — ο χρόνος του **ίδιου** του broad phase, στην ίδια στήλη με τις engines.
 *
 * Χωρίς αυτή τη γραμμή η Φ2 θα ήταν αναπόδεικτη προς τα κάτω: το `snap:ENTITIES` δείχνει πόσο
 * **μικρότερο** έγινε το πρόβλημα, αλλά όχι πόσο κόστισε να γίνει μικρότερο. Οι δύο γραμμές μαζί
 * είναι ο πλήρης απολογισμός (ίδιο ιδίωμα με τα per-engine stages της Φ0.1).
 *
 * ⚠️ **Καταγράφεται μόνο όταν υπάρχει πράγματι broad phase.** Σε pass-through (καμία οντότητα με
 * γνωστά bounds, ή ρητά απενεργοποιημένο) δεν εκτελείται δουλειά, άρα δεν υπάρχει τι να χρεωθεί —
 * μια γραμμή με μηδενικά δείγματα θα ήταν θόρυβος, όχι μέτρηση.
 */
export const SNAP_BROAD_PHASE_STAGE = `${SNAP_ENGINE_STAGE_PREFIX}BROAD`;

/**
 * 🏢 ADR-728 §Φ2 «δικλείδα» — η **άγκυρα pass-through**.
 *
 * Με `false` ο orchestrator συμπεριφέρεται **ακριβώς** όπως πριν τη Φ2 (κάθε engine βλέπει
 * ολόκληρη τη σκηνή). Υπάρχει ώστε το ίδιο σενάριο να τρέχει με και χωρίς φίλτρο και τα δύο
 * αποτελέσματα να συγκρίνονται — αυτό είναι το κριτήριο «συμπεριφορική ισοδυναμία 100%» του §6,
 * και είναι η μόνη απόδειξη που δεν στηρίζεται σε επιχείρημα.
 */
export const SNAP_BROAD_PHASE_DEFAULT_ENABLED = true;

/** Ρυθμίσεις κατασκευής του orchestrator (σήμερα: μόνο η άγκυρα pass-through). */
export interface SnapOrchestratorOptions {
  broadPhaseEnabled?: boolean;
}

/**
 * «Μάζεψα αρκετά — σταμάτα τις υπόλοιπες engines;» — δύο ανεξάρτητοι λόγοι, ένα ερώτημα.
 *
 * 1. **Sub-pixel early-exit** (FIX 2026-02-20): υποψήφιος πιο κοντά από ~1,5 pixel σε world units
 *    είναι όσο καλός γίνεται· οι ακριβές engines που απομένουν (`PERPENDICULAR` / `PARALLEL` /
 *    `NEAREST`) δεν έχουν τι να προσφέρουν.
 * 2. **Φράγμα `maxCandidates`** (ADR-597 anti-starvation): ο processor χρειάζεται λίγους καλούς
 *    υποψήφιους, όχι όλους.
 *
 * Καθαρή συνάρτηση, εξηγμένη από τον βρόχο για το όριο των 40 γραμμών (N.7.1). Η σημασιολογία
 * είναι **ταυτόσημη** με τον inline κώδικα που αντικατέστησε — καρφωμένη με tests
 * (`__tests__/SnapOrchestrator.collect-candidates.test.ts`).
 */
function hasEnoughCandidates(
  candidates: readonly SnapCandidate[],
  subPixelThreshold: number,
  maxCandidates: number,
): boolean {
  if (candidates.length === 0) return false;
  if (subPixelThreshold > 0) {
    let best = Infinity;
    for (const c of candidates) if (c.distance < best) best = c.distance;
    if (best <= subPixelThreshold) return true;
  }
  return candidates.length >= maxCandidates;
}

interface Viewport {
  worldPerPixelAt(p: Point2D): number;
  worldToScreen(p: Point2D): Point2D;
}

export interface SnapOrchestratorStats {
  totalEntities: number;
  candidateIndex: number;
  enabledEngines: ExtendedSnapType[];
  engineStats: Record<string, SnapEngineStats>;
}

export class SnapOrchestrator {
  private registry: SnapEngineRegistry;
  private processor: SnapCandidateProcessor;
  private contextManager: SnapContextManager;
  private entities: Entity[] = [];
  /** ADR-728 Φ2 — `null` ⇒ pass-through (καμία αλλαγή συμπεριφοράς έναντι της Φ0.1). */
  private broadPhase: SnapBroadPhase | null = null;
  private readonly broadPhaseEnabled: boolean;

  constructor(settings: ProSnapSettings, options?: SnapOrchestratorOptions) {
    this.registry = new SnapEngineRegistry();
    this.processor = new SnapCandidateProcessor();
    this.contextManager = new SnapContextManager(settings);
    this.broadPhaseEnabled = options?.broadPhaseEnabled ?? SNAP_BROAD_PHASE_DEFAULT_ENABLED;
  }

  /**
   * 🏢 FIX (2026-02-20): Update viewport for pixel→world tolerance conversion.
   * Called from SnapEngineCore.setViewport() on every zoom change and mouse move.
   * BEFORE: viewport was only set during initialize() — never updated afterwards.
   */
  setViewport(viewport: Viewport | null): void {
    this.contextManager.setViewport(viewport);
  }

  initialize(entities: Entity[], viewport?: Viewport): void {
    if (DEBUG_SNAP_ORCHESTRATOR) {
      console.log('🎭 [SnapOrchestrator] initialize called with', entities.length, 'entities');
    }

    this.entities = entities;
    this.contextManager.setViewport(viewport || null);

    // 🏢 ADR-728 Φ2 — το broad-phase ευρετήριο εξαρτάται ΜΟΝΟ από τις οντότητες, και αυτό εδώ
    // είναι το μοναδικό σημείο όπου αλλάζουν. Ο κύκλος ζωής είναι ήδη idle-deferred +
    // fingerprint-guarded από το `useGlobalSnapSceneSync` (ADR-040) — κανένας δικός μας.
    this.broadPhase = this.broadPhaseEnabled ? buildSnapBroadPhase(entities) : null;

    // Initialize engines through registry
    this.registry.initializeEnginesWithEntities(entities, this.contextManager.getSettings());

    if (DEBUG_SNAP_ORCHESTRATOR) {
      const settings = this.contextManager.getSettings();
      console.log('🎭 [SnapOrchestrator] Initialized with enabledTypes:', Array.from(settings.enabledTypes));
    }
  }

  updateSettings(settings: Partial<ProSnapSettings>): void {
    // 🚀 PERF (2026-02-22): Compare enabledTypes BEFORE updating context manager.
    // BUG FIX: Previous version compared AFTER update → prev was already the new value → always equal.
    let enabledTypesChanged = false;
    if (settings.enabledTypes && this.entities.length > 0) {
      const prev = this.contextManager.getSettings().enabledTypes;
      const next = settings.enabledTypes;
      enabledTypesChanged = next.size !== prev.size
        || [...next].some(t => !prev.has(t));
    }

    this.contextManager.updateSettings(settings);

    // 🏢 ENTERPRISE: Αυτόματη ενημέρωση GridSnapEngine όταν αλλάζει το gridStep
    if (settings.gridStep !== undefined) {
      this.registry.updateGridSettings(settings.gridStep);
    }

    // Only re-initialize engines if enabledTypes actually changed (prevents redundant spatial index rebuilds)
    // 🏢 ADR-728 Φ2 — το broad-phase ευρετήριο ΔΕΝ ξαναχτίζεται εδώ, **σκόπιμα**: το περιεχόμενό
    // του είναι συνάρτηση ΜΟΝΟ των `this.entities` (AABB ανά οντότητα), που δεν αλλάζουν σε
    // `updateSettings`. Η εξάρτηση από τα `enabledTypes` ζει αποκλειστικά στο **aperture**, το
    // οποίο υπολογίζεται ανά ερώτημα (`SnapContextManager.getBroadPhaseAperture`) — άρα είναι ήδη
    // φρέσκο. Ένα rebuild εδώ θα ήταν O(N) δουλειά με μηδέν διαφορά στο αποτέλεσμα, ακριβώς το
    // προφίλ «μία ακριβή εκτέλεση, 118 φθηνές» που το ADR-728 §2.2 εντόπισε ως ύποπτο.
    if (enabledTypesChanged) {
      this.registry.initializeEnginesWithEntities(this.entities, this.contextManager.getSettings());
    }
  }

  findSnapPoint(cursorPoint: Point2D, excludeEntityId?: string): ProSnapResult {
    const settings = this.contextManager.getSettings();

    if (!settings.enabled || settings.enabledTypes.size === 0) {
      if (DEBUG_SNAP_ORCHESTRATOR) {
        console.log('🎭 [SnapOrchestrator] findSnapPoint: Snapping disabled or no enabled types');
      }
      return this.processor.processResults(cursorPoint, [], settings);
    }

    // 🏢 FIX (2026-02-21): Removed entities.length === 0 early-exit.
    // Guide, Grid, and ConstructionPoint engines don't depend on scene entities —
    // they read from their own singleton stores. Returning early here blocked
    // snap-to-guide on empty scenes (Στοιχεία: 0).

    // Debug logging (limited frequency)
    const shouldLog = DEBUG_SNAP_ORCHESTRATOR && Math.random() < 0.01; // 1% of calls
    if (shouldLog) {
      console.log('🎭 [SnapOrchestrator] findSnapPoint:', {
        cursor: cursorPoint,
        entitiesCount: this.entities.length,
        enabledTypes: Array.from(settings.enabledTypes)
      });
    }

    // 🏢 ADR-728 Φ2 — ΕΝΑ broad phase, ΜΙΑ φορά, ΠΡΙΝ από τον βρόχο των engines (§3.3).
    const candidateEntities = this.selectCandidateEntities(cursorPoint);
    const context = this.contextManager.createEngineContext(
      cursorPoint, candidateEntities, excludeEntityId, this.entities,
    );

    // 🏢 ADR-728 Φ0.1 — το μέγεθος που η Φ2 υποχρεούται να ρίξει. Δείγμα, όχι χρόνος.
    // Μετά τη Φ2 αυτή η γραμμή είναι **η απόδειξη της θεραπείας**: ό,τι μετρούσε 2.910 σε κάθε
    // αναζήτηση οφείλει να μετράει ~5-50. Ίδιο όργανο, ίδια γραμμή, αντίθετο πρόσημο.
    if (isPerfEnabled()) recordSample(SNAP_ENTITY_COUNT_STAGE, context.entities.length);

    const collected = this.collectCandidates(cursorPoint, context, settings);
    if (collected.earlyReturn) return collected.earlyReturn;

    return this.processor.processResults(cursorPoint, collected.candidates, settings);
  }

  /**
   * 🏢 ADR-728 Φ2 — «ποιες οντότητες είναι κοντά στον κέρσορα;», απαντημένη **μία** φορά.
   *
   * Το κόστος του ίδιου του φίλτρου χρεώνεται ρητά στο {@link SNAP_BROAD_PHASE_STAGE}, στην ίδια
   * στήλη με τις engines — αλλιώς η Φ2 θα μπορούσε να «κερδίσει» μετακινώντας τον χρόνο σε
   * αμέτρητη θέση (ακριβώς το λάθος που το ADR-728 §3.6 καταγράφει για τη Φ11 του ADR-040).
   *
   * Χωρίς broad phase (pass-through) **δεν εκτελείται καμία δουλειά** και δεν καταγράφεται
   * stage: επιστρέφεται ο πίνακας της σκηνής αυτούσιος, δηλαδή η προ-Φ2 συμπεριφορά.
   */
  private selectCandidateEntities(cursorPoint: Point2D): Entity[] {
    const broadPhase = this.broadPhase;
    if (!broadPhase) return this.entities;

    return withPerf(SNAP_BROAD_PHASE_STAGE, () => selectBroadPhaseCandidates(
      broadPhase,
      this.entities,
      cursorPoint,
      this.contextManager.getBroadPhaseAperture(cursorPoint),
    ));
  }

  /**
   * Τρέχει τις enabled engines με σειρά προτεραιότητας και μαζεύει υποψηφίους.
   *
   * Εξήχθη από το {@link findSnapPoint} (N.7.1: εκείνο ήταν 83 γραμμές, όριο 40). Η σημασιολογία
   * είναι **ταυτόσημη** — ίδια σειρά, ίδια early-return, ίδια sub-pixel early-exit, ίδιο
   * `maxCandidates` φράγμα· μόνο η θέση του κώδικα άλλαξε.
   *
   * 🏢 **ADR-728 Φ2 (υλοποιημένη):** το `context.entities` που βλέπει αυτός ο βρόχος είναι πλέον
   * **broad-phase φιλτραρισμένο** — η ερώτηση «ποιες οντότητες είναι κοντά;» απαντήθηκε **μία**
   * φορά στο {@link selectCandidateEntities}, όχι μία ανά engine (ADR-728 §3.3). Οι engines
   * **δεν άλλαξαν γραμμή**: ίδιος τύπος, ίδια σημασιολογία, μικρότερος πίνακας.
   */
  private collectCandidates(
    cursorPoint: Point2D,
    context: SnapEngineContext,
    settings: ProSnapSettings,
  ): { candidates: SnapCandidate[]; earlyReturn?: ProSnapResult } {
    const allCandidates: SnapCandidate[] = [];

    // 🏢 FIX (2026-02-20): Sub-pixel early-exit threshold.
    // If a snap candidate is closer than ~1 pixel in world units, stop iterating modes.
    // This prevents expensive engines (PERPENDICULAR, PARALLEL, NEAREST) from running
    // when a high-quality snap was already found by a cheaper engine (ENDPOINT, MIDPOINT).
    const viewport = this.contextManager.getViewport();
    const subPixelThreshold = viewport
      ? viewport.worldPerPixelAt(cursorPoint) * 1.5  // 1.5 pixels in world units
      : 0; // No early-exit if viewport unavailable

    // Εκτέλεση όλων των enabled engines
    for (const snapType of settings.priority) {
      if (!settings.enabledTypes.has(snapType)) continue;

      const engine = this.registry.getEngine(snapType);
      if (!engine) {
        continue;
      }

      // 🏢 ADR-728 Φ0.1 — attribution ανά engine, πίσω από το ΥΠΑΡΧΟΝ flag `dxf-perf-trace`.
      // Με κλειστό flag το `withPerf` καλεί τη συνάρτηση **ασύλητη** (ένα boolean) — μηδέν κόστος
      // στην παραγωγή. Με ανοιχτό, το ίδιο το probe αλλοιώνει τα απόλυτα νούμερα (ADR-726 §2.2:
      // ~26 ζεύγη `performance.now()` ανά αναζήτηση) — **έγκυρη είναι μόνο η σχετική κατάταξη**,
      // που είναι ακριβώς το ερώτημα («ποια engine;»).
      const result: SnapEngineResult | null | undefined = withPerf(
        `${SNAP_ENGINE_STAGE_PREFIX}${snapType}`,
        () => engine.findSnapCandidates(cursorPoint, context),
      );

      // Guard against null/undefined result
      if (!result) {
        if (DEBUG_SNAP_ORCHESTRATOR) console.warn(`🔺 SnapOrchestrator: ${snapType} engine returned null/undefined result`);
        continue;
      }

      // Early return αν το engine το ζητάει
      if (result.earlyReturn) {
        return { candidates: allCandidates, earlyReturn: result.earlyReturn };
      }

      // Guard against invalid candidates array
      if (Array.isArray(result.candidates)) {
        allCandidates.push(...result.candidates);
      } else {
        if (DEBUG_SNAP_ORCHESTRATOR) console.warn(`🔺 SnapOrchestrator: Invalid candidates from ${snapType} engine:`, result.candidates);
      }

      if (hasEnoughCandidates(allCandidates, subPixelThreshold, context.maxCandidates)) break;
    }

    return { candidates: allCandidates };
  }

  cycleCandidates(): void {
    this.processor.cycleCandidates();
  }

  resetCandidateIndex(): void {
    this.processor.resetCandidateIndex();
  }

  setEnabled(enabled: boolean): void {
    const settings = this.contextManager.getSettings();
    this.contextManager.updateSettings({ enabled });
  }

  toggleSnapType(snapType: ExtendedSnapType, enabled: boolean): void {
    const settings = this.contextManager.getSettings();
    
    if (enabled) {
      settings.enabledTypes.add(snapType);
      this.registry.toggleEngine(snapType, true, this.entities);
    } else {
      settings.enabledTypes.delete(snapType);
      this.registry.toggleEngine(snapType, false, this.entities);
    }
    
    this.contextManager.updateSettings({ enabledTypes: settings.enabledTypes });
  }

  getStats(): SnapOrchestratorStats {
    const settings = this.contextManager.getSettings();
    const registryStats = this.registry.getEngineStats(settings.enabledTypes);

    return {
      ...registryStats,
      totalEntities: this.entities.length,
      candidateIndex: this.processor.getCandidateIndex()
    };
  }

  /**
   * 🔲 Update grid snap settings
   * Called when grid settings change (e.g., gridStep, majorInterval)
   */
  updateGridSettings(gridStep: number, majorInterval?: number): void {
    this.registry.updateGridSettings(gridStep, majorInterval);
  }

  dispose(): void {
    this.registry.dispose();
    this.entities = [];
    // ADR-728 Φ2 — το ευρετήριο κρατά αναφορές σε ids/AABB της σκηνής· φεύγει μαζί της.
    this.broadPhase = null;
  }
}