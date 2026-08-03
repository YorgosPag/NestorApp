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
import { tableEventWorldPoint, tableIndicatorProbeAtWorld } from './table-cell-pointer-hit';
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
// 🔬 ADR-739 §31.11 — το όργανο. Εδώ ζει η **ΑΙΤΙΑ** (τι απάντησε η σάρωση), ενώ στο
// `useCrosshairCursor` ζει το **ΑΠΟΤΕΛΕΣΜΑ** (τι γράφτηκε στο `style.cursor`). Χωρίς το πρώτο
// δεν ξεχωρίζεις «ο ρόλος άλλαξε» από «κάποιος άλλος ξαναέγραψε» — δύο διαφορετικές θεραπείες.
import { noteCursorProbe } from '../../systems/cursor/cursor-apply-audit';
// 🔴 ADR-739 §35 — η επιλογή (ΤΙ πιάνεται) και τα πλήκτρα (ΤΙ θα γίνει αν το πιάσεις).
import { getTableCellCursor } from '../../state/table-cell-cursor-store';
import { tableRangeDragIntentOf } from '../../bim/table/table-range-move-zone';
import type { TableEntity } from '../../types/table-entity';
import type { ViewTransform } from '../../rendering/types/Types';

/**
 * 🔴 ADR-739 §35 — τα πλήκτρα που **αλλάζουν την υπόσχεση** χωρίς να κουνηθεί το χέρι.
 *
 * Μόνο αυτά: κάθε άλλο πλήκτρο θα ξανα-σάρωνε γεωμετρία για απάντηση που δεν αλλάζει. Το
 * `Shift` είναι μέσα παρότι **δεν** αλλάζει το σχήμα του δείκτη σήμερα (η εισαγωγή δείχνει
 * κι αυτή `move`, όπως στο Excel) — γιατί αλλάζει την **πρόθεση** που καταγράφει το όργανο
 * του §31.11, και μια καταγραφή που δεν βλέπει το `Shift` δεν μπορεί να διαγνώσει σύρση που
 * εισήγαγε ενώ ο χρήστης περίμενε αντικατάσταση.
 */
const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Control', 'Meta', 'Shift']);

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
};

export interface UseTableIndicatorHoverParams {
  /** Το **ίδιο** `overlay !== null` που παίρνει το κλείδωμα — δες την κεφαλίδα. */
  readonly active: boolean;
  /** Η **ζωντανή** οντότητα του δρομέα· `null` όταν ο πίνακας χάθηκε από κάτω του. */
  readonly entity: TableEntity | null;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly transformRef: RefObject<ViewTransform>;
}

