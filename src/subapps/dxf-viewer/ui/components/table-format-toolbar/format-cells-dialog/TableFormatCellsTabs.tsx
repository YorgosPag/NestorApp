'use client';

/**
 * 🔴 ADR-739 §60 / ADR-750 Φ6 — **οι έξι καρτέλες** του «Μορφοποίηση κελιών», με **τρεις**
 * ζωντανές (Αριθμός · Στοίχιση · Περίγραμμα).
 *
 * ## 🔑 Γιατί φαίνονται και οι έξι (απόφαση ιδιοκτήτη, 2026-08-05)
 * Η Φ6 υλοποίησε **μία** καρτέλα. Ένας διάλογος με μία καρτέλα θα ήταν άλλο πράγμα από αυτό που
 * ξέρει ο χρήστης — και όταν εμφανίζονταν οι υπόλοιπες, ο διάλογος θα «άλλαζε σχήμα» χωρίς
 * προειδοποίηση. Οι ανενεργές δηλώνουν **πού θα ζήσουν** οι επόμενες φάσεις.
 *
 * ✅ Το §60 δικαίωσε την απόφαση κατά γράμμα: οι «Αριθμός» και «Στοίχιση» ζωντάνεψαν **στη θέση
 * τους**, χωρίς να μετακινηθεί καμία άλλη και χωρίς ο χρήστης να χρειαστεί να ξαναμάθει πού
 * είναι το «Περίγραμμα».
 *
 * ## 🔴 `aria-disabled`, ΠΟΤΕ `disabled` — και γιατί έχει σημασία εδώ ειδικά
 * Μια καρτέλα με `disabled` είναι **αόρατη** στον αναγνώστη οθόνης: ο χρήστης δεν μαθαίνει
 * ποτέ ότι υπάρχει «Γραμματοσειρά», δηλαδή η δήλωση εμβέλειας θα ίσχυε μόνο για όσους βλέπουν.
 * Με `aria-disabled` ανακοινώνεται κανονικά ως καρτέλα **μη διαθέσιμη**, και ο λόγος ταξιδεύει
 * μαζί της με `aria-describedby` — ίδια σύμβαση με κάθε ανενεργό στοιχείο της μπάρας (Α19).
 *
 * ## 🔴 ΤΟ ΠΛΗΚΤΡΟΛΟΓΙΟ ΠΗΔΑ ΤΙΣ ΑΝΕΝΕΡΓΕΣ — και αυτό ΔΕΝ είναι το APG κατά γράμμα
 * Το WAI-ARIA APG λέει ότι τα βέλη διατρέχουν **όλες** τις καρτέλες. Εδώ οι τρεις ανενεργές
 * δεν είναι προορισμοί: μια στάση πάνω τους θα ήταν στάση που δεν κάνει τίποτα, τρεις φορές, σε
 * κάθε πέρασμα. Η **ανακοίνωσή** τους μένει ακέραιη (είναι στη λίστα, με `aria-disabled` και
 * λόγο) — αυτό που παραλείπεται είναι μόνο η **στάση**, δηλαδή ακριβώς η σύσταση του APG για
 * στοιχεία που δεν μπορούν να ενεργοποιηθούν.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/format-cells-dialog/TableFormatCellsTabs
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §9.2
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  TABLE_FORMAT_CELLS_KEY,
  TABLE_FORMAT_CELLS_LIVE_TABS,
  TABLE_FORMAT_CELLS_TABS,
  TABLE_FORMAT_CELLS_TAB_KEY,
  type TableFormatCellsTabId,
} from './table-format-cells-labels';
import styles from './TableFormatCellsDialog.module.css';

export interface TableFormatCellsTabsProps {
  /** Το `id` του `tabpanel` — η ενεργή καρτέλα το δηλώνει με `aria-controls`. */
  readonly panelId: string;
  /** Το `id` του κρυφού κειμένου «Διαθέσιμο σε επόμενη φάση». */
  readonly hintId: string;
  readonly active: TableFormatCellsTabId;
  readonly onSelect: (tab: TableFormatCellsTabId) => void;
}

/** Οι ζωντανές, με τη σειρά εμφάνισης — η **μία** πηγή της κυκλικής πλοήγησης με βέλη. */
const LIVE_ORDER: readonly TableFormatCellsTabId[] = TABLE_FORMAT_CELLS_TABS.filter(
  (tab) => TABLE_FORMAT_CELLS_LIVE_TABS.has(tab),
);

export function TableFormatCellsTabs(props: TableFormatCellsTabsProps): React.ReactElement {
  const { panelId, hintId, active, onSelect } = props;
  const { t } = useTranslation('dxf-viewer');

  /**
   * Βέλη αριστερά/δεξιά με **κύκλωση**, όπως το APG — αλλά μόνο πάνω στις ζωντανές.
   *
   * Ο δείκτης υπολογίζεται από το {@link LIVE_ORDER} και όχι από τη θέση στο DOM: οι ανενεργές
   * κάθονται **ανάμεσα** στις ζωντανές (η «Γραμματοσειρά» χωρίζει τη «Στοίχιση» από το
   * «Περίγραμμα»), οπότε μια αριθμητική πάνω σε δείκτες DOM θα προσγειωνόταν σε αδιέξοδο.
   */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>): void => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (step === 0) return;
      event.preventDefault();
      const at = LIVE_ORDER.indexOf(active);
      onSelect(LIVE_ORDER[(at + step + LIVE_ORDER.length) % LIVE_ORDER.length]);
    },
    [active, onSelect],
  );

  return (
    <nav
      className={styles.tabList}
      role="tablist"
      aria-label={t(`${TABLE_FORMAT_CELLS_KEY}.title`)}
      onKeyDown={onKeyDown}
    >
      {TABLE_FORMAT_CELLS_TABS.map((tab) => {
        const live = TABLE_FORMAT_CELLS_LIVE_TABS.has(tab);
        const selected = live && tab === active;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`${panelId}-tab-${tab}`}
            aria-selected={selected}
            aria-controls={selected ? panelId : undefined}
            aria-disabled={live ? undefined : true}
            aria-describedby={live ? undefined : hintId}
            tabIndex={selected ? 0 : -1}
            className={cn(
              styles.tab,
              selected && styles.tabSelected,
              live ? undefined : styles.tabDisabled,
            )}
            onClick={(event) => {
              // Ανενεργή ⇒ **τίποτα**. Το `aria-disabled` δεν εμποδίζει το κλικ από μόνο του:
              // είναι δήλωση προς τον αναγνώστη, όχι φράγμα του browser (σε αντίθεση με το
              // `disabled`, που όμως θα την έκρυβε — δες την κεφαλίδα).
              if (!live) {
                event.preventDefault();
                return;
              }
              onSelect(tab);
            }}
          >
            {t(TABLE_FORMAT_CELLS_TAB_KEY[tab])}
          </button>
        );
      })}
      <span id={hintId} className="sr-only">
        {t(`${TABLE_FORMAT_CELLS_KEY}.tabs.disabledHint`)}
      </span>
    </nav>
  );
}
