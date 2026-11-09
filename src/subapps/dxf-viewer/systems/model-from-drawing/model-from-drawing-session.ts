/**
 * ADR-911 Φ3β — ο **ελεγκτής** της συνεδρίας «Μοντέλο από το σχέδιο»: ο ΕΝΑΣ που αποφασίζει τι
 * γράφεται στο store της συνεδρίας, και ο ΕΝΑΣ που γράφει τοίχους στη σκηνή.
 *
 * Κύκλος: `open` (οπλισμένος) → `adoptSample` (κλικ σε γραμμή ⇒ χρώμα-ρόλος ⇒ πρόταση) →
 * αποφάσεις ανθρώπου (`confirmGroup`, `setUndecided`) → `approve`.
 *
 * Τρεις εγγυήσεις της έγκρισης, με αυτή τη σειρά:
 *   1. **Μόνο επιβεβαιωμένες ομάδες πάχους** (Δ3) — ο βοηθός δεν γράφει ποτέ σιωπηλή λειτουργία. Εκ κατασκευής:
 *      η πρόταση δεν περιέχει τοίχο ανεπιβεβαίωτης ομάδας (`unconfirmed`, ADR-929 Φ5.2ε)· η έγκριση γράφει ό,τι
 *      αποφασίστηκε και αφήνει έξω τα υπόλοιπα, όπως τα αναποφάσιστα κουφώματα.
 *   2. **Ό,τι γράφεται είναι ό,τι φωτίστηκε.** Η πρόταση ξαναϋπολογίζεται από τη ΖΩΝΤΑΝΗ σκηνή·
 *      αν το αποτύπωμά της διαφέρει από εκείνο που είδε ο άνθρωπος (η σκηνή άλλαξε στο
 *      μεταξύ: το πάνελ είναι modeless, δεν κλειδώνει τα εργαλεία όπως το sketch mode του Revit),
 *      ΔΕΝ γράφεται τίποτα — η προεπισκόπηση ανανεώνεται και ζητείται νέα έγκριση.
 *   3. **Όλα ή τίποτα** — `onOverlap: 'refuse'`: δίχτυ ασφαλείας πίσω από το (2).
 *
 * Κανένας υπολογισμός γεωμετρίας εδώ: πρόταση = `computeWallProposal`, προεπισκόπηση =
 * `buildAssistantPreview`, εγγραφή = `addWallsToScene`.
 *
 * Zero React. Οι εξαρτήσεις (σκηνή, τυπογράφος, στρώσεις) δίνονται ανά κλήση από τον host.
 *
 * @see ./model-from-drawing-store.ts
 * @see ../../app/ModelFromDrawingHost.tsx (ο host που δίνει τις εξαρτήσεις)
 * @see docs/centralized-systems/reference/adrs/ADR-911-model-from-drawing-assistant.md §Φ3β
 */

import type { SceneLayer } from '../../types/entities';
import type { WallCategory } from '../../bim/types/wall-types';
import type { WallTypingSession } from '../../bim/family-types/wall-typer';
import { addWallsToScene, type WallSceneAccessor } from '../../bim/walls/add-wall-to-scene';
import { computeWallProposal, type WallProposal } from '../../bim/model-from-drawing/wall-proposal';
import {
  buildAssistantPreview,
  wallProposalSignature,
  type AssistantPreview,
} from '../../bim/model-from-drawing/assistant-preview';
import { isSampleFailure, readLiveScene, readSceneBasis, sampleColorAt, type SceneBasis } from './model-from-drawing-live';
import {
  isRasterPlacementCalibrated,
  resolveProposalLines,
  SCENE_LINE_SOURCE,
  type ProposalLineSource,
} from './proposal-line-source';
import { modelFromDrawingStore, type ModelFromDrawingState } from './model-from-drawing-store';

/** Ό,τι χρειάζεται ο ελεγκτής από τον κόσμο — διαβάζεται ΤΗ ΣΤΙΓΜΗ της πράξης, ποτέ νωρίτερα. */
export interface ModelFromDrawingDeps {
  readonly accessor: WallSceneAccessor;
  /** Η ΜΙΑ συνεδρία τύπων της συνεδρίας του βοηθού: σφραγίζει στην πρόταση, αποθηκεύει στην έγκριση. */
  readonly typing: WallTypingSession;
  readonly layersById: Record<string, SceneLayer>;
  /** Ακτίνα επιλογής γραμμής-δείγματος, σε μονάδες κόσμου. */
  readonly pickTolerance: number;
  /** Η περιγραφή της εγγραφής στο ιστορικό αναίρεσης (i18n — από τον host). */
  readonly undoName: string;
}

/** Ό,τι αποφασίζει ο άνθρωπος και καθορίζει την πρόταση. */
type ProposalInputs = Pick<
  ModelFromDrawingState,
  'lineSource' | 'wallColorHex' | 'acceptedDecisions' | 'categoryByThicknessMm'
>;

interface Computed {
  readonly proposal: WallProposal;
  readonly preview: AssistantPreview;
  /** Η σκηνή της πρότασης — ταξιδεύει ΜΑΖΙ της, ώστε κάθε δρόμος που γράφει πρόταση να γράφει και τη βάση της. */
  readonly wallBasis: SceneBasis;
}

