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
 * @see state/table-cell-cursor-scope.ts — ο ΕΝΑΣ φύλακας «ποιος πίνακας, ποιο φύλλο» (ADR-833 Φ2)
 * @see state/opening-info-tag-editor-store.ts — το αδελφό store που καθρεφτίζει
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../stores/createExternalStore';
import { markSystemsDirty } from '../rendering/core/frame-scheduler-api';
import { activeWorksheet } from '../bim/table/table-worksheet-resolve';
import type { TableCursorPosition } from '../bim/table/table-cell-navigation';
import type { TableEntity } from '../types/table-entity';
import type {
  TableCellCursorMode,
  TableCellCursorState,
  TableCellSelection,
} from './table-cell-cursor-state';

/**
 * ADR-833 Φάση 2 — οι **δηλώσεις** μετακόμισαν στο `table-cell-cursor-state.ts` όταν το
 * `worksheetId` πέρασε το αρχείο τις 500 γραμμές (N.7.1). Επανεξάγονται αυτούσιες: **καμία**
 * υπάρχουσα διαδρομή εισαγωγής δεν αλλάζει — ίδιο μοτίβο με το `types/table.ts`, που
 * επανεξάγει τις ταυτότητες του `table-ids.ts`. Η τομή είναι σημασιολογική: εδώ ζει «**πώς
 * αλλάζει**» ο δρομέας, εκεί «**τι λέει**».
 */
