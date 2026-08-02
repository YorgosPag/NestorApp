'use client';

/**
 * 🔴 ADR-739 §29 — **Η ΛΕΙΤΟΥΡΓΙΑ ΠΙΝΑΚΑ ΚΑΤΕΧΕΙ ΚΑΙ ΤΟ ΠΟΝΤΙΚΙ, ΟΧΙ ΜΟΝΟ ΤΟ ΠΛΗΚΤΡΟΛΟΓΙΟ.**
 *
 * ## Το ελάττωμα, όπως το είδε ο ιδιοκτήτης (2026-08-02)
 * «Ενώ είμαι σε edit mode σχηματίζεται περίγραμμα επιλογής»: με ανοιχτή τη λειτουργία πίνακα,
 * ο καμβάς εξακολουθούσε να κάνει **hover** πάνω σε οντότητες, να τις **επιλέγει** στο κλικ,
 * και μαζί **σκότωνε τη συνεδρία** — τρία πράγματα από μία άθελη κίνηση του χεριού.
 *
 * ## Γιατί ΔΕΝ είναι σφάλμα αλλά **αλλαγή συμβολαίου** — και ποιου
 * Το §26.15 κατέγραψε ρητά, σε πίνακα ζωντανής επαλήθευσης, «κλικ **ΕΞΩ** *(η μισή
 * προδιαγραφή)* ⇒ ✅ **κλείνει**», και ο pointer το έγραφε στον κώδικα: «έξω από αυτό… δεν
 * μας αφορά· ο καμβάς θα κάνει ό,τι κάνει πάντα». Ήταν **σκόπιμο**. Ο ιδιοκτήτης το άλλαξε:
 * η έξοδος γίνεται **ρητά** (Escape), ποτέ κατά λάθος.
 *
 * ## 🔑 Η modality ΥΠΗΡΧΕ ΗΔΗ — ημιτελής
 * Ο επεξεργαστής δηλώνει `useModalKeyboardScope(overlay !== null)` (ADR-711): όσο ζει η
 * λειτουργία πίνακα, οι **43** window listeners του viewer παραιτούνται από το πληκτρολόγιο.
 * Το ποντίκι δεν πήρε ποτέ την ίδια μεταχείριση. Αυτό το αρχείο **δεν εισάγει** νέα έννοια —
 * συμπληρώνει τη μισή που υπήρχε, και μάλιστα **στην ίδια συνθήκη**: ο καλών δηλώνει τα δύο
 * scopes με το **ίδιο** `overlay !== null`, δίπλα-δίπλα, άρα δεν μπορούν να αποκλίνουν.
 *
 * 🔴 Και είναι ο λόγος που το κλείδωμα δεν μπορεί να κρεμάσει: το `overlay` γίνεται `null`
 * όταν ο πίνακας χαθεί από κάτω από τον δρομέα (undo / διαγραφή / αλλαγή επιπέδου) — η
 * εγγύηση που το `table-mode-keyboard-scope.test.tsx` ήδη φυλάει με **τέσσερις δρόμους**,
 * αφού ένα κολλημένο scope είχε μια φορά κλειδώσει τον viewer «μέχρι reload» (§5.1).
 * Αν το κλείδωμα ρωτούσε σκέτο `getTableCellCursor() !== null`, θα ήταν **δεύτερος** κύκλος
 * ζωής — και ο δεύτερος είναι πάντα αυτός που ξεχνιέται.
 *
 * ## Ποια συμβάντα, και γιατί ΑΚΡΙΒΩΣ αυτά
 * | Συμβάν | Τι θα έκανε ο καμβάς | Απόφαση |
 * |---|---|---|
 * | `mousedown` (αριστερό) | armάρει lasso / body-drag / λαβές | ⛔ **και** `preventDefault` |
 * | `mouseup` (αριστερό) | 🔴 **εδώ γίνεται η επιλογή** (`mouse-handler-up:285`) | ⛔ |
 * | `click` | δίχτυ ασφαλείας — ο browser το παράγει ούτως ή άλλως | ⛔ |
 * | `dblclick` | άνοιγμα **άλλου** επεξεργαστή πάνω από τον ανοιχτό | ⛔ |
 * | `contextmenu` | μενού οντότητας | ⛔ **και** `preventDefault` (αλλιώς βγαίνει του browser) |
 * | `mousemove` | hover + tooltip | ✅ **περνά** — δες παρακάτω |
 * | `wheel`, μεσαίο/δεξί `mousedown` | zoom, pan | ✅ περνά (απόφαση ιδιοκτήτη) |
 *
 * 🔴 **Το `mouseup` είναι το ουσιώδες, και ήταν το μη προφανές.** Η επιλογή οντότητας ΔΕΝ
 * γίνεται στο `click`: γίνεται στο `mouseup` (`onCanvasClick` στη γραμμή 285 του
 * `mouse-handler-up.ts`). Φύλακας μόνο στο `mousedown`+`click` θα φαινόταν πλήρης, θα
 * περνούσε κάθε εύλογη ανάγνωση, και ο χρήστης θα συνέχιζε να επιλέγει οντότητες.
 *
 * ## Γιατί το `mousemove` ΔΕΝ μπλοκάρεται — και πώς σβήνει παρ' όλα αυτά το hover
 * Το pan **ζει** πάνω στο `mousemove`. Ένας φύλακας εκεί θα σκότωνε το pan που ο ιδιοκτήτης
 * ζήτησε ρητά να κρατηθεί. Άρα το hover παραιτείται στην **πηγή** του: ο
 * `mouse-handler-move` έχει ήδη κλάδο «κανένα hover τώρα» για το grip-drag, και το κλείδωμα
 * μπαίνει στον **ίδιο** κλάδο — δηλαδή μία συνθήκη, με τον υπάρχοντα καθαρισμό
 * (`setHoveredEntity(null)` + badge + sub-element), όχι δεύτερος δρόμος σβησίματος.
 *
 * ## Γιατί `preventDefault` στο `mousedown` — και γιατί ΔΕΝ αντιφάσκει με το §26.15
 * Το §26.15 απέκλεισε ρητά το `preventDefault`: «ο καμβάς είναι ο ιδιοκτήτης του ποντικιού,
 * θα έσπαγαν το σύρσιμο λαβών και η μετακίνηση οντότητας». Αυτό αφορούσε κλικ **ΜΕΣΑ** στον
 * πίνακα, όπου ο καμβάς **πρέπει** να συνεχίσει να δουλεύει. Εδώ είναι το αντίστροφο
 * σενάριο — κλικ **ΕΞΩ**, όπου το «να μη δουλέψει ο καμβάς» **είναι** η προδιαγραφή. Ο
 * κανόνας δεν χαλαρώνει· εφαρμόζεται στο μόνο σημείο όπου δεν ίσχυε ποτέ.
 *
 * Και κερδίζει την επιβίωση της συνεδρίας **δομικά**: η μεταφορά εστίασης είναι η
 * προεπιλεγμένη ενέργεια του `mousedown`, οπότε αναιρώντας την δεν γεννιέται `blur`, άρα
 * ούτε δήλωση, ούτε ανάκτηση, ούτε καρέ αναμονής. Δεν προστίθεται μηχανισμός — **αφαιρείται**
 * το συμβάν που θα τον χρειαζόταν.
 *
 * ## Γιατί στο `document` και όχι στο δοχείο του καμβά
 * Ο `useCanvasContextMenu` ακούει `contextmenu` σε **σύλληψη πάνω στο ίδιο δοχείο**, και
 * εγγράφεται όταν μονταρίζεται ο `CanvasSection` — δηλαδή **πολύ πριν** ανοίξει οποιαδήποτε
 * συνεδρία πίνακα. Δύο ακροατές σύλληψης στο **ίδιο** στοιχείο τρέχουν με σειρά **εγγραφής**,
 * άρα ο φύλακας θα έχανε πάντα. Στο `document` η σειρά είναι **δομική**: πρόγονος ⇒ πάντα
 * πρώτος στη σύλληψη, ό,τι κι αν εγγραφεί αργότερα και όπου.
 *
 * ⚠️ **Ποτέ `stopImmediatePropagation`.** Στο ίδιο `document` ζει η λήξη των δηλώσεων του
 * §26.15/§27.15 (`installClaimExpiry`). Το `stopPropagation` δεν αγγίζει συνακροατές του
 * ίδιου κόμβου· το `stopImmediatePropagation` θα τους έκοβε, και οι σημαίες θα έμεναν
 * ανοιχτές — σφάλμα που εμφανίζεται μία στις τρεις φορές και δεν αναπαράγεται ποτέ όταν το
 * ψάχνεις.
 *
 * ## Ρητά όρια
 * - **Το pan με το εργαλείο «Χέρι» + αριστερό κλικ δεν λειτουργεί** όσο ο πίνακας είναι
 *   ανοιχτός: ο φύλακας κρίνει από το **πλήκτρο**, όχι από το ενεργό εργαλείο (δεν υπάρχει
 *   imperative αναγνώστη του — μόνο React state). Το pan με **μεσαίο/δεξί σύρσιμο** (AutoCAD
 *   standard, και ο κυρίαρχος τρόπος στην εφαρμογή) και ο **τροχός** δουλεύουν κανονικά.
 * - **Κλικ σε ΑΛΛΟΝ πίνακα** μπλοκάρεται κι αυτό: η modality δεν κάνει εξαίρεση για
 *   «συγγενείς» οντότητες. Έξοδος με Escape, μετά διπλό κλικ στον άλλο.
 * - Ό,τι ζει **έξω** από το δοχείο του καμβά — κορδέλα, πλευρικός πίνακας, μενού, γραμμή
 *   κατάστασης — δεν αγγίζεται καθόλου (απόφαση ιδιοκτήτη: «όλα εκτός από το να λειτουργώ
 *   μέσα στον καμβά»).
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-canvas-lockdown
 * @see ui/table-cell-editor/table-cell-pointer-hit.ts — η ΜΙΑ ερώτηση «πού έπεσε;»
 * @see systems/cursor/mouse-handler-move.ts — ο κλάδος όπου παραιτείται το hover
 * @see lib/a11y/use-modal-keyboard-scope.ts — το δίδυμο του πληκτρολογίου (ADR-711)
 */

