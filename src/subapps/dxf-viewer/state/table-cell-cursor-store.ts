'use client';

/**
 * ADR-739 Φ.Δ βήμα 2 — **ο δρομέας κελιού πίνακα**: ποιο κελί είναι «τρέχον» και σε ποια
 * κατάσταση. Το SSoT που έλειπε — μέχρι τώρα ο πίνακας δεν είχε καθόλου έννοια «τρέχον
 * κελί», μόνο «ανοιχτός editor μετά από διπλό κλικ».
 *
 * Ίδιο σχήμα με το αδελφό `opening-info-tag-editor-store.ts` (ADR-612): χειροποίητο
 * external store πάνω στο `createExternalStore` SSoT. Οι **δύο** καταναλωτές του ζουν σε
 * κόσμους που δεν μιλούν μεταξύ τους, και γι' αυτό ακριβώς χρειάζεται store και όχι
 * React state:
 *
 *   - το `<TableCellEditorOverlay>` (DOM) — κατέχει το πληκτρολόγιο και το κείμενο·
 *   - ο `TableRenderer` (καμβάς) — ζωγραφίζει το ορθογώνιο του δρομέα, και **δεν μπορεί**
 *     να διαβάσει React state. Το διαβάζει με getter τη στιγμή του καρέ (ADR-040: event-time
 *     read μέσω getter, ποτέ snapshot), όπως ήδη κάνει με το `useDrawingScaleStore`.
 *
 * ## Οι τρεις καταστάσεις — είναι του Excel, όχι δικές μας
 * Το Excel δείχνει τη λέξη στη γραμμή κατάστασης· η διαφορά είναι **μετρήσιμη στα βέλη**:
 *
 * | κατάσταση | πώς μπαίνεις | τι κάνει το βέλος | τι κάνει η πληκτρολόγηση |
 * |---|---|---|---|
 * | `nav`   (Ready) | Tab/Enter/βέλος/Esc από edit | μετακινεί **κελί** | **αντικαθιστά** το κελί |
 * | `enter` (Enter) | πληκτρολόγησες σε `nav`      | δεσμεύει **και** μετακινεί κελί | συνεχίζει |
 * | `edit`  (Edit)  | `F2` ή διπλό κλικ           | μετακινεί τον **κέρσορα** | εισάγει στη θέση του κέρσορα |
 *
 * Το `F2` εναλλάσσει `enter` ↔ `edit` — το «διπλό F2» που ξέρει κάθε χρήστης Excel. Χωρίς
 * τον διαχωρισμό `enter`/`edit`, τα βέλη είναι διφορούμενα: ή χάνεις την πλοήγηση μόλις
 * αρχίσεις να γράφεις, ή δεν μπορείς ποτέ να διορθώσεις ένα γράμμα στη μέση.
 *
 * ## 🔴 ΓΙΑΤΙ ΔΕΝ ΚΡΑΤΑ ΚΕΙΜΕΝΟ
 * Το τρέχον κείμενο του κελιού είναι **παράγωγο** της οντότητας (`getPersistedCellText`).
 * Αντίγραφο εδώ θα ήταν δεύτερη αλήθεια που παλιώνει σε κάθε undo/redo και σε κάθε
 * ταυτόχρονη επεξεργασία. Ο δρομέας κρατά **ταυτότητα και κατάσταση**· το κείμενο το
 * διαβάζει ο καταναλωτής από το μοντέλο, τη στιγμή που το χρειάζεται.
 *
 * @module subapps/dxf-viewer/state/table-cell-cursor-store
 * @see bim/table/table-cell-navigation.ts — ποιο κελί είναι το επόμενο (καθαρό)
 * @see ui/table-cell-editor/use-table-cell-cursor-keys.ts — ο γραφέας από το πληκτρολόγιο
 * @see state/opening-info-tag-editor-store.ts — το αδελφό store που καθρεφτίζει
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../stores/createExternalStore';
import { markSystemsDirty } from '../rendering/core/frame-scheduler-api';
import type { TableCursorPosition } from '../bim/table/table-cell-navigation';

/** Οι τρεις καταστάσεις του Excel — δες τον πίνακα στην κεφαλίδα. */
export type TableCellCursorMode = 'nav' | 'enter' | 'edit';

