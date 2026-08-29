'use client';

/**
 * ADR-739 Φάση Δ βήματα 2-3 — ο **οδηγός του δρομέα κελιού** στον 2D καμβά.
 *
 * Στο **βήμα 3** πήρε και έναν δεύτερο ρόλο: είναι ο τόπος όπου το κελί γίνεται **κουτί
 * οθόνης**. Ταιριάζει εδώ για τον ίδιο λόγο που ταιριάζουν και τα υπόλοιπα — είναι το μόνο
 * σημείο που βλέπει ταυτόχρονα το **μοντέλο** (διάταξη, στυλ, γωνία) και το **DOM**
 * (container, προβολή). Ο υπολογισμός όμως δεν ζει εδώ: τον κάνει το καθαρό
 * `table-cell-editor-frame.ts`· εδώ γίνεται μόνο η σύνδεση.
 *
 * Ήταν «ο ανοιχτήρας του διπλού κλικ»· τώρα είναι ο ένας τόπος που ξέρει **και** το
 * μοντέλο **και** το DOM, δηλαδή ο μόνος που μπορεί να απαντήσει στις τρεις ερωτήσεις του
 * επεξεργαστή: «τι γράφω;» (commit), «πού πάω;» (move), «τι κείμενο έχει το κελί;».
 *
 * Ό,τι **δεν** χρειάζεται και τα δύο, ζει αλλού και δεν το ξαναγράφουμε εδώ:
 *   - ΠΟΙΟ είναι το επόμενο κελί → `bim/table/table-cell-navigation.ts` (καθαρό)
 *   - ΠΩΣ γίνεται commit + ΠΟΥ αγκυρώνεται → `bim/table/table-cell-edit-session.ts`
 *   - ΠΟΙΑ είναι η κατάσταση του δρομέα → `state/table-cell-cursor-store.ts`
 *   - ΤΙ σημαίνει κάθε πλήκτρο → `ui/table-cell-editor/table-cell-key-intent.ts`
 *
 * Κρατά **μηδέν** δική του κατάσταση: ο δρομέας ζει σε store επειδή τον διαβάζει και ο
 * ζωγράφος του καμβά, που δεν βλέπει React state. Η συνδρομή είναι χαμηλής συχνότητας
 * (ένα πάτημα πλήκτρου), δηλαδή ακριβώς το ίδιο κόστος με το `useState` που αντικατέστησε
 * — ο κανόνας 1 του ADR-040 αφορά υψίσυχνα stores (pan/zoom/hover), όχι το πληκτρολόγιο.
 *
 * @see bim/table/table-cell-navigation.ts — ΠΟΙΟ κελί είναι το επόμενο
 * @see ui/table-cell-editor/TableCellEditorOverlay.tsx — η όψη + η ιδιοκτησία πλήκτρων
 * @see ui/text-toolbar/hooks/useTextDoubleClickEditor.ts — ο αδελφός που καθρεφτίζει
 */

