'use client';

/**
 * 🔴 ADR-739 §52 — **ο εκδότης της θύρας μορφοποίησης πίνακα**.
 *
 * Συνθέτει ό,τι ήδη υπάρχει (στόχος → εντολές → περιγράμματα → συγχώνευση → δομή) σε **μία**
 * επιφάνεια και τη δημοσιεύει, ώστε η κορδέλα — που ζει σε άλλο κλαδί του δέντρου — να μη
 * χρειαστεί ούτε props ούτε δεύτερη υλοποίηση. Δες την κεφαλίδα του `table-format-port.ts`
 * για το γιατί θύρα και όχι props.
 *
 * ## 🔴 Ο ΠΑΛΜΟΣ: ΔΥΟ ΣΗΜΑΤΑ, ΚΑΝΕΝΑ ΑΝΑ ΧΑΡΑΚΤΗΡΑ
 * Οι καταναλωτές της θύρας **διαβάζουν σε render**, άρα κάποιος πρέπει να τους πει «ξαναρώτα».
 * Τα δύο —και μόνο δύο— πράγματα που αλλάζουν την απάντηση:
 *
 * ```
 *   1. ο ΣΤΟΧΟΣ      →  entityId | θέση | επιλογή | mode        (συνδρομή στο store του δρομέα)
 *   2. το ΜΟΝΤΕΛΟ    →  ταυτότητα του `live.model`              (effect χωρίς deps, με φύλακα)
 * ```
 *
 * ⚠️ **Το `draft` λείπει από την υπογραφή επίτηδες** — και είναι ολόκληρη η διαφορά ανάμεσα σε
 * «δουλεύει» και «lag πληκτρολόγησης». Ο δρομέας γράφεται σε **κάθε πλήκτρο**· μια συνδρομή
 * που ειδοποιούσε σε κάθε εγγραφή θα ξανα-απέδιδε την κορδέλα ανά χαρακτήρα, δηλαδή ακριβώς η
 * παλινδρόμηση που έκλεισαν τα ADR-040 / 532 / 547. Το πρόχειρο **δεν** αλλάζει τίποτα στη
 * μορφοποίηση: τα έντονα ενός κελιού δεν εξαρτώνται από το τι πληκτρολογείται μέσα του.
 *
 * ## 🔴 Γιατί το δεύτερο σήμα είναι effect ΧΩΡΙΣ deps — και γιατί δεν κάνει βρόχο
 * Το `Ctrl+Z` δεν αγγίζει τον δρομέα: αλλάζει **μόνο** το μοντέλο. Δεν υπάρχει store να
 * ακούσουμε (η σκηνή ζει στον `levelManager`), αλλά ο ξενιστής αυτού του hook — ο
 * `CanvasSection` — ξανα-αποδίδει σε κάθε αλλαγή σκηνής, που είναι **χαμηλής συχνότητας** εξ
 * ορισμού (ADR-040 Φάση XXII.A: μηδέν συνδρομές υψηλής συχνότητας εκεί).
 *
 * Ο φύλακας ταυτότητας είναι που κάνει τον βρόχο **αδύνατο**: ο παλμός φεύγει μόνο όταν το
 * `model` είναι **άλλο αντικείμενο** από την προηγούμενη φορά. Ο παλμός προκαλεί re-render της
 * κορδέλας → ίσως και του ξενιστή → το effect ξανατρέχει → **ίδια ταυτότητα** → σιωπή. Ένα
 * σκέτο `notify()` χωρίς φύλακα θα ήταν άπειρος βρόχος, όχι απλώς σπατάλη.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-format-actions
 * @see ui/table-cell-editor/table-format-port.ts — το συμβόλαιο
 * @see hooks/canvas/useCanvasSectionUI.ts — ο ξενιστής (δίπλα στις άλλες δύο θύρες πίνακα)
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { resolveTableStyle } from '../../bim/table/table-entity-geometry';
import {
  canResetTableFormatScope,
  resolveTableFormatState,
  tableFormatNumericRange,
  tableFormatScopeBounds,
  tableFormatScopeOf,
  type TableFormatScope,
} from '../../bim/table/table-format-scope';
import { getAllLayers } from '../../stores/LayerStore';
import { tableFormatCommands } from './table-format-commands';
import {
  resolveTableFormatSnapshot,
  resolveTableNumberFormatState,
} from './table-format-snapshot';
import { useLiveTable } from './use-live-table';
// 🔴 ADR-739 §56 — η κορδέλα χρειάζεται τη λίστα γραμματοσειρών, και τη χρειάζεται με **getter**.
// Το ίδιο hook που ήδη τροφοδοτεί τα δύο μενού δεξιού κλικ — τρίτος καταναλωτής, μία γνώση.
import { useToolbarFontNames } from './use-toolbar-font-names';
import { resolveSelectedTable } from './table-entity-lookup';
import { useTableBorderActions } from './use-table-border-actions';
import { useTableMergeActions } from './use-table-merge-actions';
import { useTableStructureActions } from './use-table-structure-actions';
import { useTableBindingActions } from './use-table-binding-actions';
// 🔴 ADR-768 Βήμα 5 — το πινέλο μορφοποίησης: **δύο** πράξεις («ρούφα», «σβήσε») + το `Esc` του.
import { useTableFormatPainterActions } from './use-table-format-painter-actions';
// 🔴 ADR-739 §57 — το πρόχειρο. **Το ίδιο** hook που τροφοδοτεί το μενού δεξιού κλικ (§54):
// τρίτος καταναλωτής, μία υλοποίηση — δες το σχόλιο του μέλους στη θύρα.
import { useTableMenuClipboard } from './use-table-menu-clipboard';
import { useLiveTableMutation } from './use-table-model-commit';
import {
  getTableCellCursor,
  subscribeTableCellCursor,
} from '../../state/table-cell-cursor-store';
import { useCommandHistory } from '../../core/commands';
import {
  getTableFormatPort,
  notifyTableFormatPort,
  setTableFormatPort,
  type TableFormatPort,
} from './table-format-port';
import type { PersistedTableModel } from '../../types/table';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';

export interface UseTableFormatActionsParams {
  readonly levelManager: LevelManagerLike;
  readonly getSelectedEntityIds: () => readonly string[];
}

/**
 * 🔴 Η υπογραφή του **στόχου** — ό,τι αλλάζει τι δείχνουν τα χειριστήρια, και τίποτα άλλο.
 *
 * Ζει ως συνάρτηση και όχι inline ώστε η **απουσία** του `draft` να είναι ορατή σε ένα σημείο
 * και να ελέγχεται από test: μια μελλοντική προσθήκη πεδίου εδώ είναι συνειδητή απόφαση, ενώ
 * ένα `JSON.stringify(cursor)` θα ήταν σιωπηλή εγγραφή σε κάθε πλήκτρο.
 */
