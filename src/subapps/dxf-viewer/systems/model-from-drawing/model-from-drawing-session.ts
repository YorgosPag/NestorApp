/**
 * ADR-911 Φ3β — ο **ελεγκτής** της συνεδρίας «Μοντέλο από το σχέδιο»: ο ΕΝΑΣ που αποφασίζει τι
 * γράφεται στο store της συνεδρίας, και ο ΕΝΑΣ που γράφει τοίχους στη σκηνή.
 *
 * Κύκλος: `open` (οπλισμένος) → `adoptSample` (κλικ σε γραμμή ⇒ χρώμα-ρόλος ⇒ πρόταση) →
 * αποφάσεις ανθρώπου (`confirmGroup`, `setUndecided`) → `approve`.
 *
 * Τρεις εγγυήσεις της έγκρισης, με αυτή τη σειρά:
 *   1. **Καμία ανεπιβεβαίωτη ομάδα πάχους** (Δ3) — ο βοηθός δεν γράφει ποτέ σιωπηλή λειτουργία.
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

import type { Entity, SceneLayer } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import type { WallCategory } from '../../bim/types/wall-types';
import type { WallTypingSession } from '../../bim/family-types/wall-typer';
import { addWallsToScene, type WallSceneAccessor } from '../../bim/walls/add-wall-to-scene';
import { extractLineSegments, pickSegmentAt } from '../../bim/walls/wall-in-region';
import { computeWallProposal, type WallProposal } from '../../bim/model-from-drawing/wall-proposal';
import {
  buildAssistantPreview,
  groupsAwaitingConfirmation,
  wallProposalSignature,
  type AssistantPreview,
} from '../../bim/model-from-drawing/assistant-preview';
import { resolveEntityColorHex } from '../selection/select-similar-by-color';
import { resolveSceneUnits, type SceneUnits } from '../../utils/scene-units';
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

interface LiveScene {
  readonly levelId: string;
  readonly entities: readonly Entity[];
  readonly sceneUnits: SceneUnits;
}

/** Ό,τι αποφασίζει ο άνθρωπος και καθορίζει την πρόταση. */
type ProposalInputs = Pick<ModelFromDrawingState, 'wallColorHex' | 'acceptedKeys' | 'categoryByThicknessMm'>;

interface Computed {
  readonly proposal: WallProposal;
  readonly preview: AssistantPreview;
}

function readLiveScene(accessor: WallSceneAccessor): LiveScene | null {
  const levelId = accessor.currentLevelId;
  const scene = levelId ? accessor.getLevelScene(levelId) : null;
  if (!levelId || !scene) return null;
  return { levelId, entities: (scene.entities ?? []) as readonly Entity[], sceneUnits: resolveSceneUnits(scene) };
}

/** Πρόταση + προεπισκόπηση από τη ΖΩΝΤΑΝΗ σκηνή. `null` χωρίς σκηνή ή χωρίς δείγμα. */
function compute(inputs: ProposalInputs, deps: ModelFromDrawingDeps): Computed | null {
  const live = readLiveScene(deps.accessor);
  if (!live || !inputs.wallColorHex) return null;
  const proposal = computeWallProposal({
    entities: live.entities,
    wallColorHex: inputs.wallColorHex,
    colorOf: (e) => resolveEntityColorHex(e, deps.layersById),
    sceneUnits: live.sceneUnits,
    levelId: live.levelId,
    acceptedKeys: inputs.acceptedKeys,
    categoryByThicknessMm: inputs.categoryByThicknessMm,
    typeWall: deps.typing.typeWall,
  });
  return { proposal, preview: buildAssistantPreview(proposal, live.entities) };
}

