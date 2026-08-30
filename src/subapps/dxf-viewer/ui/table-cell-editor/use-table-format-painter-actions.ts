'use client';

/**
 * 🔴 ADR-768 Βήμα 5 — **ΟΙ ΔΥΟ ΠΡΑΞΕΙΣ ΤΟΥ ΠΙΝΕΛΟΥ ΜΟΡΦΟΠΟΙΗΣΗΣ**: «ρούφα» και «σβήσε».
 *
 * Το τρίτο σκέλος —«βάψε»— **δεν** ζει εδώ: γεννιέται από **κλικ στον καμβά**, όχι από
 * χειριστήριο, και έχει δικό του module (`use-table-format-painter-click`). Ο διαχωρισμός δεν
 * είναι μετρικός: εδώ ζει ό,τι μπορεί να ζητήσει μια **επιφάνεια** (γραμμή εργαλείων, κορδέλα),
 * εκεί ό,τι απαντά ένα **σημείο** (ποιο κελί έπεσε κάτω από το χέρι).
 *
 * ## Γιατί ξεχωριστό αρχείο και όχι μέσα στο `use-table-format-actions`
 * Ίδιος λόγος με τα τέσσερα αδέλφια (`useTableBorderActions` / `useTableMergeActions` /
 * `useTableStructureActions` / `useTableBindingActions`): ο εκδότης της θύρας **συνθέτει**, δεν
 * υλοποιεί. Και το πινέλο έχει κάτι που κανένα από τα τέσσερα δεν έχει — **δική του κατάσταση**
 * (το store της Φ4) και **δικό του `Esc`** — δηλαδή ακριβώς τη γνώση που δεν πρέπει να μπει σε
 * αρχείο 267 γραμμών που ήδη απαντά σε άλλη ερώτηση.
 *
 * ## 🔴 ΤΟ `Esc` ΓΡΑΦΕΤΑΙ **ΕΔΩ**, ΜΑΖΙ ΜΕ ΤΗ ΣΤΑΘΕΡΑ ΤΟΥ
 * Το `escape-priority.ts` καταγγέλλει ονομαστικά (γρ. 340, `ENTITY_SELECTION`) τη σταθερά που
 * υπάρχει **χωρίς εγγραφή**: είναι «τοπόσημο τεκμηρίωσης», δηλαδή υπόσχεση που δεν εκτελείται.
 * Το σκαλί **1025** δεν είναι προτίμηση — μετρήθηκε (ADR-364 μοτίβο): ο inline editor του κελιού
 * είναι γραμμένος στο **P1000** με `canHandle: () => !settledRef.current`, που είναι `true` σε
 * **ολόκληρη** τη συνεδρία (`use-inline-editor-keys.ts:84`). Άρα **κάθε σκαλί ≤1000 είναι δομικά
 * σκιασμένο**: ένα `Esc` θα έκλεινε τη συνεδρία πίνακα αντί να σβήσει το πινέλο.
 *
 * ⚠️ **`allowWhenEditable: true` είναι υποχρεωτικό**, όχι καλλωπισμός: το `<textarea>` της
 * συνεδρίας κρατά την εστίαση όση ώρα το πινέλο είναι οπλισμένο — δηλαδή ακριβώς η κατάσταση που
 * η ασπίδα «editable focus» του bus υπάρχει για να παρακάμπτει.
 *
 * ⚠️ Ο handler είναι **αδρανής όταν το πινέλο δεν είναι οπλισμένο** (`canHandle`). Ένα σκαλί πάνω
 * από τα modal που απαντά **πάντα** θα κατανάλωνε κάθε `Esc` της εφαρμογής — η παλινδρόμηση
 * §10.12 του ADR-364, ένα σκαλί ψηλότερα.
 *
 * ## Γιατί το `arm` δεν επιστρέφει τίποτα
 * Έχει **τρεις** λόγους να μην οπλίσει (κανένας ζωντανός πίνακας · κανένας στόχος · μπαγιάτικα
 * όρια ⇒ `captureTableFormatBrush` → `null`) και **καμία** επιφάνεια δεν έχει διαφορετική
 * αντίδραση σε καθέναν: το κουμπί απλώς μένει σβηστό, γιατί το ίδιο store που αρνήθηκε είναι
 * αυτό που το ζωγραφίζει. Μια επιστροφή εδώ θα ήταν πρόσκληση για δεύτερο, χειρόγραφο φύλακα σε
 * κάθε καλούντα — και δύο απαντήσεις στο «οπλίστηκε;».
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-format-painter-actions
 * @see state/table-format-painter-store.ts — Η ΜΝΗΜΗ (Φ4): οι τρεις καταστάσεις + ο φύλακας
 * @see bim/table/table-format-paint.ts — Η ΜΗΧΑΝΗ (Φ1-Φ3): φόρτωμα + βάψιμο, καθαρά
 * @see ui/table-cell-editor/use-table-format-painter-click.ts — το τρίτο σκέλος («βάψε»)
 * @see docs/centralized-systems/reference/adrs/ADR-768-table-format-painter.md
 */

