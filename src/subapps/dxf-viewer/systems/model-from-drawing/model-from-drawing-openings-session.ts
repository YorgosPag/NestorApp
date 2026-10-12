/**
 * ADR-911 Φ4-3β — ο **ελεγκτής ανοιγμάτων** του βοηθού «Μοντέλο από το σχέδιο»: το δεύτερο βήμα
 * της ίδιας συνεδρίας, πάνω στους τοίχους που ΥΠΑΡΧΟΥΝ ήδη στη σκηνή (γραμμένους από τον βοηθό ή
 * σχεδιασμένους με το χέρι). Ο ΕΝΑΣ που γράφει ανοίγματα του βοηθού στη σκηνή.
 *
 * Κύκλος: `armSample` (οπλισμένος για δείγμα «κούφωμα») → `adoptSample` (κλικ σε γραμμή ή τόξο ⇒
 * χρώμα-ρόλος ⇒ πρόταση) → απαντήσεις ανθρώπου (`choose`) → `approve`.
 *
 * Τρεις εγγυήσεις της έγκρισης, ίδιες και με την ίδια σειρά με των τοίχων:
 *   1. **Ό,τι γράφεται είναι ό,τι φωτίστηκε.** Πρόταση ΚΑΙ προεπισκόπηση ξαναϋπολογίζονται από τη
 *      ΖΩΝΤΑΝΗ σκηνή· αν το αποτύπωμά τους διαφέρει από εκείνο που είδε ο άνθρωπος (το πάνελ
 *      είναι modeless), ΔΕΝ γράφεται τίποτα — νέα προεπισκόπηση, νέα έγκριση.
 *   2. **Άρνηση του σχεδίου εγγραφής = καμία εγγραφή**, με όνομα.
 *   3. **Όλα ή τίποτα, ΕΝΑ undo** — το εγγυάται ο `addOpeningsToScene` (`runAsSingleUndo`).
 *
 * Ό,τι μένει ΑΝΑΠΟΦΑΣΙΣΤΟ δεν κλειδώνει την έγκριση: μένει έξω και ο αριθμός του φαίνεται. Ο
 * βοηθός δεν γράφει ποτέ κούφωμα που ο άνθρωπος δεν είδε να φωτίζεται ως «θα γραφτεί».
 *
 * Κανένας υπολογισμός γεωμετρίας εδώ: πρόταση = `computeOpeningProposal`, προεπισκόπηση =
 * `buildOpeningPreview`, εγγραφή = `addOpeningsToScene`. Zero React.
 *
 * @see ./model-from-drawing-session.ts (ο αδελφός ελεγκτής των τοίχων)
 * @see ./model-from-drawing-store.ts
 */

import { isWallEntity } from '../../types/entities';
import { addOpeningsToScene } from '../../bim/model-from-drawing/add-openings-to-scene';
import { computeOpeningProposal, type OpeningProposal } from '../../bim/model-from-drawing/opening-proposal';
import {
  buildOpeningPreview,
  openingReviewSignature,
  type OpeningPreview,
} from '../../bim/model-from-drawing/opening-preview';
import {
  canChooseOpening,
  decisionsFromChoices,
  type OpeningReviewChoice,
} from '../../bim/model-from-drawing/opening-review';
import { resolveEntityColorHex } from '../selection/select-similar-by-color';
import { isSampleFailure, readLiveScene, sampleColorAt, type SampleDeps } from './model-from-drawing-live';
import { modelFromDrawingStore, type ModelFromDrawingState } from './model-from-drawing-store';

/** Ό,τι χρειάζεται ο ελεγκτής ανοιγμάτων από τον κόσμο — διαβάζεται ΤΗ ΣΤΙΓΜΗ της πράξης. */
export interface OpeningSessionDeps extends SampleDeps {
  /** Η περιγραφή της εγγραφής στο ιστορικό αναίρεσης (i18n — από τον host). */
  readonly undoName: string;
}

/** Ό,τι αποφασίζει ο άνθρωπος και καθορίζει την πρόταση ανοιγμάτων. */
type OpeningInputs = Pick<ModelFromDrawingState, 'openingColorHex' | 'openingChoices'>;

