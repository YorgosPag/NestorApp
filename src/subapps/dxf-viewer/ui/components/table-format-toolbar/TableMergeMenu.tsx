'use client';

/**
 * ADR-755 — **η συγχώνευση κελιών στο mini toolbar**: split button με τις τέσσερις εντολές.
 *
 * ## 🔴 ΤΟ ΚΥΡΙΟ ΜΙΣΟ ΕΙΝΑΙ TOGGLE — εκεί ζει η «Κατάργηση συγχώνευσης»
 * Είναι η ακριβής συμπεριφορά του Excel, και δεν είναι διακοσμητική: στην κορδέλα το κουμπί
 * «Συγχώνευση και κεντράρισμα» δείχνει **πατημένο** όταν η επιλογή περιέχει συγχώνευση, και το
 * κλικ πάνω του **καταργεί**. Ο χρήστης δεν ανοίγει ποτέ μενού για να ξηλώσει κάτι που μόλις
 * έφτιαξε — η αντίστροφη πράξη κάθεται στο **ίδιο** πλήκτρο, όπως τα Β/Ι/Υ.
 *
 * Η ρητή «Κατάργηση συγχώνευσης κελιών» υπάρχει **επιπλέον**, στο πτυσσόμενο και στο δεξί κλικ:
 * το toggle απαντά «άλλαξε αυτό», η ρητή εντολή «κάνε ακριβώς αυτό». Το δεύτερο το χρειάζεται
 * όποιος διαλέγει περιοχή με **ανάμεικτο** περιεχόμενο (μερικά κελιά συγχωνευμένα, άλλα όχι),
 * όπου το «άλλαξε» δεν έχει ένα νόημα.
 *
 * ## Γιατί το πάνελ δείχνει και τις τέσσερις, ενώ το κουμπί κάνει μία
 * Οι τέσσερις **δεν** είναι καταστάσεις ενός πράγματος: «κατά γραμμές» δίνει N συγχωνεύσεις,
 * «κελιών» μία, «και κεντράρισμα» μία **συν** στοίχιση. Το ίδιο συμπέρασμα με τις 13 εντολές
 * περιγράμματος (Α21): είναι **εντολές που εφαρμόζουν**, όχι διακόπτες — γι' αυτό `role="menu"`
 * και όχι πλέγμα `aria-pressed`.
 *
 * ## Γιατί σκέτα `<button>` και πάνελ ΜΕΣΑ στο δοχείο
 * Ίδιοι δύο λόγοι με τα άλλα δύο πάνελ: το `DxfMenuItem` είναι Radix `menuitem` και δουλεύει
 * μόνο μέσα σε `Menu.Content`, και ένα δεύτερο portal θα μετρούσε ως «κλικ έξω» για τον φύλακα
 * {@link useKeepOpenOnSurface} — δηλαδή το `onClick` δεν θα έτρεχε ποτέ.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableMergeMenu
 * @see bim/table/table-range-merge-ops.ts — το μητρώο και οι καθαρές πράξεις
 * @see ui/components/TableRangeContextMenu.tsx — η δεύτερη υποδοχή των ΙΔΙΩΝ εντολών
 * @see docs/centralized-systems/reference/adrs/ADR-755-table-cell-merge.md
 */

import React, { useCallback, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, TableCellsMerge, TableCellsSplit } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { TABLE_CELL_SESSION_MARKER } from '../../table-cell-editor/table-cell-session-focus';
import {
  TABLE_MERGE_COMMANDS,
  TABLE_MERGE_PRIMARY_COMMAND,
  type TableMergeCommandId,
  type TableMergeState,
} from '../../../bim/table/table-range-merge-ops';
import { type RovingItemProps } from './use-roving-toolbar';
import styles from './TableMergeMenu.module.css';
import toolbar from './TableFormatToolbar.module.css';

export interface TableMergeMenuProps {
  /** Roving του **κύριου** μισού (toggle συγχώνευσης/κατάργησης). */
  readonly rovingApply: RovingItemProps;
  /** Roving του **βελακιού** (ανοίγει τις τέσσερις εντολές). */
  readonly rovingMenu: RovingItemProps;
  /** Τι ισχύει στην περιοχή — τροφοδοτεί και το `aria-pressed` και τα ανενεργά items. */
  readonly state: TableMergeState;
  readonly onApply: (commandId: TableMergeCommandId) => void;
}

/**
 * Ποια εντολή είναι **ανενεργή** σε αυτή την κατάσταση.
 *
 * Καθαρή συνάρτηση και όχι `if` μέσα στο JSX: η ίδια ερώτηση την κάνει και το μενού δεξιού
 * κλικ, και δύο αντίγραφα θα ήταν δύο ευκαιρίες να διαφωνήσουν για το ποιο item είναι γκρίζο.
 *
 * Ο κανόνας είναι συμμετρικός: η **κατάργηση** χρειάζεται υπάρχουσα συγχώνευση, οι **τρεις
 * συγχωνεύσεις** χρειάζονται ≥ 2 κελιά.
 */
