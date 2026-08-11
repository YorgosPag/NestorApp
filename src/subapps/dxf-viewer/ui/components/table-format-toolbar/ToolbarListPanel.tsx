'use client';

/**
 * 🔴 ADR-739 §55 — **το πτυσσόμενο πάνελ με λίστα επιλογών**, μία φορά για τα τρία νέα
 * χειριστήρια (γραμματοσειρά · μέγεθος · στοίχιση).
 *
 * ## Γιατί υπάρχει
 * Η γεωμετρία των πάνελ ζει ήδη κεντρικά (`table-toolbar-panel.module.css`), αλλά το **markup**
 * όχι: το `TableMergeMenu` και το `TableAxisColorMenu` γράφουν το καθένα το δικό του
 * `<div role="menu" …>` με τις ίδιες πέντε αποφάσεις μέσα (id, ρόλος, `aria-label`, το
 * `Escape` που κλείνει ένα επίπεδο, το σημάδι συνεδρίας). Δύο αντίγραφα ήταν ανεκτά· με τα
 * **τρία** νέα του §55 θα γίνονταν πέντε — δηλαδή πέντε ευκαιρίες να ξεχάσει κάποιο το
 * {@link TABLE_CELL_SESSION_MARKER} και να σκοτώσει τον δρομέα του κελιού με το πρώτο κλικ.
 *
 * ⚠️ Τα δύο **παλιά** πάνελ δεν μεταφέρθηκαν εδώ σε αυτή τη δουλειά: δουλεύουν, και η
 * μετακίνησή τους θα ανακάτευε τη διάταξη (το ζητούμενο) με ένα refactor που κανείς δεν ζήτησε.
 * Είναι γραμμένο ρητά ως χρέος, όπως ακριβώς το είχε γράψει και το `TableAxisColorMenu.module
 * .css` πριν εξαχθεί το κοινό CSS.
 *
 * ## 🔴 Γιατί το σημάδι της συνεδρίας ταξιδεύει και στο ΚΑΘΕ item
 * Ο φύλακας `useTableCellSessionBlur` ρωτά `isTableCellSessionElement` πάνω στο **ίδιο** το
 * στοιχείο που παίρνει την εστίαση, χωρίς `closest()`. Το σημάδι στο δοχείο δεν αρκεί: η πρώτη
 * εστίαση σε γραμμή της λίστας θα σκότωνε τη συνεδρία του κελιού ένα καρέ αργότερα.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/ToolbarListPanel
 * @see ui/components/table-format-toolbar/use-toolbar-panel.ts — ο κύκλος ζωής του πάνελ
 */

import React, { type KeyboardEvent } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TABLE_CELL_SESSION_MARKER } from '../../table-cell-editor/table-cell-session-focus';
import { TABLE_CELL_PANEL_SURFACE } from '../../table-cell-editor/table-cell-keyboard-ownership';
import type { RovingItemProps } from './use-roving-toolbar';
import styles from './table-toolbar-panel.module.css';

export interface ToolbarListPanelProps {
  readonly panelId: string;
  /** Το προσβάσιμο όνομα της λίστας — ήδη μεταφρασμένο από τον καλούντα. */
  readonly label: string;
  /**
   * `listbox` για **τιμές** (γραμματοσειρά, μέγεθος) · `menu` για **εντολές** (στοίχιση).
   *
   * Δεν είναι γούστο: ο αναγνώστης οθόνης ανακοινώνει «λίστα, 12 στοιχεία, επιλεγμένο το 3ο»
   * στο πρώτο και «μενού» στο δεύτερο — και τα δύο είναι αλήθεια μόνο για το δικό τους.
   */
  readonly role: 'listbox' | 'menu';
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  /** Τοπικές διαφορές γεωμετρίας (πλάτος λίστας γραμματοσειρών κ.λπ.). */
  readonly className?: string;
  readonly children: React.ReactNode;
}