/**
 * Πρόταση + προεπισκόπηση από τη ΖΩΝΤΑΝΗ σκηνή. `null` χωρίς σκηνή, χωρίς δείγμα, ή (πηγή εικόνα) χωρίς υπόβαθρο.
 * Η πηγή γραμμών (ADR-929 Φ5) αλλάζει μόνο την είσοδο· η μηχανή είναι η ίδια.
 */
function compute(inputs: ProposalInputs, deps: ModelFromDrawingDeps): Computed | null {
  const live = readLiveScene(deps.accessor);
  if (!live) return null;
  const lines = resolveProposalLines(inputs.lineSource, live, inputs.wallColorHex, deps.layersById);
  if (!lines) return null;
  const proposal = computeWallProposal({
    ...lines,
    sceneUnits: live.sceneUnits,
    levelId: live.levelId,
    acceptedDecisions: inputs.acceptedDecisions,
    categoryByThicknessMm: inputs.categoryByThicknessMm,
    typeWall: deps.typing.typeWall,
  });
  return { proposal, preview: buildAssistantPreview(proposal, lines.entities), wallBasis: readSceneBasis(deps.accessor) };
}

/** Ξαναϋπολογίζει με (ενδεχομένως) νέες αποφάσεις και γράφει το αποτέλεσμα στο store. */
function recompute(inputs: Partial<ProposalInputs>, deps: ModelFromDrawingDeps): void {
  const state = modelFromDrawingStore.get();
  const merged: ProposalInputs = {
    lineSource: inputs.lineSource ?? state.lineSource,
    wallColorHex: inputs.wallColorHex ?? state.wallColorHex,
    acceptedDecisions: inputs.acceptedDecisions ?? state.acceptedDecisions,
    categoryByThicknessMm: inputs.categoryByThicknessMm ?? state.categoryByThicknessMm,
  };
  modelFromDrawingStore.publishRecomputed(merged, compute(merged, deps));
}