import { useCallback, useMemo } from 'react';
import { resolveTableStyle } from '../../bim/table/table-entity-geometry';
import { captureTableFormatBrush } from '../../bim/table/table-format-paint';
import { ALL_TABLE_FORMAT_FACETS } from '../../bim/table/table-format-payload';
import {
  armTableFormatPainter,
  disarmTableFormatPainter,
  getTableFormatPainterState,
  isTableFormatPainterArmed,
  type TableFormatPainterMode,
  type TableFormatPainterState,
} from '../../state/table-format-painter-store';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import type { TableCellRangeBounds } from '../../bim/table/table-cell-range';
import type { TableEntity } from '../../types/table-entity';
import { activeTableModel } from '../../bim/table/table-worksheet-resolve';

/**
 * Ό,τι μπορεί να ζητήσει μια **επιφάνεια** από το πινέλο.
 *
 * 🔴 **Κάθε μέθοδος είναι getter** (ADR-040 #2), όπως ολόκληρη η θύρα: η κατάσταση διαβάζεται τη
 * στιγμή της κλήσης. Ένα παγωμένο `state` θα σήμαινε ότι το κουμπί δείχνει «οπλισμένο» αφού το
 * βάψιμο το κατανάλωσε — και ο χρήστης θα πατούσε σε κελί περιμένοντας δεύτερο βάψιμο.
 */
export interface TableFormatPainterPort {
  /** Οι τρεις καταστάσεις ως **μία** λέξη — κουμπί, δείκτης και a11y ρωτούν το ίδιο. */
  readonly state: () => TableFormatPainterState;
  /**
   * Υπάρχει **στόχος να ρουφήξει**; `false` ⇒ το κουμπί μένει σβηστό.
   *
   * Ρωτά τα **όρια** και όχι τον πίνακα: ένας επιλεγμένος πίνακας **χωρίς δρομέα** δεν έχει
   * περιοχή-πηγή, και ένα ενεργό κουμπί εκεί θα υποσχόταν χειρονομία που δεν εκτελείται.
   */
  readonly canArm: () => boolean;
  /** Ρουφά τη μορφή του τρέχοντος στόχου. Σιωπά σε καθέναν από τους τρεις λόγους — δες κεφαλίδα. */
  readonly arm: (mode: TableFormatPainterMode) => void;
  /** Σβήνει το πινέλο. Ιδεμποτής (το store το εγγυάται). */
  readonly disarm: () => void;
}

export interface UseTableFormatPainterActionsParams {
  /** Ο πίνακας του **δρομέα**, διαβασμένος τη στιγμή της κλήσης· `null` χωρίς συνεδρία. */
  readonly liveTable: () => TableEntity | null;
  /** Ο **ίδιος** στόχος που βάφουν τα περιγράμματα και η συγχώνευση — ποτέ δεύτερος ορισμός. */
  readonly bounds: () => TableCellRangeBounds | null;
}

/** Οπλίζει και σβήνει το πινέλο, και κατέχει το `Esc` του όσο είναι οπλισμένο. */
export function useTableFormatPainterActions(
  params: UseTableFormatPainterActionsParams,
): TableFormatPainterPort {
  const { liveTable, bounds } = params;

  const arm = useCallback(
    (mode: TableFormatPainterMode): void => {
      const live = liveTable();
      const source = bounds();
      if (!live || !source) return;
      // 🔴 `null` ⇒ **μπαγιάτικα όρια** (τρύπα στο ορθογώνιο μετά από undo). Η μηχανή αρνείται
      // αντί να βάψει μισό μοτίβο· εδώ η άρνηση σημαίνει «μην οπλίσεις», ποτέ «μάντεψε».
      const brush = captureTableFormatBrush(
        activeTableModel(live),
        resolveTableStyle(live),
        source,
        // Βήμα 5 = **όλες** οι όψεις. Η επιλογή ιδιοτήτων (Α3, AutoCAD «Property Settings») είναι
        // Βήμα 6 και θα περάσει από εδώ ως όρισμα — η υπογραφή δεν αλλάζει.
        ALL_TABLE_FORMAT_FACETS,
      );
      if (!brush) return;
      // Το store αρνείται **και** αυτό χωρίς ζωντανό δρομέα. Δίχτυ, όχι πρωτεύων δρόμος
      // (N.7.2 #4): ο πρωτεύων είναι το `bounds()` από πάνω, που είναι ήδη `null` χωρίς δρομέα.
      armTableFormatPainter(brush, mode);
    },
    [liveTable, bounds],
  );

  // 🔴 Η σταθερά **και** η εγγραφή της, μαζί. Δες την κεφαλίδα για το γιατί 1025 και όχι λιγότερο.
  useEscapeHandler({
    id: 'table-format-painter',
    priority: ESC_PRIORITY.TABLE_FORMAT_PAINTER,
    allowWhenEditable: true,
    canHandle: isTableFormatPainterArmed,
    handle: () => {
      disarmTableFormatPainter();
      return true;
    },
  });

  return useMemo<TableFormatPainterPort>(
    () => ({
      state: getTableFormatPainterState,
      canArm: () => bounds() !== null,
      arm,
      disarm: disarmTableFormatPainter,
    }),
    [arm, bounds],
  );
}