/** `null` ⇒ κανένα τρέχον κελί (ο πίνακας είναι το πολύ επιλεγμένος ως οντότητα). */
export interface TableCellCursorState {
  /** Η οντότητα πίνακα που φιλοξενεί τον δρομέα. */
  readonly entityId: string;
  readonly position: TableCursorPosition;
  readonly mode: TableCellCursorMode;
  /**
   * Αύξων αριθμός **συνεδρίας γραφής**. Αλλάζει μόνο όταν μια συνεδρία ακυρώνεται με
   * `Escape` **χωρίς** να αλλάξει κελί ({@link cancelTableCellCursorSession}).
   *
   * ── Γιατί χρειάζεται αριθμός και δεν αρκεί το κελί ──
   * Το `<input>` του επεξεργαστή ξαναστήνεται όταν αλλάζει το React `key`, και μαζί του
   * ο **φρουρός «μία φορά»** του `use-inline-editor-keys` (`settledRef`) και το πρόχειρο
   * κείμενο. Σε μετακίνηση αυτό συμβαίνει δωρεάν (αλλάζει το row/col στο key). Το
   * `Escape` όμως γυρίζει σε `nav` **στο ίδιο κελί**: χωρίς αυτόν τον αριθμό το `<input>`
   * θα επιβίωνε ήδη «κριμένο», και το επόμενο `Enter` **δεν θα δέσμευε ποτέ** — μια
   * σιωπηλή απώλεια πληκτρολόγησης που δεν θα φαινόταν σε κανένα test κατάστασης.
   */
  readonly sessionId: number;

  /**
   * Το **πρόχειρο** κείμενο της τρέχουσας συνεδρίας γραφής· `''` σε κατάσταση πλοήγησης.
   *
   * ── 🔴 ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΕ `useState` ΤΟΥ ΕΠΕΞΕΡΓΑΣΤΗ (μετρημένο, 2026-08-01) ──
   *
   * Ήταν τοπικό React state. Ζωντανά, με 1.427 οντότητες, η πληκτρολόγηση χανόταν
   * **διαλείπουσα**: ένα probe στα συμβάντα του DOM έδειξε `input value="7"` και αμέσως
   * μετά `focusout value="7"`, ενώ το επόμενο `Tab` έφτανε σε `<input>` με `value=""` —
   * δηλαδή ο επεξεργαστής **ξαναστηνόταν** ανάμεσα στον χαρακτήρα και το Tab, και το
   * `useState` ξανασπερνόταν από την αρχική τιμή του κελιού. Το commit που ακολουθούσε
   * έγραφε το **παλιό** κείμενο (`command built? false` — «τίποτα δεν άλλαξε»).
   *
   * Αιτία του ξαναστησίματος: το `getLevelScene` είναι σκηνή που ανανεώνεται ασύγχρονα
   * (autosave / εξωτερική ενημέρωση). Ο επεξεργαστής **δεν επιτρέπεται** να εξαρτά τη
   * δουλειά του χρήστη από το αν μια ανάγνωση σκηνής πέτυχε σε ένα συγκεκριμένο render.
   *
   * Η διόρθωση δεν είναι «κράτα και το προηγούμενο target»: αυτό θεραπεύει το σύμπτωμα.
   * Ιδιοκτήτης της συνεδρίας γραφής είναι ο **δρομέας**, όχι ένα DOM node που μπορεί να
   * ξεφορτωθεί. Με το πρόχειρο εδώ, ένα ξαναστήσιμο είναι **αβλαβές** εξ ορισμού.
   *
   * ⚠️ Αυτό ΔΕΝ αναιρεί το «το store δεν κρατά κείμενο κελιού»: το πρόχειρο **δεν είναι**
   * το κείμενο του κελιού — είναι ό,τι δεν έχει δεσμευτεί ακόμα. Το δεσμευμένο κείμενο
   * παραμένει παράγωγο της οντότητας, πάντα.
   */
  readonly draft: string;

