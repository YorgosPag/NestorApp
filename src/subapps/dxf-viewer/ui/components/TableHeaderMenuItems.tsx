'use client';

/**
 * ADR-739 Φ.Δ βήμα 9 — **τα δομικά items** του μενού ζωνών δείκτη: εισαγωγή πριν / μετά και
 * διαγραφή, με ρητή κατεύθυνση.
 *
 * ## Ρητή κατεύθυνση, όχι σκέτο «Εισαγωγή»
 * Το Excel δείχνει ένα item και εισάγει **πάντα πριν** — κανόνας που ο χρήστης μαθαίνει με
 * δοκιμή και undo. Το AutoCAD (μενού κελιού πίνακα) και τα Google Sheets δείχνουν και τις δύο
 * κατευθύνσεις. Εδώ ακολουθούμε τα δεύτερα: ο πίνακας είναι **σχέδιο**, και μια εισαγωγή στη
 * λάθος μεριά μετακινεί γεωμετρία που ο μηχανικός μόλις τακτοποίησε.
 *
 * ## Ένα σώμα, δύο άξονες
 * Τα items είναι **τρία** και ο άξονας του χτυπήματος αποφασίζει μόνο τι **λένε** και τι
 * εικονίδιο έχουν. Δύο ξεχωριστά μπλοκ JSX θα ήταν sibling clone (N.18) και, χειρότερα, δύο
 * σημεία που μπορούν κάποτε να αποκτήσουν διαφορετική συμπεριφορά για την ίδια ακριβώς πράξη.
 *
 * ## Γιατί ξεχωριστό αρχείο
 * Ζούσαν μέσα στο `TableHeaderContextMenu.tsx`, που είχε φτάσει τις **498/500** γραμμές
 * (N.7.1). **Εξαγωγή, ποτέ trim.** Το κριτήριο της τομής δεν ήταν το μέγεθος αλλά η
 * **ανεξαρτησία**: αυτά τα τρία items είναι καθαρή απόδοση από `state` + τρεις χειριστές, δεν
 * αγγίζουν ούτε την εστίαση, ούτε τον escape-bus, ούτε τον φύλακα «κλικ έξω» — δηλαδή τίποτα
 * από τη μηχανική που κάνει το γονικό αρχείο δύσκολο.
 *
 * @module subapps/dxf-viewer/ui/components/TableHeaderMenuItems
 * @see ui/components/TableHeaderContextMenu.tsx — ποιος τα ανοίγει και ποιος κλείνει το μενού
 * @see ui/components/dxf-context-menu/DxfContextMenu.tsx — το SSoT της οπτικής γλώσσας
 */

import React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Trash2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  DxfMenuIcon,
  DxfMenuItem,
  DxfMenuLabel,
  DxfMenuSeparator,
} from './dxf-context-menu/DxfContextMenu';

/** Ό,τι απαντιέται **τη στιγμή που ανοίγει** το μενού, όχι στο τελευταίο render. */
export interface TableHeaderMenuState {
  /** `A` / `3` — η ίδια ονομασία με τη ζώνη. */
  readonly label: string;
  readonly canInsert: boolean;
  readonly canDelete: boolean;
}

export interface TableHeaderMenuItemsProps {
  readonly isColumn: boolean;
  readonly state: TableHeaderMenuState;
  readonly onInsertBefore: () => void;
  readonly onInsertAfter: () => void;
  readonly onDelete: () => void;
}

/**
 * Τα items **δεν κλείνουν μόνα τους**: το κλείσιμο το ζητά το ίδιο το Radix (`onSelect` ⇒
 * `onOpenChange(false)`), δηλαδή περνά από τον **έναν** δρόμο του γονέα. Δεύτερος δρόμος θα
 * σήμαινε ότι μια έξοδος (κλικ σε item) επιστρέφει την εστίαση στο κελί και μια άλλη
 * (Esc / κλικ έξω) όχι.
 */
export function TableHeaderMenuItems({
  isColumn, state, onInsertBefore, onInsertAfter, onDelete,
}: TableHeaderMenuItemsProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');
  const { label, canInsert, canDelete } = state;

  return (
    <>
      <DxfMenuItem disabled>
        <DxfMenuLabel>
          {isColumn
            ? t('table.headerMenu.columnTitle', { label })
            : t('table.headerMenu.rowTitle', { label })}
        </DxfMenuLabel>
      </DxfMenuItem>
      <DxfMenuSeparator />

      <DxfMenuItem disabled={!canInsert} onClick={onInsertBefore}>
        <DxfMenuIcon>{isColumn ? <ArrowLeft size={16} /> : <ArrowUp size={16} />}</DxfMenuIcon>
        <DxfMenuLabel>
          {isColumn ? t('table.headerMenu.insertColumnLeft') : t('table.headerMenu.insertRowAbove')}
        </DxfMenuLabel>
      </DxfMenuItem>

      <DxfMenuItem disabled={!canInsert} onClick={onInsertAfter}>
        <DxfMenuIcon>{isColumn ? <ArrowRight size={16} /> : <ArrowDown size={16} />}</DxfMenuIcon>
        <DxfMenuLabel>
          {isColumn ? t('table.headerMenu.insertColumnRight') : t('table.headerMenu.insertRowBelow')}
        </DxfMenuLabel>
      </DxfMenuItem>

      <DxfMenuSeparator />

      <DxfMenuItem destructive disabled={!canDelete} onClick={onDelete}>
        <DxfMenuIcon><Trash2 size={16} /></DxfMenuIcon>
        <DxfMenuLabel>
          {isColumn ? t('table.headerMenu.deleteColumn') : t('table.headerMenu.deleteRow')}
        </DxfMenuLabel>
      </DxfMenuItem>
    </>
  );
}
