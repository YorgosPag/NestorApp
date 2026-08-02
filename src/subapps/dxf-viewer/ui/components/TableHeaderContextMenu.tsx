'use client';

/**
 * ADR-739 Φ.Δ βήμα 9 — **το μενού των ζωνών δείκτη**: δεξί κλικ σε γράμμα στήλης ή αριθμό
 * γραμμής ⇒ εισαγωγή / διαγραφή.
 *
 * ## Ρητή κατεύθυνση, όχι σκέτο «Εισαγωγή»
 * Το Excel δείχνει ένα item και εισάγει **πάντα πριν** — κανόνας που ο χρήστης μαθαίνει με
 * δοκιμή και undo. Το AutoCAD (μενού κελιού πίνακα) και τα Google Sheets δείχνουν και τις δύο
 * κατευθύνσεις. Εδώ ακολουθούμε τα δεύτερα: ο πίνακας είναι **σχέδιο**, και μια εισαγωγή στη
 * λάθος μεριά μετακινεί γεωμετρία που ο μηχανικός μόλις τακτοποίησε.
 *
 * ## Ένα σώμα, δύο άξονες
 * Τα items είναι **τρία** (`πριν` / `μετά` / `διαγραφή`) και ο άξονας του χτυπήματος αποφασίζει
 * μόνο τι **λένε** και τι εικονίδιο έχουν. Δύο ξεχωριστά μπλοκ JSX θα ήταν sibling clone (N.18)
 * και, χειρότερα, δύο σημεία που μπορούν κάποτε να αποκτήσουν διαφορετική συμπεριφορά για την
 * ίδια ακριβώς πράξη.
 *
 * ## 🔴 Το μενού ΕΙΝΑΙ μέλος της συνεδρίας επεξεργασίας
 * Το {@link TABLE_CELL_SESSION_MARKER} απλώνεται στο περιεχόμενο **και** στον κρυφό trigger.
 * Χωρίς αυτό, το Radix θα έπαιρνε την εστίαση, ο φύλακας `useTableCellSessionBlur` θα έκλεινε
 * τον δρομέα ένα καρέ αργότερα, και **οι ζώνες θα εξαφανίζονταν τη στιγμή ακριβώς που τις
 * πατάς**. Ο ορισμός του σημαδιού το λέει ρητά: «απλώνεται σε **κάθε** εστιάσιμο στοιχείο της
 * συνεδρίας» — το μενού του πίνακα είναι ένα από αυτά.
 *
 * Ίδιο μοτίβο imperative handle με `EntityContextMenu` / `GuideContextMenu`: το άνοιγμα δεν
 * περνά από `useState` του γονέα, άρα δεν ξανα-αποδίδει ο `CanvasSection` (ADR-040).
 *
 * @see ui/table-cell-editor/use-table-header-menu.ts — ποιος το ανοίγει και τι κάνει κάθε item
 * @see ui/components/dxf-context-menu/DxfContextMenu.tsx — το SSoT της οπτικής γλώσσας
 */

import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Trash2 } from 'lucide-react';
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
import { TABLE_CELL_SESSION_MARKER } from '../table-cell-editor/table-cell-session-focus';
import type { TableIndicatorHit } from '../../bim/table/table-indicator-geometry';

/** Ένα item δέχεται πάντα **ποια** υποδιαίρεση πατήθηκε — ποτέ κρυφή κατάσταση. */
type TableHeaderAction = (hit: TableIndicatorHit) => void;

/** Ό,τι απαντιέται **τη στιγμή που ανοίγει** το μενού, όχι στο τελευταίο render. */
export interface TableHeaderMenuState {
  /** `A` / `3` — η ίδια ονομασία με τη ζώνη. */
  readonly label: string;
  readonly canInsert: boolean;
  readonly canDelete: boolean;
}

export interface TableHeaderMenuProps {
  readonly onInsertBefore: TableHeaderAction;
  readonly onInsertAfter: TableHeaderAction;
  readonly onDelete: TableHeaderAction;
  readonly resolveState: (hit: TableIndicatorHit) => TableHeaderMenuState;
  /** Το μενού έκλεισε — με ή χωρίς ενέργεια. Εδώ επιστρέφει η εστίαση στο κελί. */
  readonly onClosed: () => void;
}

export interface TableHeaderContextMenuHandle {
  open: (x: number, y: number, hit: TableIndicatorHit) => void;
  close: () => void;
}

/** Στόχος + κατάσταση, παγωμένα μαζί στο άνοιγμα: δεν μπορούν να αποκλίνουν μεταξύ τους. */
interface OpenTarget {
  readonly hit: TableIndicatorHit;
  readonly state: TableHeaderMenuState;
}

