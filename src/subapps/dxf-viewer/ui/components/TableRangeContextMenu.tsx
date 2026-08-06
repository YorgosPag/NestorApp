'use client';

/**
 * ADR-750 Φάση 4 + **ADR-755** — **το δεξί κλικ πάνω σε κελιά πίνακα**: mini toolbar από πάνω,
 * εντολές από κάτω.
 *
 * ## 🔴 ΓΙΑΤΙ ΑΠΕΚΤΗΣΕ ΓΡΑΜΜΗ ΕΡΓΑΛΕΙΩΝ (ADR-755) — ανατροπή της Φ4
 * Εδώ έγραφε: «κανονικό μενού και όχι δεύτερο mini toolbar … το δεξί κλικ σε κελιά έχει
 * **μόνο** περιγράμματα, άρα δεν υπάρχει δεύτερη επιφάνεια από κάτω». Η πρόταση ήταν σωστή
 * **για το περιεχόμενο που υπήρχε τότε**.
 *
 * Ο ιδιοκτήτης ζήτησε συγχώνευση κελιών «στο mini toolbar», δείχνοντας το Excel: εκεί το
 * κουμπί «Συγχώνευση και κεντράρισμα» ζει ακριβώς σε αυτή τη χειρονομία — δεξί κλικ πάνω σε
 * **επιλεγμένα κελιά**. Άρα η επιφάνεια δεν προστέθηκε για συμμετρία· προστέθηκε επειδή η
 * πράξη που ζητήθηκε κατοικεί εκεί.
 *
 * ## 🔴 Τι δείχνει η γραμμή εδώ — **ΑΝΑΤΡΟΠΗ ΤΟΥ §52**
 * Εδώ έγραφε: «**Μόνο** πράξεις περιοχής: συγχώνευση, περιγράμματα. Το τμήμα μορφοποίησης
 * άξονα (Β/Ι/Υ, χρώματα, μέγεθος) **λείπει** — γράφει `styleOverride` γραμμής/στήλης, και πάνω
 * σε επιλογή κελιών δεν υπάρχει άξονας να γράψει».
 *
 * Η πρόταση ήταν σωστή και η αιτία της **πραγματική** — αλλά ήταν έλλειψη του μοντέλου, όχι
 * σχεδιαστική επιλογή. Το §52 έγραψε τον γραφέα που έλειπε (`TableCell.styleOverride`) και την
 * επιλογή στόχου (`table-format-scope.ts`), οπότε η γραμμή δείχνει πλέον **και τα εννιά**
 * χειριστήρια — με στόχο τα μαρκαρισμένα κελιά. Δεν έλειπε κουμπί· έλειπε η **πράξη**.
 *
 * ## 🔑 Α22 — ο στόχος είναι το κελί, ΕΚΤΟΣ αν ανήκει στην επιλογή
 * ```
 * επιλογή B2:D4, δεξί κλικ στο C3  ⇒  στόχος B2:D4   (μέσα στην επιλογή)
 * επιλογή B2:D4, δεξί κλικ στο E5  ⇒  στόχος E5      (έξω από αυτήν)
 * καμία επιλογή,  δεξί κλικ στο E5  ⇒  στόχος E5
 * ```
 * Είναι **ακριβώς η σημασιολογία του Excel**, χωρίς την παρενέργειά του. Το Excel τη
 * συμπεραίνει *μετακινώντας* την επιλογή στο κελί που πατήθηκε· εδώ το δεξί κλικ δεν αγγίζει
 * ποτέ την επιλογή (ADR-739 §27.14: «το δεξί σταματά εδώ»), οπότε ο ίδιος κανόνας βγαίνει από
 * την **ερώτηση** αντί από τη μεταβολή.
 *
 * ## 🔑 Η ΓΝΩΣΗ ΤΩΝ ΕΝΤΟΛΩΝ ΔΕΝ ΞΑΝΑΓΡΑΦΕΤΑΙ ΕΔΩ
 * Σειρά, ομάδες, εικονίδια και ετικέτες έρχονται από τα **ίδια** μητρώα που τροφοδοτούν τη
 * γραμμή εργαλείων ({@link tableBorderMenuItems}, `TABLE_DIAGONAL_COMMANDS`,
 * `TABLE_MERGE_COMMANDS`). Διαφέρει **μόνο** η υποδοχή (`DxfMenuItem` του Radix εναντίον
 * σκέτου `<button>`), δηλαδή ό,τι είναι όντως διαφορετικό.
 *
 * @module subapps/dxf-viewer/ui/components/TableRangeContextMenu
 * @see ui/table-cell-editor/use-table-range-menu.ts — ποιος το ανοίγει και με ποιον στόχο
 * @see ui/components/table-format-toolbar/table-border-menu-items.ts — η κοινή γνώση
 */