import { useCallback, useMemo } from 'react';
import type React from 'react';
// ADR-751 Φ8.γ — `Alt+Enter` σε πλοήγηση· η απόφαση «ένας / πολλοί / κανένας» ζει στον
// επιλυτή, εδώ μένει μόνο η αντίδραση της διεπαφής στην περίπτωση «πολλοί».
// ADR-711 — το SSoT του «ποιος κατέχει το πληκτρολόγιο». ΜΗΝ γράψεις δεύτερο scope.
import { useModalKeyboardScope } from '@/lib/a11y/use-modal-keyboard-scope';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { useCommandHistory } from '../../core/commands';
import { resolveTableById } from './table-entity-lookup';
import { useTableCursorCommands } from './use-table-cursor-commands';
import { useLiveTable } from './use-live-table';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import { buildTableCellEditCommand } from '../../bim/table/table-cell-edit-session';
import {
  moveTableCursor,
  type TableCursorMove,
} from '../../bim/table/table-cell-navigation';
import {
  closeTableCellCursor,
  setTableCellCursor,
  useTableCellCursor,
} from '../../state/table-cell-cursor-store';
// 🔴 ADR-828 Φ4α — η πληκτρολογιακή πόρτα του κουμπιού συμπλήρωσης. Όλη η γνώση ζει στο module
// της· εδώ γίνεται μόνο η σύνδεση με τον κόσμο (ζωντανή οντότητα + DOM + δεσμευτής).
import { useTableFillBadgeKey } from './use-table-fill-badge-key';
// 🔴 ADR-739 §46 — η **απόφαση** του διπλού κλικ (είσοδος vs άνοιγμα κελιού), σε δικό της
// module: δεν χρειάζεται τίποτα από το hook, και αυτό εδώ ξαναχτύπησε τις 500 γραμμές (N.7.1).
import { useTableDoubleClick } from './use-table-double-click';
// 🔴 ADR-739 §68.9 — ο γραφέας της **χειρονομίας** «όλα» (ενεργό κελί στο A1), σε αντίθεση
// με την **εντολή** `Ctrl+A` που επιλέγει χωρίς να πλοηγεί.
import { selectWholeTableFromCorner } from './table-select-all-action';
// 🔴 ADR-739 §48 — δες το `commitText`: το γράψιμο σε κελί ακυρώνει την υπόσχεση του προχείρου.
import { clearTableCopyMarquee } from '../../state/table-copy-marquee-store';
// ADR-739 §31.10 — η **αλυσίδα προς την οθόνη** (κελί ⇒ κουτί ⇒ άγκυρο), εξαχθείσα για τον
// ίδιο λόγο: αυτό το αρχείο ξαναχτύπησε τις 500 γραμμές.
import { useTableCellAnchor } from './use-table-cell-anchor';
import { useTableNameBoxGoto } from './use-table-name-box-goto';
import {
  useTableFormulaBarMount,
  type TableFormulaBarMount,
} from './use-table-formula-bar-mount';
import type { TableCellEditorOverlayProps } from './table-cell-editor-overlay-types';
// ADR-739 Φ.Δ βήμα 8 — οι ενέργειες περιοχής ζουν σε δικό τους module: αυτό το αρχείο
// είναι ήδη στα όρια των 500 γραμμών (N.7.1), και ο διαχωρισμός είναι σημασιολογικός —
// εδώ «ποιο κελί, πού, με τι όψη», εκεί «ποια κελιά και τι τους κάνω».
import { useTableRangeActions } from './use-table-range-actions';
// ADR-739 Φ.Δ βήμα 8 — απλό κλικ μετακινεί το ενεργό κελί, `Shift+κλικ` απλώνει την
// περιοχή. **Παθητικός** ακροατής: δεν καταναλώνει το συμβάν, δεν αγγίζει τον καμβά.
import { useTableCellPointer } from './use-table-cell-pointer';
// ADR-739 §29 + §30 + §40 — οι τρεις ακροατές καμβά της λειτουργίας πίνακα (κλείδωμα
// ποντικιού, hover λωρίδων, πάτημα του ⊕) με τη **μία** κοινή συνθήκη ζωής τους. Έφυγαν από
// εδώ όταν αυτό το αρχείο ξαναχτύπησε τις 500 γραμμές (N.7.1).
import { useTableModeCanvasWiring } from './use-table-mode-canvas-wiring';
// ADR-739 §31.9 — ο ΕΝΑΣ δεσμευτής «οντότητα + νέο μοντέλο ⇒ μία εντολή», κοινός με το μενού
// ζωνών· η σύρση πλάτους τον καλεί **μία** φορά, στο `mouseup`.
import { useTableModelCommit } from './use-table-model-commit';
import { useTableSceneWriters } from './use-table-scene-writers'; // §66 — γραφείς σκηνής
import { beginTableMove } from './table-move-drag'; // §66 — η πέμπτη χειρονομία
import { useEventCallback } from '@/hooks/useEventCallback';
// 🔴 ADR-763 Φ2.4.1 — ο ΕΝΑΣ εξυπηρετητής του «δέσμευσε και βγες». Δικό του module για τον
// ίδιο λόγο με τα υπόλοιπα τέσσερα: αυτό το αρχείο είναι στα όρια των 500 γραμμών (N.7.1).
import { useTableCellCommitRequest } from './use-table-cell-commit-request';
// 🔴 ADR-769 Δ1 — δεμένο κελί σε **γράψιμη** στήλη: ο πίνακας ΖΗΤΑΕΙ αντί να κρατήσει.
import { useTableCellWriteBack } from './use-table-cell-write-back';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { ViewTransform } from '../../rendering/types/Types';

interface UseTableCellDoubleClickEditorParams {
  readonly transformRef: React.RefObject<ViewTransform>;
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
  readonly getSelectedEntityIds: () => readonly string[];
  readonly levelManager: LevelManagerLike;
}

/**
 * Ό,τι χρειάζεται ο καλών για να στήσει την όψη. Το `key` ταξιδεύει **δίπλα** στα props
 * και όχι μέσα τους: το React το καταναλώνει, δεν φτάνει ποτέ στο component — και εδώ
 * κουβαλά τον αριθμό συνεδρίας, που είναι ακριβώς ο λόγος που ξαναστήνεται το `<input>`.
 */
export interface TableCellOverlayMount {
  readonly key: string;
  readonly props: TableCellEditorOverlayProps;
}

