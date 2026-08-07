'use client';

/**
 * ADR-739 §30 — **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΟΥ HOVER ΤΩΝ ΛΩΡΙΔΩΝ.**
 *
 * Ο Giorgio το έθεσε ως εξής (03/08): «όταν ο κέρσορας κάνει hover πάνω από τις λωρίδες των
 * γραμμάτων των στηλών και των αριθμών των γραμμών, θέλω να φωτίζονται τα **ξεχωριστά
 * κομμάτια** της λωρίδας — όπως ακριβώς στο Excel». Το «ξεχωριστά» είναι η προδιαγραφή:
 * φωτίζεται το `C`, όχι ολόκληρη η πάνω λωρίδα.
 *
 * ## 🔴 ΠΑΘΗΤΙΚΟΣ ΑΚΡΟΑΤΗΣ — και εδώ είναι δομικά υποχρεωτικό, όχι επιλογή
 * Το `mousemove` είναι το **μόνο** συμβάν ποντικιού που το κλείδωμα του §29 αφήνει να
 * περάσει, και ο λόγος είναι ρητός εκεί: **το pan ζει πάνω του**. Ένα `stopPropagation` ή
 * ένα `preventDefault` εδώ θα σκότωνε το pan που ο ιδιοκτήτης ζήτησε ρητά να κρατηθεί όσο ο
 * πίνακας είναι ανοιχτός. Γι' αυτό ο ακροατής δηλώνεται **`passive`**: όχι ως
 * μικροβελτιστοποίηση, αλλά ως δήλωση συμβολαίου που ο browser επιβάλλει.
 *
 * ## Γιατί ΔΕΝ ρωτά τη «μία ερώτηση» του §29 ολόκληρη
 * Το `tablePointerHitAtWorld` απαντά «ζώνη ⇒ κελί ⇒ τίποτα». Το τρίτο σκέλος του κοστίζει
 * γραμμική σάρωση **όλων** των κελιών, και ο hover θα το πλήρωνε ~60 φορές το δευτερόλεπτο
 * για μια απάντηση που δεν διαβάζει κανείς. Ρωτά το `tableIndicatorProbeAtWorld`, που
 * καταναλώνει την **ίδια** ιδιωτική γεωμετρία ζώνης με το ίδιο LOD — εξαγωγή, όχι αντίγραφο.
 * Δες την κεφαλίδα του `table-cell-pointer-hit`.
 *
 * ⚠️ Το probe κουβαλά **δύο** πεδία: το `hit` (§30 — ποιο γράμμα φωτίζεται) και το `cursor`
 * (§31 — ποιο σχήμα οφείλει ο δείκτης του ΟΣ). Εδώ διαβάζεται **μόνο** το πρώτο, και είναι
 * σκόπιμο: το δεύτερο έχει δικό του καταναλωτή. Ο λόγος που ταξιδεύουν μαζί είναι ότι
 * πηγάζουν από την ίδια ανάγνωση γεωμετρίας — δύο κλήσεις θα την πλήρωναν δύο φορές **ανά
 * κίνηση ποντικιού**.
 *
 * ## Γιατί ο φύλακας «άλλαξε κάτι;» ΔΕΝ είναι εδώ
 * Θα ήταν φυσικό να μπει σε αυτό το αρχείο — εδώ γεννιέται ο θόρυβος. Ζει όμως στον
 * **γραφέα** (`setTableIndicatorHover`), ώστε ένας δεύτερος γραφέας αύριο να μην μπορεί να
 * τον παρακάμψει. Ίδια αρχή με το `TABLE_INDICATOR_OUTER_PX`: «κανείς έξω από το module δεν
 * ξαναϋπολογίζει».
 *
 * ## Ο κύκλος ζωής δένεται στο ΙΔΙΟ `active` με το κλείδωμα και το πληκτρολόγιο
 * Ο δείκτης ζωγραφίζεται **μόνο** όσο υπάρχει δρομέας, άρα ένας hover χωρίς συνεδρία θα
 * έγραφε κατάσταση που κανείς δεν ζωγραφίζει. Ο καλών περνά το **ίδιο** `overlay !== null`
 * που περνά στο `useTableCanvasLockdown` και στο `useModalKeyboardScope` — τρεις μηχανισμοί,
 * μία συνθήκη, καμία δυνατότητα απόκλισης.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-indicator-hover
 * @see state/table-indicator-hover-store.ts — πού γράφεται (και ο φύλακας του καρέ)
 * @see ui/table-cell-editor/use-table-canvas-lockdown.ts — γιατί το `mousemove` περνά
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §30
 */