import React, { forwardRef, useCallback, useRef } from 'react';
import { RotateCcw, TableCellsMerge, TableCellsSplit } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DxfMenuContent,
  DxfMenuHiddenTrigger,
  DxfMenuIcon,
  DxfMenuItem,
  DxfMenuLabel,
  DxfMenuSeparator,
} from './dxf-context-menu/DxfContextMenu';
import { useAnchoredContextMenu } from './dxf-context-menu/use-anchored-context-menu';
import { useKeepOpenOnSurface } from './dxf-context-menu/use-keep-open-on-surface';
import { TABLE_CELL_SESSION_MARKER } from '../table-cell-editor/table-cell-session-focus';
import { TableBorderIcon } from './table-format-toolbar/TableBorderIcon';
import { tableBorderMenuItems } from './table-format-toolbar/table-border-menu-items';
import { TableDiagonalIcon } from './table-format-toolbar/TableDiagonalIcon';
import { isTableMergeCommandDisabled } from './table-format-toolbar/TableMergeMenu';
import {
  TableFormatToolbar,
  type TableBorderMenuHostProps,
  type TableFormatSnapshot,
  type TableToggleFormatKey,
} from './table-format-toolbar/TableFormatToolbar';
import type { TextHeightStepDirection } from '../../bim/table/table-text-height-scale';
import type { TableBorderCommandId } from '../../bim/table/table-range-border-ops';
import {
  TABLE_DIAGONAL_COMMANDS,
  type TableDiagonalCommandId,
} from '../../bim/table/table-cell-diagonal-ops';
import {
  TABLE_MERGE_COMMANDS,
  type TableMergeCommandId,
  type TableMergeState,
} from '../../bim/table/table-range-merge-ops';
import type { TableCellRangeBounds } from '../../bim/table/table-cell-range';

/**
 * 🔴 ADR-739 §52 — οι **πέντε** εντολές μορφοποίησης, παραμετρικές ως προς τα όρια.
 *
 * Ένα αντικείμενο και όχι πέντε props, για τον ίδιο λόγο που το ADR-750 έβαλε τα περιγράμματα
 * σε ένα: ο τύπος **είναι** το συμβόλαιο, και μια κατάσταση «τρεις από τις πέντε» δεν πρέπει
 * να είναι εκφράσιμη. Παραμετρικές ως προς τα **όρια** (και όχι δεμένες) επειδή ο κανόνας
 * ξαναρωτήματος του {@link TableRangeMenuProps.resolveTarget} απαιτεί να ξαναδοθούν φρέσκα
 * μετά από κάθε πράξη — ένα undo ενόσω η γραμμή ήταν ανοιχτή δεν επιτρέπεται να γράψει σε
 * κελιά που δεν υπάρχουν.
 */
export interface TableRangeFormatActions {
  readonly onToggle: (bounds: TableCellRangeBounds, key: TableToggleFormatKey) => void;
  readonly onStepSize: (
    bounds: TableCellRangeBounds,
    direction: TextHeightStepDirection,
  ) => void;
  readonly onReset: (bounds: TableCellRangeBounds) => void;
  readonly onSetTextColor: (bounds: TableCellRangeBounds, value: string | undefined) => void;
  readonly onSetFillColor: (
    bounds: TableCellRangeBounds,
    value: string | null | undefined,
  ) => void;
}

/**
 * Ο στόχος, **παγωμένος στο άνοιγμα**: τα όρια που θα γραφτούν, το όνομα που φαίνεται και το τι
 * έχει νόημα να πατηθεί. Όλα μαζί, ώστε να μην μπορούν να αποκλίνουν μεταξύ τους — ίδια
 * σύμβαση με το `OpenTarget` του μενού των ζωνών.
 */