  /**
   * ADR-739 Φ.Δ βήμα 3 — σε ποιον **χαρακτήρα** στήνεται ο κέρσορας όταν ανοίγει η
   * συνεδρία· `undefined` ⇒ στο τέλος του κειμένου.
   *
   * Το γεμίζει **μόνο** το διπλό κλικ, γιατί μόνο εκείνο έχει σημείο: το Excel βάζει τον
   * κέρσορα εκεί που έδειξες, όχι μονίμως στο τέλος. `Tab` / βέλη / `F2` δεν έχουν σημείο
   * και γι' αυτό αφήνουν το πεδίο κενό — δεν είναι παράλειψη, είναι η σωστή σημασιολογία.
   *
   * Καταναλώνεται **μία φορά**, στο στήσιμο του `<input>`. Επιβιώνει των `...current`
   * ενημερώσεων (draft/mode) αβλαβώς: εκείνες δεν ξαναστήνουν το πεδίο.
   */
  readonly caretIndex?: number;
}

/**
 * Ο ζωγράφος του καμβά ξαναβάφει **μόνο** όταν το ζητήσει κάποιος (ADR-040 / ADR-119): ο
 * δρομέας ζει έξω από τον React κύκλο του καμβά, άρα η μετακίνησή του πρέπει να το πει
 * ρητά. Ίδιο μοτίβο με το `webgl-line-layer-store` και τις λαβές (`grip-hotgrip-actions`).
 *
 * Ένα καρέ ανά **πάτημα πλήκτρου** — μηδενική σχέση με τον βρόχο 60fps, και **έξω** από το
 * κλειδί του bitmap cache (ADR-040 κανόνας #3: ο δρομέας ζωγραφίζεται στο overlay pass της
 * επιλεγμένης οντότητας, ποτέ μέσα στο cached normal-state raster).
 */
const DXF_CANVAS_SYSTEM_ID = 'dxf-canvas';

const store = createExternalStore<TableCellCursorState | null>(null, {
  equals: (a, b) =>
    a?.entityId === b?.entityId &&
    a?.mode === b?.mode &&
    a?.sessionId === b?.sessionId &&
    a?.draft === b?.draft &&
    a?.caretIndex === b?.caretIndex &&
    a?.position.rowId === b?.position.rowId &&
    a?.position.colId === b?.position.colId &&
    a?.position.anchorColId === b?.position.anchorColId,
});

/**
 * Γράφει και ζητά **ένα** καρέ. Το «ζήτα καρέ» είναι άνευ όρων επίτηδες: το `equals` του
 * store μπορεί να απορρίψει μια ισοδύναμη εγγραφή, αλλά ένα περιττό repaint ανά πάτημα
 * πλήκτρου κοστίζει μηδέν — ενώ ένα **χαμένο** repaint αφήνει τον δρομέα ζωγραφισμένο σε
 * λάθος κελί, που είναι σφάλμα ορατό στην οθόνη. Ασύμμετρο ρίσκο, ασύμμετρη επιλογή.
 */
function commit(next: TableCellCursorState | null): void {
  store.set(next);
  markSystemsDirty([DXF_CANVAS_SYSTEM_ID]);
}

/** Καθαρή ανάγνωση — και ο getter που καλεί ο `TableRenderer` τη στιγμή του καρέ. */
export function getTableCellCursor(): TableCellCursorState | null {
  return store.get();
}

/** Συνδρομή σε αλλαγές· επιστρέφει την αποδέσμευση. */
export function subscribeTableCellCursor(listener: () => void): () => void {
  return store.subscribe(listener);
}

/**
 * Τοποθετεί τον δρομέα. Ένα κλικ / διπλό κλικ ξεκινά **νέα** συνεδρία καταχώρισης, οπότε
 * ο καλών περνά θέση φτιαγμένη από το `tableCursorAt` (νέα στήλη αγκύρωσης).
 */