interface Computed {
  readonly openingProposal: OpeningProposal;
  readonly openingPreview: OpeningPreview;
}

/** Πρόταση + προεπισκόπηση από τη ΖΩΝΤΑΝΗ σκηνή. `null` χωρίς σκηνή ή χωρίς δείγμα. */
function compute(inputs: OpeningInputs, deps: OpeningSessionDeps): Computed | null {
  const live = readLiveScene(deps.accessor);
  if (!live || !inputs.openingColorHex) return null;
  const openingProposal = computeOpeningProposal({
    entities: live.entities,
    openingColorHex: inputs.openingColorHex,
    colorOf: (e) => resolveEntityColorHex(e, deps.layersById),
    sceneUnits: live.sceneUnits,
    decisions: decisionsFromChoices(inputs.openingChoices),
  });
  const openingPreview = buildOpeningPreview({
    proposal: openingProposal,
    entities: live.entities,
    levelId: live.levelId,
    sceneUnits: live.sceneUnits,
    choices: inputs.openingChoices,
  });
  return { openingProposal, openingPreview };
}

/** Ξαναϋπολογίζει με (ενδεχομένως) νέες απαντήσεις και γράφει το αποτέλεσμα στο store. */
function recompute(inputs: Partial<OpeningInputs>, deps: OpeningSessionDeps): void {
  const state = modelFromDrawingStore.get();
  const merged: OpeningInputs = {
    openingColorHex: inputs.openingColorHex ?? state.openingColorHex,
    openingChoices: inputs.openingChoices ?? state.openingChoices,
  };
  modelFromDrawingStore.publishRecomputed(merged, compute(merged, deps), { sampleRole: 'wall' });
}

function sceneHasWalls(deps: OpeningSessionDeps): boolean {
  return readLiveScene(deps.accessor)?.entities.some(isWallEntity) ?? false;
}

