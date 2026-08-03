'use client';

/**
 * ADR-750 Φάση 3 — **το dropdown περιγραμμάτων του mini toolbar**.
 *
 * Ένα κουμπί που ξεδιπλώνει τη λίστα των εντολών του Excel, με τα διαχωριστικά της, τα
 * παραγόμενα εικονίδια ({@link TableBorderIcon}) και την «Επαναφορά περιγραμμάτων» στο τέλος.
 *
 * ## 🔴 Γιατί `role="menu"` και όχι `role="toolbar"` (απόφαση Α21)
 * Το ADR §9.2 αποκλείει το `role="menu"` — αλλά για **άλλο** χειριστήριο: το proxy preview της
 * Φ6, όπου ο χρήστης εναλλάσσει την **κατάσταση** κάθε πλευράς σε οπτικό πλέγμα. Εκεί το APG
 * όντως απαιτεί toggle buttons με `aria-pressed`.
 *
 * Εδώ τα 13 δεν είναι καταστάσεις: είναι **εντολές που εφαρμόζουν** μια διαμόρφωση και
 * κλείνουν. Δεν έχουν πατημένη/ελεύθερη μορφή — «Κάτω περίγραμμα» δεν είναι κάτι που *είσαι*,
 * είναι κάτι που *κάνεις*. Το `aria-pressed` σε εντολή χωρίς κατάσταση θα ανακοίνωνε μονίμως
 * «μη πατημένο», δηλαδή θα έλεγε ψέματα σε κάθε ανάγνωση. (Η **τρέχουσα κατάσταση** ακμής είναι
 * η ορατή προέλευση της Φ7 §10.2 — τότε το πάνελ θα αποκτήσει και δεύτερη ανάγνωση.)
 *
 * ## Γιατί σκέτο `<button>` και όχι `DxfMenuItem`
 * Ο ίδιος λόγος με τη γραμμή που το φιλοξενεί: το `DxfMenuItem` είναι Radix `menuitem` και
 * δουλεύει μόνο μέσα στο δέντρο ενός `Menu.Content`. Αυτό εδώ ζει μέσα στο portal του toolbar.
 * Η **δεύτερη** υποδοχή των ίδιων εντολών (δεξί κλικ σε επιλογή κελιών, Φ4) είναι πραγματικό
 * Radix μενού και εκεί χρησιμοποιεί `DxfMenuItem` — η γνώση μοιράζεται μέσω του
 * {@link tableBorderMenuItems}, ποτέ το JSX.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableBorderMenu
 * @see ui/components/table-format-toolbar/table-border-menu-items.ts — η κοινή γνώση
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §9.2 · §18 (Α19/Α21)
 */

import React, { useCallback, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Grid2x2, RotateCcw } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { TABLE_CELL_SESSION_MARKER } from '../../table-cell-editor/table-cell-session-focus';
import type { TableBorderCommandId } from '../../../bim/table/table-range-border-ops';
import {
  TABLE_DIAGONAL_COMMANDS,
  type TableDiagonalCommandId,
} from '../../../bim/table/table-cell-diagonal-ops';
import type { TableBorderSpec } from '../../../types/table-edges';
import { TableBorderIcon } from './TableBorderIcon';
import { TableDiagonalIcon } from './TableDiagonalIcon';
import {
  TABLE_PENCIL_ROW_COUNT,
  TableBorderPencilPanel,
} from './TableBorderPencilPanel';
import { tableBorderMenuItems } from './table-border-menu-items';
import { useRovingToolbar, type RovingItemProps } from './use-roving-toolbar';
import panel from './TableBorderMenu.module.css';
import toolbar from './TableFormatToolbar.module.css';