/** Ανάβει την υποδιαίρεση ζώνης κάτω από το ποντίκι, όσο ζει η λειτουργία πίνακα. */
export function useTableIndicatorHover(params: UseTableIndicatorHoverParams): void {
  const { active, entity, containerRef, transformRef } = params;

  /**
   * 🔴 §35 — **ΠΟΥ ΣΤΕΚΕΤΑΙ ΤΟ ΧΕΡΙ**, ώστε το `Ctrl` να μπορεί να ξαναρωτήσει χωρίς κίνηση.
   *
   * Ίδιο σχήμα με το `lastEvent` της σύρσης (`table-cell-drag-session` §27.16 Ε1) και για
   * τον ίδιο ακριβώς λόγο: υπάρχουν **δύο** αφορμές να ξαναλυθεί η ίδια ερώτηση — κινήθηκε το
   * χέρι, ή άλλαξε η **πρόθεση** κάτω από ακίνητο χέρι. Μία απάντηση, δύο αφορμές.
   *
   * `null` πριν την πρώτη κίνηση: ένα `Ctrl` χωρίς προηγούμενο hover δεν έχει σημείο να
   * ρωτήσει, και δεν επιτρέπεται να εφεύρει ένα.
   */
  const lastMoveRef = useRef<MouseEvent | null>(null);

  const handleMouseMove = useEventCallback((event: MouseEvent): void => {
    lastMoveRef.current = event;
    const container = containerRef.current;
    const transform = transformRef.current;
    if (!container || !entity || !transform) {
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
    // 🔴 ADR-739 §35 — η **επιλογή** διαβάζεται με getter τη στιγμή του συμβάντος, ποτέ ως
    // στιγμιότυπο κλεισμένο στο hook. Είναι ο ρητός κανόνας του ADR-040 («event handlers MUST
    // receive getters, not snapshot values»), και εδώ έχει **ορατό** σύμπτωμα αν παραβιαστεί:
    // ο χρήστης μεγαλώνει την περιοχή με `Shift+βέλος` χωρίς να κουνήσει το χέρι, και το
    // περίγραμμα που «πιάνεται» θα έμενε αυτό της **προηγούμενης** επιλογής.
    //
    // Φιλτραρισμένη ως προς ΑΥΤΟΝ τον πίνακα: δύο πίνακες στη σκηνή δεν μοιράζονται δρομέα —
    // ο ίδιος έλεγχος που κάνει ήδη ο ζωγράφος (`TableRenderer.cursorOf`).
    const cursorState = getTableCellCursor();
    const selection = cursorState?.entityId === entity.id ? cursorState.selection : null;
    // ΜΙΑ ανάγνωση γεωμετρίας, δύο απαντήσεις — δες την κεφαλίδα του `tableIndicatorProbeAtWorld`
    // για το γιατί δεν είναι δύο κλήσεις (θα ήταν δύο υπολογισμοί ανά κίνηση ποντικιού).
    const { hit, cursor } = tableIndicatorProbeAtWorld(
      entity,
      world,
      transform.scale,
      selection,
      // §35 — τα πλήκτρα **του συμβάντος**, όχι κατάσταση που κρατά κάποιος: το `Ctrl` μπορεί
      // να πατηθεί ή να αφεθεί με το χέρι ακίνητο πάνω στο περίγραμμα. Η ανανέωση του δείκτη
      // σε αυτή την περίπτωση έρχεται από το `keydown`/`keyup` — δες παρακάτω.
      tableRangeDragIntentOf(event),
    );
    // 🔬 §31.11 — η **αιτία**, με τις συντεταγμένες του συμβάντος: αν ο ρόλος ταλαντώνεται ενώ
    // το `y` μένει σταθερό, φταίει όριο κατά τον **οριζόντιο** άξονα (διαχωριστικά στηλών)·
    // αν ταλαντώνεται με το `y` να κινείται 1-2 px, φταίει το **χείλος** της λωρίδας.
    noteCursorProbe('ok', cursor, hit, event.clientX, event.clientY);
    setTableIndicatorHover(hit ? { entityId: entity.id, hit } : null);
    setTableIndicatorCursor(cursor);
  });

  /**
   * 🔴 §35 — το ποντίκι έφυγε: σβήσε **και** το σημείο, όχι μόνο την ανάδραση.
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
   * 🔴 §35 — **Η ΠΡΟΘΕΣΗ ΑΛΛΑΞΕ ΧΩΡΙΣ ΝΑ ΚΟΥΝΗΘΕΙ ΤΟ ΧΕΡΙ.**
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
    if (!MODIFIER_KEYS.has(event.key)) return;
    const last = lastMoveRef.current;
    if (last) handleMouseMove(last);
  });

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    // Καμία σύλληψη: δεν διεκδικούμε σειρά έναντι κανενός, μόνο παρατηρούμε. Και καμία
    // ακύρωση προεπιλογής — δες την κεφαλίδα (το pan ζει πάνω σε αυτό το συμβάν).
    container.addEventListener('mousemove', handleMouseMove, { passive: true });
    // Το ποντίκι βγήκε από τον καμβά: καμία λωρίδα δεν είναι πια «κάτω από τον δείκτη».
    // Χωρίς αυτό, το γράμμα θα έμενε αναμμένο ενώ το χέρι είναι στην κορδέλα.
    container.addEventListener('mouseleave', handleMouseLeave);
    // §35 — παθητικοί και οι δύο: **μόνο** ξαναρωτούν την ίδια ερώτηση. Καμία διεκδίκηση
    // πλήκτρου — το `Ctrl`/`Shift` ανήκουν σε όποιον τα διεκδικεί αλλού (αντιγραφή, επέκταση).
    window.addEventListener('keydown', handleModifierChange, { passive: true });
    window.addEventListener('keyup', handleModifierChange, { passive: true });
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('keydown', handleModifierChange);
      window.removeEventListener('keyup', handleModifierChange);
      lastMoveRef.current = null;
      // Η λειτουργία έκλεισε με το ποντίκι ακόμα πάνω στη λωρίδα: ο δείκτης παύει να
      // ζωγραφίζεται, αλλά η κατάσταση θα επιβίωνε και θα άναβε λάθος γράμμα στο επόμενο
      // άνοιγμα. Ίδια λογική με το `endTableCellDrag` του pointer.
      //
      // 🔴 §31 — για τον **δείκτη του ΟΣ** αυτό δεν είναι υγιεινή, είναι υποχρέωση: το σχήμα ζει
      // στο `style.cursor` του καμβά, όχι σε καρέ που παύει να ζωγραφίζεται. Χωρίς τον καθαρισμό,
      // ένα `Esc` με το χέρι πάνω στο γράμμα θα άφηνε **παχύ βέλος πάνω από σχέδιο** — δείκτη που
      // υπόσχεται επιλογή στήλης σε καμβά που δεν έχει πια πίνακα ανοιχτό.
      clearTableIndicatorFeedback();
    };
  }, [active, containerRef, handleMouseMove, handleMouseLeave, handleModifierChange]);
}
