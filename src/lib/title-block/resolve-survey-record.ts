/**
 * @fileoverview Λ2 — **σε ποιο τοπογραφικό** προσγειώνεται μια δήλωση του σχεδίου (ADR-759 Φ3γ).
 *
 * Δύο ερωτήματα, σκόπιμα χωριστά:
 * 1. **Πού** — ποια εγγραφή `survey_records` δέχεται την τιμή. Απαντιέται εδώ, **μία φορά**,
 *    για όλα τα πεδία: ο προορισμός είναι ιδιότητα του **έργου**, όχι του κελιού.
 * 2. **Τι** — ποια τιμή γράφεται σε ποιο πεδίο. Απαντά το `config/survey-bindable-fields.ts`.
 *
 * 🔑 Ο διαχωρισμός δεν είναι αισθητικός: αν ο προορισμός λυνόταν ανά πεδίο, ο μηχανικός θα
 * μπορούσε να στείλει την ημερομηνία στο ένα τοπογραφικό και την Πράξη Εφαρμογής στο άλλο —
 * δηλαδή να συνθέσει μια βεβαίωση που **κανείς τοπογράφος δεν υπέγραψε**. Ούτε το Revit
 * επιτρέπει Copy/Monitor «σε κάποιο link»: διαλέγεις τον σύνδεσμο, μετά τα στοιχεία.
 *
 * Καθαρή συνάρτηση: το στιγμιότυπο των εγγραφών δίνεται ως **όρισμα**, όπως οι επαφές.
 *
 * @module lib/title-block/resolve-survey-record
 */

import {
  parseSurveyValue,
  surveyBindingPreview,
  type BindableSurveyField,
} from '@/config/survey-bindable-fields';
import type {
  BindingBlockReason,
  BindingCandidate,
  BindingCaution,
  BindingProposal,
  BindingSourceKind,
} from '@/types/title-block-binding';
import type { ProposalBase } from './proposal-base';

/** Ένα τοπογραφικό, στην ελάχιστη προβολή που χρειάζεται η απόφαση προορισμού. */
export interface SurveyRecordSnapshotEntry {
  readonly id: string;
  /**
   * Επιβεβαιωμένο ⇒ **παγωμένο**. Τα Firestore rules το επιβάλλουν· εδώ το ξέρουμε **πριν**
   * το κλικ, ώστε η οθόνη να μην υπόσχεται εγγραφή που η βάση θα απορρίψει.
   */
  readonly isConfirmed: boolean;
  /**
   * Πώς **ταυτοποιείται** για τον άνθρωπο («30/7/2026», ή το όνομα αρχείου) — `null` όταν το
   * έγγραφο δεν λέει ακόμη τίποτα αναγνωρίσιμο (κάθε νέα, χειροκίνητη καρτέλα).
   *
   * Ωμή **ταυτότητα**, όπως το `ContactSnapshotEntry.displayName`: ο Λ2 δεν αγγίζει `t()` —
   * μεταφρασμένος resolver θα διάβαζε το **ίδιο αρχείο** αλλιώς ανά γλώσσα (ADR-759 §5.6).
   *
   * ⚠️ **Το `null` ΔΕΝ αντικαθίσταται εδώ με παύλα** (ADR-759 Φ4β): η φράση που το ντύνει
   * είναι κείμενο διεπαφής και ζει **μία** φορά στο `config/survey-record-labels.ts`, ώστε η
   * παλέτα και η καρτέλα να λένε κατά λέξη το ίδιο.
   */
  readonly label: string | null;
}

export interface SurveySnapshot {
  readonly records: readonly SurveyRecordSnapshotEntry[];
  /**
   * Ο **ρητός** δείκτης του έργου (`project.activeSurveyRecordId`).
   *
   * 🔴 `null` δεν σημαίνει «το νεότερο». Το ADR-759 Q1 απαγορεύει ρητά την παραγωγή του
   * ενεργού με ταξινόμηση: ανεβάζοντας **παλιότερο** τοπογραφικό θα άλλαζε από παρενέργεια
   * ποιο θεωρείται αυθεντικό. Δες {@link resolveSurveyDestination} για το τι γίνεται τότε.
   */
  readonly activeId: string | null;
}

