'use client';

/**
 * **Η ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ** — «14 ακίνητα · 11 στον χάρτη · 3 χωρίς δηλωμένη θέση».
 *
 * ADR-777 Α5, **κανόνας 27**: το άθροισμα **οφείλει να κλείνει, πάντα** — ακόμη και
 * στο μηδέν. Μια λίστα που δείχνει 14 και ένας χάρτης που δείχνει 11 **χωρίς να το
 * πει** είναι το ίδιο ψέμα με πύλη που τυπώνει «0 παραβιάσεις» επειδή δεν κοίταξε.
 *
 * 🏆 Είναι η **δική μας** αποδεδειγμένη πρακτική των πυλών (CHECK 3.39 · 3.42 · 3.44 ·
 * 3.46 · 3.47 · 3.48) μεταφερμένη στην **οθόνη**. Δεν βρέθηκε portal ακινήτων που να
 * το κάνει — και ο λόγος που δεν το κάνουν είναι ότι δεν τους συμφέρει: ο αριθμός που
 * λείπει είναι το χρέος τους.
 *
 * ⚠️ **Τυπώνεται ΚΑΙ στο μηδέν** (άγκυρα, όχι ύφος): ένα «0» που δεν εμφανίζεται
 * διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος».
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ledgerBalances, type ListingLedger } from '@/types/public-listing';
import { cn } from '@/lib/utils';

interface ListingLedgerBarProps {
  readonly ledger: ListingLedger;
  readonly className?: string;
}

export function ListingLedgerBar({ ledger, className }: ListingLedgerBarProps) {
  const { t } = useTranslation(['search-results']);
  const balanced = ledgerBalances(ledger);

  return (
    <output
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground',
        className
      )}
    >
      <span>
        {t('search-results:ledger.summary', {
          total: ledger.total,
          mapped: ledger.mapped,
          unmapped: ledger.unmapped,
        })}
      </span>

      {ledger.total === 0 && <span>{t('search-results:ledger.empty')}</span>}

      {/*
        🔴 Ο φρουρός δεν είναι διακοσμητικός: αν κάποτε προστεθεί τρίτη κατάσταση
        θέσης που δεν μετριέται σε κανέναν από τους δύο κάδους, ο χρήστης το μαθαίνει
        ΕΔΩ — αντί να δει χάρτη με λιγότερα από τη λίστα και να μην ξέρει γιατί.
      */}
      {!balanced && (
        <strong role="alert" className="text-destructive">
          {t('search-results:ledger.imbalanced')}
        </strong>
      )}
    </output>
  );
}