interface TableCellDoubleClickEditorApi {
  readonly overlay: TableCellOverlayMount | null;
  /**
   * ADR-739 Φ.Δ βήμα 7 — η γραμμή τύπων, αγκυρωμένη στον **πίνακα**. Ζει δίπλα στον
   * επεξεργαστή και όχι μέσα του: είναι το δεύτερο πεδίο της **ίδιας** συνεδρίας, με
   * διαφορετικό άγκυρο και διαφορετικό ρυθμό ανανέωσης.
   */
  readonly formulaBar: TableFormulaBarMount | null;
  readonly handleDoubleClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export function useTableCellDoubleClickEditor(
  params: UseTableCellDoubleClickEditorParams,
): TableCellDoubleClickEditorApi {
  const { transformRef, containerRef, getSelectedEntityIds, levelManager } = params;
  const { execute, undo, redo } = useCommandHistory();
  const cursor = useTableCellCursor();

  // ADR-739 §46 — δύο χειρονομίες σε ένα συμβάν (είσοδος / άνοιγμα κελιού). Η απόφαση ζει στο
  // `table-double-click-gesture`, η καλωδίωση στο `use-table-double-click` — δες εκεί το κριτήριο.
  const handleDoubleClick = useTableDoubleClick({
    transformRef, containerRef, getSelectedEntityIds, levelManager,
  });

  /**
   * Γράφει κείμενο στο τρέχον κελί ως **ένα** αναιρέσιμο `UpdateEntityCommand`.
   *
   * Ο πίνακας ξαναδιαβάζεται ΤΗ ΣΤΙΓΜΗ του commit (όχι η αναφορά του ανοίγματος), ώστε
   * δύο διαδοχικές επεξεργασίες — που πλέον είναι ο **κανόνας**, αφού το Tab γράφει
   * κελί-κελί — να μη γράφουν πάνω σε μπαγιάτικο μοντέλο.
   */
  const attemptWriteBack = useTableCellWriteBack(levelManager);

  const commitText = useCallback(
    (nextText: string) => {
      if (!cursor) return;
      const { currentLevelId, getLevelScene, setLevelScene } = levelManager;
      const entity = resolveTableById(levelManager, cursor.entityId);
      if (!entity || !currentLevelId || !setLevelScene) return;
      // 🔴 ADR-769 Δ1 — **πρώτα ο ιδιοκτήτης**: αν το κελί τρέφεται από πηγή και η στήλη
      // γράφεται, η τιμή πάει στην **οντότητα**, όχι στο μοντέλο. `false` ⇒ κανονικό κελί.
      const { rowId, colId } = cursor.position;
      if (attemptWriteBack(entity, rowId, colId, nextText)) { clearTableCopyMarquee(); return; }
      const sceneManager = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId);
      const command = buildTableCellEditCommand(entity, rowId, colId, nextText, sceneManager);
      if (!command) return;
      execute(command);
      // 🔴 ADR-739 §48 — το γράψιμο σε κελί σβήνει τα μυρμήγκια (Excel parity). Δεύτερο σημείο
      // δίπλα στο `useTableModelCommit` και **όχι** αντιγραφή: αυτή η διαδρομή δεν περνά από
      // εκείνο το hook (χτίζει `buildTableCellEditCommand` απευθείας), και οι δύο μαζί είναι
      // όλες οι διαδρομές που παράγουν εντολή πίνακα από τη διεπαφή του κελιού.
      clearTableCopyMarquee();
    },
    [cursor, levelManager, execute, attemptWriteBack],
  );

  /**
   * Μετακίνηση δρομέα. Ο νέος δρομέας μπαίνει **πάντα** σε κατάσταση `nav`: μετακινήθηκες,
   * δεν άρχισες να γράφεις — η γραφή ξεκινά μόλις πατήσεις χαρακτήρα (Excel).
   *
   * `null` από το `moveTableCursor` σημαίνει «άκρη πλέγματος»: ο δρομέας **μένει**. Καμία
   * αναδίπλωση, καμία αυτόματη νέα γραμμή — δες το σκεπτικό στο `table-cell-navigation`.
   */
  const move = useCallback(
    (m: TableCursorMove) => {
      if (!cursor) return;
      const entity = resolveTableById(levelManager, cursor.entityId);
      // Ο πίνακας εξαφανίστηκε κάτω από τον δρομέα (undo / διαγραφή): κλείσε, μη μαντεύεις.
      if (!entity) { closeTableCellCursor(); return; }
      // Το entity κρατά απλό JSON (Φ.Δ Λύση Α)· το `resolveTableModel` είναι ο ΙΔΙΟΣ
      // απομνημονευμένος (WeakMap) δρόμος που περνά και η γεωμετρία — ίδιο persisted ⇒
      // ίδιο μοντέλο, άρα καμία δεύτερη αποσειριοποίηση ανά πάτημα πλήκτρου.
      const next = moveTableCursor(resolveTableModel(entity.model), cursor.position, m);
      if (next) setTableCellCursor(cursor.entityId, next, 'nav');
    },
    [cursor, levelManager],
  );