function cursorFormatSignature(): string {
  const cursor = getTableCellCursor();
  if (!cursor) return '∅';
  const { entityId, position, selection, mode } = cursor;
  const span = selection
    ? `${selection.kind}:${selection.from.rowId}/${selection.from.colId}→${selection.to.rowId}/${selection.to.colId}`
    : '∅';
  return `${entityId}|${position.rowId}|${position.colId}|${span}|${mode}`;
}

export function useTableFormatActions(params: UseTableFormatActionsParams): void {
  const { levelManager, getSelectedEntityIds } = params;
  const { execute } = useCommandHistory();

  /** Ο πίνακας του **δρομέα**· `null` χωρίς δρομέα ή σβησμένη οντότητα. */
  const cursorTable = useLiveTable(levelManager);

  /**
   * Ο πίνακας που αφορούν οι εντολές: δρομέας πρώτα, αλλιώς η **μοναδική** επιλεγμένη
   * οντότητα. Η σειρά είναι του Excel — μόλις μπεις σε κελί, οι εντολές αφορούν αυτόν τον
   * πίνακα ό,τι κι αν λέει η επιλογή οντοτήτων.
   */
  const table = useCallback(
    () => cursorTable() ?? resolveSelectedTable(levelManager, getSelectedEntityIds),
    [cursorTable, levelManager, getSelectedEntityIds],
  );

  const scope = useCallback((): TableFormatScope | null => {
    const cursor = getTableCellCursor();
    const live = cursorTable();
    if (!cursor || !live) return null;
    return tableFormatScopeOf(live.model, cursor.position, cursor.selection);
  }, [cursorTable]);

  /**
   * Ο στόχος ως **ορθογώνιο** — ό,τι δέχονται περιγράμματα, συγχώνευση και το πινέλο.
   *
   * Ζει ως `useCallback` και όχι inline μέσα στο `answers` επειδή έχει πλέον **δεύτερο**
   * καταναλωτή: το {@link useTableFormatPainterActions} το χρειάζεται ως εξάρτηση, και μια νέα
   * ταυτότητα ανά render θα ξανάφτιαχνε το `arm` σε κάθε απόδοση — δηλαδή θα ακύρωνε το `useMemo`
   * της θύρας του πινέλου χωρίς κανένα όφελος.
   */
  const bounds = useCallback(
    (): ReturnType<TableFormatPort['bounds']> => {
      const live = table();
      const current = scope();
      return live && current ? tableFormatScopeBounds(live.model, current) : null;
    },
    [table, scope],
  );

  /** Ο στόχος + το στυλ + τα χρώματα του σχεδίου, **τη στιγμή της κλήσης**. */
  const formatTarget = useCallback(() => {
    const live = cursorTable();
    const current = scope();
    if (!live || !current) return null;
    return {
      model: live.model,
      style: resolveTableStyle(live),
      scope: current,
      layerColors: getAllLayers().map((layer) => layer.color),
    };
  }, [cursorTable, scope]);

  // Η ΙΔΙΑ ουρά με το mini toolbar: ένα `UpdateEntityCommand`, ένα `Ctrl+Z` (§6.6).
  const applyFormat = useLiveTableMutation({ levelManager, execute, liveTable: cursorTable });
  const commands = useMemo(() => tableFormatCommands(applyFormat), [applyFormat]);

  // ⚠️ **Αυτούσια** τα υπάρχοντα συμβόλαια — η κορδέλα ξαναχρησιμοποιεί τα ίδια components
  // (`TableBorderMenu` / `TableMergeMenu`) με το floating toolbar, όχι αντίγραφά τους.
  const borders = useTableBorderActions({ levelManager, liveTable: table });
  const merge = useTableMergeActions({ levelManager, liveTable: table });
  const structure = useTableStructureActions({ levelManager, table });
  // 🔴 ADR-767 Δ3 — ο δεσμός ζητά **μόνο** τον ζωντανό πίνακα: δεν χρειάζεται δρομέα, γιατί
  // ανανεώνεται ολόκληρος ο πίνακας (Δ8: ένα `sourceRef` ανά πίνακα, ποτέ ανά περιοχή).
  const binding = useTableBindingActions({ levelManager, table });
  // 🔴 ADR-768 Βήμα 5 — το πινέλο ζητά **τον πίνακα του δρομέα** (`cursorTable`, όχι `table`): η
  // πηγή είναι πάντα περιοχή **μέσα σε συνεδρία**, ενώ ένας απλώς επιλεγμένος πίνακας δεν έχει
  // τι να ρουφήξει. Το `bounds()` το λέει ήδη (`null` χωρίς δρομέα) — η συμφωνία των δύο
  // ορισμάτων είναι δομική, όχι σύμπτωση.
  const painter = useTableFormatPainterActions({ liveTable: cursorTable, bounds });
  // 🔴 ADR-739 §57 — **`cursorTable`, όχι `table`**, με τον ίδιο ακριβώς λόγο που το ζητά το
  // πινέλο από πάνω: η αντιγραφή περιοχής προϋποθέτει **περιοχή**, και περιοχή υπάρχει μόνο μέσα
  // σε συνεδρία κελιού. Ένας απλώς επιλεγμένος πίνακας δεν έχει τι να αντιγράψει — και το
  // `bounds()` το λέει ήδη (`null` χωρίς δρομέα), οπότε η συμφωνία των δύο είναι δομική.
  const clipboard = useTableMenuClipboard({ levelManager, execute, liveTable: cursorTable });
  // 🔴 ADR-739 §56 — δες την κεφαλίδα του `use-toolbar-font-names.ts` για το γιατί getter.
  const fontNames = useToolbarFontNames(levelManager);

  /**
   * Ό,τι απαντά η θύρα **αυτή τη στιγμή**. Απλό αντικείμενο, ξαναφτιαγμένο ανά render —
   * επίτηδες: δεν το βλέπει ποτέ κανείς έξω από εδώ.
   */
  const answers = {
    table,
    scope,
    bounds,
    state: ((key) => {
      const target = formatTarget();
      return target ? resolveTableFormatState(target.model, target.style, target.scope, key) : null;
    }) as TableFormatPort['state'],
    colorState: ((key) => {
      // Το πλήρες στιγμιότυπο απαντά **και τις τέσσερις** ερωτήσεις του χρώματος (τι ισχύει /
      // συμφωνούν; / ποιος το είπε; / σε τι επιστρέφω). Μια δεύτερη, «φθηνότερη» ανάγνωση εδώ
      // θα ήταν το σημείο όπου η κορδέλα και το toolbar θα έλεγαν άλλα για την κληρονομιά.
      const snapshot = resolveTableFormatSnapshot(formatTarget());
      return key === 'textColorHex' ? snapshot.textColor : snapshot.fillColor;
    }) as TableFormatPort['colorState'],
    toggle: (key: Parameters<TableFormatPort['toggle']>[0]): void => commands.toggle(formatTarget(), key),
    setField: ((key, value) => commands.setField(formatTarget(), key, value)) as TableFormatPort['setField'],
    stepTextHeight: (direction: Parameters<TableFormatPort['stepTextHeight']>[0]): void =>
      commands.stepSize(formatTarget(), direction),
    textHeightMm: (): number | null => {
      const target = formatTarget();
      if (!target) return null;
      // 🔑 Το **εύρος** και όχι η «κοινή τιμή»: το ύψος είναι μεικτό σχεδόν πάντα (τίτλος 4mm,
      // κεφαλίδα 3mm, δεδομένα 2.8mm). Το πεδίο δείχνει τιμή **μόνο** όταν όντως συμφωνούν —
      // αλλιώς `null`, που η κορδέλα μεταφράζει σε «Mixed» και ποτέ σε μια από τις τρεις.
      const range = tableFormatNumericRange(target.model, target.style, target.scope, 'textHeightMm');
      return range && range.min === range.max ? range.min : null;
    },
    // 🔴 ADR-739 §56 — **η υπάρχουσα ανάγνωση**, τρίτος καταναλωτής. Το `resolveTableNumberFormat
    // State` γράφτηκε στο §55 για το mini toolbar και ήξερε ήδη και τα τέσσερα επίπεδα
    // κληρονομιάς· μια «φθηνότερη» ανάγνωση εδώ θα ήταν το σημείο όπου η κορδέλα και η γραμμή
    // δεξιού κλικ θα έλεγαν άλλα για το ίδιο κελί.
    numberFormat: (): ReturnType<TableFormatPort['numberFormat']> =>
      resolveTableNumberFormatState(formatTarget()),
    fontNames,
    reset: (): void => commands.reset(formatTarget()),
    canReset: (): boolean => {
      const live = cursorTable();
      const current = scope();
      return live !== null && current !== null && canResetTableFormatScope(live.model, current);
    },
    borders,
    merge,
    structure,
    binding,
    painter,
    clipboard,
  };

  /**
   * 🔴 Η ΤΑΥΤΟΤΗΤΑ ΤΗΣ ΘΥΡΑΣ ΕΙΝΑΙ **ΣΤΑΘΕΡΗ** — και δεν είναι βελτιστοποίηση.
   *
   * Οι απαντήσεις εξαρτώνται από `levelManager` / `getSelectedEntityIds`, δηλαδή από τιμές που
   * **κανείς δεν εγγυάται** ότι είναι σταθερές ανά render του `CanvasSection`. Με θύρα που
   * αλλάζει ταυτότητα, το ζεύγος cleanup+set του effect θα έτρεχε σε κάθε render — και επειδή
   * η αλλαγή **παρουσίας** ειδοποιεί, ο κύκλος κλείνει:
   *
   * ```
   *   νέα θύρα → set(null)+set(νέα) → emit → re-render bridge → DxfViewerContent
   *            → CanvasSection → νέα θύρα → … (άπειρος)
   * ```
   *
   * Η λύση δεν είναι φύλακας στο store — είναι να **μην αλλάζει η ταυτότητα**: ένα σταθερό
   * πρόσωπο που διαβάζει τις τρέχουσες απαντήσεις από ref τη στιγμή της κλήσης. Είναι ο ίδιος
   * κανόνας #2 του ADR-040 («getter, ποτέ στιγμιότυπο»), εφαρμοσμένος στην **ίδια τη θύρα**.
   *
   * Τα τρία υπο-αντικείμενα περνούν ως `get` accessors: οι καταναλωτές γράφουν
   * `port.borders.canReset(…)`, δηλαδή διαβάζουν την ιδιότητα **τη στιγμή της κλήσης** και
   * παίρνουν πάντα το τρέχον.
   */
  const latest = useRef(answers);
  latest.current = answers;

  const port = useMemo<TableFormatPort>(() => ({
    table: () => latest.current.table(),
    scope: () => latest.current.scope(),
    bounds: () => latest.current.bounds(),
    state: ((key) => latest.current.state(key)) as TableFormatPort['state'],
    colorState: (key) => latest.current.colorState(key),
    toggle: (key) => latest.current.toggle(key),
    setField: ((key, value) => latest.current.setField(key, value)) as TableFormatPort['setField'],
    stepTextHeight: (direction) => latest.current.stepTextHeight(direction),
    textHeightMm: () => latest.current.textHeightMm(),
    numberFormat: () => latest.current.numberFormat(),
    fontNames: () => latest.current.fontNames(),
    reset: () => latest.current.reset(),
    canReset: () => latest.current.canReset(),
    get borders() { return latest.current.borders; },
    get merge() { return latest.current.merge; },
    get structure() { return latest.current.structure; },
    get binding() { return latest.current.binding; },
    get painter() { return latest.current.painter; },
    get clipboard() { return latest.current.clipboard; },
  }), []);

  useEffect(() => {
    setTableFormatPort(port);
    // Έλεγχος ταυτότητας στο cleanup, ίδιος λόγος με τις άλλες δύο θύρες πίνακα: σε διπλό
    // mount (StrictMode) το cleanup του **παλιού** δεν επιτρέπεται να σβήσει τη θύρα που μόλις
    // έγραψε ο νέος — αλλιώς η κορδέλα θα έμενε αδρανής, σιωπηλά.
    return () => {
      if (getTableFormatPort() === port) setTableFormatPort(null);
    };
  }, [port]);

  // ── Σήμα 1: ο στόχος. Συνδρομή **χωρίς** React state — μηδέν re-render εδώ. ──────────────
  useEffect(() => {
    let previous = cursorFormatSignature();
    return subscribeTableCellCursor(() => {
      const next = cursorFormatSignature();
      if (next === previous) return;
      previous = next;
      notifyTableFormatPort();
    });
  }, []);

  // ── Σήμα 2: το μοντέλο (undo/redo, εξωτερική ενημέρωση). Δες την κεφαλίδα. ──────────────
  const lastModelRef = useRef<PersistedTableModel | null>(null);
  useEffect(() => {
    const model = table()?.model ?? null;
    if (model === lastModelRef.current) return;
    lastModelRef.current = model;
    notifyTableFormatPort();
  });
}