/** Πού καταλήγει η προσγείωση — εγγραφή, ή ρητή αιτία που δεν γίνεται. */
export type SurveyDestination =
  | { readonly to: 'record'; readonly record: SurveyRecordSnapshotEntry }
  | { readonly to: 'blocked'; readonly reason: BindingBlockReason };

/**
 * Ποιο τοπογραφικό δέχεται τις τιμές αυτού του σχεδίου.
 *
 * Τέσσερις εκβάσεις, καμία σιωπηλή:
 *
 * | κατάσταση έργου | έκβαση | γιατί |
 * |---|---|---|
 * | καμία εγγραφή | `no-survey-record` | δεν φτιάχνουμε μία στο κλικ — άλλος ιδιοκτήτης |
 * | **ακριβώς μία** | αυτή | **πληθικότητα**, όχι ταξινόμηση: δεν υπάρχει δεύτερη να διαλέξεις |
 * | δείκτης δηλωμένος | αυτή που δείχνει | ο ρητός ιδιοκτήτης κερδίζει πάντα |
 * | >1 χωρίς δείκτη | `survey-record-undecided` | διαλέγει άνθρωπος, όχι `orderBy` |
 *
 * 🔑 **Το «ακριβώς μία» ΔΕΝ παραβιάζει το Q1**, και η διάκριση είναι λεπτή αλλά ολόκληρη:
 * το Q1 απαγορεύει να **ταξινομήσεις** και να πάρεις την πρώτη. Εδώ δεν ταξινομείται τίποτα —
 * με μία εγγραφή, «η ενεργή» και «η μοναδική» είναι **η ίδια πρόταση**. Χωρίς αυτό, ο
 * κανόνας θα μπλόκαρε το **100%** των σημερινών έργων, αφού **κανείς δεν γράφει ακόμη τον
 * δείκτη** — δηλαδή θα ήταν ορθότητα που δεν επιτρέπει καμία ορθή χρήση.
 *
 * ⚠️ Δείκτης που δείχνει σε **ανύπαρκτη** εγγραφή (διαγράφηκε) **δεν** υποχωρεί σιωπηλά στην
 * πρώτη: πέφτει στον κανόνα της πληθικότητας. Μία εγγραφή ⇒ αυτή· πολλές ⇒ ο άνθρωπος.
 */
export function resolveSurveyDestination(snapshot: SurveySnapshot | undefined): SurveyDestination {
  const records = snapshot?.records ?? [];
  if (records.length === 0) return { to: 'blocked', reason: 'no-survey-record' };

  const pointed = snapshot?.activeId
    ? records.find((r) => r.id === snapshot.activeId)
    : undefined;
  const chosen = pointed ?? (records.length === 1 ? records[0] : undefined);

  if (!chosen) return { to: 'blocked', reason: 'survey-record-undecided' };

  // 🔴 Ο έλεγχος παγώματος ζει **και εδώ και στον writer**. Εδώ επειδή ένα κουμπί που
  // υπόσχεται εγγραφή την οποία η βάση θα απορρίψει είναι σφάλμα αναφοράς· εκεί επειδή ένας
  // φύλακας που ζει μόνο στο UI δεν είναι φύλακας.
  if (chosen.isConfirmed) return { to: 'blocked', reason: 'survey-record-locked' };

  return { to: 'record', record: chosen };
}

/** Τι επιφύλαξη φέρει η ίδια η τιμή, ανεξάρτητα από τη σημαδούρα που τη γέννησε. */
function valueCaution(field: BindableSurveyField, rawText: string): BindingCaution | null {
  // Το πεδίο θέλει περισσότερη ακρίβεια απ' όση έδωσε το σχέδιο («ΙΟΥΛΙΟΣ 2026» → ημερομηνία).
  return parseSurveyValue(field, rawText).value === null ? 'partial-value' : null;
}