/** Ξαναϋπολογίζει με (ενδεχομένως) νέες αποφάσεις και γράφει το αποτέλεσμα στο store. */
function recompute(inputs: Partial<ProposalInputs>, deps: ModelFromDrawingDeps): void {
  const state = modelFromDrawingStore.get();
  const merged: ProposalInputs = {
    wallColorHex: inputs.wallColorHex ?? state.wallColorHex,
    acceptedKeys: inputs.acceptedKeys ?? state.acceptedKeys,
    categoryByThicknessMm: inputs.categoryByThicknessMm ?? state.categoryByThicknessMm,
  };
  const computed = compute(merged, deps);
  if (!computed) {
    modelFromDrawingStore.patch({ ...merged, notice: { kind: 'no-scene' } });
    return;
  }
  modelFromDrawingStore.patch({ ...merged, ...computed, phase: 'review', notice: null });
}

/** Το χρώμα της γραμμής κάτω από το `point`, ή ο λόγος που δεν βρέθηκε. */
function sampleColorAt(point: Point2D, deps: ModelFromDrawingDeps): string | 'no-scene' | 'no-line' | 'no-color' {
  const live = readLiveScene(deps.accessor);
  if (!live) return 'no-scene';
  const segment = pickSegmentAt(point, extractLineSegments(live.entities), deps.pickTolerance);
  const entity = segment ? live.entities.find((e) => e.id === segment.id) : undefined;
  if (!entity) return 'no-line';
  const hex = resolveEntityColorHex(entity, deps.layersById);
  return hex ?? 'no-color';
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
    const { pendingSample } = modelFromDrawingStore.get();
    if (!pendingSample) return;
    modelFromDrawingStore.patch({ pendingSample: null });
    const sampled = sampleColorAt(pendingSample, deps);
    if (sampled === 'no-scene' || sampled === 'no-line' || sampled === 'no-color') {
      modelFromDrawingStore.patch({ notice: { kind: sampled } });
      return;
    }
    recompute({ wallColorHex: sampled, acceptedKeys: new Set(), categoryByThicknessMm: new Map() }, deps);
  },

  /** Δ3 — ο άνθρωπος επιβεβαιώνει τη λειτουργία ΜΙΑΣ ομάδας πάχους. */
  confirmGroup(thicknessMm: number, category: WallCategory, deps: ModelFromDrawingDeps): void {
    const next = new Map(modelFromDrawingStore.get().categoryByThicknessMm);
    next.set(thicknessMm, category);
    recompute({ categoryByThicknessMm: next }, deps);
  },

  /** Δ7 — ο άνθρωπος αποφασίζει αν ένα αμφίσημο ορθογώνιο ΕΙΝΑΙ τοίχος. */
  setUndecided(key: string, isWall: boolean, deps: ModelFromDrawingDeps): void {
    const next = new Set(modelFromDrawingStore.get().acceptedKeys);
    if (isWall) next.add(key);
    else next.delete(key);
    recompute({ acceptedKeys: next }, deps);
  },

  /** «Αυτό κοιτάω» — μόνο έμφαση· δεν αγγίζει καμία απόφαση. */
  focus(key: string | null): void {
    modelFromDrawingStore.patch({ focusedKey: key });
  },

  /** Ξαναϋπολογίζει από τη ζωντανή σκηνή με τις ίδιες αποφάσεις. */
  refresh(deps: ModelFromDrawingDeps): void {
    if (modelFromDrawingStore.get().phase === 'review') recompute({}, deps);
  },

  /**
   * Η ΜΙΑ έγκριση. Γράφει ΜΟΝΟ αν: καμία ομάδα δεν εκκρεμεί, και η πρόταση από τη ζωντανή
   * σκηνή έχει το ίδιο αποτύπωμα με αυτή που φωτίστηκε. Επιστρέφει `true` ⇔ γράφτηκαν τοίχοι.
   */
  approve(deps: ModelFromDrawingDeps): boolean {
    const state = modelFromDrawingStore.get();
    const shown = state.proposal;
    if (state.phase !== 'review' || !shown) return false;
    if (groupsAwaitingConfirmation(shown).length > 0) {
      modelFromDrawingStore.patch({ notice: { kind: 'unconfirmed' } });
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
