'use client';

/**
 * 🔴 ADR-751 Φ8.β — **το δεξί κλικ πάνω σε σύνδεσμο κελιού.**
 *
 * ## 🔑 Γιατί ΔΥΟ εντολές και όχι οι τέσσερις του Excel (η έρευνα, 2026-08-04)
 * Το Excel δείχνει *Open · Edit · Copy · Remove Hyperlink*, και τα Google Sheets *Edit link ·
 * Remove link · Copy link*. Και τα δύο μπορούν, γιατί ο υπερσύνδεσμος εκεί είναι
 * **αποθηκευμένη ιδιότητα του κελιού**: υπάρχει αντικείμενο να επεξεργαστείς και να σβήσεις.
 *
 * Ο δικός μας σύνδεσμος **παράγεται από το κείμενο**. Δεν υπάρχει τι να επεξεργαστείς — το
 * κείμενο *είναι* ο σύνδεσμος — και «αφαίρεση» θα σήμαινε να χαλάσει ο χρήστης το e-mail του
 * για να πάψει να είναι μπλε. Το σωστό προηγούμενο δεν είναι το Excel αλλά το **VS Code**:
 * ίδια σημασιολογία (εντοπισμένος, όχι αποθηκευμένος), ίδια χειρονομία (Ctrl+κλικ), ίδια
 * ένδειξη (υπογράμμιση στο hover) — και προσφέρει **μόνο άνοιγμα**.
 *
 * Αντιγράφοντας τις τέσσερις εντολές θα κάναμε ακριβώς το λάθος Υ-5 που κατέγραψε το ADR-748:
 * **αντιγραφή ταξινόμησης χωρίς σημασιολογία**.
 *
 * ## Γιατί η ετικέτα λέει «Αποστολή e-mail» και όχι «Άνοιγμα υπερσυνδέσμου»
 * Ίδιος κανόνας με το tooltip (§12.2): λέμε **τι θα συμβεί**. Το «Open Hyperlink» του Excel
 * είναι σωστό και άχρηστο ταυτόχρονα — ο χρήστης ξέρει ότι είναι σύνδεσμος, δεν ξέρει αν θα
 * ανοίξει πρόγραμμα αλληλογραφίας, φυλλομετρητής ή τηλεφωνητής. Η γνώση έρχεται από το
 * {@link LINK_ACTION_KEY}, το **ίδιο** SSoT με το tooltip και τη λίστα.
 *
 * @module subapps/dxf-viewer/ui/components/TableCellLinkContextMenu
 * @see ui/table-cell-editor/use-table-link-menu.ts — ποιος το ανοίγει και με ποιον στόχο
 * @see bim/table/table-link-labels.ts — η κοινή γνώση των ετικετών
 */

import { forwardRef } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TextLinkKind } from '@/lib/validation/text-link-segments';
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
import { LINK_ACTION_KEY, LINK_COPY_KEY } from '../../bim/table/table-link-labels';

/**
 * Ο σύνδεσμος, **παγωμένος στο άνοιγμα**.
 *
 * Το `href` ταξιδεύει μαζί με το `kind` και το `text` για τον ίδιο λόγο που το
 * `TableRangeMenuTarget` κουβαλά όρια **και** ετικέτα: τα τρία περιγράφουν το ίδιο πράγμα και
 * δεν επιτρέπεται να αποκλίνουν αν ο δείκτης φύγει όσο το μενού είναι ανοιχτό.
 */
export interface TableLinkMenuTarget {
  readonly kind: TextLinkKind;
  readonly href: string;
  /** Το κείμενο όπως το έγραψε ο χρήστης — ποτέ το `href` (§12.2). */
  readonly text: string;
}

export interface TableLinkMenuProps {
  readonly onOpen: (target: TableLinkMenuTarget) => void;
  readonly onCopy: (target: TableLinkMenuTarget) => void;
}

export interface TableCellLinkContextMenuHandle {
  open: (x: number, y: number, target: TableLinkMenuTarget) => void;
  close: () => void;
}

const TableCellLinkContextMenuInner = forwardRef<
  TableCellLinkContextMenuHandle,
  TableLinkMenuProps
>(({ onOpen, onCopy }, ref) => {
  const { t } = useTranslation('dxf-viewer');

  /**
   * Ο κύκλος ζωής (τέσσερις καταστάσεις + τοποθέτηση + ΕΝΑΣ δρόμος εξόδου) είναι **κοινός**
   * με το μενού περιγραμμάτων και ζει σε ένα σημείο — το CHECK 3.28 τον χαρακτήρισε δίδυμο
   * 32 γραμμών μόλις γεννήθηκε αυτό εδώ.
   *
   * ⚠️ Χωρίς `onClosed`, και **δεν είναι παράλειψη**: το μενού περιγραμμάτων ζει μέσα σε
   * συνεδρία επεξεργασίας και πρέπει να την ξαναζωντανέψει. Ο σύνδεσμος είναι χαρακτηριστικό
   * **απλής προβολής** (Α4) — δεν υπάρχει συνεδρία να επιστρέψει.
   */
  const { triggerRef, isOpen, target, onOpenChange } =
    useAnchoredContextMenu<TableLinkMenuTarget>(ref);

  return (
    <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <DxfMenuHiddenTrigger ref={triggerRef} />
      </DropdownMenuTrigger>

      {target ? (
        <DxfMenuContent>
          {/* Ο τίτλος δείχνει τον προορισμό όπως τον έγραψε ο χρήστης: το `tel:2310788493`
              δεν λέει τίποτα σε κανέναν, ενώ το «2310-788493» είναι αυτό που βλέπει. */}
          <DxfMenuItem disabled>
            <DxfMenuLabel>{target.text}</DxfMenuLabel>
          </DxfMenuItem>
          <DxfMenuSeparator />

          <DxfMenuItem onSelect={() => onOpen(target)}>
            <DxfMenuIcon><ExternalLink size={15} aria-hidden="true" /></DxfMenuIcon>
            <DxfMenuLabel>{t(LINK_ACTION_KEY[target.kind])}</DxfMenuLabel>
          </DxfMenuItem>

          <DxfMenuItem onSelect={() => onCopy(target)}>
            <DxfMenuIcon><Copy size={15} aria-hidden="true" /></DxfMenuIcon>
            <DxfMenuLabel>{t(LINK_COPY_KEY[target.kind])}</DxfMenuLabel>
          </DxfMenuItem>
        </DxfMenuContent>
      ) : null}
    </DropdownMenu>
  );
});

TableCellLinkContextMenuInner.displayName = 'TableCellLinkContextMenu';

export const TableCellLinkContextMenu = TableCellLinkContextMenuInner;