export function isTableMergeCommandDisabled(
  commandId: TableMergeCommandId,
  state: TableMergeState,
): boolean {
  return commandId === 'unmerge' ? !state.merged : !state.canMerge;
}

export function TableMergeMenu(props: TableMergeMenuProps): React.ReactElement {
  const { rovingApply, rovingMenu, state, onApply } = props;
  const { t } = useTranslation('dxf-viewer');
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  /**
   * Κάθε εντολή **κλείνει** το πάνελ — η ίδια απόφαση του ιδιοκτήτη που έκανε το μενού ζωνών να
   * κλείνει στο πρώτο πάτημα (Excel parity). Η εστίαση γυρίζει στον trigger, αλλιώς ο χρήστης
   * πληκτρολογίου μένει σε στοιχείο που μόλις ξεμόνταρε.
   */
  const runAndClose = useCallback((commandId: TableMergeCommandId) => {
    onApply(commandId);
    setIsOpen(false);
    triggerRef.current?.focus();
  }, [onApply]);

  // Το `Escape` κλείνει **το πάνελ**, όχι όλη τη γραμμή: ένα `Escape` = ένα επίπεδο.
  const onPanelKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  // 🔑 Το toggle: πατημένο ⇒ ξήλωσε· ελεύθερο ⇒ η προεπιλογή του μητρώου. Η ταυτότητα της
  // προεπιλογής δεν γράφεται εδώ (`'mergeCenter'`) — έρχεται από το μητρώο, ώστε το κουμπί και
  // το πρώτο item του πάνελ να μη μπορούν ποτέ να πουν διαφορετικά πράγματα.
  const primary = state.merged ? 'unmerge' : TABLE_MERGE_PRIMARY_COMMAND;
  const primaryDisabled = isTableMergeCommandDisabled(primary, state);

  return (
    <span className={styles.anchor}>
      <span className={styles.split}>
        <button
          type="button"
          ref={rovingApply.ref}
          tabIndex={rovingApply.tabIndex}
          onKeyDown={rovingApply.onKeyDown}
          onFocus={rovingApply.onFocus}
          className={cn(toolbar.button, styles.mainButton, state.merged && toolbar.buttonActive)}
          aria-label={t('table.merge.trigger')}
          // Δίτιμο **επειδή είναι** δίτιμο: «αυτή η περιοχή είναι συγχωνευμένη» έχει ακριβώς δύο
          // απαντήσεις, σε αντίθεση με τις τέσσερις εντολές του πάνελ (δες την κεφαλίδα).
          aria-pressed={state.merged}
          aria-disabled={primaryDisabled || undefined}
          onClick={() => {
            if (!primaryDisabled) onApply(primary);
          }}
          {...TABLE_CELL_SESSION_MARKER}
        >
          {state.merged
            ? <TableCellsSplit size={15} aria-hidden="true" />
            : <TableCellsMerge size={15} aria-hidden="true" />}
        </button>

        <button
          type="button"
          ref={(node) => {
            triggerRef.current = node;
            rovingMenu.ref(node);
          }}
          tabIndex={rovingMenu.tabIndex}
          onKeyDown={rovingMenu.onKeyDown}
          onFocus={rovingMenu.onFocus}
          className={cn(toolbar.button, styles.arrowButton, isOpen && toolbar.buttonActive)}
          aria-label={t('table.merge.menuLabel')}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          onClick={() => setIsOpen((open) => !open)}
          {...TABLE_CELL_SESSION_MARKER}
        >
          <ChevronDown size={12} aria-hidden="true" />
        </button>
      </span>

      {isOpen ? (
        <div
          id={panelId}
          role="menu"
          aria-label={t('table.merge.menuLabel')}
          onKeyDown={onPanelKeyDown}
          className={cn(
            styles.panel,
            'border border-border rounded-lg bg-popover text-popover-foreground shadow-md',
          )}
          {...TABLE_CELL_SESSION_MARKER}
        >
          {TABLE_MERGE_COMMANDS.map((command, index) => {
            const disabled = isTableMergeCommandDisabled(command.id, state);
            return (
              <React.Fragment key={command.id}>
                {/* Η κατάργηση είναι η αντίστροφη πράξη, όχι η τέταρτη συγχώνευση. */}
                {command.id === 'unmerge'
                  ? <span className={styles.separator} role="separator" />
                  : null}
                <button
                  type="button"
                  role="menuitem"
                  className={styles.item}
                  aria-disabled={disabled || undefined}
                  // Ο πρώτος εστιάζεται με το άνοιγμα· τα υπόλοιπα μέσω των βελών του browser
                  // στο `role="menu"` — δεν στήνεται δεύτερο roving μέσα σε τέσσερα items.
                  autoFocus={index === 0}
                  onClick={() => {
                    if (!disabled) runAndClose(command.id);
                  }}
                  {...TABLE_CELL_SESSION_MARKER}
                >
                  <span className={styles.itemIcon}>
                    {command.joins
                      ? <TableCellsMerge size={15} aria-hidden="true" />
                      : <TableCellsSplit size={15} aria-hidden="true" />}
                  </span>
                  {t(`table.merge.commands.${command.id}`)}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      ) : null}
    </span>
  );
}
