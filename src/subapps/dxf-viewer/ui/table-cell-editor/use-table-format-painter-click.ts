'use client';

/**
 * 🔴 ADR-768 Βήμα 5 (Δ3) — **ΤΟ ΒΑΨΙΜΟ**: ένα κλικ, μία μορφή, ένα `Ctrl+Z`.
 *
 * Το τρίτο σκέλος του πινέλου. Τα άλλα δύο («ρούφα», «σβήσε») ζουν στη **θύρα**, γιατί τα ζητούν
 * **επιφάνειες**· αυτό ζει στον **καμβά**, γιατί απαντά σε ερώτηση που καμία επιφάνεια δεν
 * μπορεί να απαντήσει: *σε ποιο κελί έπεσε το χέρι.*
 *
 * ## 🔴 ΔΕΝ ΞΑΝΑΚΑΝΕΙ HIT-TEST — και γι' αυτό χρησιμοποιεί τον κοινό ακροατή ΑΥΤΟΥΣΙΟ
 * Ο στόχος έχει ήδη απαντηθεί από την **τελευταία κίνηση ποντικιού** και ζει στο
 * `table-format-paint-target-store` — το **πέμπτο** κανάλι της ίδιας σάρωσης που γεννά τον
 * δείκτη. Άρα εδώ δεν υπάρχει γεωμετρία, δεν υπάρχει επιλογή στόχου, δεν υπάρχει τίποτα να
 * αποκλίνει: *ό,τι πατιέται είναι ό,τι φαίνεται* (§40.5).
 *
 * 🔑 **Αυτό ήταν και η ολόκληρη σχεδιαστική απόφαση του Δ3.** Ο πειρασμός ήταν να δεχτεί ο κοινός
 * ακροατής το `MouseEvent` και να το ρωτήσει το πινέλο — «το ⊕ ξέρει τον στόχο του από store, το
 * πινέλο όχι». Θα ήταν λάθος δύο φορές: (α) θα άλλαζε το κοινό συμβόλαιο για **έναν** καταναλωτή,
 * (β) θα γεννούσε **δεύτερη** σάρωση γεωμετρίας, η οποία ανάμεσα στην κίνηση και το πάτημα
 * μπορεί να απαντήσει για **άλλο** κελί (zoom με τροχό, undo από συντόμευση) — σφάλμα που δεν
 * αφήνει ίχνος, γιατί το αποτέλεσμα είναι απολύτως έγκυρο. Η σωστή απάντηση δεν ήταν «δώσε του
 * το συμβάν», ήταν «**γράψε τον στόχο εκεί που γράφονται όλοι οι άλλοι**».
 *
 * ## Τι έρχεται δωρεάν από τον κοινό ακροατή
 * `mousedown` σε **σύλληψη** στο δοχείο · **η κατανάλωση προηγείται του αποτελέσματος** (§40.8) ·
 * `claimTableCellSessionPointerDown()` (δίχτυ κατά του `focusout`) · 🔴 **`claimNextMouseUp()`**,
 * χωρίς το οποίο ο καμβάς διαβάζει το `mouseup` ως «κλικ στο κενό» και **αποεπιλέγει τον πίνακα**
 * με την ίδια κίνηση που τον έβαψε (§40.9).
 *
 * ## 🔴 ΕΝΑ ΒΗΜΑ ΑΝΑΙΡΕΣΗΣ, ΚΑΙ ΚΑΝΕΝΑ ΓΙΑ ΤΟ ΤΙΠΟΤΑ (Α5) — χωρίς νέα γραμμή μηχανισμού
 * Το {@link paintTableFormat} επιστρέφει το **ίδιο** μοντέλο by-reference όταν καμία τιμή δεν
 * αλλάζει, και ο φύλακας ταυτότητας από κάτω το μεταφράζει σε «καμία εντολή». Η ίδια σύμβαση
 * no-op που χρησιμοποιούν ήδη το μενού ζωνών, οι εντολές περιγράμματος και το ⊕.
 *
 * ## 🔴 Ο ΔΡΟΜΕΑΣ ΜΕΤΑΚΙΝΕΙΤΑΙ ΣΤΟ ΒΑΜΜΕΝΟ ΚΕΛΙ — μετρημένο στο Excel, όχι υποτεθειμένο
 * «*Excel will instantly apply the source cell's formatting, and **the selection will move to the
 * painted cell** that you just clicked on*». Δηλαδή το βάψιμο **είναι** και επιλογή: ο χρήστης
 * συνεχίζει από εκεί που έβαψε, όπως με κάθε άλλο κλικ σε κελί.
 *
 * ⚠️ Και συμβαίνει **ανεξάρτητα από το αν άλλαξε κάτι**: η επιλογή απαντά «πού είμαι», όχι «τι
 * πέτυχε». Ίδια αρχή με την κατανάλωση του πινέλου, μία στροφή πιο έξω.
 *
 * ⚠️ Σε **cross-table** βάψιμο ο δρομέας μεταπηδά στον **άλλο** πίνακα — και είναι το σωστό: το
 * Excel κάνει ακριβώς αυτό μεταξύ φύλλων. Το πινέλο **επιβιώνει** (ο φύλακας της Φ4 σβήνει μόνο
 * σε `δρομέας → null`), οπότε σε «κλειδωμένο» η επόμενη κίνηση συνεχίζει κανονικά.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-format-painter-click
 * @see state/table-format-paint-target-store.ts — ΠΟΥ βάφει (η απάντηση της τελευταίας κίνησης)
 * @see state/table-format-painter-store.ts — ΤΙ βάφει, και ποιος σβήνει το πινέλο
 * @see bim/table/table-format-paint.ts — Η ΠΡΑΞΗ, καθαρή
 * @see ui/table-cell-editor/use-table-armed-control-click.ts — ο κοινός ακροατής (§40.8/§40.9)
 * @see docs/centralized-systems/reference/adrs/ADR-768-table-format-painter.md
 */

