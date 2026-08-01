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
import { editorGrowthCeilingPx } from './table-cell-editor-expansion';
import {
  cellCaretIndexAtPx,
  cellFontBandPx,
  cellTextWidthPx,
} from './table-cell-text-metrics';
import { tableCellEditorCssVars } from './table-cell-editor-vars';
import {
  useTableFormulaBarMount,
  type TableFormulaBarMount,
} from './use-table-formula-bar-mount';
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
  expansion?: { readonly draft: string; readonly anchor: { x: number; y: number } | null },
): TableCellEditorFrame {
  const pxPerMm = tablePxPerMm(tableMmToWorldLive(), getImmediateTransform().scale);
  return computeTableCellEditorFrame({
    target,
    pxPerMm,
    angleRad,
    resolveBand: cellFontBandPx,
    backgroundHex,
    draft: expansion?.draft,
    resolveWidth: expansion ? cellTextWidthPx : undefined,
    maxWidthPx: expansion
      ? editorGrowthCeilingPx({
          anchor: expansion.anchor,
          rotationRad: -angleRad,
          cellWidthPx: target.rectMm.w * pxPerMm,
          growsFrom: target.hAlign === 'right' || target.hAlign === 'center' ? target.hAlign : 'left',
          viewport: { width: window.innerWidth, height: window.innerHeight },
        })
      : undefined,
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

  // Το κελί του δρομέα, διαβασμένο από το ΖΩΝΤΑΝΟ μοντέλο: κείμενο, όψη και αγκύρωση είναι
  // **παράγωγα**, ποτέ αντίγραφα (γι' αυτό το store δεν κρατά κείμενο).
  //
  // Η γωνία ταξιδεύει μαζί επειδή ανήκει στην **οντότητα**, όχι στο κελί, και ο επεξεργαστής
  // πρέπει να γείρει μαζί με τον πίνακα. Διαβασμένη από την **ίδια** αναφορά οντότητας —
  // μια δεύτερη ανάγνωση σκηνής θα μπορούσε να δει άλλο (ή σβησμένο) πίνακα.
  const target = useMemo(() => {
    if (!cursor || !liveEntity) return null;
    const cell = resolveTableCellEditTargetById(liveEntity, cursor.position.rowId, cursor.position.colId);
    return cell ? { cell, angleRad: liveEntity.angleRad } : null;
  }, [cursor, liveEntity]);

  // Σταθερή ταυτότητα ανά κελί: το `TextEditorAnchorLayer` ξαναδένει τη συνδρομή του σε
  // κάθε νέο `anchor`, οπότε ένα φρέσκο αντικείμενο ανά απόδοση θα ξέδενε/ξανάδενε τον
  // scheduler σε κάθε πάτημα πλήκτρου.
  //
  // 🔴 ADR-739 Φ.Δ βήμα 3 — ΕΔΩ ζούσαν δύο σταθερές, `140 × 24 px`. Ήταν αυτές που έκαναν
  // τον επεξεργαστή «μαύρο κουτάκι πάνω-αριστερά μέσα στο κελί» (Giorgio, 2026-08-01):
  // ένα ξένο κουτί σε px οθόνης, που δεν κληρονομούσε ούτε μέγεθος, ούτε γραμματοσειρά,
  // ούτε στοίχιση, ούτε χρώμα, ούτε την περιστροφή του πίνακα. Τη θέση τους παίρνει ένα
  // **ζωντανό** κουτί, παράγωγο της ίδιας διάταξης που ζωγραφίζει ο καμβάς.
  //
  // 🔴 ADR-739 Φ.Δ βήμα 6 — το `draft` μπαίνει στις εξαρτήσεις **επίτηδες**: το κουτί
  // μεγαλώνει με το κείμενο, άρα αλλάζει σε κάθε πάτημα πλήκτρου. Ο `cursor` ήδη άλλαζε ανά
  // πάτημα (το πρόχειρο ζει μέσα του), οπότε αυτό **δεν** προσθέτει καμία νέα απόδοση — απλώς
  // κάνει ρητό ότι το κουτί εξαρτάται από αυτό.
  //
  // Σε **πλοήγηση** δεν περνά πρόχειρο: εκεί ο επεξεργαστής είναι διαφανής και το κουτί
  // πρέπει να είναι ακριβώς το κελί (τον δρομέα τον ζωγραφίζει ο καμβάς πάνω σε αυτό).
  const draft = cursor && cursor.mode !== 'nav' ? cursor.draft : undefined;

  const anchor = useMemo(() => {
    if (!target) return null;
    const { cell, angleRad } = target;
    // Το φόντο διαβάζεται ΜΙΑ φορά ανά συνεδρία — δες το σχόλιο του `cellEditorFrame`.
    const backgroundHex = resolveDxfCanvasBackgroundHex();
    const projectBox = (point: { x: number; y: number } | null): TextEditorAnchorBox => {
      const frame = cellEditorFrame(
        cell,
        angleRad,
        backgroundHex,
        draft === undefined ? undefined : { draft, anchor: point },
      );
      return {
        widthPx: frame.widthPx,
        heightPx: frame.heightPx,
        rotationRad: frame.rotationRad,
        offsetXPx: frame.offsetXPx,
        cssVars: tableCellEditorCssVars(frame),
      };
    };
    const initial = projectBox(null);
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
  }, [target, containerRef, draft]);

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
        onHistory: history,
      },
    };
  }, [cursor, target, anchor, commitText, move, clear, history]);

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

  // ADR-739 Φ.Δ βήμα 7 — το **δεύτερο** πεδίο της συνεδρίας. Δέχεται τους ΙΔΙΟΥΣ χειριστές:
  // καμία δεύτερη διαδρομή εγγραφής, καμία δεύτερη πλοήγηση, κανένα δεύτερο ιστορικό.
  const formulaBar = useTableFormulaBarMount({
    entity: liveEntity,
    cursor,
    initialText: target?.cell.text ?? '',
    containerRef,
    onCommit: commitText,
    onMove: move,
    onClear: clear,
    onHistory: history,
  });

  return useMemo(
    () => ({ overlay, formulaBar, handleDoubleClick }),
    [overlay, formulaBar, handleDoubleClick],
  );
}