export interface TableRangeMenuTarget {
  readonly bounds: TableCellRangeBounds;
  /** `C3` για ένα κελί, `B2:D4` για περιοχή — η γλώσσα του χρήστη, ποτέ «ακμή» (Α5). */
  readonly label: string;
  readonly canReset: boolean;
  /** ADR-750 Φ5 (Α2) — υπάρχει διαγώνιος να σβηστεί; Ίδια σύμβαση με το {@link canReset}. */
  readonly canClearDiagonals: boolean;
  /**
   * ADR-755 — τι ισχύει για τη **συγχώνευση**. Ανανεώνεται μετά από κάθε εντολή, γιατί η
   * γραμμή εργαλείων επιβιώνει του μενού και το κουμπί οφείλει να δείξει πατημένο.
   */
  readonly merge: TableMergeState;
  /** ADR-755 — το dropdown περιγραμμάτων, σε μία ερώτηση (ίδιο σχήμα με το μενού ζωνών). */
  readonly borders: TableBorderMenuHostProps;
  /**
   * 🔴 ADR-739 §52 — **τι δείχνουν τα εννιά χειριστήρια μορφοποίησης** για αυτά τα κελιά.
   *
   * Έλειπε μέχρι το §52 — όχι από παράλειψη: δεν υπήρχε γραφέας για το
   * `TableCell.styleOverride`, οπότε το τμήμα θα ήταν εννιά κουμπιά που δεν κάνουν τίποτα.
   * Δες την κεφαλίδα του `TableFormatSection`.
   */
  readonly format: TableFormatSnapshot;
}

export interface TableRangeMenuProps {
  readonly onApplyBorder: (bounds: TableCellRangeBounds, commandId: TableBorderCommandId) => void;
  readonly onResetBorders: (bounds: TableCellRangeBounds) => void;
  /**
   * ADR-750 Φ5 (Α2) — οι **διαγώνιοι**.
   *
   * ⚠️ Αυτή η υποδοχή δείχνει τις **εντολές** (13 + 4), όχι τη ζώνη σχεδίασης του μολυβιού:
   * το μολύβι είναι **εργαλείο**, όχι εντολή, και ζει σε ένα σημείο — τη γραμμή εργαλείων.
   * Δύο σημεία ρύθμισης του ίδιου μολυβιού θα ήταν δύο απαντήσεις στο «με τι γράφω τώρα».
   * Το ίδιο κάνουν AutoCAD και Excel: ο πένα ρυθμίζεται μία φορά, εφαρμόζεται από παντού.
   */
  readonly onApplyDiagonal: (
    bounds: TableCellRangeBounds,
    commandId: TableDiagonalCommandId,
  ) => void;
  /** ADR-755 — μία από τις τέσσερις εντολές συγχώνευσης· ασύγχρονη όταν ρωτά (δες §4). */
  readonly onApplyMerge: (
    bounds: TableCellRangeBounds,
    commandId: TableMergeCommandId,
  ) => void | Promise<void>;
  /** ADR-739 §52 — οι πέντε εντολές μορφοποίησης κελιών (Β/Ι/Υ, χρώματα, μέγεθος, επαναφορά). */
  readonly formatActions: TableRangeFormatActions;
  /** Ξαναρωτά την κατάσταση μετά από εντολή — η γραμμή επιβιώνει και οφείλει να λέει αλήθεια. */
  readonly resolveTarget: (bounds: TableCellRangeBounds) => TableRangeMenuTarget | null;
  /** Το μενού έκλεισε — με ή χωρίς ενέργεια. Εδώ επιστρέφει η εστίαση στο κελί. */
  readonly onClosed: () => void;
}

export interface TableRangeContextMenuHandle {
  open: (x: number, y: number, target: TableRangeMenuTarget) => void;
  close: () => void;
}