import { type RefObject } from 'react';
import { useCommandHistory } from '../../core/commands';
import { resolveTableStyle } from '../../bim/table/table-entity-geometry';
import { paintTableFormat } from '../../bim/table/table-format-paint';
import {
  tableFormatScopeBounds,
  tableFormatScopeOf,
} from '../../bim/table/table-format-scope';
import { tableCursorAt } from '../../bim/table/table-cell-navigation';
import {
  consumeTableFormatPainterBrush,
  isTableFormatPainterArmed,
} from '../../state/table-format-painter-store';
import {
  getTableFormatPaintTarget,
  type TableFormatPaintTargetState,
} from '../../state/table-format-paint-target-store';
import { setTableCellCursor } from '../../state/table-cell-cursor-store';
import { useTableArmedControlClick } from './use-table-armed-control-click';
import { useTableModelCommit } from './use-table-model-commit';
import type { TableEntity } from '../../types/table-entity';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';

export interface UseTableFormatPainterClickParams {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly levelManager: LevelManagerLike;
}

/** Βάφει το κελί που υπόσχεται ο δείκτης, όσο το πινέλο είναι οπλισμένο. */
export function useTableFormatPainterClick(params: UseTableFormatPainterClickParams): void {
  const { containerRef, levelManager } = params;
  const { execute } = useCommandHistory();
  // Η ΙΔΙΑ διαδρομή commit με το mini toolbar, την κορδέλα και το ⊕: ένα `UpdateEntityCommand`,
  // ένα `Ctrl+Z`, καμία δεύτερη διαδρομή εγγραφής (§6.6).
  const commitModel = useTableModelCommit({ levelManager, execute });

  useTableArmedControlClick<TableFormatPaintTargetState>({
    containerRef,
    levelManager,
    /**
     * 🔴 **Η ΦΑΣΗ ΕΛΕΓΧΕΤΑΙ ΕΔΩ**, όπως και στα δύο αδέλφια: είναι γνώση του εργαλείου, όχι του
     * ακροατή. Και οι **δύο** ερωτήσεις είναι απαραίτητες.
     *
     * Ο στόχος γράφεται μόνο με οπλισμένο πινέλο, αλλά καθαρίζεται στην **επόμενη κίνηση** — άρα
     * υπάρχει παράθυρο «οπλίστηκε, ο χρήστης πάτησε `Esc`, το χέρι δεν κουνήθηκε» όπου ο στόχος
     * επιβιώνει ενός πινέλου που δεν υπάρχει πια. Χωρίς τον έλεγχο οπλισμού, εκείνο το πάτημα θα
     * καταναλωνόταν σιωπηλά και δεν θα έβαφε τίποτα — η χειρότερη εκδοχή του «δεν δουλεύει».
     */
    resolveArmed: () => (isTableFormatPainterArmed() ? getTableFormatPaintTarget() : null),
    run: (live, target) => paintOnce(live, target, commitModel),
  });
}

