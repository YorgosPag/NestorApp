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
// ADR-711 — το SSoT του «ποιος κατέχει το πληκτρολόγιο». ΜΗΝ γράψεις δεύτερο scope.
import { useModalKeyboardScope } from '@/lib/a11y/use-modal-keyboard-scope';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { useCommandHistory } from '../../core/commands';
import { resolveSelectedTable, resolveTableById } from './table-entity-lookup';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import {
  buildTableCellEditCommand,
  resolveTableCellEditTarget,
} from '../../bim/table/table-cell-edit-session';
import {
  moveTableCursor,
  tableCursorAt,
  type TableCursorMove,
} from '../../bim/table/table-cell-navigation';
import {
  closeTableCellCursor,
  setTableCellCursor,
  useTableCellCursor,
} from '../../state/table-cell-cursor-store';
import { resolveDxfCanvasBackgroundHex } from '../../config/color-config';
// ADR-739 §26.15 — το **ζωντανό** κουτί του κελιού μετακόμισε σε δικό του module όταν αυτό
// εδώ χτύπησε τις 500 γραμμές (N.7.1). Εξαγωγή, όχι κόψιμο: οι δύο συναρτήσεις δεν
// χρειάζονται τίποτα από το hook.
import { caretIndexOfClick, cellEditorFrameLive } from './table-cell-editor-frame-live';
// ADR-739 §31.10 — η **αλυσίδα προς την οθόνη** (κελί ⇒ κουτί ⇒ άγκυρο), εξαχθείσα για τον
// ίδιο λόγο: αυτό το αρχείο ξαναχτύπησε τις 500 γραμμές.
import { useTableCellAnchor } from './use-table-cell-anchor';
import {
  useTableFormulaBarMount,
  type TableFormulaBarMount,
} from './use-table-formula-bar-mount';
import type { TableCellEditorOverlayProps } from './TableCellEditorOverlay';
// ADR-739 Φ.Δ βήμα 8 — οι ενέργειες περιοχής ζουν σε δικό τους module: αυτό το αρχείο
// είναι ήδη στα όρια των 500 γραμμών (N.7.1), και ο διαχωρισμός είναι σημασιολογικός —
// εδώ «ποιο κελί, πού, με τι όψη», εκεί «ποια κελιά και τι τους κάνω».
import { useTableRangeActions } from './use-table-range-actions';
// ADR-739 Φ.Δ βήμα 8 — απλό κλικ μετακινεί το ενεργό κελί, `Shift+κλικ` απλώνει την
// περιοχή. **Παθητικός** ακροατής: δεν καταναλώνει το συμβάν, δεν αγγίζει τον καμβά.
import { useTableCellPointer } from './use-table-cell-pointer';
// ADR-739 §29 — το δίδυμο του modal keyboard scope για το ποντίκι: όσο ζει η λειτουργία
// πίνακα, ο καμβάς δεν επιλέγει, δεν σέρνει και δεν κάνει hover σε οντότητες.
import { useTableCanvasLockdown } from './use-table-canvas-lockdown';
// ADR-739 §30 — ο hover των λωρίδων δείκτη (Excel). Παθητικός ακροατής `mousemove`, ο μόνος
// που το κλείδωμα του §29 αφήνει να περάσει (το pan ζει πάνω του).
import { useTableIndicatorHover } from './use-table-indicator-hover';
// ADR-739 §31.9 — ο ΕΝΑΣ δεσμευτής «οντότητα + νέο μοντέλο ⇒ μία εντολή», κοινός με το μενού
// ζωνών· η σύρση πλάτους τον καλεί **μία** φορά, στο `mouseup`.
import { useTableModelCommit } from './use-table-model-commit';
import type { TableEntity } from '../../types/table-entity';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';

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

/** Το σημείο κόσμου ενός mouse event, με την ίδια margin-aware αντιστροφή του renderer. */
function eventWorldPoint(
  event: React.MouseEvent<HTMLDivElement>,
  container: HTMLDivElement,
  transform: ViewTransform,
): Point2D {
  const containerRect = container.getBoundingClientRect();
  const viewport: Viewport = { width: containerRect.width, height: containerRect.height };
  return CoordinateTransforms.screenToWorld(
    { x: event.clientX - containerRect.left, y: event.clientY - containerRect.top },
    transform,
    viewport,
  );
}