import { useEffect, type RefObject } from 'react';
import { tableEventWorldPoint, tablePointerHitAtWorld } from './table-cell-pointer-hit';
import { isInsideTableCellSession } from './table-cell-session-focus';
import type { TableEntity } from '../../types/table-entity';
import type { ViewTransform } from '../../rendering/types/Types';

/**
 * 🔴 Το SSoT ερώτημα του §29: **κατέχει η λειτουργία πίνακα τον καμβά αυτή τη στιγμή;**
 *
 * Module-level και όχι store, με τον ίδιο λόγο που είναι module-level οι δύο δηλώσεις του
 * `table-cell-session-focus`: το ρωτούν χειριστές **εκτός React** (ο hot-path του
 * `mouse-handler-move`, ~60 φορές το δευτερόλεπτο) και μια συνδρομή εκεί θα ήταν ακριβώς η
 * κατηγορία που ο ADR-040 απαγορεύει.
 */
let canvasLockDepth = 0;

/**
 * Ρωτά ο hover στον `mouse-handler-move`. Ονομασμένο ερώτημα και όχι σύγκριση επί τόπου: ο
 * καλών δηλώνει **γιατί** παραιτείται, και η απάντηση αλλάζει σε ένα σημείο.
 */
export function isCanvasLockedByTableSession(): boolean {
  return canvasLockDepth > 0;
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τα stores και τις δηλώσεις. */
export function __resetTableCanvasLockdownForTests(): void {
  canvasLockDepth = 0;
}

export interface UseTableCanvasLockdownParams {
  /**
   * 🔴 **Περνάς το ΙΔΙΟ `overlay !== null` που περνάς στο `useModalKeyboardScope`.**
   *
   * Όχι `cursor !== null`: ο δρομέας επιβιώνει **επίτηδες** μιας παροδικά αποτυχημένης
   * ανάγνωσης σκηνής (αλλιώς χανόταν διαλείπουσα η πληκτρολόγηση), ενώ ο επεξεργαστής όχι.
   * Με τον δρομέα ως κριτήριο, ένα undo που σβήνει τον πίνακα θα άφηνε τον καμβά
   * **κλειδωμένο χωρίς κανέναν να ακούει** — η ακριβής μορφή του «κλείδωσε μέχρι reload»
   * (§5.1) που το πληκτρολόγιο έχει ήδη πληρώσει μια φορά. Μία τιμή οδηγεί και τα δύο.
   */
  readonly active: boolean;
  /** Η **ζωντανή** οντότητα του δρομέα — η γεωμετρία που απαντά «μέσα ή έξω;». */
  readonly entity: TableEntity | null;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly transformRef: RefObject<ViewTransform>;
}

/** Τα συμβάντα που ο καμβάς δεν επιτρέπεται να δει. Δες τον πίνακα στην κεφαλίδα. */
const GUARDED_EVENTS = ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'] as const;

/**
 * Κλειδώνει τον καμβά όσο ζει η λειτουργία πίνακα.
 *
 * Καλείται **δίπλα** στο `useModalKeyboardScope(overlay !== null)` και με την **ίδια**
 * συνθήκη — δες την κεφαλίδα για το γιατί αυτό είναι εγγύηση ορθότητας και όχι σύμπτωση.
 */
export function useTableCanvasLockdown(params: UseTableCanvasLockdownParams): void {
  const { active, entity, containerRef, transformRef } = params;

  useEffect(() => {
    if (!active) return;

    canvasLockDepth += 1;

    const guard = (event: Event): void => {
      if (!(event instanceof MouseEvent)) return;
      if (!shouldBlock(event, containerRef.current, transformRef.current, entity)) return;
      event.stopPropagation();
      // Μόνο εκεί που η προεπιλεγμένη ενέργεια βλάπτει: μεταφορά εστίασης (⇒ θα σκότωνε τη
      // συνεδρία) και μενού του browser. Στα `click`/`dblclick`/`mouseup` δεν υπάρχει
      // προεπιλογή να αναιρεθεί, και μια αδιάκριτη `preventDefault` θα έκρυβε ό,τι εμφανιστεί
      // αύριο.
      if (event.type === 'mousedown' || event.type === 'contextmenu') event.preventDefault();
    };

    for (const type of GUARDED_EVENTS) {
      document.addEventListener(type, guard, { capture: true });
    }
    return () => {
      for (const type of GUARDED_EVENTS) {
        document.removeEventListener(type, guard, { capture: true });
      }
      canvasLockDepth = Math.max(0, canvasLockDepth - 1);
    };
  }, [active, entity, containerRef, transformRef]);
}

/**
 * Η απόφαση, ολόκληρη — πέντε ερωτήσεις, με σειρά από τη φθηνότερη στην ακριβότερη.
 *
 * Εξαγόμενη από το `guard` επίτηδες: είναι **καθαρή** συνάρτηση της κατάστασης του συμβάντος,
 * άρα δοκιμάζεται χωρίς DOM στήσιμο και διαβάζεται ως προδιαγραφή.
 */
function shouldBlock(
  event: MouseEvent,
  container: HTMLDivElement | null,
  transform: ViewTransform | null,
  entity: TableEntity | null,
): boolean {
  if (!container || !entity) return false;
  // 1. Μεσαίο/δεξί **πάτημα** = pan (AutoCAD/BricsCAD). Το `contextmenu` που ίσως ακολουθήσει
  //    κρίνεται χωριστά — έτσι το δεξί σύρσιμο κάνει pan ΚΑΙ το δεξί κλικ δεν ανοίγει μενού.
  if ((event.type === 'mousedown' || event.type === 'mouseup') && event.button !== 0) return false;
  // 2. Έξω από τον καμβά: κορδέλα, πλευρικός πίνακας, μενού σε portal. Δεν μας αφορούν ποτέ.
  if (!(event.target instanceof Node) || !container.contains(event.target)) return false;
  // 3. Μέσα σε μέλος της ίδιας συνεδρίας: το `<textarea>` του κελιού, η γραμμή τύπων, το
  //    μενού ζωνών. Ρωτιέται **πριν** τη γεωμετρία γιατί ένα πεδίο μπορεί να ξεπερνά το κελί
  //    του (το κουτί μεγαλώνει με το κείμενο) — το DOM είναι εδώ πιο αληθινό από τα mm.
  if (isInsideTableCellSession(event.target)) return false;
  // 4. Πάνω στον ίδιο τον πίνακα (κελί ή ζώνη δείκτη): ο pointer του πίνακα το χειρίζεται,
  //    και ο καμβάς έχει ακόμα δουλειά εκεί (λαβές, μετακίνηση οντότητας).
  const world = tableEventWorldPoint(event, container, transform);
  if (!world || !transform) return false;
  return tablePointerHitAtWorld(entity, world, transform.scale) === null;
}