  /**
   * ADR-739 Φ.Δ βήμα 4 — `Ctrl+Z`/`Ctrl+Y` σε **πλοήγηση**, με σημασιολογία Excel.
   *
   * Δεν υπάρχει δεύτερο ιστορικό: είναι **το ίδιο** `CommandHistory` του καμβά. Και δεν
   * χρειάζεται να είναι — κάθε δέσμευση κελιού είναι ήδη ένα `UpdateEntityCommand` σε
   * αυτό ακριβώς το ιστορικό (δες {@link commitText}). Άρα «αναίρεσε την τελευταία
   * επεξεργασία κελιού» **είναι** «αναίρεσε την τελευταία εντολή», όσο ο χρήστης είναι
   * μέσα στον πίνακα και δεν έχει κάνει τίποτα άλλο. Ένα ξεχωριστό ιστορικό ανά πίνακα
   * θα ήταν δεύτερη αλήθεια που θα αποκλίνει στο πρώτο undo από τη γραμμή εντολών.
   */
  const history = useCallback(
    (direction: 'undo' | 'redo') => {
      if (direction === 'undo') undo();
      else redo();
    },
    [undo, redo],
  );

  /**
   * 🔴 ADR-739 Φ.Δ βήμα 4 — Η ΖΩΝΤΑΝΗ ΟΝΤΟΤΗΤΑ, **έξω** από κάθε memo.
   *
   * ## Το σφάλμα που διορθώνει (μετρημένο, όχι υποθετικό)
   * Το `target` παρακάτω ήταν `useMemo(..., [cursor, levelManager])` και **διάβαζε τη σκηνή**.
   * Οι δύο εξαρτήσεις όμως **δεν αλλάζουν ποτέ** όταν αλλάζει η σκηνή:
   *
   *   - το `levelManager` είναι τιμή React context, και το `getLevelScene` του είναι
   *     `useCallback(…, [])` πάνω σε **ref** (`LevelsSystem.tsx`) — άρα η ταυτότητα του
   *     context μένει ίδια σε κάθε `setLevelScene`·
   *   - ο `cursor` αλλάζει σε κάθε **πάτημα πλήκτρου** (το πρόχειρο ζει μέσα του).
   *
   * Το δεύτερο έκρυβε το πρώτο: όσο ο χρήστης πληκτρολογούσε, ο memo ξαναϋπολογιζόταν και
   * όλα φαίνονταν σωστά. Σε αλλαγή σκηνής **χωρίς** αλλαγή δρομέα — δηλαδή ακριβώς σε
   * **undo / διαγραφή του πίνακα / αλλαγή επιπέδου** — ο memo κρατούσε μπαγιάτικο `target`,
   * άρα το `overlay` έμενε μονταρισμένο πάνω σε πίνακα **που δεν υπάρχει πια**, άρα το
   * modal scope έμενε πατημένο: **ο viewer κλείδωνε μέχρι reload** (§5.1 του handoff).
   *
   * Το πιάνει το `__tests__/table-mode-keyboard-scope.test.tsx`, «ΔΡΟΜΟΣ 2/4».
   *
   * ## Γιατί η διόρθωση είναι εξάρτηση και όχι φύλακας
   * Ο πειρασμός είναι ένα `useEffect` που κλείνει τον δρομέα όταν χαθεί ο στόχος. Αυτό
   * θεραπεύει το σύμπτωμα και προσθέτει νέο κίνδυνο: μια **παροδικά** αποτυχημένη ανάγνωση
   * σκηνής θα σκότωνε τη συνεδρία γραφής του χρήστη — η παλινδρόμηση που έλυσε το βήμα 3.
   * Η αιτία δεν ήταν «λείπει φύλακας», ήταν **memo που δήλωνε εξαρτήσεις τις οποίες δεν
   * διαβάζει**. Η ανάγνωση ανεβαίνει έξω· ο memo δηλώνει επιτέλους την αλήθεια.
   *
   * Κόστος: μία `Array.find` ανά απόδοση όταν υπάρχει δρομέας — δηλαδή ανά πάτημα πλήκτρου,
   * όχι ανά καρέ.
   */
  const liveEntity = cursor ? resolveTableById(levelManager, cursor.entityId) : null;