export type {
  TableCellCursorMode,
  TableCellCursorState,
  TableCellSelection,
} from './table-cell-cursor-state';

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
    // 🔴 ADR-833 Φάση 2 — **και το φύλλο**: ο ίδιος πίνακας, το ίδιο κελί, άλλη καρτέλα είναι
    // **άλλη** θέση. Χωρίς αυτή τη γραμμή η αλλαγή καρτέλας θα ήταν «ισοδύναμη εγγραφή» και ο
    // δρομέας θα έμενε ζωγραφισμένος πάνω από το φύλλο που δεν τον γέννησε.
    a?.worksheetId === b?.worksheetId &&
    a?.mode === b?.mode &&
    a?.sessionId === b?.sessionId &&
    a?.draft === b?.draft &&
    a?.caretIndex === b?.caretIndex &&
    // 🔴 ADR-754 §4 — **και ο αύξων αριθμός τοποθέτησης**: χωρίς αυτή τη γραμμή, δύο
    // διαδοχικές υποδείξεις στο ίδιο κελί θα ήταν «ισοδύναμη εγγραφή» και ο κέρσορας δεν θα
    // ξαναπήγαινε ποτέ εκεί που τον έβαλε ο κώδικας. Δες το σχόλιο του πεδίου.
    a?.caretRevision === b?.caretRevision &&
    // 🔴 ADR-763 Φ2.4.1 — **και ο αύξων αριθμός αιτήματος δέσμευσης**, για τον **ίδιο ακριβώς**
    // λόγο με τη γραμμή από πάνω. Ο φύλακας είναι το **τρίτο** σημείο που πρέπει να μάθει κάθε
    // νέος μετρητής (πεδίο · κατασκευαστής · εδώ), και είναι το μόνο που αστοχεί **σιωπηλά**:
    // μετρήθηκε ζωντανά στη Φ2.4.1 — το `requestTableCellCursorCommit()` απορριπτόταν ως
    // «ισοδύναμη εγγραφή» και το «OK» δεν έκανε **τίποτα**, χωρίς κανένα σφάλμα πουθενά.
    a?.commitRequest === b?.commitRequest &&
    a?.position.rowId === b?.position.rowId &&
    a?.position.colId === b?.position.colId &&
    a?.position.anchorColId === b?.position.anchorColId &&
    // ADR-739 Φ.Δ βήμα 8 — η περιοχή συγκρίνεται **κατά τιμή**: το `rangeEnd` είναι νέο
    // αντικείμενο σε κάθε `Shift+βέλος`, οπότε μια σύγκριση αναφοράς θα δήλωνε «άλλαξε»
    // ακόμα και όταν το βέλος χτύπησε στην άκρη και τίποτα δεν κουνήθηκε.
    a?.selection?.from.rowId === b?.selection?.from.rowId &&
    a?.selection?.from.colId === b?.selection?.from.colId &&
    a?.selection?.to.rowId === b?.selection?.to.rowId &&
    a?.selection?.to.colId === b?.selection?.to.colId &&
    // 🔴 ADR-739 §27.15 — **και το είδος**: οι ίδιες δύο γωνίες σημαίνουν άλλα κελιά
    // ανάλογα με την πρόθεση (η στήλη δεν κουμπώνει, η περιοχή κουμπώνει). Χωρίς αυτή τη
    // γραμμή, μια μετάβαση «σύρσιμο περιοχής → κλικ στο γράμμα» με ταυτόσημες γωνίες θα
    // απορριπτόταν ως «τίποτα δεν άλλαξε» και η οθόνη θα έμενε στην παλιά ερμηνεία.
    a?.selection?.kind === b?.selection?.kind,
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
  entity: TableEntity,
  position: TableCursorPosition,
  mode: TableCellCursorMode,
  draft = '',
  caretIndex?: number,
): void {
  // Η μετακίνηση σε **άλλο** κελί ξαναστήνει ούτως ή άλλως το `<input>` (το row/col είναι
  // μέρος του React key), οπότε ο αριθμός συνεδρίας δεν χρειάζεται να αυξηθεί εδώ.
  //
  // ADR-739 Φ.Δ βήμα 8 — **η περιοχή πέφτει** (`rangeEnd: null`). Ένα σκέτο βέλος ή ένα
  // κλικ ξεκινά καινούρια επιλογή, όπως σε κάθε φύλλο υπολογισμού: η επέκταση απαιτεί
  // `Shift`, και ό,τι δεν το κρατά τη διαλύει. Χωρίς αυτό, μια περιοχή θα επιβίωνε
  // αόρατα κάτω από τον δρομέα και το επόμενο `Ctrl+C` θα αντέγραφε κελιά που ο χρήστης
  // δεν βλέπει πια μαρκαρισμένα.
  commit({
    entityId: entity.id,
    // 🔴 ADR-833 Φάση 2 — ο δρομέας γεννιέται **δεμένος στο φύλλο** που τον γέννησε. Γι' αυτό
    // δέχεται **οντότητα** και όχι `entityId`: η μισή ταυτότητα δεν είναι κάτι που ένας
    // καλών μπορεί να ξεχάσει να δώσει — δεν υπάρχει τρόπος να την παραλείψει.
    worksheetId: activeWorksheet(entity).id,
    position,
    mode,
    draft,
    caretIndex,
    selection: null,
    sessionId: store.get()?.sessionId ?? 0,
    // Αύξων για όλη τη ζωή του store, όπως ο αριθμός συνεδρίας — δες το σχόλιο του πεδίου.
    commitRequest: store.get()?.commitRequest ?? 0,
    // ADR-754 §4 — ο αριθμός τοποθέτησης είναι **αύξων για όλη τη ζωή του store**, όπως ο
    // αριθμός συνεδρίας: η μετακίνηση σε άλλο κελί δεν είναι λόγος να ξαναρχίσει από το μηδέν,
    // και ένα μηδένισμα εδώ θα μπορούσε να συμπέσει με την προηγούμενη τιμή σε άλλο κελί.
    //
    // 🔴 ADR-739 §46 — **ρητό `caretIndex` ⇒ ρητό γεγονός τοποθέτησης.** Ο δείκτης μόνος του
    // ήταν αρκετός όσο ο **μοναδικός** καλών με σημείο ήταν το διπλό κλικ **εισόδου**: εκεί
    // ο δρομέας γεννιόταν από το μηδέν, άρα το `<textarea>` μοντάριζε και το
    // `useLayoutEffect` έτρεχε ούτως ή άλλως. Από τη στιγμή που το διπλό κλικ **μέσα** στη
    // λειτουργία δείχνει γράμμα σε πεδίο που **ήδη ζει** (ίδιο React `key` ⇒ κανένα remount),
    // η θέση χωρίς γεγονός δεν θα εφαρμοζόταν ποτέ. Δες το σχόλιο του πεδίου: ο δείκτης είναι
    // **θέση**, το `caretRevision` είναι **εντολή** — και οι δύο καλούντες με σημείο περνούν
    // πλέον από την ίδια εντολή.
    caretRevision: (store.get()?.caretRevision ?? 0) + (caretIndex === undefined ? 0 : 1),
  });
}

