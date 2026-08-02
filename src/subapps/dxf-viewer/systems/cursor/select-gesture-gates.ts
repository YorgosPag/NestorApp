/**
 * 🔴 ADR-739 §29.10 — **ΟΙ ΔΥΟ ΠΥΛΕΣ ΤΗΣ ΒΟΗΘΗΤΙΚΗΣ ΕΡΓΑΣΙΑΣ ΤΟΥ ΚΑΜΒΑ**, ονομασμένες.
 *
 * Το λάσο και τα σημάδια έλξης δεν είναι «επιλογή»: είναι η **προετοιμασία** της. Γεννιούνται
 * από χειρονομίες που ο καμβάς βλέπει **νόμιμα** — γι' αυτό ο φύλακας του §29, που κόβει τα
 * συμβάντα **έξω** από τον πίνακα, δεν τα αγγίζει ποτέ:
 *
 *  - το πάτημα **μέσα** σε κελί περνά **επίτηδες** στον καμβά (ο ακροατής του πίνακα είναι
 *    παθητικός, ώστε να μη σπάσουν λαβές και μετακίνηση οντότητας)· άρα armάρει λάσο, και η
 *    σύρση επιλογής **κελιών** ζωγράφιζε ταυτόχρονα λάσο πάνω από τον πίνακα — μία χειρονομία,
 *    δύο επιλογές, όπως το είδε ο ιδιοκτήτης στην οθόνη·
 *  - τα σημάδια έλξης γεννιούνται από `mousemove`, που ο φύλακας **δεν** μπλοκάρει ποτέ (το
 *    pan ζει πάνω του, §29.5).
 *
 * Δηλαδή δεν πρόκειται για κενό του φύλακα αλλά για **δεύτερη κατηγορία**: εργασία που
 * ξεκινά από επιτρεπτό συμβάν. Οι δύο πύλες τη σταματούν στην **πηγή** της.
 *
 * ## Γιατί ξεχωριστό αρχείο και όχι δύο συνθήκες επί τόπου
 * Και οι δύο ζουν σε **hot handlers** που δεν στήνονται σε test χωρίς δεκάδες props — δηλαδή
 * μια συνθήκη γραμμένη inline είναι, στην πράξη, **αδοκίμαστη**. Εδώ είναι καθαρές συναρτήσεις
 * της κατάστασης: η μετάλλαξη «ξέχασα τον φύλακα» κοκκινίζει, χωρίς κανένα DOM.
 *
 * Και οι δύο δέχονται το κλείδωμα ως **παράμετρο** αντί να το ρωτούν μόνες τους: έτσι η
 * απόφαση μένει καθαρή συνάρτηση (δοκιμάσιμη με έναν boolean, χωρίς mock module), και ο
 * καλών δηλώνει ρητά ότι διαβάζει το SSoT **τη στιγμή του συμβάντος** — ADR-040, ποτέ
 * στιγμιότυπο.
 *
 * @module subapps/dxf-viewer/systems/cursor/select-gesture-gates
 * @see ui/table-cell-editor/use-table-canvas-lockdown.ts — ο ΕΝΑΣ ορισμός του κλειδώματος
 */

import { isRectMarqueeDragTool } from '../tools/region-tool-ids';

export interface LassoArmGateInput {
  /** `0` = αριστερό. Το μεσαίο/δεξί είναι pan και δεν armάρει ποτέ επιλογή. */
  readonly button: number;
  readonly isGripDragging: boolean;
  /**
   * Το ενεργό εργαλείο. Χαλαρός τύπος **επίτηδες**, ίδιος με τον
   * {@link isRectMarqueeDragTool}: τα predicates των εργαλείων δέχονται σκέτο `string` ώστε
   * να μη χρειάζεται εξαντλητικό `Record<ToolType>` σε κάθε νέο εργαλείο (δες την κεφαλίδα
   * του `region-tool-ids`). Δεύτερος, αυστηρότερος τύπος εδώ θα ήταν το μόνο σημείο του
   * μονοπατιού που θα χρειαζόταν ενημέρωση σε κάθε προσθήκη.
   */
  readonly activeTool: string | null | undefined;
  /** Εργαλείο σε φάση σχεδίασης — το πάτημα ανήκει σε εκείνο, όχι στην επιλογή. */
  readonly isToolInteractive: boolean;
  /** 🔴 ADR-739 §29.10 — `isCanvasLockedByTableSession()`, διαβασμένο τη στιγμή του πατήματος. */
  readonly lockedByTableSession: boolean;
}

/**
 * Armάρει αυτό το πάτημα τη σύρση επιλογής (λάσο / region box / marquee);
 *
 * 🔴 Ο φύλακας μπαίνει στο **arm** και όχι στη ζωγραφική, επειδή το ίδιο `lassoDownRef`
 * τροφοδοτεί **τρεις** καταναλωτές στο `mouse-handler-move` — λάσο, region box, marquee. Ένας
 * φύλακας στη ζωγραφική θα έπρεπε να γραφτεί τρεις φορές, και θα ξεχνούσε τον τέταρτο που θα
 * προστεθεί αύριο.
 */
export function shouldArmSelectDrag(input: LassoArmGateInput): boolean {
  if (input.button !== 0) return false;
  if (input.isGripDragging) return false;
  if (input.lockedByTableSession) return false;
  return (
    (input.activeTool === 'select' && !input.isToolInteractive) ||
    isRectMarqueeDragTool(input.activeTool)
  );
}

export interface SnapDetectionGateInput {
  /** Ο διακόπτης OSNAP της γραμμής κατάστασης (F11). */
  readonly snapEnabled: boolean;
  /** Υπάρχει resolver· χωρίς αυτόν δεν υπάρχει τίποτα να υπολογιστεί. */
  readonly hasResolver: boolean;
  /** Το σύρσιμο λαβής έχει **δικό του**, σύγχρονο snap — χρειάζεται ghost 1:1. */
  readonly isGripDragging: boolean;
  /** 🔴 ADR-739 §29.10 — «ούτε τα σημάδια έλξης των οντοτήτων» (ιδιοκτήτης). */
  readonly lockedByTableSession: boolean;
}

/**
 * Υπολογίζονται σημάδια έλξης σε αυτή την κίνηση;
 *
 * ⚠️ Το `false` **δεν** σημαίνει «άφησέ τα όπως είναι»: ο καλών πέφτει στο
 * `clearSnapDetection`, δηλαδή τα σημάδια **σβήνουν** μαζί με το ghost του column. Ένας
 * early-return στη θέση της πύλης θα άφηνε στην οθόνη το τελευταίο σημάδι πριν ανοίξει ο
 * πίνακας — παγωμένο και ανεξήγητο.
 */
export function shouldDetectSnap(input: SnapDetectionGateInput): boolean {
  return (
    input.snapEnabled &&
    input.hasResolver &&
    !input.isGripDragging &&
    !input.lockedByTableSession
  );
}
