/**
 * 🔴 ADR-769 Δ1 — **ΠΟΙΟΣ ΕΚΤΕΛΕΙ**: από εγκεκριμένο πλάνο σε **ΥΠΑΡΧΟΥΣΑ** εντολή.
 *
 * ## ⛔ Καμία νέα οικογένεια εντολών — και αυτό είναι όλο το αρχείο
 * Το ADR-766 Α2 λέει «**ΕΝΑΣ** ιδιοκτήτης». Ο ιδιοκτήτης του πίνακα συντεταγμένων υπάρχει
 * γραμμένος, undoable, με το γραπτό συμβόλαιο των τριών βημάτων και με `reconcile` **σύγχρονα
 * μέσα** στην εντολή: `MoveTopoSurveyPointCommand` (ADR-662 §13). Αυτό το module **δεν χτίζει
 * εντολή** — μεταφράζει «η κορυφή 14 είναι στο X = 391.698,5» στη μία κλήση που ο ιδιοκτήτης
 * ήδη δέχεται. Δεύτερο μονοπάτι γραφής θα ήταν το ίδιο σχήμα με τα δύο raycasters του
 * hit-test: δύο απαντήσεις, και test στον έναν = τυφλός στον άλλο.
 *
 * ## 🔴 Το μητρώο είναι `Record<TableSourceKind, …>` για τον ίδιο λόγο με τους resolvers
 * Νέα πηγή ⇒ **δεν μεταγλωττίζεται** μέχρι να δηλωθεί ποιος εκτελεί γι' αυτήν. Οι
 * μη-συνδεδεμένες πηγές δηλώνουν {@link noOwner} — και είναι **δομικά απρόσιτες**, γιατί το
 * `tableSourceColumnWriteBack` τους απαντά ήδη `no-owner` για κάθε στήλη, δηλαδή ο φρουρός
 * απορρίπτει πριν φτάσει εδώ. Δηλώνονται παρ' όλα αυτά ονομαστικά: μια κενή θέση θα γινόταν
 * `undefined` σε χρόνο εκτέλεσης την ημέρα που κάποιος συνδέσει τη στήλη και ξεχάσει τον
 * εκτελεστή.
 *
 * @module subapps/dxf-viewer/bim/table/write-back/table-write-back-owner
 * @see core/commands/entity-commands/MoveTopoSurveyPointCommand.ts — ο ιδιοκτήτης
 * @see systems/topography/topo-survey-point-resolve.ts — `surveyPointDeltaForField`
 * @see docs/centralized-systems/reference/adrs/ADR-769-table-live-write-back.md §4 Δ1
 */

import { isTopoSurfaceEntity } from '../../../types/topo-surface';
import { getTopoPoints } from '../../../systems/topography/TopoPointStore';
import { surveyPointDeltaForField } from '../../../systems/topography/topo-survey-point-resolve';
import { MoveTopoSurveyPointCommand } from '../../../core/commands/entity-commands/MoveTopoSurveyPointCommand';
import type { TableWriteBackField } from './table-write-back-plan';
import type { ICommand, ISceneManager } from '../../../core/commands';
import type { TopoSurfaceId } from '../../../systems/topography/topo-types';
import type { TableSourceKind, TableSourceRef } from '../../../types/table-source-ref';

/**
 * 🔴 Η επιφάνεια που τρέφει τον πίνακα συντεταγμένων.
 *
 * Δηλώνεται **ρητά** ώστε η σύζευξη να είναι ορατή: ο παραγωγός (`readTableSourceContext` →
 * `getTopoPoints()`) διαβάζει το **προεπιλεγμένο** όρισμα του store, και το `sourceRef` του
 * ADR-767 Δ7 δηλώνει επίτηδες «χωρίς παραμέτρους». Αν η μία μέρα γίνουν δύο επιφάνειες, το
 * `sourceRef` αποκτά πεδίο και **αυτή** η σταθερά είναι το σημείο που θα φωνάξει — αντί να το
 * ανακαλύψει κάποιος επειδή ο πίνακας μετακίνησε κορυφή άλλης αποτύπωσης.
 */
const SURVEY_SOURCE_SURFACE_ID: TopoSurfaceId = 'existing';