export interface TableBorderMenuProps {
  /** Τα props roving του **trigger**, ως μέλους της γραμμής εργαλείων που το φιλοξενεί. */
  readonly roving: RovingItemProps;
  readonly onApply: (commandId: TableBorderCommandId) => void;
  readonly onReset: () => void;
  /** Υπάρχει ρητή ακμή να διαγραφεί; Αλλιώς η «Επαναφορά περιγραμμάτων» δεν έχει τι να κάνει. */
  readonly canReset: boolean;
  /** ADR-750 Φ5 (Α2) — οι διαγώνιοι· άλλο μητρώο, άλλο μοντέλο, ίδιο μολύβι. */
  readonly onApplyDiagonal: (commandId: TableDiagonalCommandId) => void;
  /** Υπάρχει διαγώνιος να σβηστεί; Αλλιώς η «Χωρίς διαγώνιες» δεν έχει τι να κάνει. */
  readonly canClearDiagonals: boolean;
  /** ADR-750 Φ5 (Α23) — το μολύβι που θα εφαρμοστεί, για τη ζώνη σχεδίασης. */
  readonly resolvePencil: () => TableBorderSpec | null;
}

export function TableBorderMenu(props: TableBorderMenuProps): React.ReactElement {
  const {
    roving, onApply, onReset, canReset, onApplyDiagonal, canClearDiagonals, resolvePencil,
  } = props;
  const { t } = useTranslation('dxf-viewer');
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();
  const items = tableBorderMenuItems();

  /**
   * 🔴 Οι θέσεις roving **παράγονται με τη σειρά εμφάνισης**, ποτέ γραμμένες ως σταθερές.
   *
   * Η ίδια απόφαση που ο ιδιοκτήτης της γραμμής εργαλείων πήρε ένα επίπεδο πιο πάνω, και για
   * τον ίδιο λόγο: κάθε νέα ομάδα στη μέση μετακινεί όλες τις επόμενες. Εδώ το πλήρωσε ήδη η
   * Φ5 δύο φορές — οι εντολές πέρασαν από 11 σε **13** και μπήκαν άλλες 4 + 4 γραμμές.
   */
  const resetIndex = items.length;
  const diagonalBase = resetIndex + 1;
  const pencilBase = diagonalBase + TABLE_DIAGONAL_COMMANDS.length;
  const roving2 = useRovingToolbar(pencilBase + TABLE_PENCIL_ROW_COUNT, 'vertical');

  /**
   * Κάθε εντολή **κλείνει** το πάνελ — η ίδια απόφαση του ιδιοκτήτη που έκανε το μενού ζωνών να
   * κλείνει στο πρώτο πάτημα (Excel parity). Η εστίαση γυρίζει στον trigger, αλλιώς ο χρήστης
   * πληκτρολογίου μένει σε στοιχείο που μόλις ξεμόνταρε.
   */
  const runAndClose = useCallback((action: () => void) => {
    action();
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Το `Escape` κλείνει **το πάνελ**, όχι όλη τη γραμμή: `stopPropagation` ώστε ο γονέας να μη
  // δει το πλήκτρο και κλείσει μαζί και το μενού από κάτω. Ένα `Escape` = ένα επίπεδο.
  const onPanelKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  return (
    <span className={panel.anchor}>
      <button
        type="button"
        ref={(node) => {
          triggerRef.current = node;
          roving.ref(node);
        }}
        tabIndex={roving.tabIndex}
        onKeyDown={roving.onKeyDown}
        onFocus={roving.onFocus}
        className={cn(toolbar.button, isOpen && toolbar.buttonActive)}
        aria-label={t('table.borders.trigger')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onClick={() => setIsOpen((open) => !open)}
        {...TABLE_CELL_SESSION_MARKER}
      >
        <Grid2x2 size={15} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          id={panelId}
          role="menu"
          aria-label={t('table.borders.menuLabel')}
          onKeyDown={onPanelKeyDown}
          className={cn(
            panel.panel,
            'border border-border rounded-lg bg-popover text-popover-foreground shadow-md',
          )}
          {...TABLE_CELL_SESSION_MARKER}
        >
          {items.map(({ command, labelKey, startsGroup }, index) => (
            <React.Fragment key={command.id}>
              {startsGroup ? <span className={panel.separator} role="separator" /> : null}
              <MenuItem
                roving={roving2.itemProps(index)}
                label={t(labelKey)}
                icon={<TableBorderIcon command={command} />}
                onActivate={() => runAndClose(() => onApply(command.id))}
              />
            </React.Fragment>
          ))}

          <span className={panel.separator} role="separator" />
          <MenuItem
            roving={roving2.itemProps(resetIndex)}
            label={t('table.borders.resetBorders')}
            icon={<RotateCcw size={15} aria-hidden="true" />}
            disabled={!canReset}
            onActivate={() => runAndClose(onReset)}
          />

          {/*
            ADR-750 Φ5 (Α2) — οι **διαγώνιοι** σε δική τους ομάδα, με δικό της τίτλο.
            Δεν ανακατεύονται με τις 13: εκείνες μιλούν για ακμές που **μοιράζονται** με τον
            γείτονα, αυτές για γραμμές που ανήκουν σε **ένα** κελί (§6.3). Ο τίτλος υπάρχει
            γιατί ένα σκέτο διαχωριστικό θα έλεγε «άλλη ομάδα» χωρίς να πει **ποια**.
          */}
          <span className={panel.separator} role="separator" />
          <h4 className={panel.sectionLabel}>{t('table.borders.diagonals.section')}</h4>
          {TABLE_DIAGONAL_COMMANDS.map((command, index) => (
            <MenuItem
              key={command.id}
              roving={roving2.itemProps(diagonalBase + index)}
              label={t(`table.borders.diagonals.${command.id}`)}
              icon={<TableDiagonalIcon command={command} />}
              // Μόνο η αφαίρεση μπορεί να μην έχει τι να κάνει· οι τρεις άλλες γράφουν πάντα.
              disabled={command.id === 'clear' && !canClearDiagonals}
              onActivate={() => runAndClose(() => onApplyDiagonal(command.id))}
            />
          ))}

          <span className={panel.separator} role="separator" />
          <TableBorderPencilPanel
            rovingOf={(index) => roving2.itemProps(pencilBase + index)}
            resolvePencil={resolvePencil}
          />
        </div>
      ) : null}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

interface MenuItemProps {
  readonly roving: RovingItemProps;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly disabled?: boolean;
  readonly onActivate: () => void;
}

/**
 * Ένα στοιχείο της λίστας: εικονίδιο + **ορατό** κείμενο.
 *
 * Το ορατό κείμενο δεν είναι πολυτέλεια χώρου — είναι ο λόγος που αυτό το πάνελ δεν χρειάζεται
 * tooltip καθόλου: το όνομα της εντολής είναι το ίδιο το περιεχόμενο του κουμπιού, άρα υπάρχει
 * και για τον αναγνώστη οθόνης και για όποιον δεν αναγνωρίζει το εικονίδιο. Το εικονίδιο μένει
 * `aria-hidden` (θα διαβαζόταν δεύτερη φορά το ίδιο πράγμα).
 *
 * Το ανενεργό μένει **εστιάσιμο** με `aria-disabled`, όπως κάθε κουμπί της γραμμής: ο δείκτης
 * του roving δεν επιτρέπεται να πέσει σε τρύπα.
 */
function MenuItem({ roving, label, icon, disabled, onActivate }: MenuItemProps): React.ReactElement {
  return (
    <button
      type="button"
      role="menuitem"
      ref={roving.ref}
      tabIndex={roving.tabIndex}
      onKeyDown={roving.onKeyDown}
      onFocus={roving.onFocus}
      className={panel.item}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onActivate();
      }}
      {...TABLE_CELL_SESSION_MARKER}
    >
      <span className={panel.itemIcon}>{icon}</span>
      {label}
    </button>
  );
}