const TableHeaderContextMenuInner = forwardRef<TableHeaderContextMenuHandle, TableHeaderMenuProps>(
  ({ onInsertBefore, onInsertAfter, onDelete, resolveState, onClosed }, ref) => {
    const { t } = useTranslation('dxf-viewer');
    const triggerRef = useRef<HTMLSpanElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [target, setTarget] = useState<OpenTarget | null>(null);

    useImperativeHandle(ref, () => ({
      open: (x: number, y: number, hit: TableIndicatorHit) => {
        if (triggerRef.current) {
          triggerRef.current.style.left = `${x}px`;
          triggerRef.current.style.top = `${y}px`;
        }
        setTarget({ hit, state: resolveState(hit) });
        setIsOpen(true);
      },
      close: () => {
        setIsOpen(false);
        setTarget(null);
      },
    }), [resolveState]);

    const handleOpenChange = useCallback((open: boolean) => {
      setIsOpen(open);
      if (!open) {
        setTarget(null);
        onClosed();
      }
    }, [onClosed]);

    /**
     * Κάθε item εκτελεί με τον **πατημένο** στόχο και **δεν κλείνει μόνο του**: το κλείσιμο το
     * ζητά το ίδιο το Radix (`onSelect` ⇒ `onOpenChange(false)`), δηλαδή περνά από τον **έναν**
     * δρόμο του {@link handleOpenChange}. Δεύτερος δρόμος θα σήμαινε ότι μια έξοδος (κλικ σε
     * item) επιστρέφει την εστίαση στο κελί και μια άλλη (Esc / κλικ έξω) όχι.
     */
    const run = useCallback((action: TableHeaderAction) => {
      if (target) action(target.hit);
    }, [target]);

    if (!target) {
      // Κλειστό μενού χωρίς στόχο: ο trigger πρέπει να υπάρχει (το `open` τον τοποθετεί),
      // αλλά δεν υπάρχει τίποτα να δείξει — και κυρίως, καμία ετικέτα να μαντέψουμε.
      return (
        <DropdownMenu open={false} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger asChild>
            <DxfMenuHiddenTrigger ref={triggerRef} {...TABLE_CELL_SESSION_MARKER} />
          </DropdownMenuTrigger>
        </DropdownMenu>
      );
    }

    const isColumn = target.hit.axis === 'column';
    const { label, canInsert, canDelete } = target.state;

    return (
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <DxfMenuHiddenTrigger ref={triggerRef} {...TABLE_CELL_SESSION_MARKER} />
        </DropdownMenuTrigger>

        <DxfMenuContent {...TABLE_CELL_SESSION_MARKER}>
          <DxfMenuItem disabled>
            <DxfMenuLabel>
              {isColumn
                ? t('table.headerMenu.columnTitle', { label })
                : t('table.headerMenu.rowTitle', { label })}
            </DxfMenuLabel>
          </DxfMenuItem>
          <DxfMenuSeparator />

          <DxfMenuItem disabled={!canInsert} onClick={() => run(onInsertBefore)}>
            <DxfMenuIcon>{isColumn ? <ArrowLeft size={16} /> : <ArrowUp size={16} />}</DxfMenuIcon>
            <DxfMenuLabel>
              {isColumn ? t('table.headerMenu.insertColumnLeft') : t('table.headerMenu.insertRowAbove')}
            </DxfMenuLabel>
          </DxfMenuItem>

          <DxfMenuItem disabled={!canInsert} onClick={() => run(onInsertAfter)}>
            <DxfMenuIcon>{isColumn ? <ArrowRight size={16} /> : <ArrowDown size={16} />}</DxfMenuIcon>
            <DxfMenuLabel>
              {isColumn ? t('table.headerMenu.insertColumnRight') : t('table.headerMenu.insertRowBelow')}
            </DxfMenuLabel>
          </DxfMenuItem>

          <DxfMenuSeparator />

          <DxfMenuItem destructive disabled={!canDelete} onClick={() => run(onDelete)}>
            <DxfMenuIcon><Trash2 size={16} /></DxfMenuIcon>
            <DxfMenuLabel>
              {isColumn ? t('table.headerMenu.deleteColumn') : t('table.headerMenu.deleteRow')}
            </DxfMenuLabel>
          </DxfMenuItem>
        </DxfMenuContent>
      </DropdownMenu>
    );
  },
);

TableHeaderContextMenuInner.displayName = 'TableHeaderContextMenu';

export const TableHeaderContextMenu = React.memo(TableHeaderContextMenuInner);