import { useEffect, useRef, type RefObject } from 'react';
// ADR-739 §27.16 Ε6 — σταθερή ταυτότητα χειριστή + ανάγνωση των **τελευταίων** τιμών τη
// στιγμή του συμβάντος. Χωρίς αυτό, το effect θα ξαναέγραφε τον ακροατή σε κάθε αλλαγή
// οντότητας — δηλαδή σε κάθε πάτημα πλήκτρου μέσα στον πίνακα.
import { useEventCallback } from '@/hooks/useEventCallback';
import {
  tableEventWorldPoint,
  tableIndicatorProbeAtWorld,
  tablePointerHitAtWorld,
} from './table-cell-pointer-hit';
// 🔴 ADR-768 Δ2/Δ3 — το **πέμπτο** κανάλι της ίδιας σάρωσης: πού βάφει το οπλισμένο πινέλο.
import { isTableFormatPainterArmed } from '../../state/table-format-painter-store';
import { tableFormatPaintRoleOf } from '../../bim/table/table-indicator-cursor-role';
import {
  clearTableFormatPaintTarget,
  setTableFormatPaintTarget,
  type TableFormatPaintTargetState,
} from '../../state/table-format-paint-target-store';
import {
  clearTableIndicatorHover,
  setTableIndicatorHover,
} from '../../state/table-indicator-hover-store';
// ADR-739 §31 — η **δεύτερη** απάντηση της ίδιας ερώτησης: τι υπόσχεται ο δείκτης του ΟΣ εδώ.
// Δύο stores επειδή οι καταναλωτές είναι δύο και ασύνδετοι (ο ζωγράφος του καμβά / ο δείκτης
// υλικού)· **μία** σάρωση γεωμετρίας επειδή ο ακροατής είναι ένας — δες `tableIndicatorProbeAtWorld`.
import {
  clearTableIndicatorCursor,
  setTableIndicatorCursor,
} from '../../systems/cursor/TableIndicatorCursorStore';
// 🔴 ADR-739 §40 — το **τρίτο** κανάλι της ίδιας σάρωσης: το ⊕ της εισαγωγής (Word parity).
import {
  clearTableInsertControl,
  setTableInsertControl,
} from '../../state/table-insert-control-store';
import type { TableInsertControlMode } from '../../bim/table/table-insert-control';
// 🔴 ADR-739 §42 — το **τέταρτο** κανάλι της ίδιας σάρωσης: το ⊖ της διαγραφής.
import {
  clearTableDeleteControl,
  setTableDeleteControl,
} from '../../state/table-delete-control-store';
// 🔴 §42/§27.17 — «ποιους άξονες αφορά η πράξη». Απαντιέται **εδώ**, τη στιγμή της σάρωσης,
// ώστε ο ζωγράφος να βάψει ακριβώς όσους θα σβήσει το πάτημα — δες την κεφαλίδα του store.
import { resolveTableAxisActionTarget } from '../../bim/table/table-axis-action-target';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
// 🔴 §42 — η ΜΙΑ έκφραση «επιτρέπεται η διαγραφή;», κοινή με το μενού ζωνών.
import { canDeleteAxisTarget } from './table-header-axis-actions';
// 🔬 ADR-739 §31.11 — το όργανο. Εδώ ζει η **ΑΙΤΙΑ** (τι απάντησε η σάρωση), ενώ στο
// `useCrosshairCursor` ζει το **ΑΠΟΤΕΛΕΣΜΑ** (τι γράφτηκε στο `style.cursor`). Χωρίς το πρώτο
// δεν ξεχωρίζεις «ο ρόλος άλλαξε» από «κάποιος άλλος ξαναέγραψε» — δύο διαφορετικές θεραπείες.
import { noteCursorProbe } from '../../systems/cursor/cursor-apply-audit';
// 🔴 ADR-739 §36 — η επιλογή (ΤΙ πιάνεται) και τα πλήκτρα (ΤΙ θα γίνει αν το πιάσεις).
import { getTableCellCursor } from '../../state/table-cell-cursor-store';
import {
  TABLE_RANGE_MODIFIER_KEYS,
  tableRangeDragIntentOf,
} from '../../bim/table/table-range-move-zone';
// 🔴 ADR-739 §36 ΦΑΣΗ 3 — όσο σέρνεται περιοχή, η **χειρονομία** ξέρει τι οφείλει ο δείκτης·
// η σάρωση θέσης δεν το ξέρει και δεν μπορεί να το μάθει (χρειάζεται ολόκληρο το σχέδιο).
import { activeTableRangeTransferCursor } from './table-range-transfer-drag';
import type { TableEntity } from '../../types/table-entity';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';

/**
 * Ο **ένας** καθαρισμός και των δύο καναλιών, με **σταθερή** ταυτότητα.
 *
 * Ζει σε επίπεδο module και όχι μέσα στο hook για δύο λόγους που είναι και οι δύο πραγματικοί:
 * δίνεται απευθείας ως ακροατής `mouseleave` (ένα περιτύλιγμα ανά απόδοση θα πρόσθετε/αφαιρούσε
 * ακροατή σε κάθε πάτημα πλήκτρου μέσα στον πίνακα), και — το ουσιώδες — **δεν υπάρχει δρόμος
 * να καθαριστεί το ένα κανάλι χωρίς το άλλο**. Με δύο ξεχωριστές κλήσεις σε τέσσερα σημεία
 * εξόδου, η πρώτη προσθήκη τρίτου καναλιού θα ξεχνούσε ένα από αυτά.
 */