const TableRangeContextMenuInner = forwardRef<TableRangeContextMenuHandle, TableRangeMenuProps>(
  ({
    onApplyBorder, onResetBorders, onApplyDiagonal, onApplyMerge, formatActions,
    resolveTarget, onClosed,
  }, ref) => {
    const { t } = useTranslation('dxf-viewer');
    const toolbarRef = useRef<HTMLDivElement>(null);

    // 🔴 ADR-751 Φ8.β — ο κύκλος ζωής (τέσσερις καταστάσεις, τοποθέτηση κρυφού trigger,
    // `open`/`close`, ΕΝΑΣ δρόμος εξόδου) **εξήχθη**: το τρίτο μενού δεξιού κλικ πίνακα τον
    // αντέγραψε αυτούσιο και το CHECK 3.28 τον μέτρησε — 32 γραμμές / 138 tokens. Το
    // `onClosed` μένει **εδώ** ως όρισμα γιατί είναι η μία πραγματική διαφορά: αυτό το μενού
    // ζει μέσα σε συνεδρία κελιού και οφείλει να την ξαναζωντανέψει.
    const { triggerRef, isOpen, target, onOpenChange, anchor, setTarget, closeMenuKeepTarget } =
      useAnchoredContextMenu<TableRangeMenuTarget>(ref, onClosed);

    // 🔴 Το toolbar ζει σε **δικό του** portal, άρα κάθε πάτημα κουμπιού φτάνει εδώ ως
    // `pointerDownOutside` — και το `DismissableLayer` κλείνει στο `pointerdown`, δηλαδή ΠΡΙΝ
    // το `click`. Χωρίς τον φύλακα, το `onClick` της εντολής δεν θα έτρεχε ποτέ.
    const keepOpenOnToolbar = useKeepOpenOnSurface(toolbarRef);

    /**
     * Μια εντολή της γραμμής: **κλείνει το μενού, εκτελεί, ξαναρωτά**.
     *
     * Το κλείσιμο προηγείται γιατί η συγχώνευση μπορεί να ανοίξει modal διάλογο — με το μενού
     * ακόμη ανοιχτό, το `FocusScope` του Radix θα επανέφερε κάθε εστίαση στο `role="menu"` και
     * ο χρήστης θα έβλεπε ερώτηση που δεν μπορεί να απαντήσει με πληκτρολόγιο.
     *
     * Η ανανέωση γίνεται με updater και έλεγχο `prev`: η γραμμή μπορεί να έχει φύγει (`Escape`)
     * όσο έτρεχε η ασύγχρονη πράξη.
     */
    const runOnRange = useCallback(
      (action: (bounds: TableCellRangeBounds) => void | Promise<void>) => {
        if (!target) return;
        const { bounds } = target;
        closeMenuKeepTarget();
        void Promise.resolve(action(bounds)).then(() => {
          setTarget((prev) => (prev ? resolveTarget(prev.bounds) ?? prev : prev));
        });
      },
      [target, closeMenuKeepTarget, setTarget, resolveTarget],
    );

    const items = tableBorderMenuItems();

    return (
      <>
        {/*
          ⚠️ Κρέμεται από το `target`, ΟΧΙ από το `isOpen` — ίδια απόφαση με το μενού των ζωνών:
          η γραμμή επιβιώνει του μενού για την **επόμενη** εντολή και φεύγει μόνο με `Escape` /
          κλικ έξω / νέο δεξί κλικ.
        */}
        {target && anchor ? (
          <TableFormatToolbar
            anchorX={anchor.x}
            anchorY={anchor.y}
            scope="range"
            label={target.label}
            surfaceRef={toolbarRef}
            /*
              🔴 ADR-739 §52 — **τα ίδια εννιά χειριστήρια με τη ζώνη δείκτη**, με άλλον στόχο
              μέσα τους. Κάθε εντολή περνά από το {@link runOnRange}: εφαρμογή → ξαναρώτημα →
              κλείσιμο **μόνο** του μενού· η γραμμή μένει, γιατί η μορφοποίηση είναι κατεξοχήν
              επαναλαμβανόμενη πράξη (έντονα, μετά πλάγια, μετά ένα μέγεθος πάνω).
            */
            format={{
              format: target.format,
              onToggle: (key) => runOnRange((bounds) => formatActions.onToggle(bounds, key)),
              onStepSize: (dir) => runOnRange((bounds) => formatActions.onStepSize(bounds, dir)),
              onReset: () => runOnRange((bounds) => formatActions.onReset(bounds)),
              onSetTextColor: (v) => runOnRange((bounds) => formatActions.onSetTextColor(bounds, v)),
              onSetFillColor: (v) => runOnRange((bounds) => formatActions.onSetFillColor(bounds, v)),
            }}
            merge={{
              state: target.merge,
              onApply: (id) => runOnRange((bounds) => onApplyMerge(bounds, id)),
            }}
            borders={{
              ...target.borders,
              onApply: (id) => runOnRange((bounds) => onApplyBorder(bounds, id)),
              onReset: () => runOnRange((bounds) => onResetBorders(bounds)),
              onApplyDiagonal: (id) => runOnRange((bounds) => onApplyDiagonal(bounds, id)),
            }}
          />
        ) : null}

        <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
          <DropdownMenuTrigger asChild>
            <DxfMenuHiddenTrigger ref={triggerRef} {...TABLE_CELL_SESSION_MARKER} />
          </DropdownMenuTrigger>

          {target ? (
            <DxfMenuContent
              {...TABLE_CELL_SESSION_MARKER}
              onPointerDownOutside={keepOpenOnToolbar}
              onFocusOutside={keepOpenOnToolbar}
            >
              <DxfMenuItem disabled>
                <DxfMenuLabel>{t('table.borders.rangeMenuTitle', { label: target.label })}</DxfMenuLabel>
              </DxfMenuItem>

              {/*
                ADR-755 — η **συγχώνευση** πρώτη, από το ίδιο μητρώο με το split button. Είναι η
                σειρά της κορδέλας του Excel και η σειρά με την οποία σκέφτεται ο χρήστης: πρώτα
                «τι είναι κελί», μετά «πώς πλαισιώνεται».
              */}
              <DxfMenuSeparator />
              {TABLE_MERGE_COMMANDS.map((command) => (
                <DxfMenuItem
                  key={command.id}
                  disabled={isTableMergeCommandDisabled(command.id, target.merge)}
                  onSelect={() => onApplyMerge(target.bounds, command.id)}
                >
                  <DxfMenuIcon>
                    {command.joins
                      ? <TableCellsMerge size={15} aria-hidden="true" />
                      : <TableCellsSplit size={15} aria-hidden="true" />}
                  </DxfMenuIcon>
                  <DxfMenuLabel>{t(`table.merge.commands.${command.id}`)}</DxfMenuLabel>
                </DxfMenuItem>
              ))}

              {items.map(({ command, labelKey, startsGroup }) => (
                <React.Fragment key={command.id}>
                  {startsGroup ? <DxfMenuSeparator /> : null}
                  <DxfMenuItem onSelect={() => onApplyBorder(target.bounds, command.id)}>
                    <DxfMenuIcon><TableBorderIcon command={command} /></DxfMenuIcon>
                    <DxfMenuLabel>{t(labelKey)}</DxfMenuLabel>
                  </DxfMenuItem>
                </React.Fragment>
              ))}

              <DxfMenuSeparator />
              <DxfMenuItem
                disabled={!target.canReset}
                onSelect={() => onResetBorders(target.bounds)}
              >
                <DxfMenuIcon><RotateCcw size={15} aria-hidden="true" /></DxfMenuIcon>
                <DxfMenuLabel>{t('table.borders.resetBorders')}</DxfMenuLabel>
              </DxfMenuItem>

              {/*
                ADR-750 Φ5 (Α2) — οι **διαγώνιοι**, ίδια ομάδα και ίδια σειρά με τη γραμμή
                εργαλείων. Η γνώση έρχεται από το **ίδιο** μητρώο, όπως και οι 13: η ημέρα που θα
                προστεθεί πέμπτη διαγώνια εντολή δεν επιτρέπεται να τη δείξει μόνο η μία υποδοχή.
              */}
              <DxfMenuSeparator />
              {TABLE_DIAGONAL_COMMANDS.map((command) => (
                <DxfMenuItem
                  key={command.id}
                  disabled={command.id === 'clear' && !target.canClearDiagonals}
                  onSelect={() => onApplyDiagonal(target.bounds, command.id)}
                >
                  <DxfMenuIcon><TableDiagonalIcon command={command} /></DxfMenuIcon>
                  <DxfMenuLabel>{t(`table.borders.diagonals.${command.id}`)}</DxfMenuLabel>
                </DxfMenuItem>
              ))}
            </DxfMenuContent>
          ) : null}
        </DropdownMenu>
      </>
    );
  },
);

TableRangeContextMenuInner.displayName = 'TableRangeContextMenu';

export const TableRangeContextMenu = TableRangeContextMenuInner;