export const modelFromDrawingSession = {
  /** Άνοιγμα / «άλλο δείγμα»: νέα συνεδρία, οπλισμένη, χωρίς καμία προηγούμενη απόφαση. */
  open(): void {
    modelFromDrawingStore.arm();
  },

  close(): void {
    modelFromDrawingStore.reset();
  },

  /**
   * Υιοθετεί το κλικ-δείγμα που άφησε ο καμβάς: γραμμή ⇒ αποδιδόμενο χρώμα ⇒ πρόταση. Αν δεν
   * υπήρχε γραμμή κάτω από το κλικ, ο βοηθός ΜΕΝΕΙ οπλισμένος και το λέει.
   */
  adoptSample(deps: ModelFromDrawingDeps): void {
    const { pendingSample, sampleRole } = modelFromDrawingStore.get();
    // Το δείγμα «κούφωμα» το υιοθετεί ο ελεγκτής ανοιγμάτων — ποτέ δύο ρόλοι από ένα κλικ.
    if (!pendingSample || sampleRole !== 'wall') return;
    modelFromDrawingStore.patch({ pendingSample: null });
    const sampled = sampleColorAt(pendingSample, deps, false);
    if (isSampleFailure(sampled)) {
      modelFromDrawingStore.patch({ notice: { kind: sampled } });
      return;
    }
    recompute(
      { lineSource: SCENE_LINE_SOURCE, wallColorHex: sampled, acceptedDecisions: [], categoryByThicknessMm: new Map() },
      deps,
    );
  },

  /**
   * ADR-929 Φ5 — η πηγή γίνεται τα τμήματα της εικόνας (ή μια νέα αναγνώριση/όψη/βαθμονόμηση τα αντικαθιστά). Όταν η
   * πηγή ήταν ήδη εικόνα του ίδιου ορόφου, **μένουν** και οι δύο λογιών αποφάσεις: οι ομάδες πάχους (Δ3) αφορούν πάχη,
   * όχι τμήματα· οι αποφάσεις αμφίσημων ορθογωνίων (Δ7) είναι άγκυρες στα pixel της εικόνας και ξαναβρίσκουν το
   * ορθογώνιό τους με επικάλυψη (§6.11) — όσες δεν το βρουν φαίνονται ως ορφανές, δεν σβήνονται σιωπηλά.
   */
  adoptRasterSegments(source: Extract<ProposalLineSource, { kind: 'raster' }>, deps: ModelFromDrawingDeps): void {
    const state = modelFromDrawingStore.get();
    const sameFloor = state.lineSource.kind === 'raster' && state.lineSource.floorId === source.floorId;
    recompute(
      {
        lineSource: source,
        acceptedDecisions: sameFloor ? state.acceptedDecisions : [],
        categoryByThicknessMm: sameFloor ? state.categoryByThicknessMm : new Map(),
      },
      deps,
    );
  },

  /** Δ3 — ο άνθρωπος επιβεβαιώνει τη λειτουργία ΜΙΑΣ ομάδας πάχους. */
  confirmGroup(thicknessMm: number, category: WallCategory, deps: ModelFromDrawingDeps): void {
    const next = new Map(modelFromDrawingStore.get().categoryByThicknessMm);
    next.set(thicknessMm, category);
    recompute({ categoryByThicknessMm: next }, deps);
  },

  /**
   * Δ7 — ο άνθρωπος αποφασίζει αν ένα αμφίσημο ορθογώνιο ΕΙΝΑΙ τοίχος. Η άγκυρα έρχεται από την πρόταση που είδε
   * (ίδιο αντικείμενο με την αποθηκευμένη, όταν υπάρχει) ⇒ ιδεμποτικό, και η αφαίρεση βρίσκει ακριβώς αυτήν.
   */
  setUndecided(key: string, isWall: boolean, deps: ModelFromDrawingDeps): void {
    const { proposal, acceptedDecisions } = modelFromDrawingStore.get();
    const anchor = proposal?.decisions.anchorByKey.get(key);
    if (!anchor) return;
    const rest = acceptedDecisions.filter((a) => a !== anchor);
    recompute({ acceptedDecisions: isWall ? [...rest, anchor] : rest }, deps);
  },

  /** ADR-929 §6.11 — ο άνθρωπος πετά τις αποφάσεις που δεν βρήκαν ορθογώνιο στην τρέχουσα πηγή (ρητά, ποτέ σιωπηλά). */
  discardOrphanedDecisions(deps: ModelFromDrawingDeps): void {
    const { proposal, acceptedDecisions } = modelFromDrawingStore.get();
    const orphaned = new Set(proposal?.decisions.orphaned ?? []);
    if (orphaned.size === 0) return;
    recompute({ acceptedDecisions: acceptedDecisions.filter((a) => !orphaned.has(a)) }, deps);
  },

  /** «Αυτό κοιτάω» — μόνο έμφαση· δεν αγγίζει καμία απόφαση. */
  focus(key: string | null): void {
    modelFromDrawingStore.patch({ focusedKey: key });
  },

  /**
   * Ξαναϋπολογίζει από τη ζωντανή σκηνή με τις ίδιες αποφάσεις. `keepNotice`: η σκηνή άλλαξε
   * επειδή ο ΑΛΛΟΣ ελεγκτής μόλις έγραψε (Φ4-3β) — το «γράφτηκαν Ν» του δεν πρέπει να σβηστεί.
   */
  refresh(deps: ModelFromDrawingDeps, keepNotice = false): void {
    const { phase, proposal, notice } = modelFromDrawingStore.get();
    if (phase !== 'review' || !proposal) return;
    recompute({}, deps);
    if (keepNotice) modelFromDrawingStore.patch({ notice });
  },

  /**
   * Η ΜΙΑ έγκριση. Γράφει τους τοίχους των επιβεβαιωμένων ομάδων, ΜΟΝΟ αν η πρόταση από τη ζωντανή
   * σκηνή έχει το ίδιο αποτύπωμα με αυτή που φωτίστηκε. Επιστρέφει `true` ⇔ γράφτηκαν τοίχοι.
   */
  approve(deps: ModelFromDrawingDeps): boolean {
    const state = modelFromDrawingStore.get();
    const shown = state.proposal;
    if (state.phase !== 'review' || !shown) return false;
    if (!isRasterPlacementCalibrated(state.lineSource)) {
      modelFromDrawingStore.patch({ notice: { kind: 'uncalibrated' } });
      return false;
    }
    const fresh = compute(state, deps);
    if (!fresh) {
      modelFromDrawingStore.patch({ notice: { kind: 'no-scene' } });
      return false;
    }
    if (wallProposalSignature(fresh.proposal) !== wallProposalSignature(shown)) {
      modelFromDrawingStore.patch({ ...fresh, notice: { kind: 'stale' } });
      return false;
    }
    return writeApproved(fresh.proposal, deps);
  },
};

/** Η εγγραφή: τύποι → τοίχοι (όλα ή τίποτα) → νέα πρόταση από τη σκηνή που προέκυψε. */
function writeApproved(proposal: WallProposal, deps: ModelFromDrawingDeps): boolean {
  // ADR-412 — οι τύποι που κόπηκαν για ΑΥΤΟΥΣ τους τοίχους αποθηκεύονται ακριβώς πριν την εγγραφή.
  deps.typing.commit(proposal.walls);
  const result = addWallsToScene(proposal.walls, deps.accessor, {
    origin: 'bulk',
    onOverlap: 'refuse',
    undoName: deps.undoName,
  });
  if (result.refusal) {
    modelFromDrawingStore.patch({ notice: { kind: 'refused', refusal: result.refusal, blocked: result.blocked } });
    return false;
  }
  // Η σκηνή έχει πλέον τους τοίχους ⇒ η νέα πρόταση τους δείχνει ως «υπάρχοντες» (Α-6, ορατό).
  recompute({}, deps);
  modelFromDrawingStore.patch({
    notice: { kind: 'written', count: result.written.length, retrimmed: result.retrimmedNeighbours },
  });
  return true;
}