const clearTableIndicatorFeedback = (): void => {
  // 🔬 §31.11 — καταγράφεται **κάθε** σβήσιμο, γιατί το σιωπηλό σβήσιμο είναι ακριβώς το
  // γεγονός που δεν αφήνει ίχνος. Οι δύο πρόωροι έξοδοι του χειριστή σημειώνουν πρώτα τον
  // **λόγο** τους, οπότε ένα σκέτο `leave` χωρίς προηγούμενο λόγο σημαίνει γνήσιο `mouseleave`
  // ή αποπροσάρτηση — και αυτό ακριβώς είναι το διακριτικό που ψάχνουμε.
  noteCursorProbe('leave', null, null, -1, -1);
  clearTableIndicatorHover();
  clearTableIndicatorCursor();
  // §40 — **τρίτο κανάλι, ίδιος καθαρισμός.** Ο λόγος που ο καθαρισμός είναι ένας γράφτηκε
  // πριν υπάρξει αυτή η γραμμή: «δεν υπάρχει δρόμος να καθαριστεί το ένα κανάλι χωρίς το
  // άλλο». Η προσθήκη του τρίτου είναι η επαλήθευση — ένα σημείο άλλαξε, και τα τέσσερα
  // σημεία εξόδου το πήραν.
  clearTableInsertControl();
  // §42 — **τέταρτο κανάλι, ίδιος καθαρισμός.** Η πρόβλεψη της κεφαλίδας («η προσθήκη του
  // τρίτου είναι η επαλήθευση») κρατά και για το τέταρτο: ένα σημείο άλλαξε, και τα τέσσερα
  // σημεία εξόδου το πήραν. Εδώ έχει και **βάρος**: ένα ξεχασμένο ⊖ θα άφηνε κόκκινη στήλη
  // βαμμένη σε πίνακα που δεν έχει πια χειριστήριο από πάνω του.
  clearTableDeleteControl();
  // 🔴 ADR-768 Δ3 — **πέμπτο κανάλι, ίδιος καθαρισμός.** Η πρόβλεψη της κεφαλίδας κρατά και για
  // το πέμπτο: ένα σημείο άλλαξε, και τα τέσσερα σημεία εξόδου το πήραν. Εδώ έχει το **μεγαλύτερο**
  // βάρος: ένας ξεχασμένος στόχος βαψίματος αφήνει το κλείδωμα του §29 να δέχεται `mousedown` για
  // κελί που δεν είναι πια κάτω από το χέρι — δηλαδή βάψιμο σε λάθος κελί, χωρίς κανένα ίχνος.
  clearTableFormatPaintTarget();
};

/**
 * 🔴 ADR-768 Δ3 — **ΠΟΙΟ ΚΕΛΙ ΘΑ ΒΑΨΕΙ ΤΟ ΠΑΤΗΜΑ**, από την ίδια σάρωση που έδωσε τον δείκτη.
 *
 * Ταυτότητες και όχι δείκτες ορίων: δες την κεφαλίδα του store. Η ερώτηση `where === 'cell'`
 * είναι **δίχτυ** (N.7.2 #4) — ο πρωτεύων φρουρός είναι ο **ρόλος δείκτη**, που ο καλών έχει ήδη
 * ελέγξει. Οι δύο δεν μπορούν να διαφωνήσουν: και οι δύο ρωτούν την ίδια γεωμετρία για το ίδιο
 * σημείο, και η ερώτηση εδώ είναι η **γενικότερη** από τις δύο.
 */
function paintTargetAt(
  entity: TableEntity,
  world: Point2D,
  viewScale: number,
): TableFormatPaintTargetState | null {
  const hit = tablePointerHitAtWorld(entity, world, viewScale);
  return hit?.where === 'cell'
    ? { entityId: entity.id, rowId: hit.cell.rowId, colId: hit.cell.colId }
    : null;
}