/**
 * Μία εφαρμογή του πινέλου πάνω στη **ζωντανή** οντότητα.
 *
 * Ξεχωριστή συνάρτηση και όχι inline: κρατά το hook κάτω από το όριο των 40 γραμμών (N.7.1) και,
 * το ουσιώδες, κάνει τη **σειρά** αναγνώσιμη ως προδιαγραφή — κατανάλωση, στόχος, πράξη, commit,
 * δρομέας.
 */
function paintOnce(
  live: TableEntity,
  target: TableFormatPaintTargetState,
  commitModel: (entity: TableEntity, model: TableEntity['model']) => boolean,
): void {
  // 🔴 §40.8 / Φ4 — **η κατανάλωση προηγείται του αποτελέσματος**, και ο κανόνας «μία χρήση» ζει
  // μέσα στο store. Σε «κλειδωμένο» το φορτίο επιστρέφεται χωρίς να αλλάξει τίποτα.
  const brush = consumeTableFormatPainterBrush();
  if (!brush) return;

  // Η **ίδια** διαδρομή «τι διάλεξε ο χρήστης → πού γράφεται» με κάθε άλλη εντολή μορφοποίησης
  // (ADR-739 §52). Καμία αριθμητική εδώ: μια χειρόγραφη μετατροπή ταυτότητας σε δείκτη θα ήταν
  // δεύτερη άποψη για το τι σημαίνει «αυτό το κελί» σε συγχωνευμένη περιοχή.
  const position = tableCursorAt(target.rowId, target.colId);
  const scope = tableFormatScopeOf(live.model, position, null);
  const bounds = scope ? tableFormatScopeBounds(live.model, scope) : null;
  // Μπαγιάτικη ταυτότητα (undo ανάμεσα στην κίνηση και το πάτημα): κανένα βάψιμο, κανένα
  // ιστορικό — αλλά το πινέλο έχει ήδη καταναλωθεί, και είναι το σωστό (§40.8).
  if (!bounds) return;

  const nextModel = paintTableFormat(live.model, resolveTableStyle(live), brush, bounds);
  // 🔴 Α5 — **ΧΩΡΙΣ ΔΕΥΤΕΡΟ ΦΥΛΑΚΑ «άλλαξε κάτι;», ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ.**
  //
  // Η πρώτη γραφή έβαζε εδώ `if (nextModel !== live.model)`. Ο έλεγχος με μεταλλάξεις τον
  // χαρακτήρισε **αδρανή**: αφαιρέθηκε και **καμία** άγκυρα δεν κοκκίνισε, γιατί ο πραγματικός
  // φύλακας ζει μία στρώση πιο κάτω (`buildTableModelCommand:284` → `null` σε ίδια ταυτότητα)
  // και το `commitModel` επιστρέφει `false` χωρίς να αγγίξει το ιστορικό.
  //
  // Δηλαδή ήταν ακριβώς αυτό που το `use-table-model-commit` απαγορεύει ονομαστικά: «*μια
  // δεύτερη σύγκριση εδώ θα ήταν δεύτερη άποψη για το «άλλαξε κάτι;»*». Δύο απόψεις σημαίνουν
  // ότι κάποτε θα αποκλίνουν — και το σύμπτωμα («το `Ctrl+Z` δεν κάνει τίποτα») δεν δείχνει
  // ποτέ προς την αιτία. Το `paintTableFormat` επιστρέφει το **ίδιο** μοντέλο by-reference όταν
  // δεν άλλαξε τίποτα· αυτό αρκεί, και το φυλάει ολόκληρη η σουίτα του `useTableModelCommit`.
  commitModel(live, nextModel);

  // 🔴 Ο δρομέας μετακινείται **πάντα**, ακόμη και σε άκαρπο βάψιμο: απαντά «πού είμαι», όχι «τι
  // πέτυχε». Κατάσταση `nav` και **κανένα πρόχειρο** — το βάψιμο δεν είναι πρόσκληση για γραφή.
  setTableCellCursor(live.id, position, 'nav');
}