  /**
   * 🔴 ADR-739 §36 ΦΑΣΗ 4 — **η ίδια ανάγνωση, αλλά σε χρόνο χειριστή.** Το {@link liveEntity}
   * απαντά «τι βλέπει αυτό το render»· ο διάλογος επικάλυψης της μεταφοράς ρωτά «τι ισχύει
   * **τώρα** που ο χρήστης απάντησε», δηλαδή μετά από αόριστο χρόνο ανθρώπου. Ο ΕΝΑΣ getter
   * του subapp — καμία τέταρτη αντιγραφή των τριών γραμμών (δες την κεφαλίδα του module).
   */
  const liveTable = useLiveTable(levelManager);

  /**
   * ADR-739 Φ.Δ βήμα 8 — επέκταση / επιλογή όλων / άδειασμα / πρόχειρο.
   *
   * Δέχεται τη **ζωντανή** οντότητα που μόλις διαβάστηκε παραπάνω: μια δεύτερη ανάγνωση
   * σκηνής θα μπορούσε να δει άλλο (ή σβησμένο) πίνακα μέσα στο ίδιο render — ακριβώς το
   * σφάλμα που περιγράφει το σχόλιο του `liveEntity`.
   */
  const rangeActions = useTableRangeActions({ cursor, entity: liveEntity, levelManager, execute });

  /**
   * 🔴 ADR-739 §26.15 — **ό,τι γράφεται δεσμεύεται πριν το κλικ μετακινήσει τον δρομέα.**
   *
   * Είναι το ταίρι του `commit()` που κάνει ήδη το πληκτρολόγιο πριν από κάθε `onMove`
   * (`use-table-cell-session-keys`, `case 'move'`) — όχι δεύτερη διαδρομή εγγραφής: περνά
   * από το **ίδιο** {@link commitText}, δηλαδή το ίδιο `buildTableCellEditCommand` και το
   * ίδιο ιστορικό.
   *
   * Σε πλοήγηση σιωπά, με τον ίδιο λόγο που σιωπά και ο επεξεργαστής: εκεί το πρόχειρο είναι
   * κενό, και μια δέσμευσή του θα **έσβηνε** το κελί περνώντας από πάνω του.
   */
  const commitPendingDraft = useCallback(() => {
    if (!cursor || cursor.mode === 'nav') return;
    commitText(cursor.draft);
  }, [cursor, commitText]);

  /**
   * 🔴 ADR-739 §31.9 — **ΟΙ ΔΥΟ ΓΡΑΦΕΙΣ ΤΗΣ ΣΥΡΣΗΣ ΠΛΑΤΟΥΣ**, και γιατί δεν είναι ένας.
   *
   * Το `commitTableModel` παράγει **εντολή** — δηλαδή βήμα αναίρεσης. Καλεσμένο σε κάθε
   * `mousemove`, ένα σύρσιμο θα γέμιζε τον σωρό με 60 βήματα και ένα `Ctrl+Z` θα γύριζε **ένα
   * pixel** πίσω. Καλεσμένο μόνο στο τέλος, ο χρήστης θα έσερνε στα τυφλά.
   *
   * Άρα δύο δρόμοι: η προεπισκόπηση γράφει τη σκηνή **απευθείας** (φθηνή, χωρίς ιστορικό) και
   * το τελικό πλάτος περνά **μία** φορά από την εντολή. Ο κύκλος ζωής της χειρονομίας δεν
   * ξέρει τη διαφορά — δες την κεφαλίδα του `table-axis-resize-drag`.
   */
  const commitTableModel = useTableModelCommit({ levelManager, execute });

  // 🔴 ADR-828 Φ4α — `Alt+↓`: η πληκτρολογιακή πόρτα του κουμπιού «Επιλογές Αυτόματης
  // Συμπλήρωσης», η διαδρομή που το Excel **δεν έχει καθόλου**. Η σύνδεση ζει εδώ επειδή εδώ
  // είναι ο ένας τόπος που βλέπει μοντέλο **και** DOM· το γιατί ζει στο module της πόρτας.
  const openFillOptions = useTableFillBadgeKey({
    liveTable, containerRef, transformRef, commit: commitTableModel,
  });

  // 🔴 ADR-739 §69 — η μετάβαση από το πλαίσιο ονόματος, με τον **ίδιο** δεσμευτή
  // προχείρου που τηρεί ήδη το ποντίκι (§26.15). Η σειρά ζει στο module.
  const goToReference = useTableNameBoxGoto({ entity: liveEntity, onCommitPending: commitPendingDraft });