export interface SurveyProposalParams {
  readonly projectId: string;
  readonly field: BindableSurveyField;
  /** Το κείμενο του σχεδίου, αυτούσιο — γίνεται `rawText` του `Sourced`. */
  readonly rawText: string;
  readonly snapshot: SurveySnapshot | undefined;
  /**
   * Επιφύλαξη που προκύπτει από **την ανάγνωση** (π.χ. διφορούμενο ακρωνύμιο), όχι από την
   * τιμή. Υπερισχύει της επιφύλαξης ακρίβειας: αν δεν ξέρουμε καν αν η τιμή **ανήκει** εδώ,
   * το «λείπει η μέρα» είναι δευτερεύον θέμα.
   */
  readonly declaredCaution?: BindingCaution;
  readonly sourceKind?: BindingSourceKind;
  /** Πόσα ανεξάρτητα έγγραφα του σχεδίου λένε το ίδιο — δες {@link BindingProposal.corroboration}. */
  readonly corroboration?: number;
}

/**
 * **Η μία** κατασκευή πρότασης προς το τοπογραφικό.
 *
 * 🔑 Ζει εδώ και όχι στους δύο καλούντες (`resolve-location` για το «Π.Ε.»,
 * `title-block-proposals` για τον «ΧΡΟΝΟ ΜΕΛΕΤΗΣ») επειδή θα ήταν **ακριβώς** ο sibling clone
 * του N.18: δύο σχεδόν ίδιες συναρτήσεις που αποκλίνουν την ημέρα που αλλάξει ο κανόνας
 * προορισμού. Ο αναγνώστης του σώματος (Άξονας Α) θα γίνει ο **τρίτος** καλών, χωρίς γραμμή.
 *
 * Ποτέ δεν επιστρέφει «τίποτα»: κλειστός προορισμός ⇒ μπλοκαρισμένη πρόταση με **δηλωμένη**
 * αιτία. Γραμμή που εξαφανίζεται είναι σιωπηλή απώλεια (ADR-745 §8 κανόνας 3).
 */
export function buildSurveyProposal(
  base: ProposalBase,
  params: SurveyProposalParams,
): BindingProposal {
  const { projectId, field, rawText, snapshot, declaredCaution, sourceKind, corroboration } = params;
  // Ρητά spreads: το `exactOptionalPropertyTypes` ξεχωρίζει «απόν» από «`undefined`», και και
  // τα δύο πεδία τεκμηριώνονται ως **απόντα ⇒ προεπιλογή**, όχι ως `undefined`.
  const withSource = {
    ...base,
    ...(sourceKind ? { sourceKind } : {}),
    ...(corroboration !== undefined ? { corroboration } : {}),
  };
  const destination = resolveSurveyDestination(snapshot);

  if (destination.to === 'blocked') {
    return { ...withSource, candidates: [], blockedBy: destination.reason };
  }

  const candidate: BindingCandidate = {
    target: {
      kind: 'survey-record',
      projectId,
      recordId: destination.record.id,
      field,
      value: parseSurveyValue(field, rawText),
    },
    // Τι **θα γραφτεί** — και όχι το ωμό κείμενο, όταν τα δύο διαφέρουν («Π.Ε. 39» → «39»).
    label: surveyBindingPreview(field, rawText),
    // Κενή μαρτυρία επίτηδες: δεν τίθεται ερώτημα ταυτότητας. Ίδια σύμβαση με τον δήμο.
    evidence: [],
  };

  const caution = declaredCaution ?? valueCaution(field, rawText);
  return caution
    ? { ...withSource, candidates: [candidate], caution }
    : { ...withSource, candidates: [candidate] };
}
