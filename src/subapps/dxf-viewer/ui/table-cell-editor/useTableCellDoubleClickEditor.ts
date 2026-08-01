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
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { useCommandHistory } from '../../core/commands';
import { isTableEntity } from '../../types/table-entity';
import type { TableEntity } from '../../types/table-entity';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import {
  buildTableCellEditCommand,
  resolveTableCellEditTarget,
  resolveTableCellEditTargetById,
  type TableCellEditTarget,
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
import { createTextEditorAnchor2D } from '../text-toolbar/text-editor-anchor-2d';
import type { TextEditorAnchorBox } from '../text-toolbar/TextEditorAnchorLayer';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { resolveDxfCanvasBackgroundHex } from '../../config/color-config';
import { tableMmToWorldLive, tablePxPerMm } from '../../bim/table/table-entity-geometry';
import {
  computeTableCellEditorFrame,
  cellTextStartPx,
  type TableCellEditorFrame,
} from './table-cell-editor-frame';
import {
  cellCaretIndexAtPx,
  cellFontBandPx,
  cellTextWidthPx,
} from './table-cell-text-metrics';
import { tableCellEditorCssVars } from './table-cell-editor-vars';
import type { TableCellEditorOverlayProps } from './TableCellEditorOverlay';
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
  readonly handleDoubleClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

/** Η επιλεγμένη οντότητα, αν είναι ΑΚΡΙΒΩΣ μία και είναι πίνακας — αλλιώς `null`. */
function resolveSelectedTable(
  levelManager: LevelManagerLike,
  getSelectedEntityIds: () => readonly string[],
): TableEntity | null {
  const ids = getSelectedEntityIds();
  if (ids.length !== 1) return null;
  return resolveTableById(levelManager, ids[0]);
}

/** Η οντότητα πίνακα με αυτό το id, διαβασμένη **τη στιγμή της κλήσης** (ποτέ στιγμιότυπο). */
function resolveTableById(levelManager: LevelManagerLike, entityId: string): TableEntity | null {
  const levelId = levelManager.currentLevelId;
  const scene = levelId ? levelManager.getLevelScene(levelId) : null;
  const entity = scene?.entities.find((e) => e.id === entityId);
  return entity && isTableEntity(entity) ? entity : null;
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

/**
 * ADR-739 Φ.Δ βήμα 3 — το κουτί του κελιού σε px οθόνης, **τη στιγμή της κλήσης**.
 *
 * Κάθε είσοδος διαβάζεται ζωντανά: η κλίμακα σχεδίασης από το SSoT της (`tableMmToWorldLive`)
 * και το zoom από το `ImmediateTransformStore` — ADR-040 «event-time read μέσω getter, ποτέ
 * στιγμιότυπο». Γι' αυτό ο επεξεργαστής **ζουμάρει μαζί** με τον καμβά αντί να καρφώνεται
 * στο μέγεθος που είχε το κελί όταν έγινε το διπλό κλικ.
 *
 * Το `backgroundHex` έρχεται απ' έξω και **δεν** διαβάζεται εδώ: είναι `getComputedStyle`
 * στο `documentElement`, δηλαδή αναγκαστικό style recalc — σε κάθε καρέ zoom θα ήταν
 * μετρήσιμο κόστος για μια τιμή που αλλάζει μόνο σε αλλαγή θέματος.
 */
function cellEditorFrame(
  target: TableCellEditTarget,
  angleRad: number,
  backgroundHex: string,
): TableCellEditorFrame {
  return computeTableCellEditorFrame({
    target,
    pxPerMm: tablePxPerMm(tableMmToWorldLive(), getImmediateTransform().scale),
    angleRad,
    resolveBand: cellFontBandPx,
    backgroundHex,
  });
}

/**
 * Σε ποιον χαρακτήρα πέφτει το διπλό κλικ (Excel: ο κέρσορας μπαίνει **εκεί που έδειξες**).
 *
 * `undefined` όταν δεν υπάρχει σημείο κλικ — τότε ο επεξεργαστής βάζει τον κέρσορα στο
 * τέλος, που είναι η σωστή συμπεριφορά για `Tab` / `F2`.
 */
function caretIndexOfClick(target: TableCellEditTarget, frame: TableCellEditorFrame): number | undefined {
  if (target.clickOffsetMm === undefined || !target.text) return undefined;
  const pxPerMm = frame.widthPx / target.rectMm.w;
  const startPx = cellTextStartPx(frame, cellTextWidthPx(target.text, frame.font));
  return cellCaretIndexAtPx(target.text, frame.font, target.clickOffsetMm * pxPerMm - startPx);
}

export function useTableCellDoubleClickEditor(
  params: UseTableCellDoubleClickEditorParams,
): TableCellDoubleClickEditorApi {
  const { transformRef, containerRef, getSelectedEntityIds, levelManager } = params;
  const { execute } = useCommandHistory();
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
      const frame = cellEditorFrame(target, entity.angleRad, resolveDxfCanvasBackgroundHex());
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

  const clear = useCallback(() => commitText(''), [commitText]);

  // Το κελί του δρομέα, διαβασμένο από το ΖΩΝΤΑΝΟ μοντέλο σε κάθε απόδοση: κείμενο, όψη και
  // αγκύρωση είναι **παράγωγα**, ποτέ αντίγραφα (γι' αυτό το store δεν κρατά κείμενο).
  //
  // Η γωνία ταξιδεύει μαζί επειδή ανήκει στην **οντότητα**, όχι στο κελί, και ο επεξεργαστής
  // πρέπει να γείρει μαζί με τον πίνακα. Διαβασμένη εδώ, από την ίδια ανάγνωση σκηνής —
  // μια δεύτερη ανάγνωση θα μπορούσε να δει άλλο (ή σβησμένο) πίνακα.
  const target = useMemo(() => {
    if (!cursor) return null;
    const entity = resolveTableById(levelManager, cursor.entityId);
    if (!entity) return null;
    const cell = resolveTableCellEditTargetById(entity, cursor.position.rowId, cursor.position.colId);
    return cell ? { cell, angleRad: entity.angleRad } : null;
  }, [cursor, levelManager]);

  // Σταθερή ταυτότητα ανά κελί: το `TextEditorAnchorLayer` ξαναδένει τη συνδρομή του σε
  // κάθε νέο `anchor`, οπότε ένα φρέσκο αντικείμενο ανά απόδοση θα ξέδενε/ξανάδενε τον
  // scheduler σε κάθε πάτημα πλήκτρου.
  //
  // 🔴 ADR-739 Φ.Δ βήμα 3 — ΕΔΩ ζούσαν δύο σταθερές, `140 × 24 px`. Ήταν αυτές που έκαναν
  // τον επεξεργαστή «μαύρο κουτάκι πάνω-αριστερά μέσα στο κελί» (Giorgio, 2026-08-01):
  // ένα ξένο κουτί σε px οθόνης, που δεν κληρονομούσε ούτε μέγεθος, ούτε γραμματοσειρά,
  // ούτε στοίχιση, ούτε χρώμα, ούτε την περιστροφή του πίνακα. Τη θέση τους παίρνει ένα
  // **ζωντανό** κουτί, παράγωγο της ίδιας διάταξης που ζωγραφίζει ο καμβάς.
  const anchor = useMemo(() => {
    if (!target) return null;
    const { cell, angleRad } = target;
    // Το φόντο διαβάζεται ΜΙΑ φορά ανά συνεδρία — δες το σχόλιο του `cellEditorFrame`.
    const backgroundHex = resolveDxfCanvasBackgroundHex();
    const projectBox = (): TextEditorAnchorBox => {
      const frame = cellEditorFrame(cell, angleRad, backgroundHex);
      return {
        widthPx: frame.widthPx,
        heightPx: frame.heightPx,
        rotationRad: frame.rotationRad,
        cssVars: tableCellEditorCssVars(frame),
      };
    };
    const initial = projectBox();
    return {
      ...createTextEditorAnchor2D({
        worldPoint: cell.anchorWorldPoint,
        getContainer: () => containerRef.current,
        // Το στατικό μέγεθος μένει ως έσχατο δίχτυ του clamping· το ζωντανό κουτί το
        // αντικαθιστά σε κάθε tick.
        size: { width: initial.widthPx, height: initial.heightPx },
      }),
      projectBox,
    };
  }, [target, containerRef]);

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
        onClear: clear,
      },
    };
  }, [cursor, target, anchor, commitText, move, clear]);

  return useMemo(() => ({ overlay, handleDoubleClick }), [overlay, handleDoubleClick]);
}