export function setTableCellCursor(
  entityId: string,
  position: TableCursorPosition,
  mode: TableCellCursorMode,
  draft = '',
  caretIndex?: number,
): void {
  // Η μετακίνηση σε **άλλο** κελί ξαναστήνει ούτως ή άλλως το `<input>` (το row/col είναι
  // μέρος του React key), οπότε ο αριθμός συνεδρίας δεν χρειάζεται να αυξηθεί εδώ.
  commit({ entityId, position, mode, draft, caretIndex, sessionId: store.get()?.sessionId ?? 0 });
}

/**
 * Ο χρήστης πληκτρολόγησε. Σε κατάσταση πλοήγησης αυτό **ανοίγει** τη συνεδρία γραφής
 * (`enter`) — ο κανόνας type-to-replace του Excel· σε γραφή απλώς ενημερώνει το πρόχειρο.
 *
 * No-op χωρίς ενεργό δρομέα: ένα πλήκτρο δεν επιτρέπεται να γεννήσει δρομέα από το πουθενά.
 */
export function setTableCellCursorDraft(draft: string): void {
  const current = store.get();
  if (!current) return;
  commit({ ...current, draft, mode: current.mode === 'nav' ? 'enter' : current.mode });
}

/**
 * `F2` — εναλλαγή κατάστασης. Από πλοήγηση χρειάζεται το **κείμενο του κελιού** ως αφετηρία
 * του προχείρου (μπήκες για να διορθώσεις, όχι για να ξαναγράψεις)· από γραφή το πρόχειρο
 * μένει ως έχει και αλλάζει μόνο ποιος κατέχει τα βέλη.
 *
 * No-op χωρίς ενεργό δρομέα ή όταν η κατάσταση δεν αλλάζει.
 */
export function setTableCellCursorMode(mode: TableCellCursorMode, seedDraft?: string): void {
  const current = store.get();
  if (!current || current.mode === mode) return;
  commit({ ...current, mode, draft: seedDraft ?? current.draft });
}

/**
 * `Escape` πάνω σε πρόχειρο κείμενο: ακυρώνει τη **γραφή** και επιστρέφει σε πλοήγηση,
 * κρατώντας τον δρομέα στο ίδιο κελί — η δίπτυχη σημασιολογία του Excel και του WAI-ARIA
 * APG («Escape restores grid navigation»), όχι η μονόπτυχη έξοδος του AutoCAD.
 *
 * Ο αυξημένος {@link TableCellCursorState.sessionId} είναι το ουσιώδες μέρος: στήνει
 * καθαρό `<input>` με καθαρό φρουρό δέσμευσης. Δες το σχόλιο του πεδίου.
 *
 * No-op όταν δεν υπάρχει δρομέας ή όταν δεν γράφεται τίποτα — τότε το `Escape` ανήκει σε
 * όποιον άλλο το διεκδικεί στον bus (π.χ. αποεπιλογή οντότητας).
 */
export function cancelTableCellCursorSession(): void {
  const current = store.get();
  if (!current || current.mode === 'nav') return;
  // Το `caretIndex` πέφτει μαζί με τη συνεδρία: ήταν «πού έδειξε **εκείνο** το κλικ», και
  // το κλικ ακυρώθηκε. Ένα ξαναστημένο `<input>` δεν κληρονομεί σημείο που δεν ισχύει πια.
  commit({ ...current, mode: 'nav', draft: '', caretIndex: undefined, sessionId: current.sessionId + 1 });
}

/** Κλείνει τη συνεδρία δρομέα (Esc σε `nav`, αποεπιλογή, σβήσιμο του πίνακα). Ιδεμποτής. */
export function closeTableCellCursor(): void {
  if (store.get() === null) return;
  commit(null);
}

/** React binding — ο μόνος τρόπος που ο DOM κόσμος διαβάζει τον δρομέα. */
export function useTableCellCursor(): TableCellCursorState | null {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τα αδελφά stores. */
export function __resetTableCellCursorStoreForTests(): void {
  store.reset(null);
}