export interface UseTableIndicatorHoverParams {
  /** Η **ζωντανή** οντότητα του δρομέα· `null` όταν ο πίνακας χάθηκε από κάτω του. */
  readonly entity: TableEntity | null;
  /**
   * 🔴 §40 — ο **επιλεγμένος** πίνακας, όταν δεν υπάρχει δρομέας.
   *
   * Συνάρτηση και όχι τιμή, και ο λόγος είναι γραμμένος ολόκληρος στην κεφαλίδα του
   * `table-entity-lookup`: η σκηνή ανανεώνεται **ασύγχρονα** (autosave / εξωτερική
   * ενημέρωση), και μια αναφορά οντότητας κλεισμένη σε prop γίνεται μπαγιάτικη χωρίς κανένα
   * ορατό σημάδι. Καλείται **μόνο** όταν δεν υπάρχει δρομέας — δηλαδή το κόστος της σάρωσης
   * σκηνής πληρώνεται μόνο τη στιγμή που υπάρχει όντως επιλεγμένος πίνακας.
   */
  readonly resolveSelected: () => TableEntity | null;
  /**
   * 🔴 ADR-768 Βήμα 5 — ο πίνακας **κάτω από το χέρι**, όποιος κι αν είναι.
   *
   * Καλείται **μόνο** όσο το πινέλο μορφοποίησης είναι οπλισμένο, και ο λόγος είναι το κόστος: η
   * απάντηση απαιτεί σάρωση σκηνής **και** υπολογισμό διάταξης ανά πίνακα, δηλαδή κάτι που δεν
   * επιτρέπεται να πληρώνεται 60 φορές το δευτερόλεπτο ως μόνιμη συμπεριφορά.
   *
   * Γιατί υπάρχει καθόλου: το βάψιμο ταξιδεύει **από πίνακα σε πίνακα** (§2.2), οπότε ο πίνακας
   * του δρομέα δεν είναι απάντηση στο «πού δείχνω». Χωρίς αυτό, ο δείκτης θα σιωπούσε πάνω από
   * τον δεύτερο πίνακα ενώ το πάτημα θα έβαφε — η ακριβής παραβίαση που ο §31 απαγορεύει.
   */
  readonly resolvePaintTable: (world: Point2D, viewScale: number) => TableEntity | null;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly transformRef: RefObject<ViewTransform>;
}

