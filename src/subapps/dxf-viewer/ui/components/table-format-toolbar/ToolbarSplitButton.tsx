'use client';

/**
 * 🔴 ADR-755 — **τα δύο μισά ενός split button** του mini toolbar.
 *
 * ## Πώς βρέθηκε (CHECK 3.28, μετρημένο)
 * Το split button συγχώνευσης αντέγραψε από εκείνο του χρώματος **τρία** μπλοκ, 42 γραμμές
 * συνολικά: τον σκελετό των δύο `<button>`, τα roving props του καθενός, και τη σύνδεση
 * `aria-haspopup` / `aria-expanded` / `aria-controls` του βελακιού.
 *
 * ⚠️ **Το επικίνδυνο δεν ήταν οι γραμμές.** Το `ref` του βελακιού πρέπει να γράφεται σε **δύο**
 * θέσεις ταυτόχρονα (τον `triggerRef` του πάνελ *και* το roving του toolbar)· ένα από τα δύο
 * αντίγραφα θα ξεχνούσε κάποτε τη μία, και το σύμπτωμα θα ήταν «η εστίαση δεν γυρίζει μετά το
 * `Escape`» σε **ένα** από τα τρία χειριστήρια — ασυμμετρία που καμία οπτική επιθεώρηση δεν
 * πιάνει.
 *
 * ## Τι ΔΕΝ μπαίνει εδώ
 * Το **περιεχόμενο** του κύριου μισού (εικονίδιο, έγχρωμη μπάρα, εναλλασσόμενο γλυφό) και το
 * πάνελ που ανοίγει. Κοινός είναι μόνο ο **σκελετός** — η γνώση «τι κάνει αυτό το κουμπί»
 * μένει στον καθένα.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/ToolbarSplitButton
 * @see ui/components/table-format-toolbar/use-toolbar-panel.ts — ο κύκλος ζωής του πάνελ
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TABLE_CELL_SESSION_MARKER } from '../../table-cell-editor/table-cell-session-focus';
import { keepTableCellKeyboardOwnership } from '../../table-cell-editor/table-cell-keyboard-ownership';
import type { RovingItemProps } from './use-roving-toolbar';
import styles from './table-toolbar-panel.module.css';
import toolbar from './TableFormatToolbar.module.css';

export interface ToolbarSplitButtonProps {
  /** Roving του **κύριου** μισού (εκτελεί χωρίς μενού). */
  readonly rovingApply: RovingItemProps;
  /** Roving του **βελακιού** (ανοίγει το πάνελ). */
  readonly rovingMenu: RovingItemProps;
  readonly mainLabel: string;
  readonly menuLabel: string;
  /** `aria-pressed` — μόνο για χειριστήρια που είναι όντως δίτιμα (π.χ. η συγχώνευση). */
  readonly mainPressed?: boolean;
  readonly mainDisabled?: boolean;
  /** Επιπλέον κλάσεις του κύριου μισού (πλάτος, χώρος για μπάρα χρώματος κ.λπ.). */
  readonly mainClassName?: string;
  readonly onMainClick: () => void;
  readonly isOpen: boolean;
  readonly panelId: string;
  readonly onToggleMenu: () => void;
  /** Ο trigger του πάνελ — γράφεται **μαζί** με το roving ref (δες την κεφαλίδα). */
  readonly triggerRef: React.MutableRefObject<HTMLButtonElement | null>;
  /** Το περιεχόμενο του κύριου μισού. */
  readonly children: React.ReactNode;
}

export function ToolbarSplitButton(props: ToolbarSplitButtonProps): React.ReactElement {
  const {
    rovingApply, rovingMenu, mainLabel, menuLabel, mainPressed, mainDisabled, mainClassName,
    onMainClick, isOpen, panelId, onToggleMenu, triggerRef, children,
  } = props;

  return (
    <span className={styles.split}>
      <button
        type="button"
        ref={rovingApply.ref}
        tabIndex={rovingApply.tabIndex}
        onKeyDown={rovingApply.onKeyDown}
        onFocus={rovingApply.onFocus}
        // 🔴 ADR-753 §25.6 — και τα **δύο** μισά, για τον ίδιο λόγο που το `ref` γράφεται σε δύο
        // θέσεις (δες την κεφαλίδα): ένα από τα δύο που θα το ξεχνούσε θα έδινε «το `Enter`
        // δεσμεύει μετά το κύριο μισό, αλλά όχι μετά το βελάκι» — ασυμμετρία που καμία οπτική
        // επιθεώρηση δεν πιάνει.
        onMouseDown={keepTableCellKeyboardOwnership}
        className={cn(
          toolbar.button,
          styles.splitMain,
          mainClassName,
          mainPressed && toolbar.buttonActive,
        )}
        aria-label={mainLabel}
        aria-pressed={mainPressed}
        // Ανενεργό αλλά **εστιάσιμο**: ο δείκτης του roving δεν επιτρέπεται να πέσει σε τρύπα.
        aria-disabled={mainDisabled || undefined}
        onClick={() => {
          if (!mainDisabled) onMainClick();
        }}
        {...TABLE_CELL_SESSION_MARKER}
      >
        {children}
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
        onMouseDown={keepTableCellKeyboardOwnership}
        className={cn(toolbar.button, styles.splitArrow, isOpen && toolbar.buttonActive)}
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onClick={onToggleMenu}
        {...TABLE_CELL_SESSION_MARKER}
      >
        <ChevronDown size={12} aria-hidden="true" />
      </button>
    </span>
  );
}