/**
 * ADR-739 Φ.Δ βήμα 8 — θέτει το **δεύτερο άκρο** της περιοχής· `null` τη διαλύει.
 *
 * Το ενεργό κελί **δεν** κουνιέται: αυτή είναι όλη η διαφορά ανάμεσα σε `βέλος` και
 * `Shift+βέλος`, και ο λόγος που η επιλογή δεν είναι κατάσταση αλλά έκταση.
 *
 * No-op χωρίς ενεργό δρομέα: δεν υπάρχει περιοχή χωρίς ενεργό κελί να την ορίζει.
 */
export function setTableCellSelection(selection: TableCellSelection | null): void {
  const current = store.get();
  if (!current) return;
  commit({ ...current, selection });
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
  // ADR-739 Φ.Δ βήμα 8 — **η γραφή διαλύει την περιοχή**, και είναι συνειδητή απόκλιση από
  // το Excel. Εκεί το μαρκάρισμα επιβιώνει επειδή το `Enter` **περιφέρεται μέσα του** (η
  // κλασική ροή «μαρκάρω μπλοκ, γράφω, Enter, γράφω…»). Εμείς **δεν** υλοποιούμε αυτή την
  // περιφορά· κρατώντας μόνο το μαρκάρισμα θα λέγαμε ψέματα με το χρώμα: έξι φωτισμένα
  // κελιά ενώ γράφεται **ένα**. Όταν έρθει η περιφορά, αυτή η γραμμή είναι το ένα σημείο
  // που αλλάζει.
  commit({
    ...current,
    draft,
    selection: null,
    mode: current.mode === 'nav' ? 'enter' : current.mode,
  });
}

/**
 * 🔴 ADR-754 §4 — **ο κώδικας γράφει το πρόχειρο ΚΑΙ τοποθετεί τον κέρσορα**, ως μία πράξη.
 *
 * Ο ένας καλών του είναι η υπόδειξη κελιού με το ποντίκι: το κλικ αλλάζει το κείμενο σε
 * θέση που **δεν** είναι το τέλος (`=|+1` ⇒ `=E4|+1`), και ο browser, μόλις δει νέα τιμή σε
 * πεδίο κειμένου, πάει τον κέρσορα στο τέλος. Δηλαδή η θέση **πρέπει** να ταξιδέψει μαζί με
 * το κείμενο· δύο ξεχωριστές εγγραφές θα άφηναν ένα ενδιάμεσο render όπου η μία ίσχυε και η
 * άλλη όχι.
 *
 * ## 🔴 Γιατί ΔΕΝ υπάρχει τέταρτη τιμή στο {@link TableCellCursorMode}
 * Η υπόδειξη δεν είναι **κατάσταση**: είναι **παράγωγο** του `(πρόχειρο, θέση κέρσορα)`,
 * υπολογισμένο από τον υπάρχοντα λεξικογράφο (`resolveFormulaPointState`). Μια σημαία θα
 * έπρεπε να μπαίνει στο `=`, να βγαίνει σε κάθε ψηφίο, σε κάθε `)`, σε `Escape`, σε `F2`, σε
 * `Enter`, σε αναίρεση — και σε κάθε **μελλοντικό** μονοπάτι που αγγίζει το κείμενο. Η πρώτη
 * φορά που θα ξεχνιόταν ένα από αυτά, το επόμενο κλικ θα έγραφε `E4` **μέσα σε κείμενο που
 * δεν είναι τύπος**, σιωπηλά. Έτσι όπως είναι, `Enter`/`Escape`/`F2`/πληκτρολόγηση δεν
 * χρειάστηκαν **καμία** γραμμή: αλλάζουν το πρόχειρο, άρα η απάντηση πέφτει μόνη της.
 *
 * No-op χωρίς ενεργό δρομέα, όπως κάθε άλλος γραφέας εδώ.
 */
