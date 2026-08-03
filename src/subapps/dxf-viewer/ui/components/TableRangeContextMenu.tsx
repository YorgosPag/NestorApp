'use client';

/**
 * ADR-750 Φάση 4 — **το δεξί κλικ πάνω σε κελιά πίνακα**: οι εντολές περιγράμματος.
 *
 * ## Γιατί κανονικό μενού και όχι δεύτερο mini toolbar
 * Το mini toolbar των ζωνών δείκτη ζει σε **δικό του** portal επειδή η απόφαση Α7 απαιτεί να
 * κάθεται *πάνω* από το μενού εισαγωγής/διαγραφής, με κενό ανάμεσα — κάτι που το Radix δεν
 * κάνει για παιδί του `Menu.Content`. Εδώ δεν υπάρχει δεύτερη επιφάνεια από κάτω: το δεξί κλικ
 * σε κελιά έχει **μόνο** περιγράμματα. Άρα το idiom είναι το κανονικό context menu του subapp
 * (`DxfContextMenu`, το SSoT της οπτικής γλώσσας) — και μαζί του έρχονται δωρεάν portal,
 * τοποθέτηση, `Escape`, κλικ έξω και roving του Radix, χωρίς **καμία** από τις παγίδες
 * `aria-hidden` / `pointer-events` που πλήρωσε το toolbar.
 *
 * ## 🔑 Η γνώση των εντολών ΔΕΝ ξαναγράφεται εδώ
 * Σειρά, ομάδες, εικονίδια και ετικέτες έρχονται από το {@link tableBorderMenuItems} — το ίδιο
 * που τροφοδοτεί το πάνελ του toolbar. Διαφέρει **μόνο** η υποδοχή (`DxfMenuItem` του Radix
 * εναντίον σκέτου `<button>`), δηλαδή ό,τι είναι όντως διαφορετικό. Την ημέρα που η Φ5
 * ενεργοποιεί τη διπλή γραμμή, εμφανίζεται **και στις δύο** χωρίς να το θυμηθεί κανείς.
 *
 * @module subapps/dxf-viewer/ui/components/TableRangeContextMenu
 * @see ui/table-cell-editor/use-table-range-menu.ts — ποιος το ανοίγει και με ποιον στόχο
 * @see ui/components/table-format-toolbar/table-border-menu-items.ts — η κοινή γνώση
 */

import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
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
import { useAnchoredHiddenTrigger } from './dxf-context-menu/use-anchored-hidden-trigger';
import { TABLE_CELL_SESSION_MARKER } from '../table-cell-editor/table-cell-session-focus';
import { TableBorderIcon } from './table-format-toolbar/TableBorderIcon';
import { tableBorderMenuItems } from './table-format-toolbar/table-border-menu-items';
import { TableDiagonalIcon } from './table-format-toolbar/TableDiagonalIcon';
import type { TableBorderCommandId } from '../../bim/table/table-range-border-ops';
import {
  TABLE_DIAGONAL_COMMANDS,
  type TableDiagonalCommandId,
} from '../../bim/table/table-cell-diagonal-ops';
import type { TableCellRangeBounds } from '../../bim/table/table-cell-range';

/**
 * Ο στόχος, **παγωμένος στο άνοιγμα**: τα όρια που θα γραφτούν, το όνομα που φαίνεται και το αν
 * υπάρχει τι να επαναφερθεί. Τα τρία μαζί, ώστε να μην μπορούν να αποκλίνουν μεταξύ τους — ίδια
 * σύμβαση με το `OpenTarget` του μενού των ζωνών.
 */
export interface TableRangeMenuTarget {
  readonly bounds: TableCellRangeBounds;
  /** `C3` για ένα κελί, `B2:D4` για περιοχή — η γλώσσα του χρήστη, ποτέ «ακμή» (Α5). */
  readonly label: string;
  readonly canReset: boolean;
  /** ADR-750 Φ5 (Α2) — υπάρχει διαγώνιος να σβηστεί; Ίδια σύμβαση με το {@link canReset}. */
  readonly canClearDiagonals: boolean;
}

export interface TableRangeMenuProps {
  readonly onApplyBorder: (bounds: TableCellRangeBounds, commandId: TableBorderCommandId) => void;
  readonly onResetBorders: (bounds: TableCellRangeBounds) => void;
  /**
   * ADR-750 Φ5 (Α2) — οι διαγώνιοι.
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
  /** Το μενού έκλεισε — με ή χωρίς ενέργεια. Εδώ επιστρέφει η εστίαση στο κελί. */
  readonly onClosed: () => void;
}

export interface TableRangeContextMenuHandle {
  open: (x: number, y: number, target: TableRangeMenuTarget) => void;
  close: () => void;
}

const TableRangeContextMenuInner = forwardRef<TableRangeContextMenuHandle, TableRangeMenuProps>(
  ({ onApplyBorder, onResetBorders, onApplyDiagonal, onClosed }, ref) => {
    const { t } = useTranslation('dxf-viewer');
    const triggerRef = useRef<HTMLSpanElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [target, setTarget] = useState<TableRangeMenuTarget | null>(null);
    const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

    // Η τοποθέτηση του κρυφού trigger είναι κοινή με το μενού των ζωνών — και το σκεπτικό της
    // (γιατί χρειάζονται **δύο** γραψίματα) ζει εκεί, μία φορά.
    const placeTrigger = useAnchoredHiddenTrigger(triggerRef, anchor);

    useImperativeHandle(ref, () => ({
      open: (x, y, next) => {
        placeTrigger(x, y);
        setAnchor({ x, y });
        setTarget(next);
        setIsOpen(true);
      },
      close: () => {
        setIsOpen(false);
        setTarget(null);
      },
    }), [placeTrigger]);

    /** Ο ΕΝΑΣ δρόμος εξόδου — `Escape`, κλικ έξω, επιλογή item. Η εστίαση γυρίζει στο κελί. */
    const handleOpenChange = useCallback((next: boolean) => {
      setIsOpen(next);
      if (!next) {
        setTarget(null);
        onClosed();
      }
    }, [onClosed]);

    const items = tableBorderMenuItems();

    return (
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <DxfMenuHiddenTrigger ref={triggerRef} {...TABLE_CELL_SESSION_MARKER} />
        </DropdownMenuTrigger>

        {target ? (
          <DxfMenuContent {...TABLE_CELL_SESSION_MARKER}>
            <DxfMenuItem disabled>
              <DxfMenuLabel>{t('table.borders.rangeMenuTitle', { label: target.label })}</DxfMenuLabel>
            </DxfMenuItem>
            <DxfMenuSeparator />

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
    );
  },
);

TableRangeContextMenuInner.displayName = 'TableRangeContextMenu';

export const TableRangeContextMenu = TableRangeContextMenuInner;
