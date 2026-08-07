'use client';

/**
 * ADR-750 Φ6 — **οι έξι καρτέλες** του «Μορφοποίηση κελιών», με ενεργή μόνο την «Περίγραμμα».
 *
 * ## 🔑 Γιατί φαίνονται και οι έξι (απόφαση ιδιοκτήτη, 2026-08-05)
 * Η Φ6 υλοποιεί **μία** καρτέλα. Ένας διάλογος με μία καρτέλα θα ήταν άλλο πράγμα από αυτό που
 * ξέρει ο χρήστης — και όταν αργότερα εμφανίζονταν οι υπόλοιπες, ο διάλογος θα «άλλαζε σχήμα»
 * χωρίς προειδοποίηση. Οι πέντε ανενεργές δηλώνουν **πού θα ζήσουν** οι επόμενες φάσεις.
 *
 * ## 🔴 `aria-disabled`, ΠΟΤΕ `disabled` — και γιατί έχει σημασία εδώ ειδικά
 * Μια καρτέλα με `disabled` είναι **αόρατη** στον αναγνώστη οθόνης: ο χρήστης δεν μαθαίνει
 * ποτέ ότι υπάρχει «Γραμματοσειρά», δηλαδή η δήλωση εμβέλειας θα ίσχυε μόνο για όσους βλέπουν.
 * Με `aria-disabled` ανακοινώνεται κανονικά ως καρτέλα **μη διαθέσιμη**, και ο λόγος ταξιδεύει
 * μαζί της με `aria-describedby` — ίδια σύμβαση με κάθε ανενεργό στοιχείο της μπάρας (Α19).
 *
 * Το roving είναι **δεδομένο** εδώ: μία καρτέλα δέχεται `Tab`, οι υπόλοιπες `tabIndex={-1}`.
 * Δεν υπάρχει πλοήγηση με βέλη επειδή δεν υπάρχει **πού** να πας: πέντε ανενεργοί προορισμοί.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/border-dialog/TableBorderDialogTabs
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §9.2
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  TABLE_BORDER_DIALOG_ACTIVE_TAB,
  TABLE_BORDER_DIALOG_KEY,
  TABLE_BORDER_DIALOG_TABS,
} from './table-border-dialog-labels';
import styles from './TableBorderDialog.module.css';

export interface TableBorderDialogTabsProps {
  /** Το `id` του μοναδικού `tabpanel` — η ενεργή καρτέλα το δηλώνει με `aria-controls`. */
  readonly panelId: string;
  /** Το `id` του κρυφού κειμένου «Διαθέσιμο σε επόμενη φάση». */
  readonly hintId: string;
}

export function TableBorderDialogTabs({
  panelId, hintId,
}: TableBorderDialogTabsProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');

  return (
    <nav className={styles.tabList} role="tablist" aria-label={t(`${TABLE_BORDER_DIALOG_KEY}.title`)}>
      {TABLE_BORDER_DIALOG_TABS.map((tab) => {
        const active = tab === TABLE_BORDER_DIALOG_ACTIVE_TAB;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`${panelId}-tab-${tab}`}
            aria-selected={active}
            aria-controls={active ? panelId : undefined}
            aria-disabled={active ? undefined : true}
            aria-describedby={active ? undefined : hintId}
            tabIndex={active ? 0 : -1}
            className={cn(
              styles.tab,
              active ? styles.tabSelected : styles.tabDisabled,
            )}
            onClick={(event) => {
              // Ανενεργή ⇒ **τίποτα**. Το `aria-disabled` δεν εμποδίζει το κλικ από μόνο του:
              // είναι δήλωση προς τον αναγνώστη, όχι φράγμα του browser (σε αντίθεση με το
              // `disabled`, που όμως θα την έκρυβε — δες την κεφαλίδα).
              if (!active) event.preventDefault();
            }}
          >
            {t(`${TABLE_BORDER_DIALOG_KEY}.tabs.${tab}`)}
          </button>
        );
      })}
      <span id={hintId} className="sr-only">
        {t(`${TABLE_BORDER_DIALOG_KEY}.tabs.disabledHint`)}
      </span>
    </nav>
  );
}