  // §66 — οι γραφείς σκηνής (προεπισκόπηση μοντέλου **και** θέσης, commit θέσης) ζουν σε δικό
  // τους module: ήταν ένα ιδιωτικό `useCallback` όσο ο μόνος καταναλωτής έγραφε μοντέλο.
  const sceneWriters = useTableSceneWriters({ levelManager, execute });

  /**
   * 🔴 ADR-739 §43 + §66 — **ΤΟ ΠΑΤΗΜΑ ΣΤΗ ΓΩΝΙΑ**: μαρκάρει τα πάντα και οπλίζει τη μετακίνηση.
   *
   * 🔴 **§68.9 — ΔΕΝ είναι πια «κυριολεκτικά ο ίδιος χειριστής με το `Ctrl+A`».** Εδώ έγραφε
   * ακριβώς αυτό, και ήταν η διατύπωση του σφάλματος: η γωνία κληρονομούσε τον κανόνα του
   * **πλήκτρου** («επιλέγει, δεν πλοηγεί») ενώ είναι **χειρονομία ποντικιού**. Παραμένει η ίδια
   * *πράξη* — ο ΕΝΑΣ ορισμός του «όλα» — με τη **μία** διαφορά που ζητά το Excel: το ενεργό κελί
   * πάει στο `A1`. Η σύρση που ακολουθεί δεν το αναιρεί: μετακινεί πίνακα ολόκληρο επιλεγμένο.
   */
  const onCornerPress = useEventCallback((event: MouseEvent, container: HTMLElement): void => {
    if (!liveEntity) return;
    // 🔴 §68.9 — **ΟΧΙ** `rangeActions.selectAll()`: εκείνο είναι η **εντολή** (`Ctrl+A`), που
    // επιλέγει χωρίς να πλοηγεί. Το πάτημα είναι **χειρονομία** και ορίζει άγκυρα — το ενεργό
    // κελί πάει στο `A1`, όπως ήδη κάνει ο διπλανός κλάδος των ζωνών (`selectWholeAxis`).
    selectWholeTableFromCorner(liveEntity);
    beginTableMove(event, {
      entity: liveEntity,
      container,
      transformRef,
      preview: sceneWriters.previewPosition,
      commit: sceneWriters.commitPosition,
    });
  });

  useTableCellPointer({
    cursor,
    entity: liveEntity,
    liveTable,
    containerRef,
    transformRef,
    onSelectTo: rangeActions.selectTo,
    onCornerPress,
    onCommitPending: commitPendingDraft,
    onPreviewModel: sceneWriters.previewModel,
    onCommitModel: commitTableModel,
  });

  // ADR-739 §31.10 — «πού είναι αυτό το κελί στην οθόνη;» ζει σε δικό του module από τη
  // στιγμή που αυτό εδώ χτύπησε τις 500 γραμμές (N.7.1). Δέχεται τη **ζωντανή** οντότητα που
  // μόλις διαβάστηκε παραπάνω, για τον ίδιο λόγο με τις ενέργειες περιοχής: μια δεύτερη
  // ανάγνωση σκηνής θα μπορούσε να δει άλλο (ή σβησμένο) πίνακα μέσα στο ίδιο render.
  const { target, anchor } = useTableCellAnchor({ cursor, entity: liveEntity, containerRef });

  // ADR-739 §66 — οι δύο εντολές που χρειάζονται ΜΟΝΟ δρομέα+οντότητα (χωρίς DOM)
  // ζουν στο `use-table-cursor-commands`, κατά το κριτήριο της κεφαλίδας αυτού του αρχείου.
  const { openCursorCellLink, toggleAbsoluteRef } = useTableCursorCommands(liveEntity, cursor);