/** Ό,τι χρειάζεται ένας ιδιοκτήτης για να εκτελέσει ένα **εγκεκριμένο** πλάνο. */
export interface TableWriteBackOwnerAsk {
  readonly sourceRef: TableSourceRef;
  /** Ο δείκτης της γραμμής στην **πηγή** — υπολογισμένος μία φορά, ποτέ ξανά εδώ. */
  readonly sourceRowIndex: number;
  readonly field: TableWriteBackField;
  /** Η **απόλυτη** τιμή σε μονάδες αποθήκης (ο κριτής έκανε ήδη τη μετατροπή, Δ4). */
  readonly storeValue: number;
  readonly sceneManager: ISceneManager;
}

type OwnerExecutor = (ask: TableWriteBackOwnerAsk) => ICommand | null;

/**
 * Η οντότητα-περίγραμμα της επιφάνειας — ο δεύτερος μισός της ταυτότητας που θέλει η εντολή.
 *
 * `null` όταν η σκηνή δεν την έχει (δεν έχει παραχθεί ακόμη, ή σβήστηκε): **άρνηση**, ποτέ
 * μαντεψιά. Χωρίς περίγραμμα, το βήμα 2 του συμβολαίου της εντολής (πηγή → **παράγωγο** →
 * εξαρτημένα) δεν έχει τι να ξαναπαράγει.
 */
function footprintEntityIdFor(
  sceneManager: ISceneManager,
  surfaceId: TopoSurfaceId,
): string | null {
  const entities = sceneManager.getEntities?.() ?? [];
  for (const entity of entities) {
    if (isTopoSurfaceEntity(entity) && entity.surfaceId === surfaceId) return entity.id;
  }
  return null;
}

/**
 * Ο **πρώτος και μοναδικός** συνδεδεμένος ιδιοκτήτης: η κορυφή της αποτύπωσης.
 *
 * Τρία `null` και τα τρία ρητά: χωρίς περίγραμμα δεν υπάρχει παράγωγο να ξαναχτιστεί· εκτός
 * ορίων δείκτη σημαίνει ότι η γραμμή δεν αντιστοιχεί σε σημείο· και το `fromDrag` επιστρέφει
 * `null` σε **μηδενικό** delta, δηλαδή διατηρεί την ταυτοδυναμία που ο κριτής ήδη επέβαλε
 * (N.7.2 #3) χωρίς να την ξαναγράψει κανείς.
 */
function executeSurveyCoordinates(ask: TableWriteBackOwnerAsk): ICommand | null {
  const surfaceId = SURVEY_SOURCE_SURFACE_ID;
  const footprintEntityId = footprintEntityIdFor(ask.sceneManager, surfaceId);
  if (footprintEntityId === null) return null;

  const delta = surveyPointDeltaForField(
    getTopoPoints(surfaceId),
    ask.sourceRowIndex,
    ask.field,
    ask.storeValue,
  );
  if (delta === null) return null;

  return MoveTopoSurveyPointCommand.fromDrag(
    surfaceId,
    footprintEntityId,
    ask.sourceRowIndex,
    delta,
    ask.sceneManager,
  );
}

/** Πηγή **χωρίς** ιδιοκτήτη — δηλωμένη ονομαστικά, ποτέ κενή θέση (δες την κεφαλίδα). */
const noOwner: OwnerExecutor = () => null;

const OWNER_EXECUTORS: Readonly<Record<TableSourceKind, OwnerExecutor>> = {
  'survey-coordinates': executeSurveyCoordinates,
  'survey-plot-boundary': noOwner,
  'survey-volumes': noOwner,
  'survey-tolerance': noOwner,
  'bim-schedule': noOwner,
};

/**
 * Η εντολή που εκτελεί το εγκεκριμένο αίτημα — ή `null` όταν ο ιδιοκτήτης **δεν μπορεί**.
 *
 * 🔴 Το `null` εδώ είναι **διαφορετικό** από κάθε άρνηση του κριτή: εκεί η γραφή απορρίφθηκε
 * με λόγο *πριν* καν υπολογιστεί· εδώ η γραφή εγκρίθηκε και ο **κόσμος** δεν την επιτρέπει
 * (λείπει το περίγραμμα, μηδενική μετατόπιση, δείκτης εκτός ορίων). Ο καλών οφείλει να το πει
 * χωριστά — ένα κοινό «απέτυχε» θα έστελνε τον χρήστη να ψάχνει λάθος αιτία.
 */
export function buildTableWriteBackCommand(ask: TableWriteBackOwnerAsk): ICommand | null {
  return OWNER_EXECUTORS[ask.sourceRef.kind](ask);
}