export function setTableCellCursorDraftAt(draft: string, caretIndex: number): void {
  const current = store.get();
  if (!current) return;
  // Η **περιοχή** δεν διαλύεται εδώ, σε αντίθεση με το {@link setTableCellCursorDraft}: ο
  // χρήστης δεν πληκτρολόγησε — έδειξε. Το μαρκάρισμα που βλέπει ανήκει στο κελί που γράφει,
  // και μια υπόδειξη σε τρίτο κελί δεν είναι λόγος να σβήσει.
  commit({ ...current, draft, caretIndex, caretRevision: current.caretRevision + 1 });
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
  // ADR-739 Φ.Δ βήμα 8 — η είσοδος σε **γραφή** διαλύει την περιοχή, για τον ίδιο λόγο με
  // το {@link setTableCellCursorDraft}: γράφεται ένα κελί, δεν επιτρέπεται να φωτίζονται
  // έξι. Η επιστροφή σε `nav` δεν την ξαναγεννά — μια διαλυμένη επιλογή είναι διαλυμένη.
  commit({
    ...current,
    mode,
    draft: seedDraft ?? current.draft,
    selection: mode === 'nav' ? current.selection : null,
  });
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

/**
 * ADR-739 Φ.Δ βήμα 9 — **ξαναστήνει** το πεδίο της συνεδρίας χωρίς να αλλάξει τίποτα άλλο.
 *
 * Ο δρομέας μένει στο ίδιο κελί, στην ίδια κατάσταση· αλλάζει **μόνο** ο
 * {@link TableCellCursorState.sessionId}, δηλαδή το React `key` του επεξεργαστή — άρα το
 * `<textarea autoFocus>` ξαναστήνεται και η **εστίαση επιστρέφει στο κελί**.
 *
 * ## Γιατί χρειάζεται
 * Το μενού συμφραζομένων των ζωνών δείκτη παίρνει την εστίαση όσο είναι ανοιχτό (Radix). Στο
 * κλείσιμό του η εστίαση επιστρέφει στον **κρυφό trigger** του, όχι στο κελί — και τότε η
 * συνεδρία θα ήταν ζωντανή αλλά «κουφή»: κανένα πλήκτρο πίνακα δεν θα έφτανε πουθενά. Ο
 * δομικός φύλακας `isTextEntryTarget` βλέπει **εστιασμένο πεδίο κειμένου**, όχι κατάσταση
 * store· άρα η επαναφορά πρέπει να είναι πραγματική εστίαση, όχι δήλωση.
 *
 * Καθρέφτης του {@link cancelTableCellCursorSession}, με τη μία διαφορά που μετρά: **δεν**
 * αγγίζει `mode`/`draft`. Δεν ακυρώνεις γραφή — ξαναπιάνεις το πληκτρολόγιο.
 *
 * No-op χωρίς δρομέα.
 */
export function restartTableCellCursorSession(): void {
  const current = store.get();
  if (!current) return;
  commit({ ...current, sessionId: current.sessionId + 1 });
}

/**
 * 🔴 ADR-763 Φ2.4.1 — **«ΔΕΣΜΕΥΣΕ ΚΑΙ ΒΓΕΣ»**, από καλούντα που δεν μπορεί να δεσμεύσει μόνος.
 *
 * Το «OK» του διαλόγου ορισμάτων είναι το ίδιο πράγμα με το `Enter` του Excel: ο τύπος μπαίνει
 * στο κελί και το κελί **παύει να γράφεται**. Μέχρι τη Φ2.4.1 ο διάλογος έκανε
 * {@link restartTableCellCursorSession}, δηλαδή ξαναστήνε το `<textarea autoFocus>` — το κελί
 * έμενε σε γραφή και ο χρήστης έπρεπε να πατήσει **και** `Enter` (αναφορά Giorgio, στιγμιότυπο
 * 14:20). Τα δύο μοιάζουν και είναι **αντίθετα**: το ένα ξαναπιάνει το πληκτρολόγιο, το άλλο
 * το παραδίδει.
 *
 * Το γιατί είναι σήμα και όχι κλήση ζει στο {@link TableCellCursorState.commitRequest}.
 * Ο **ένας** εξυπηρετητής: `use-table-cell-commit-request.ts`.
 *
 * No-op χωρίς δρομέα ή σε πλοήγηση — εκεί δεν γράφεται τίποτα να δεσμευτεί, και ένα αίτημα
 * που κανείς δεν θα εξυπηρετούσε θα έμενε να «κρέμεται» μέχρι την επόμενη συνεδρία.
 */
export function requestTableCellCursorCommit(): void {
  const current = store.get();
  if (!current || current.mode === 'nav') return;
  commit({ ...current, commitRequest: current.commitRequest + 1 });
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