  const overlay = useMemo<TableCellOverlayMount | null>(() => {
    if (!cursor || !target || !anchor) return null;
    const { entityId, position, mode, sessionId } = cursor;
    return {
      key: `${entityId}:${position.rowId}:${position.colId}:${sessionId}`,
      props: {
        entityId,
        rowId: position.rowId,
        colId: position.colId,
        mode,
        draft: cursor.draft,
        initialText: target.cell.text,
        // 🔴 ADR-753 §28 — η μορφοποίηση ανά χαρακτήρα και η βάση της, **από την ίδια
        // ανάγνωση μοντέλου** με το κείμενο. Δύο αναγνώσεις μέσα στο ίδιο render μπορούν να
        // δουν άλλο (ή σβησμένο) κελί — ο ίδιος λόγος για τον οποίο η `liveEntity` περνά ως
        // όρισμα παραπάνω.
        ...(target.cell.runs !== undefined && { runs: target.cell.runs }),
        cellStyle: target.cell.style,
        // 🔴 ADR-769 Δ7 — **ο στόχος το ξέρει ήδη**: το `resolveTableCellEditTargetById` ρωτά
        // τον ΕΝΑ κριτή (`resolveTableCellWriteRoute`). Ένας δεύτερος έλεγχος εδώ θα ήταν
        // δεύτερη απάντηση στο «γράφεται;» μέσα στην ίδια χειρονομία — και θα μπορούσε να
        // διαφωνήσει με τον φρουρό του `buildTableCellEditCommand`, δίνοντας πεδίο που δέχεται
        // πληκτρολόγηση και commit που τη ρίχνει στο κενό.
        //
        // ⚠️ Κελί **γράψιμης** δεμένης στήλης ανοίγει **κανονικά**: η τιμή πάει στην οντότητα
        // μέσω του `attemptWriteBack` παραπάνω, όχι στο μοντέλο.
        readOnly: target.cell.readOnly,
        caretIndex: cursor.caretIndex,
        // ADR-754 §4 — η **αφορμή** για να ξαναμπεί ο κέρσορας εκεί· δες το store.
        caretRevision: cursor.caretRevision,
        anchor,
        onCommit: commitText,
        onMove: move,
        // ADR-739 Φ.Δ βήμα 8 — το `Delete` αδειάζει ΟΛΗ την περιοχή (μία εντολή, ένα undo).
        // Χωρίς επιλογή, η «περιοχή» είναι το ενεργό κελί — ίδιο αποτέλεσμα με πριν, ένας
        // δρόμος αντί για δύο.
        onClear: rangeActions.clearSelection,
        onHistory: history,
        onExtend: rangeActions.extend,
        onSelectAll: rangeActions.selectAll,
        onToggleAbsoluteRef: toggleAbsoluteRef,
        onCopy: rangeActions.onCopy,
        onCut: rangeActions.onCut,
        onPaste: rangeActions.onPaste,
        onOpenLink: openCursorCellLink,
        // 🔴 ADR-828 Φ4α — δες `openFillOptions` παραπάνω.
        onFillOptions: openFillOptions,
      },
    };
  }, [
    cursor, target, anchor, commitText, move, history, rangeActions, openCursorCellLink,
    toggleAbsoluteRef, openFillOptions,
  ]);

  /**
   * 🔴 ADR-739 Φ.Δ βήμα 4 — **Η ΔΗΛΩΣΗ «ΕΙΜΑΙ ΜΕΣΑ ΣΤΟΝ ΠΙΝΑΚΑ»**.
   *
   * ## Γιατί ΔΕΝ υπάρχει τέταρτη κατάσταση
   * Ο Giorgio ζήτησε ένα «τρίτο, εξωτερικό» επίπεδο πάνω από τα `nav`/`enter`/`edit`. Αυτό
   * **υπάρχει ήδη** και είναι το `cursor !== null`: ο δρομέας γεννιέται όταν μπαίνεις στον
   * πίνακα και πεθαίνει όταν βγαίνεις. Ένα νέο `isInTableMode` θα ήταν δεύτερη αλήθεια για
   * το ίδιο γεγονός — και η πρώτη φορά που θα αποκλίνανε θα ήταν ένα κλειδωμένο πληκτρολόγιο.
   *
   * ## 🔴 Γιατί `overlay !== null` και ΟΧΙ `cursor !== null`
   * Είναι **η γραμμή που αποφασίζει αν ο viewer μπορεί να κλειδώσει για πάντα** (§5.1 του
   * handoff: ξεχασμένο release ⇒ κανένα πλήκτρο καμβά μέχρι reload).
   *
   * Το `overlay` είναι `null` όποτε λείπει **οτιδήποτε** από τα τρία — δρομέας, ζωντανός
   * στόχος στο μοντέλο, αγκύρωση. Δηλαδή είναι ακριβώς η συνθήκη «υπάρχει εστιασμένο
   * `<input>` που κατέχει τα πλήκτρα». Η ταύτιση **δεν είναι ευκολία, είναι το επιχείρημα
   * ορθότητας**: δεν μπορεί να υπάρξει κατάσταση «scope πατημένο αλλά κανείς δεν ακούει»,
   * γιατί η ίδια τιμή οδηγεί και τα δύο. Undo που σβήνει τον πίνακα, διαγραφή γραμμής,
   * αλλαγή επιπέδου, ασύγχρονο ξαναστήσιμο σκηνής ⇒ `target` → `null` ⇒ `overlay` → `null`
   * ⇒ **το scope απελευθερώνεται στο ίδιο commit**, χωρίς να χρειαστεί να το θυμηθεί κανείς.
   *
   * Με `cursor !== null` θα υπήρχε αυτό ακριβώς το παράθυρο: ο δρομέας επιβιώνει μιας
   * αποτυχημένης ανάγνωσης σκηνής (**επίτηδες** — δες το σχόλιο του `draft` στο store, η
   * πληκτρολόγηση χανόταν διαλείπουσα όταν δεν επιβίωνε), ενώ ο επεξεργαστής όχι.
   *
   * ⚠️ ΚΑΙ ΤΟ ΑΝΤΙΣΤΡΟΦΟ: **δεν** «διορθώνουμε» τη διαφορά κλείνοντας τον δρομέα όταν
   * χαθεί ο στόχος. Ένας τέτοιος φύλακας θα σκότωνε τη συνεδρία του χρήστη σε κάθε
   * παροδικά αποτυχημένη ανάγνωση σκηνής — η ίδια ακριβώς παλινδρόμηση που έλυσε το
   * βήμα 3. Ο δρομέας χωρίς επεξεργαστή είναι **αδρανής**: δεν κατέχει πλήκτρα, δεν
   * κρατά scope, και ξαναζωντανεύει σωστά αν η σκηνή επανέλθει.
   *
   * @see src/lib/a11y/keyboard-scope.ts — τι σημαίνει «modal κατέχει το πληκτρολόγιο»
   */
  useModalKeyboardScope(overlay !== null);