export function ToolbarListPanel(props: ToolbarListPanelProps): React.ReactElement {
  const { panelId, label, role, onKeyDown, className, children } = props;

  return (
    <div
      id={panelId}
      role={role}
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        styles.panel,
        // Χρώμα/περίγραμμα/σκιά από τις ΙΔΙΕΣ utility classes με το `DropdownMenuContent`, ώστε
        // οι επιφάνειες να ακολουθούν μαζί το θέμα — ποτέ αντιγραμμένες τιμές.
        'border border-border rounded-lg bg-popover text-popover-foreground shadow-md',
        className,
      )}
      // 🔴 ADR-753 §26.8 — **ΕΠΙΦΑΝΕΙΑ**, όχι σκέτο σημάδι: το σημάδι ταυτότητας μαζί με τον
      // φρουρό «το πάτημα του ποντικιού δεν μετακινεί το πληκτρολόγιο», μία φορά για **όλα** τα
      // στοιχεία μέσα (το `mousedown` αναδύεται). Τα ίδια τα στοιχεία κρατούν σκέτο το σημάδι.
      {...TABLE_CELL_PANEL_SURFACE}
    >
      {children}
    </div>
  );
}

export interface ToolbarListItemProps {
  /** `option` μέσα σε `listbox` · `menuitemradio` μέσα σε `menu` — ποτέ ασύμφωνα με το πάνελ. */
  readonly role: 'option' | 'menuitemradio';
  /** Το ορατό κείμενο **και** το προσβάσιμο όνομα. */
  readonly label: string;
  readonly selected: boolean;
  readonly disabled?: boolean;
  /** Ο πρώτος της λίστας παίρνει την εστίαση με το άνοιγμα (δες {@link ToolbarListPanel}). */
  readonly autoFocus?: boolean;
  /** Εικονίδιο πριν το κείμενο· απόν ⇒ τη θέση την παίρνει το τσεκάρισμα. */
  readonly icon?: React.ReactNode;
  /** Στυλ του **ίδιου του κειμένου** (η προεπισκόπηση γραμματοσειράς). */
  readonly labelClassName?: string;
  /**
   * Η θέση του στο **κατακόρυφο** roving του πάνελ — ίδιο μοτίβο με το `TableBorderMenu`.
   *
   * Απόν ⇒ φυσιολογική σειρά `Tab`. Σε λίστα δεκαπέντε γραμματοσειρών αυτό σημαίνει δεκαπέντε
   * στάσεις, γι' αυτό κάθε λίστα του §55 στήνει δικό της κατακόρυφο roving: ένα `Tab` για τη
   * λίστα, τα βέλη μέσα της (WAI-ARIA APG).
   */
  readonly roving?: RovingItemProps;
  readonly onSelect: () => void;
}

export function ToolbarListItem(props: ToolbarListItemProps): React.ReactElement {
  const { role, label, selected, disabled, autoFocus, icon, labelClassName, roving, onSelect } = props;

  return (
    <button
      type="button"
      role={role}
      ref={roving?.ref}
      tabIndex={roving?.tabIndex}
      onKeyDown={roving?.onKeyDown}
      onFocus={roving?.onFocus}
      className={styles.item}
      // Οι δύο ρόλοι δηλώνουν την επιλογή με **διαφορετικό** γνώρισμα· δοσμένα και τα δύο, ο
      // αναγνώστης οθόνης ακούει την ίδια πληροφορία δύο φορές (ή, χειρότερα, αντιφατικά).
      aria-selected={role === 'option' ? selected : undefined}
      aria-checked={role === 'menuitemradio' ? selected : undefined}
      aria-disabled={disabled || undefined}
      autoFocus={autoFocus}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      {...TABLE_CELL_SESSION_MARKER}
    >
      <span className={styles.itemIcon}>
        {icon ?? (selected ? <Check size={14} aria-hidden="true" /> : null)}
      </span>
      <span className={labelClassName}>{label}</span>
      {/* Με εικονίδιο μπροστά, το τσεκάρισμα χρειάζεται δική του θέση — αλλιώς η επιλεγμένη
          γραμμή θα ξεχώριζε μόνο από το χρώμα εστίασης, που φεύγει με το ποντίκι. */}
      {icon && selected ? <Check size={14} aria-hidden="true" /> : null}
    </button>
  );
}
