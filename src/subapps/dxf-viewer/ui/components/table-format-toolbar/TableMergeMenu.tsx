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

import React from 'react';
import { TableCellsMerge, TableCellsSplit } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { TABLE_CELL_SESSION_MARKER } from '../../table-cell-editor/table-cell-session-focus';
import { TABLE_CELL_PANEL_SURFACE } from '../../table-cell-editor/table-cell-keyboard-ownership';
import {
  TABLE_MERGE_COMMANDS,
  TABLE_MERGE_PRIMARY_COMMAND,
  type TableMergeCommandId,
  type TableMergeState,
} from '../../../bim/table/table-range-merge-ops';
import { ToolbarSplitButton } from './ToolbarSplitButton';
import { useToolbarPanel } from './use-toolbar-panel';
import { type RovingItemProps } from './use-roving-toolbar';
import styles from './TableMergeMenu.module.css';

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
  // Κύκλος ζωής πάνελ: κατάσταση, `aria-controls`, «εκτέλεσε → κλείσε → γύρνα την εστίαση»,
  // και το `Escape` που κλείνει **ένα** επίπεδο. Κοινός με τα άλλα δύο πτυσσόμενα (N.18).
  const panel = useToolbarPanel();

  // 🔑 Το toggle: πατημένο ⇒ ξήλωσε· ελεύθερο ⇒ η προεπιλογή του μητρώου. Η ταυτότητα της
  // προεπιλογής δεν γράφεται εδώ (`'mergeCenter'`) — έρχεται από το μητρώο, ώστε το κουμπί και
  // το πρώτο item του πάνελ να μη μπορούν ποτέ να πουν διαφορετικά πράγματα.
  const primary = state.merged ? 'unmerge' : TABLE_MERGE_PRIMARY_COMMAND;
  const primaryDisabled = isTableMergeCommandDisabled(primary, state);

  return (
    <span className={styles.anchor}>
      <ToolbarSplitButton
        rovingApply={rovingApply}
        rovingMenu={rovingMenu}
        mainLabel={t('table.merge.trigger')}
        menuLabel={t('table.merge.menuLabel')}
        // Δίτιμο **επειδή είναι** δίτιμο: «αυτή η περιοχή είναι συγχωνευμένη» έχει ακριβώς δύο
        // απαντήσεις, σε αντίθεση με τις τέσσερις εντολές του πάνελ (δες την κεφαλίδα).
        mainPressed={state.merged}
        mainDisabled={primaryDisabled}
        onMainClick={() => onApply(primary)}
        isOpen={panel.isOpen}
        panelId={panel.panelId}
        onToggleMenu={panel.toggle}
        triggerRef={panel.triggerRef}
      >
        {state.merged
          ? <TableCellsSplit size={15} aria-hidden="true" />
          : <TableCellsMerge size={15} aria-hidden="true" />}
      </ToolbarSplitButton>

      {panel.isOpen ? (
        <div
          id={panel.panelId}
          role="menu"
          aria-label={t('table.merge.menuLabel')}
          onKeyDown={panel.onPanelKeyDown}
          className={cn(
            styles.panel,
            'border border-border rounded-lg bg-popover text-popover-foreground shadow-md',
          )}
          // 🔴 ADR-753 §26.8 — σημάδι **και** φρουρός πατήματος, μία φορά για όλο το πάνελ.
          {...TABLE_CELL_PANEL_SURFACE}
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
                  //
                  // 🔴 §26.8 — **υπό όρο**: αν το πληκτρολόγιο το κρατούσε το κελί όταν άνοιξε
                  // το πάνελ, το `autoFocus` θα το έκλεβε — και μάλιστα χωρίς να περάσει ποτέ
                  // από `mousedown`, δηλαδή πίσω από την πλάτη του φρουρού.
                  autoFocus={index === 0 && panel.mayTakeKeyboard}
                  onClick={() => {
                    if (!disabled) panel.runAndClose(() => onApply(command.id));
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