  /**
   * 🔴 ADR-739 §29 + §30 + §40 — **ΤΙ ΑΚΟΥΕΙ Ο ΚΑΜΒΑΣ ΑΠΟ ΚΑΤΩ**: το κλείδωμα του ποντικιού
   * και ο hover των λωρίδων δείκτη, μαζί με το ⊕ της εισαγωγής.
   *
   * Μετακόμισαν σε δικό τους module όταν αυτό εδώ ξαναχτύπησε τις 500 γραμμές (N.7.1) —
   * και διαλέχτηκαν επειδή ήταν **αυτό που μεγάλωσε** στο §40, όχι επειδή ήταν το
   * μεγαλύτερο κομμάτι. Ο διαχωρισμός είναι σημασιολογικός: εδώ «ποιο κελί, πού, με τι
   * όψη», εκεί «τι επιτρέπεται στον καμβά από κάτω».
   *
   * ⚠️ §40.9 — **δεν δέχεται πια το `overlay !== null`, και αυτό ήταν διόρθωση ελαττώματος.**
   * Ο καμβάς δεν έχει καμία συνθήκη προσάρτησης: οι ακροατές του ζουν όσο ζει το δοχείο, και
   * την ερώτηση «υπάρχει πίνακας;» τη λύνουν **τη στιγμή του συμβάντος** με getter. Ό,τι
   * υπολογίζεται εδώ πάνω αποτιμάται **ανά απόδοση**, και αυτό το component **δεν αποδίδει σε
   * αλλαγή επιλογής** (ADR-532 B4) — δηλαδή ήταν δομικά ακατάλληλος τόπος για τη συνθήκη.
   */
  useTableModeCanvasWiring({
    entity: liveEntity,
    levelManager,
    getSelectedEntityIds,
    containerRef,
    transformRef,
  });

  // ADR-739 Φ.Δ βήμα 7 — το **δεύτερο** πεδίο της συνεδρίας. Δέχεται τους ΙΔΙΟΥΣ χειριστές:
  // καμία δεύτερη διαδρομή εγγραφής, καμία δεύτερη πλοήγηση, κανένα δεύτερο ιστορικό.
  const formulaBar = useTableFormulaBarMount({
    entity: liveEntity,
    cursor,
    initialText: target?.cell.text ?? '',
    containerRef,
    // 🔴 §69 — το πλαίσιο ονόματος ως **πόρτα**: `B7` + `Enter` μετακινεί τον δρομέα.
    onGoTo: goToReference,
    onCommit: commitText,
    onMove: move,
    onClear: rangeActions.clearSelection,
    onHistory: history,
    onExtend: rangeActions.extend,
    onSelectAll: rangeActions.selectAll,
    onToggleAbsoluteRef: toggleAbsoluteRef,
  });

  // 🔴 ADR-763 Φ2.4.1 — «δέσμευσε και βγες», ζητημένο από καλούντα **εκτός React** (το «OK»
  // του διαλόγου ορισμάτων). Ο δεσμευτής είναι ο **ΙΔΙΟΣ** με του `Enter` — καμία δεύτερη
  // διαδρομή εγγραφής κελιού. Δες `use-table-cell-commit-request`.
  useTableCellCommitRequest(cursor, commitText);

  return useMemo(
    () => ({ overlay, formulaBar, handleDoubleClick }),
    [overlay, formulaBar, handleDoubleClick],
  );
}
