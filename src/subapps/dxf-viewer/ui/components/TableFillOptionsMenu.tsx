'use client';

/**
 * 🔴 ADR-828 §7.2 — **το μενού του δεξιού συρσίματος της λαβής συμπλήρωσης**.
 *
 * Στο Excel: πιάνεις τη λαβή με το **δεξί** κουμπί, σέρνεις, αφήνεις — και αντί να γραφτεί η
 * προεπιλογή, εμφανίζεται μενού που ρωτά **τι εννοούσες**. Είναι η μόνη πόρτα προς τη
 * «Συμπλήρωση καθημερινών» (ADR-828 §2: δεν συμπεραίνεται ποτέ) και ο ρητός τρόπος να
 * **ανατραπεί** η συμπερασμένη μονάδα ημερολογίου.
 *
 * ## 🔴 ΧΩΡΙΣ PROPS, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ
 * Τα άλλα τέσσερα αγκυρωμένα μενού του πίνακα παίρνουν τις πράξεις τους ως props, μέσα από
 * `useCanvasSectionUI` → `CanvasSection` → `CanvasSectionOverlays`. Εδώ **δεν υπάρχει τίποτα
 * να περάσει**: ολόκληρη η πράξη —πηγή, στόχος, και η ΜΙΑ διαδρομή εγγραφής— είναι ήδη στα
 * χέρια της χειρονομίας που μόλις τελείωσε, και ταξιδεύει μαζί με τον στόχο
 * ({@link TableFillMenuTarget.apply}).
 *
 * Δεύτερο μονοπάτι props θα σήμαινε **δεύτερη** ανάγνωση της σκηνής και δεύτερη διαδρομή
 * εγγραφής για το ίδιο γέμισμα — δηλαδή δύο ευκαιρίες να διαφωνήσει το μενού με τη σύρση που
 * μόλις είδε ο χρήστης. Ίδιο κριτήριο με τα φύλλα χωρίς props του `CanvasSectionOverlays`
 * (`TableResizeReadoutOverlay`, `TableLinkPicker`): ο orchestrator δεν μαθαίνει τίποτα που δεν
 * χρειάζεται (ADR-040).
 *
 * ## 🔑 Η ΘΥΡΑ ΔΗΛΩΝΕΤΑΙ ΩΣ ΣΤΑΘΕΡΟΣ ΠΡΟΣΑΡΜΟΓΕΑΣ, ΟΧΙ ΩΣ ΤΟ ΙΔΙΟ ΤΟ HANDLE
 * Το `useImperativeHandle` **ξαναφτιάχνει** το αντικείμενο όποτε αλλάξουν οι εξαρτήσεις του,
 * οπότε μια θύρα που κρατούσε το handle θα κρατούσε στιγμιότυπο. Ο προσαρμογέας διαβάζει το
 * `ref.current` **τη στιγμή του ανοίγματος** — ο ίδιος κανόνας που τηρούν όλες οι θύρες του
 * πίνακα (ADR-040 κανόνας #2), εφαρμοσμένος μία στάθμη πιο μέσα.
 *
 * @module subapps/dxf-viewer/ui/components/TableFillOptionsMenu
 * @see ui/table-cell-editor/table-fill-menu-port.ts — ποιος το ανοίγει, και γιατί όχι ο δρομολογητής
 * @see ui/components/table-fill-menu/table-fill-menu-commands.ts — η διάταξη (Excel)
 * @see docs/centralized-systems/reference/adrs/ADR-828-table-autofill-series.md §7.2
 */

import React, { useEffect, useRef } from 'react';
import { AnchoredMenuShell } from './dxf-context-menu/AnchoredMenuShell';
import { useAnchoredContextMenu, type AnchoredMenuHandle } from './dxf-context-menu/use-anchored-context-menu';
import { TableFillMenuItems } from './table-fill-menu/TableFillMenuItems';
import type { TableFillMenuEnabled } from './table-fill-menu/table-fill-menu-commands';
import {
  setTableFillMenuPort,
  type TableFillMenuTarget,
} from '../table-cell-editor/table-fill-menu-port';
import { restartTableCellCursorSession } from '../../state/table-cell-cursor-store';

/**
 * Ποιες εντολές ανοίγουν, από τη **μία** ανίχνευση που έτρεξε ήδη η χειρονομία.
 *
 * Οι τρεις που **λείπουν** από εδώ (`copyCells`, `formatOnly`, `withoutFormat`) ισχύουν πάντα:
 * δεν εξαρτώνται από το περιεχόμενο, άρα δεν έχουν τι να ρωτήσουν. Η απουσία τους είναι η
 * σωστή δήλωση — δες `TableFillMenuEnabled`: «δεν το ρώτησε κανείς» ≠ «δεν γίνεται».
 */
function enabledFrom(target: TableFillMenuTarget): TableFillMenuEnabled {
  const { series, date } = target.offer;
  return {
    fillSeries: series,
    fillDays: date,
    fillWeekdays: date,
    fillMonths: date,
    fillYears: date,
  };
}

export function TableFillOptionsMenu(): React.ReactElement {
  const handleRef = useRef<AnchoredMenuHandle<TableFillMenuTarget> | null>(null);
  /**
   * Δεν υπάρχει δεύτερη επιφάνεια (mini toolbar) πάνω από αυτό το μενού, και δεν πρόκειται:
   * το δεξί σύρσιμο ρωτά **τι είδους γέμισμα**, όχι πώς μοιάζει το κελί. Ο φύλακας «κλικ πάνω
   * στη γραμμή» δέχεται κενό ref και δεν ακυρώνει ποτέ κλείσιμο — μια γραμμή αντί για δεύτερη
   * παραλλαγή του κελύφους (§67: **γνώση χωριστά από μηχανική**).
   */
  const noSurfaceRef = useRef<HTMLElement>(null);

  const { triggerRef, isOpen, target, onOpenChange } = useAnchoredContextMenu<TableFillMenuTarget>(
    handleRef,
    // Το μενού ζει **μέσα** σε συνεδρία κελιού, όπως το μενού περιοχής: όταν κλείσει, το
    // πληκτρολόγιο πρέπει να επιστρέψει στον δρομέα — αλλιώς ο πίνακας μένει «επιλεγμένος
    // χωρίς δρομέα» (ADR-739 §27.10).
    restartTableCellCursorSession,
  );

  useEffect(() => {
    setTableFillMenuPort({
      open: (x, y, next) => {
        handleRef.current?.open(x, y, next);
      },
    });
    return () => setTableFillMenuPort(null);
  }, []);

  return (
    <AnchoredMenuShell
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      triggerRef={triggerRef}
      surfaceRef={noSurfaceRef}
    >
      {target ? (
        <TableFillMenuItems onPick={target.apply} enabled={enabledFrom(target)} />
      ) : null}
    </AnchoredMenuShell>
  );
}