export function useTableCellDoubleClickEditor(
  params: UseTableCellDoubleClickEditorParams,
): TableCellDoubleClickEditorApi {
  const { transformRef, containerRef, getSelectedEntityIds, levelManager } = params;
  const { execute, undo, redo } = useCommandHistory();
  const cursor = useTableCellCursor();

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const entity = resolveSelectedTable(levelManager, getSelectedEntityIds);
      const container = containerRef.current;
      const transform = transformRef.current;
      if (!entity || !container || !transform) return;

      const target = resolveTableCellEditTarget(entity, eventWorldPoint(event, container, transform));
      if (!target) return;
      // Διπλό κλικ = «θέλω να διορθώσω ΑΥΤΟ το κελί» ⇒ κατάσταση `edit`, όχι `enter`. Και
      // **νέα** στήλη αγκύρωσης: το κλικ ξεκινά νέα σειρά καταχώρισης, άρα το επόμενο Enter
      // επιστρέφει ΕΔΩ.
      // Το πρόχειρο ξεκινά από το **δεσμευμένο** κείμενο του κελιού: μπήκες με διπλό κλικ
      // για να διορθώσεις, όχι για να ξαναγράψεις από την αρχή (η `enter` κάνει εκείνο).
      // Ο κέρσορας πάει στο γράμμα που έδειξες (Excel) — το κουτί υπολογίζεται εδώ γιατί
      // μόνο **τώρα** υπάρχει σημείο κλικ.
      const frame = cellEditorFrameLive(target, entity.angleRad, resolveDxfCanvasBackgroundHex());
      setTableCellCursor(
        entity.id,
        tableCursorAt(target.rowId, target.colId),
        'edit',
        target.text,
        caretIndexOfClick(target, frame),
      );
    },
    [levelManager, getSelectedEntityIds, containerRef, transformRef],
  );

  /**
   * Γράφει κείμενο στο τρέχον κελί ως **ένα** αναιρέσιμο `UpdateEntityCommand`.
   *
   * Ο πίνακας ξαναδιαβάζεται ΤΗ ΣΤΙΓΜΗ του commit (όχι η αναφορά του ανοίγματος), ώστε
   * δύο διαδοχικές επεξεργασίες — που πλέον είναι ο **κανόνας**, αφού το Tab γράφει
   * κελί-κελί — να μη γράφουν πάνω σε μπαγιάτικο μοντέλο.
   */
  const commitText = useCallback(
    (nextText: string) => {
      if (!cursor) return;
      const { currentLevelId, getLevelScene, setLevelScene } = levelManager;
      const entity = resolveTableById(levelManager, cursor.entityId);
      if (!entity || !currentLevelId || !setLevelScene) return;
      const sceneManager = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId);
      const command = buildTableCellEditCommand(
        entity,
        cursor.position.rowId,
        cursor.position.colId,
        nextText,
        sceneManager,
      );
      if (command) execute(command);
    },
    [cursor, levelManager, execute],
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
   * ξέρει τη διαφορά — δες την κεφαλίδα του `table-column-resize-drag`.
   */
  const commitTableModel = useTableModelCommit({ levelManager, execute });

  const previewTableModel = useCallback(
    (entity: TableEntity, model: TableEntity['model']): void => {
      const { currentLevelId, getLevelScene, setLevelScene } = levelManager;
      if (!currentLevelId || !setLevelScene) return;
      const scene = getLevelScene(currentLevelId);
      if (!scene) return;
      // Νέο αντικείμενο οντότητας ⇒ οι απομνημονεύσεις της διάταξης ακυρώνονται από μόνες
      // τους (η ταυτότητα ΕΙΝΑΙ η έκδοση, δες `resizeTableColumnLeftOfEdge`).
      setLevelScene(currentLevelId, {
        ...scene,
        entities: scene.entities.map((e) => (e.id === entity.id ? { ...entity, model } : e)),
      });
    },
    [levelManager],
  );

  useTableCellPointer({
    cursor,
    entity: liveEntity,
    containerRef,
    transformRef,
    onSelectTo: rangeActions.selectTo,
    onCommitPending: commitPendingDraft,
    onPreviewModel: previewTableModel,
    onCommitModel: commitTableModel,
  });

  // ADR-739 §31.10 — «πού είναι αυτό το κελί στην οθόνη;» ζει σε δικό του module από τη
  // στιγμή που αυτό εδώ χτύπησε τις 500 γραμμές (N.7.1). Δέχεται τη **ζωντανή** οντότητα που
  // μόλις διαβάστηκε παραπάνω, για τον ίδιο λόγο με τις ενέργειες περιοχής: μια δεύτερη
  // ανάγνωση σκηνής θα μπορούσε να δει άλλο (ή σβησμένο) πίνακα μέσα στο ίδιο render.
  const { target, anchor } = useTableCellAnchor({ cursor, entity: liveEntity, containerRef });

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
        caretIndex: cursor.caretIndex,
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
        onCopy: rangeActions.onCopy,
        onCut: rangeActions.onCut,
        onPaste: rangeActions.onPaste,
      },
    };
  }, [cursor, target, anchor, commitText, move, history, rangeActions]);

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
   * 🔴 ADR-739 §29 — **το δίδυμο του παραπάνω, για το ΠΟΝΤΙΚΙ.**
   *
   * Ο ιδιοκτήτης (2026-08-02): «όταν μπαίνω σε edit mode στους πίνακες, να μην μπορώ να
   * κάνω κλικ έξω από τους πίνακες μέσα στον καμβά για να επιλέξω και να τροποποιήσω
   * οντότητες, αν πρώτα δεν βγω με κάποιον τρόπο από το edit». Μέχρι εδώ ο καμβάς
   * εξακολουθούσε να κάνει hover, να επιλέγει στο κλικ, και να **σκοτώνει τη συνεδρία** με
   * την ίδια κίνηση.
   *
   * 🔴 **§29.15 — ΑΛΛΗ ΣΥΝΘΗΚΗ ΑΠΟ ΤΟ ΠΛΗΚΤΡΟΛΟΓΙΟ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ.**
   *
   * Μέχρι τις 03/08 περνιόταν εδώ το **ίδιο** `overlay !== null` του σχολίου από πάνω, με
   * το επιχείρημα «μία τιμή οδηγεί και τα δύο». Μετρήθηκε ζωντανά ότι η τιμή είναι λάθος
   * για το ποντίκι: κλικ στη λωρίδα μιας στήλης που καλύπτεται από τον **συγχωνευμένο
   * τίτλο** βάζει τον δρομέα σε κελί **χωρίς δικό του ορθογώνιο** ⇒ `overlay` → `null` ⇒ ο
   * καμβάς ξεκλείδωνε **μέσα στο ίδιο `mousedown`** και το `mouseup` γεννούσε πλαίσιο
   * επιλογής, ενώ ο χρήστης έβλεπε ολοκάθαρα ότι είναι μέσα στον πίνακα.
   *
   * Το πληκτρολόγιο ρωτά «υπάρχει πεδίο που κατέχει τα πλήκτρα;» — και σωστά κρατά το
   * `overlay`. Το ποντίκι ρωτά «είναι ο χρήστης μέσα στη λειτουργία;» — και η απάντηση
   * είναι ο **ζωντανός πίνακας**. Το hook πλέον τη διαβάζει **μόνο** του από το `entity`:
   * δεν υπάρχει `active` να δοθεί λάθος. Πλήρες σκεπτίκο στην κεφαλίδα του module.
   */
  useTableCanvasLockdown({ entity: liveEntity, containerRef, transformRef });

  /**
   * 🔴 ADR-739 §30 — **η τρίτη χρήση της ίδιας τιμής**: ο hover των λωρίδων `A B C` / `1 2 3`.
   *
   * Ο ιδιοκτήτης (2026-08-03): «όταν ο κέρσορας κάνει hover πάνω από τις λωρίδες… θέλω να
   * φωτίζονται τα **ξεχωριστά κομμάτια** της λωρίδας, όπως ακριβώς στο Excel».
   *
   * 🔑 Ίδιο `overlay !== null` — και δεν είναι συμμετρία για την ομορφιά: ο δείκτης
   * **ζωγραφίζεται** μόνο όσο υπάρχει δρομέας, οπότε hover εκτός αυτής της συνθήκης θα ήταν
   * κατάσταση που κανείς δεν αποδίδει. Τρεις μηχανισμοί (πληκτρολόγιο, ποντίκι, hover), μία
   * τιμή, καμία δυνατότητα να μείνει ένας από τους τρεις ανοιχτός.
   */
  useTableIndicatorHover({
    active: overlay !== null,
    entity: liveEntity,
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
    onCommit: commitText,
    onMove: move,
    onClear: rangeActions.clearSelection,
    onHistory: history,
    onExtend: rangeActions.extend,
    onSelectAll: rangeActions.selectAll,
  });

  return useMemo(
    () => ({ overlay, formulaBar, handleDoubleClick }),
    [overlay, formulaBar, handleDoubleClick],
  );
}