export const modelFromDrawingOpeningsSession = {
  /** Οπλίζει το επόμενο κλικ ως δείγμα «κούφωμα». Ό,τι υπάρχει για τους τοίχους ΜΕΝΕΙ. */
  armSample(): void {
    if (modelFromDrawingStore.get().phase === 'closed') return;
    modelFromDrawingStore.patch({ phase: 'picking', sampleRole: 'opening', pendingSample: null, notice: null });
  },

  /**
   * Ακύρωση του δείγματος «κούφωμα»: πίσω εκεί από όπου ήρθε ο άνθρωπος — στον έλεγχο αν
   * υπάρχει πρόταση να ελεγχθεί, αλλιώς στο δείγμα «τοίχος». `false` ⇔ δεν ήταν δική του η
   * ακύρωση (ο βοηθός περίμενε δείγμα τοίχου, ή δεν περίμενε τίποτα).
   */
  cancelSample(): boolean {
    const state = modelFromDrawingStore.get();
    if (state.phase !== 'picking' || state.sampleRole !== 'opening') return false;
    const hasReview = state.proposal !== null || state.openingProposal !== null;
    modelFromDrawingStore.patch({
      phase: hasReview ? 'review' : 'picking', sampleRole: 'wall', pendingSample: null, notice: null,
    });
    return true;
  },

  /**
   * Υιοθετεί το κλικ-δείγμα «κούφωμα»: γραμμή ή τόξο ⇒ αποδιδόμενο χρώμα ⇒ πρόταση. Χωρίς
   * γραμμή κάτω από το κλικ, ή χωρίς κανέναν τοίχο να φιλοξενήσει κούφωμα, ο βοηθός ΜΕΝΕΙ
   * οπλισμένος και το λέει.
   */
  adoptSample(deps: OpeningSessionDeps): void {
    const { pendingSample, sampleRole } = modelFromDrawingStore.get();
    if (!pendingSample || sampleRole !== 'opening') return;
    modelFromDrawingStore.patch({ pendingSample: null });
    const sampled = sampleColorAt(pendingSample, deps, true);
    if (isSampleFailure(sampled)) {
      modelFromDrawingStore.patch({ notice: { kind: sampled } });
      return;
    }
    if (!sceneHasWalls(deps)) {
      modelFromDrawingStore.patch({ notice: { kind: 'no-walls' } });
      return;
    }
    recompute({ openingColorHex: sampled, openingChoices: new Map() }, deps);
  },

  /**
   * Η απάντηση του ανθρώπου για ένα ή περισσότερα στοιχεία (μαζική απόφαση για όμοια). `null` =
   * «αναποφάσιστο ξανά». Κλειδί που δεν δέχεται απάντηση αγνοείται — ο πυρήνας θα το αγνοούσε
   * ούτως ή άλλως, αλλά εδώ δεν μένει ούτε ως ψεύτικο «το είδα».
   */
  choose(keys: readonly string[], choice: OpeningReviewChoice | null, deps: OpeningSessionDeps): void {
    const state = modelFromDrawingStore.get();
    const choosable = new Set(state.openingProposal?.items.filter(canChooseOpening).map((i) => i.key));
    const next = new Map(state.openingChoices);
    for (const key of keys) {
      if (!choosable.has(key)) continue;
      if (choice === null) next.delete(key);
      else next.set(key, choice);
    }
    recompute({ openingChoices: next }, deps);
  },

  /**
   * Ξαναϋπολογίζει από τη ζωντανή σκηνή με τις ίδιες απαντήσεις. `keepNotice`: η σκηνή άλλαξε
   * επειδή ο ελεγκτής ΤΟΙΧΩΝ μόλις έγραψε — το «γράφτηκαν Ν τοίχοι» του δεν πρέπει να σβηστεί.
   */
  refresh(deps: OpeningSessionDeps, keepNotice = false): void {
    const { phase, openingColorHex, notice } = modelFromDrawingStore.get();
    if (phase !== 'review' || !openingColorHex) return;
    recompute({}, deps);
    if (keepNotice) modelFromDrawingStore.patch({ notice });
  },

  /**
   * Η ΜΙΑ έγκριση των ανοιγμάτων. Γράφει ΜΟΝΟ αν η πρόταση και η προεπισκόπηση από τη ζωντανή
   * σκηνή έχουν το ίδιο αποτύπωμα με όσα φωτίστηκαν. Επιστρέφει `true` ⇔ γράφτηκαν ανοίγματα.
   */
  approve(deps: OpeningSessionDeps): boolean {
    const state = modelFromDrawingStore.get();
    const { openingProposal: shown, openingPreview: shownPreview } = state;
    if (state.phase !== 'review' || !shown || !shownPreview) return false;
    const fresh = compute(state, deps);
    if (!fresh) {
      modelFromDrawingStore.patch({ notice: { kind: 'no-scene' } });
      return false;
    }
    const seen = openingReviewSignature(shown, shownPreview);
    if (openingReviewSignature(fresh.openingProposal, fresh.openingPreview) !== seen) {
      modelFromDrawingStore.patch({ ...fresh, notice: { kind: 'stale' } });
      return false;
    }
    return writeApproved(fresh.openingProposal, deps);
  },
};

/** Η εγγραφή: ανοίγματα (όλα ή τίποτα, ένα undo) → νέα πρόταση από τη σκηνή που προέκυψε. */
function writeApproved(proposal: OpeningProposal, deps: OpeningSessionDeps): boolean {
  const result = addOpeningsToScene(proposal.items, deps.accessor, { undoName: deps.undoName });
  if (!result.plan) {
    modelFromDrawingStore.patch({ notice: { kind: 'openings-refused', refusal: result.refusal ?? 'nothing-to-write' } });
    return false;
  }
  // Η σκηνή έχει πλέον τα ανοίγματα ⇒ η νέα πρόταση τα δείχνει ως «υπάρχουν ήδη» (ιδεμποτία, ορατή).
  recompute({}, deps);
  modelFromDrawingStore.patch({ notice: { kind: 'openings-written', count: result.plan.openings.length } });
  return true;
}
