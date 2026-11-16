/**
 * ADR-929 §6.25 — Τα **τρία βήματα** του βοηθού «Μοντέλο από το σχέδιο», ως ΚΑΘΑΡΗ παραγωγή από την κατάσταση.
 *
 * ① **Πηγή & κλίμακα** — από πού διαβάζουμε και σε ποια κλίμακα (Bluebeam/Togal: η κλίμακα ΠΡΩΤΑ).
 * ② **Τοίχοι** — ομάδες πάχους, ό,τι θέλει απόφαση, μία έγκριση.
 * ③ **Κουφώματα** — δική τους ουρά, δική τους έγκριση.
 *
 * 🔑 **Κανένα νέο πεδίο στο store.** Η κατάσταση κάθε βήματος ΠΑΡΑΓΕΤΑΙ από ό,τι ήδη ξέρει ο ελεγκτής· ένα δεύτερο
 *   αντίγραφο («βήμα 2 ολοκληρώθηκε») θα μπορούσε να διαφωνήσει με την αλήθεια. Το μόνο τοπικό είναι το ποιο βήμα
 *   **κοιτάζει** ο άνθρωπος — προτίμηση όψης, όχι δεδομένο.
 * 🔑 **Μη-γραμμικό** (NN/g: τα αλληλοεξαρτώμενα βήματα θέλουν ελεύθερη μετάβαση): κανένα βήμα δεν κλειδώνει την
 *   επίσκεψη· κλειδώνει μόνο η ΕΝΕΡΓΕΙΑ που δεν επιτρέπεται ακόμη (π.χ. έγκριση τοίχων χωρίς βαθμονόμηση).
 * ⚠️ «Τοίχοι: έγινε» στηρίζεται στην ειδοποίηση `written`, που είναι **η τελευταία πράξη**, όχι μόνιμο γεγονός: μια
 *   επόμενη πράξη τη σβήνει και το βήμα ξαναδείχνει τον αριθμό του. Αυτό είναι ειλικρινές (ο βοηθός δεν κρατά
 *   ιστορικό εγγραφών), αλλά καταγράφεται στο ADR-929 §6.25 ως γνωστό όριο.
 */

import type { StepRailStatus } from '@/components/ui/step-rail';
import { countProposalByStatus } from '../../../bim/model-from-drawing/assistant-preview';
import { countOpeningReview } from '../../../bim/model-from-drawing/opening-review';
import type { ModelFromDrawingState } from '../../../systems/model-from-drawing/model-from-drawing-store';

export const MFD_STEP_ORDER = ['source', 'walls', 'openings'] as const;
export type MfdStepId = (typeof MFD_STEP_ORDER)[number];

/** Ό,τι χρειάζεται η παραγωγή από την πηγή εικόνα (υπολογισμένο από τον host). */
interface MfdStepImageFacts {
  readonly calibrated: boolean;
}

const fromImage = (state: ModelFromDrawingState): boolean => state.lineSource.kind === 'raster';

function sourceStatus(state: ModelFromDrawingState, image: MfdStepImageFacts): StepRailStatus {
  if (!state.proposal) return 'pending';
  if (!fromImage(state)) return 'done';
  return image.calibrated ? 'done' : 'attention';
}

function wallsStatus(state: ModelFromDrawingState): StepRailStatus {
  if (state.notice?.kind === 'written') return 'done';
  if (!state.proposal) return 'pending';
  const counts = countProposalByStatus(state.proposal);
  return counts['needs-decision'] + counts.unconfirmed > 0 ? 'attention' : 'pending';
}

function openingsStatus(state: ModelFromDrawingState): StepRailStatus {
  if (state.notice?.kind === 'openings-written') return 'done';
  if (!state.openingProposal) return 'pending';
  return countOpeningReview(state.openingProposal, state.openingReview.choices).undecided > 0 ? 'attention' : 'pending';
}

/** Η κατάσταση κάθε βήματος — το κανάλι της ράγας. */
export function mfdStepStatuses(
  state: ModelFromDrawingState,
  image: MfdStepImageFacts,
): Readonly<Record<MfdStepId, StepRailStatus>> {
  return { source: sourceStatus(state, image), walls: wallsStatus(state), openings: openingsStatus(state) };
}

/**
 * Το βήμα που **προτείνει** η κατάσταση. Αλλάζει ΜΟΝΟ όταν προχωρά η δουλειά (βαθμονόμηση · εγγραφή τοίχων ·
 * έναρξη κουφωμάτων) — άρα η αυτόματη προώθηση γίνεται μόνο μετά από επιτυχή πράξη, ποτέ στη μέση μιας απόφασης.
 */
export function mfdSuggestedStep(state: ModelFromDrawingState, image: MfdStepImageFacts): MfdStepId {
  if (state.sampleRole === 'opening' || state.openingProposal) return 'openings';
  if (state.phase === 'picking' || !state.proposal) return 'source';
  if (state.notice?.kind === 'written') return 'openings';
  return fromImage(state) && !image.calibrated ? 'source' : 'walls';
}