/** Ανάβει την υποδιαίρεση ζώνης κάτω από το ποντίκι, όσο ζει η λειτουργία πίνακα. */
export function useTableIndicatorHover(params: UseTableIndicatorHoverParams): void {
  const { entity, resolveSelected, resolvePaintTable, containerRef, transformRef } = params;

  /**
   * 🔴 §36 — **ΠΟΥ ΣΤΕΚΕΤΑΙ ΤΟ ΧΕΡΙ**, ώστε το `Ctrl` να μπορεί να ξαναρωτήσει χωρίς κίνηση.
   *
   * Ίδιο σχήμα με το `lastEvent` της σύρσης (`table-cell-drag-session` §27.16 Ε1) και για
   * τον ίδιο ακριβώς λόγο: υπάρχουν **δύο** αφορμές να ξαναλυθεί η ίδια ερώτηση — κινήθηκε το
   * χέρι, ή άλλαξε η **πρόθεση** κάτω από ακίνητο χέρι. Μία απάντηση, δύο αφορμές.
   *
   * `null` πριν την πρώτη κίνηση: ένα `Ctrl` χωρίς προηγούμενο hover δεν έχει σημείο να
   * ρωτήσει, και δεν επιτρέπεται να εφεύρει ένα.
   */
  const lastMoveRef = useRef<MouseEvent | null>(null);

  /**
   * 🔴 §36 ΦΑΣΗ 3 — τα πλήκτρα διαβάζονται από **ξεχωριστό** αντικείμενο, όχι πάντα από το
   * `MouseEvent`: τα `ctrlKey`/`shiftKey` του είναι **παγωμένο στιγμιότυπο** της στιγμής που
   * γεννήθηκε. Ο ακροατής πλήκτρων επαναλαμβάνει την τελευταία **θέση** αλλά περνά τη **δική
   * του** πρόθεση — αλλιώς ένα `Ctrl` με ακίνητο χέρι θα ξαναρωτούσε με την **παλιά**
   * κατάσταση πλήκτρων, δηλαδή ο δείκτης δεν θα άλλαζε μέχρι την επόμενη κίνηση: ακριβώς η
   * συμπεριφορά που ο ακροατής υπάρχει για να καταργήσει.
   */
  const handleMouseMove = useEventCallback((
    event: MouseEvent,
    modifiers: Pick<MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'> = event,
  ): void => {
    lastMoveRef.current = event;
    // 🔴 §36 ΦΑΣΗ 3 — **η σύρση μεταφοράς έχει προτεραιότητα**: όσο ζει, ο δείκτης λέει τι
    // κρατά το χέρι (`move`/`copy`/`not-allowed`), όχι τι υπάρχει από κάτω. Χωρίς αυτό, η
    // σάρωση θα απαντούσε «μέσα σε κελί ⇒ σταυρός» μόλις το χέρι φύγει από το περίγραμμα.
    // Παράπλευρο κέρδος: μηδέν σάρωση γεωμετρίας στα 60-120 συμβάντα/δευτ. της σύρσης.
    const dragging = activeTableRangeTransferCursor();
    if (dragging) {
      noteCursorProbe('ok', dragging, null, event.clientX, event.clientY);
      setTableIndicatorHover(null);
      setTableIndicatorCursor(dragging);
      return;
    }
    const container = containerRef.current;
    const transform = transformRef.current;
    // 🔴 §40 — **ΠΟΙΟΣ ΠΙΝΑΚΑΣ, ΚΑΙ ΣΕ ΠΟΙΑ ΚΑΤΑΣΤΑΣΗ.** Ο δρομέας νικά πάντα: όσο υπάρχει,
    // ο χρήστης είναι **μέσα** στον πίνακα και ο επιλεγμένος είναι ο ίδιος ούτως ή άλλως. Ο
    // resolver τρέχει μόνο στο `else` — δες το σκεπτικό του prop για το γιατί δεν είναι τιμή.
    const owned: TableEntity | null = entity ?? resolveSelected();
    const mode: TableInsertControlMode = entity ? 'table-mode' : 'selection';
    // 🔴 ADR-768 — μία ανάγνωση store, πριν από κάθε γεωμετρία. Δες παρακάτω γιατί μπαίνει
    // **στον φρουρό**: χωρίς αυτήν, ένα οπλισμένο πινέλο πάνω από **άλλον** πίνακα θα έβγαινε από
    // εδώ με «κανένας πίνακας» και ο δείκτης θα σιωπούσε εκεί ακριβώς που το πάτημα βάφει.
    const painting = isTableFormatPainterArmed();
    if (!container || !transform || (!owned && !painting)) {
      noteCursorProbe('no-entity', null, null, event.clientX, event.clientY);
      clearTableIndicatorFeedback();
      return;
    }
    // ADR-040 — η προβολή διαβάζεται **τη στιγμή του συμβάντος**, ποτέ ως στιγμιότυπο: ο
    // χρήστης μπορεί να ζουμάρει με τον τροχό ενώ το χέρι του στέκεται πάνω στη λωρίδα.
    const world = tableEventWorldPoint(event, container, transform);
    if (!world) {
      noteCursorProbe('no-world', null, null, event.clientX, event.clientY);
      clearTableIndicatorFeedback();
      return;
    }
    // 🔴 ADR-768 Βήμα 5 — **ΤΟ ΥΠΟΚΕΙΜΕΝΟ ΑΛΛΑΖΕΙ ΟΣΟ ΤΟ ΠΙΝΕΛΟ ΕΙΝΑΙ ΟΠΛΙΣΜΕΝΟ.**
    //
    // Κανονικά η σάρωση αφορά τον πίνακα **του χρήστη** (δρομέας ή επιλογή). Με οπλισμένο πινέλο
    // το ερώτημα αντιστρέφεται: ο χρήστης δεν κοιτά τον δικό του πίνακα, **στοχεύει** — και ο
    // στόχος μπορεί να είναι οποιοσδήποτε (cross-table, §2.2). Ο δρομέας μένει εφεδρεία, ώστε το
    // χέρι πάνω από κενό σχέδιο να μη χάνει τη λωρίδα του δικού του πίνακα.
    //
    // ⚠️ Η σάρωση σκηνής πληρώνεται **μόνο** εδώ, πίσω από το `painting`. Δες το prop.
    const target: TableEntity | null =
      (painting ? resolvePaintTable(world, transform.scale) : null) ?? owned;
    if (!target) {
      noteCursorProbe('no-entity', null, null, event.clientX, event.clientY);
      clearTableIndicatorFeedback();
      return;
    }
    // 🔴 ADR-739 §36 — η **επιλογή** διαβάζεται με getter τη στιγμή του συμβάντος, ποτέ ως
    // στιγμιότυπο κλεισμένο στο hook. Είναι ο ρητός κανόνας του ADR-040 («event handlers MUST
    // receive getters, not snapshot values»), και εδώ έχει **ορατό** σύμπτωμα αν παραβιαστεί:
    // ο χρήστης μεγαλώνει την περιοχή με `Shift+βέλος` χωρίς να κουνήσει το χέρι, και το
    // περίγραμμα που «πιάνεται» θα έμενε αυτό της **προηγούμενης** επιλογής.
    //
    // Φιλτραρισμένη ως προς ΑΥΤΟΝ τον πίνακα: δύο πίνακες στη σκηνή δεν μοιράζονται δρομέα —
    // ο ίδιος έλεγχος που κάνει ήδη ο ζωγράφος (`TableRenderer.cursorOf`).
    // Φιλτραρισμένος ως προς ΑΥΤΟΝ τον πίνακα, **μία φορά**: δύο πίνακες στη σκηνή δεν
    // μοιράζονται δρομέα, και η ερώτηση «είναι δικός μου;» δεν επιτρέπεται να απαντηθεί δύο
    // φορές με δύο διατυπώσεις (εδώ ζητούνται πλέον **τρία** πεδία του: επιλογή, θέση, μορφή).
    const liveCursor = getTableCellCursor();
    const cursorState = liveCursor?.entityId === target.id ? liveCursor : null;
    const selection = cursorState?.selection ?? null;
    // 🔴 ADR-754 §14 — **Η ΛΑΒΗ ΖΕΙ ΜΟΝΟ ΣΕ ΠΛΟΗΓΗΣΗ.** Ο ίδιος φρουρός που έχουν ήδη ο
    // ζωγράφος (`stampTableFillHandleOverlay`) και το πάτημα (`tryTableFillHandleMouseDown`):
    // όσο ο χρήστης πληκτρολογεί, η λαβή ούτε ζωγραφίζεται ούτε πιάνεται (Excel parity, §13.5)
    // — άρα ο δείκτης **οφείλει** να σιωπά κι αυτός. Τρίτος φρουρός με διαφορετική άποψη θα
    // έδινε «λεπτός σταυρός πάνω σε λαβή που δεν υπάρχει».
    const fillAnchor =
      cursorState?.mode === 'nav'
        ? { rowId: cursorState.position.rowId, colId: cursorState.position.colId }
        : null;
    // ΜΙΑ ανάγνωση γεωμετρίας, δύο απαντήσεις — δες την κεφαλίδα του `tableIndicatorProbeAtWorld`
    // για το γιατί δεν είναι δύο κλήσεις (θα ήταν δύο υπολογισμοί ανά κίνηση ποντικιού).
    const { hit, cursor, insert, remove, selectAll } = tableIndicatorProbeAtWorld(
      target,
      world,
      transform.scale,
      selection,
      // §36 — τα πλήκτρα **της στιγμής**, όχι κατάσταση που κρατά κάποιος: το `Ctrl` μπορεί
      // να πατηθεί ή να αφεθεί με το χέρι ακίνητο πάνω στο περίγραμμα. Τότε τα δίνει το
      // **`keydown`/`keyup`** μέσω του `modifiers` — δες την κεφαλίδα του χειριστή.
      tableRangeDragIntentOf(modifiers),
      mode,
      fillAnchor,
    );
    // 🔬 §31.11 — η **αιτία**, με τις συντεταγμένες του συμβάντος: αν ο ρόλος ταλαντώνεται ενώ
    // το `y` μένει σταθερό, φταίει όριο κατά τον **οριζόντιο** άξονα (διαχωριστικά στηλών)·
    // αν ταλαντώνεται με το `y` να κινείται 1-2 px, φταίει το **χείλος** της λωρίδας.
    noteCursorProbe('ok', cursor, hit, event.clientX, event.clientY);
    // 🔴 §43 — **ένα** πεδίο, δύο κομμάτια: η υποδιαίρεση **ή** η γωνία. Η σειρά δεν λύνει
    // διεκδίκηση (τα δύο είναι γεωμετρικά ξένα — δες `table-select-all-corner`), αλλά γράφεται
    // ρητά ώστε να μην μπορεί ποτέ να προκύψει κατάσταση «και τα δύο», που δεν έχει νόημα:
    // ο δείκτης φωτίζει **ένα** πράγμα κάθε στιγμή.
    setTableIndicatorHover(
      hit
        ? { entityId: target.id, target: { kind: 'tick', hit } }
        : selectAll
          ? { entityId: target.id, target: { kind: 'select-all' } }
          : null,
    );
    setTableIndicatorCursor(cursor);
    // §40 — το τρίτο κανάλι της **ίδιας** σάρωσης. Ο φύλακας «άλλαξε κάτι;» ζει μέσα στον
    // γραφέα, όπως και στα άλλα δύο — εδώ δεν επαναλαμβάνεται.
    setTableInsertControl(insert ? { entityId: target.id, control: insert } : null);
    // 🔴 §42 — το τέταρτο κανάλι, **με τον στόχο του**.
    //
    // Ο στόχος λύνεται εδώ και όχι στη γεωμετρία, γιατί είναι γνώση **μοντέλου + επιλογής**
    // (§27.17: «η επιλογή μετράει μόνο αν το πάτημα έπεσε μέσα της»), ενώ το
    // `tableIndicatorProbeAtWorld` απαντά ρητά «**πού** έπεσε αυτό», όχι «τι κατάσταση έχει η
    // εφαρμογή» — δες την κεφαλίδα του. Η **ίδια** `selection` που ήδη διαβάστηκε από πάνω με
    // getter: μία ανάγνωση, δύο καταναλωτές.
    //
    // ⚠️ `null` και όταν ο στόχος δεν λύνεται (μπαγιάτικη ταυτότητα μετά από undo): τότε δεν
    // υπάρχει τίποτα έγκυρο να βαφτεί κόκκινο, και ένα ⊖ χωρίς στόχο θα ήταν κουμπί που δεν
    // ξέρει τι σβήνει.
    const removeTarget = remove
      ? resolveTableAxisActionTarget(resolveTableModel(target.model), remove.hit, selection)
      : null;
    setTableDeleteControl(
      // 🔴 §42 — **ΚΑΝΕΝΑ ⊖ ΟΤΑΝ Η ΔΙΑΓΡΑΦΗ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ.**
      //
      // Το μενού ζωνών γκριζάρει το item (`resolveHeaderState`)· ένα σηματάκι στον καμβά δεν
      // έχει «ανενεργή» όψη που να διαβάζεται αξιόπιστα, οπότε η ειλικρινής απάντηση είναι να
      // **μην υπάρχει**. Ο κανόνας του §31 («ο δείκτης δεν ψεύδεται») εφαρμοσμένος στο ίδιο το
      // χειριστήριο: ό,τι φαίνεται, δρα.
      //
      // ⚠️ **Δίχτυ, όχι πρωτεύων δρόμος** (N.7.2 #4): το φράγμα υπάρχει ήδη μέσα στη μηχανή
      // (`deleteTableRows/Columns` επιστρέφουν το ίδιο μοντέλο by-reference). Εδώ μπαίνει
      // επειδή αλλιώς ο χρήστης θα έβλεπε κόκκινο κουμπί σε πίνακα μιας στήλης και θα πατούσε
      // στο κενό — το ακριβές σύμπτωμα που κόστισε το §40.8.
      //
      // Οι **ίδιες** δύο συναρτήσεις που ρωτά το μενού, με το **πλήθος του στόχου** και όχι με
      // `1` (§27.17): με τέσσερις στήλες μαρκαρισμένες σε πίνακα τεσσάρων, το ⊖ δεν υπάρχει.
      remove && removeTarget && canDeleteAxisTarget(target.model, removeTarget)
        ? { entityId: target.id, control: remove, target: removeTarget }
        : null,
    );
    // 🔴 ADR-768 Δ2/Δ3 — **ΤΟ ΠΕΜΠΤΟ ΚΑΝΑΛΙ**: πού θα βάψει το πάτημα, αν γίνει τώρα.
    //
    // Ο φρουρός είναι ο **ρόλος δείκτη**, όχι δεύτερη γεωμετρική ερώτηση: ό,τι υπόσχεται η οθόνη
    // είναι ό,τι εκτελεί το πάτημα (§31/§40.5). Γι' αυτό ρωτιέται η {@link tableFormatPaintRoleOf}
    // πάνω στην **ίδια** απάντηση `cursor` που μόλις γράφτηκε — και όχι, λόγου χάρη, «είμαι μέσα
    // στο πλέγμα;». Πάνω στη λαβή συμπλήρωσης, στο ⊕, στο ⊖, στις λωρίδες και στη γωνία ο ρόλος
    // **δεν** είναι βαψίματος, άρα ο στόχος είναι `null` και το πάτημα ανήκει σε εκείνα.
    //
    // ⚠️ Το `null` όταν το πινέλο δεν είναι οπλισμένο **δεν** είναι προαιρετικό: αλλιώς το
    // κλείδωμα του §29 θα άφηνε `mousedown` να περνά σε κάθε κελί, για πάντα.
    setTableFormatPaintTarget(
      painting && tableFormatPaintRoleOf(cursor) === 'format-paint'
        ? paintTargetAt(target, world, transform.scale)
        : null,
    );
  });

  /**
   * 🔴 §36 — το ποντίκι έφυγε: σβήσε **και** το σημείο, όχι μόνο την ανάδραση.
   *
   * Χωρίς το πρώτο, ένα `Ctrl` πατημένο ενώ το χέρι είναι στην κορδέλα θα ξανα-σάρωνε την
   * **τελευταία θέση μέσα στον καμβά** και θα άναβε δείκτη μετακίνησης για περίγραμμα που
   * κανείς δεν δείχνει. Το σημείο και η ανάδραση γεννιούνται μαζί, άρα σβήνουν μαζί — η ίδια
   * αρχή που έκανε τον καθαρισμό των δύο καναλιών **έναν**.
   */
  const handleMouseLeave = useEventCallback((): void => {
    lastMoveRef.current = null;
    clearTableIndicatorFeedback();
  });

  /**
   * 🔴 §36 — **Η ΠΡΟΘΕΣΗ ΑΛΛΑΞΕ ΧΩΡΙΣ ΝΑ ΚΟΥΝΗΘΕΙ ΤΟ ΧΕΡΙ.**
   *
   * Στο Excel κρατάς το χέρι στο περίγραμμα και πατάς `Ctrl`: ο δείκτης αποκτά «+» **αμέσως**,
   * πριν αρχίσει η σύρση. Αυτή είναι όλη η αξία του — μαθαίνεις ότι θα **αντιγράψεις** αντί να
   * **μετακινήσεις** ενώ ακόμα μπορείς να αλλάξεις γνώμη. Χωρίς αυτόν τον ακροατή, ο δείκτης
   * θα έλεγε «μετακίνηση» μέχρι το επόμενο pixel κίνησης — δηλαδή θα **ψευδόταν** ακριβώς τη
   * στιγμή που ο χρήστης ρωτά, και ο §31 έχει όνομα γι' αυτό: *ο δείκτης δεν επιτρέπεται να
   * ψεύδεται*.
   *
   * Ζει στο `window` και όχι στο δοχείο: το πληκτρολόγιο δεν έχει «θέση», και η εστίαση την
   * ώρα του hover ανήκει στο `<textarea>` της συνεδρίας — ένας ακροατής στο δοχείο **δεν θα
   * έβλεπε ποτέ** το πλήκτρο.
   */
  const handleModifierChange = useEventCallback((event: KeyboardEvent): void => {
    if (!TABLE_RANGE_MODIFIER_KEYS.has(event.key)) return;
    const last = lastMoveRef.current;
    // Η **θέση** από την τελευταία κίνηση, η **πρόθεση** από το πλήκτρο που μόλις άλλαξε.
    if (last) handleMouseMove(last, event);
  });

  /**
   * 🔴 §40.9 — **ΤΟ ΣΒΗΣΙΜΟ ΤΗΣ ΕΞΟΔΟΥ, ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΗΝ ΠΡΟΣΑΡΤΗΣΗ.**
   *
   * Ζούσε στο cleanup του ακροατή, όσο εκείνος γεννιόταν και πέθαινε μαζί με τη λειτουργία.
   * Τώρα ο ακροατής είναι σταθερός (δες παρακάτω), οπότε το σβήσιμο χρειάζεται **δικό του**
   * κύκλο ζωής — αλλιώς ένα `Escape` με το χέρι ακίνητο πάνω στη ζώνη θα άφηνε **παχύ βέλος
   * πάνω από σχέδιο**: ο δείκτης του ΟΣ ζει στο `style.cursor`, όχι σε καρέ που παύει να
   * ζωγραφίζεται (§31), άρα δεν σβήνει μόνος του όπως τα άλλα τρία κανάλια.
   *
   * ⚠️ Η εξάρτηση είναι **δυαδική** και όχι η οντότητα: εκείνη είναι νέο αντικείμενο σε κάθε
   * πάτημα πλήκτρου, άρα θα καθάριζε τον δείκτη ενώ ο χρήστης γράφει. Ίδιο μοτίβο, ίδιος λόγος
   * με το `hasSession` του pointer (§27.16 Ε6) και το βάθος του κλειδώματος (§29.12).
   */
  const hasCursorEntity = entity !== null;
  useEffect(() => {
    if (!hasCursorEntity) return;
    return clearTableIndicatorFeedback;
  }, [hasCursorEntity]);

  /**
   * 🔴 §40.9 — **ΣΤΑΘΕΡΑ ΠΡΟΣΑΡΤΗΜΕΝΟΣ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ Η ΔΙΟΡΘΩΣΗ.**
   *
   * Εδώ υπήρχε `if (!active) return;` με το `active` υπολογισμένο **την ώρα της απόδοσης** από
   * τον `CanvasSection`. Εκείνος όμως **δεν αποδίδει ποτέ σε αλλαγή επιλογής** (ADR-532 B4),
   * οπότε η επιλογή ενός πίνακα δεν μπορούσε να προσαρτήσει τον ακροατή: **το ⊕ δεν
   * ζωγραφιζόταν καν** σε απλή επιλογή, παρότι και οι πέντε στρώσεις από κάτω το υποστηρίζουν.
   *
   * 🔑 Το παλιό σχόλιο δικαιολογούσε το prop ως εξοικονόμηση («*αλλιώς κάθε κίνηση ποντικιού σε
   * ολόκληρη την εφαρμογή θα πλήρωνε μια ερώτηση*»). Η ερώτηση όμως είναι
   * `getSelectedEntityIds().length !== 1` — έξοδος στην **πρώτη** σύγκριση, όπως δηλώνει ήδη ο
   * ίδιος ο καλών. Δηλαδή ο φρουρός αγόραζε **μηδέν** και πλήρωνε **ολόκληρη** την κατάσταση
   * `'selection'`. Η πραγματική πύλη είναι το `if (!container || !target || !transform)` του
   * χειριστή, που λύνεται **τη στιγμή του συμβάντος** — εκεί που η απάντηση είναι πάντα φρέσκια.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Καμία σύλληψη: δεν διεκδικούμε σειρά έναντι κανενός, μόνο παρατηρούμε. Και καμία
    // ακύρωση προεπιλογής — δες την κεφαλίδα (το pan ζει πάνω σε αυτό το συμβάν).
    container.addEventListener('mousemove', handleMouseMove, { passive: true });
    // Το ποντίκι βγήκε από τον καμβά: καμία λωρίδα δεν είναι πια «κάτω από τον δείκτη».
    // Χωρίς αυτό, το γράμμα θα έμενε αναμμένο ενώ το χέρι είναι στην κορδέλα.
    container.addEventListener('mouseleave', handleMouseLeave);
    // §36 — παθητικοί και οι δύο: **μόνο** ξαναρωτούν την ίδια ερώτηση. Καμία διεκδίκηση
    // πλήκτρου — το `Ctrl`/`Shift` ανήκουν σε όποιον τα διεκδικεί αλλού (αντιγραφή, επέκταση).
    window.addEventListener('keydown', handleModifierChange, { passive: true });
    window.addEventListener('keyup', handleModifierChange, { passive: true });
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('keydown', handleModifierChange);
      window.removeEventListener('keyup', handleModifierChange);
      lastMoveRef.current = null;
      // Ο καμβάς ξηλώνεται: ό,τι έμεινε βαμμένο ή γραμμένο στο `style.cursor` δεν έχει πια
      // ιδιοκτήτη. Η **έξοδος από τη λειτουργία** (το συχνό σενάριο) καθαρίζεται από τον
      // δυαδικό effect παραπάνω — δες εκεί για το γιατί δεν αρκεί αυτό εδώ.
      clearTableIndicatorFeedback();
    };
  }, [containerRef, handleMouseMove, handleMouseLeave, handleModifierChange]);
}
