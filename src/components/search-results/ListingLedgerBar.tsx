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
import { ledgerBalances, ledgerCoversRendered, type ListingLedger } from '@/types/public-listing';
import { cn } from '@/lib/utils';

interface ListingLedgerBarProps {
  readonly ledger: ListingLedger;
  /**
   * **ΠΟΣΕΣ ΚΑΡΤΕΣ ΠΑΡΑΔΟΘΗΚΑΝ ΣΤΗ ΛΙΣΤΑ** — ο αριθμός που κάνει τον μετρητή
   * **ανίκανο να ψευδιστεί** (ADR-777 §8.62).
   *
   * ⚠️ **Υποχρεωτικό, ποτέ προαιρετικό με προεπιλογή `ledger.total`.** Μια προεπιλογή
   * ίση με τη λογιστική θα έκανε τον έλεγχο **ταυτολογία** — θα περνούσε πάντα, και θα
   * ήταν ακριβώς το είδος «πράσινου επειδή κανείς δεν κοίταξε» που το ίδιο το έργο
   * καταγράφει τέσσερις φορές (N.11 · N.12 · N.18 · CHECK 3.18). Ο καταναλωτής
   * **οφείλει** να το μετρήσει από τα σύνολα που όντως έδωσε στη λίστα.
   */
  readonly rendered: number;
  readonly className?: string;
}

export function ListingLedgerBar({ ledger, rendered, className }: ListingLedgerBarProps) {
  const { t } = useTranslation(['search-results']);
  // 🔑 **ΔΥΟ ΑΝΕΞΑΡΤΗΤΕΣ ΕΡΩΤΗΣΕΙΣ, ΠΟΤΕ ΜΙΑ ΜΕ «Ή» ΣΤΗΝ ΠΗΓΗ.** Το `balanced` ρωτά
  //    «κλείνει μέσα της;»· το `covers` ρωτά «είναι του ΙΔΙΟΥ συνόλου;». Συμπτύσσοντάς
  //    τες σε έναν υπολογισμό θα χανόταν ποια από τις δύο έσπασε — το ίδιο σχήμα που
  //    οι πύλες μας κρατούν χωριστό (Κ1 δομικός · Κ2 ταβάνι, ποτέ ένας με «ή»).
  const balanced = ledgerBalances(ledger);
  const covers = ledgerCoversRendered(ledger, rendered);

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

        🔴 **ΚΑΙ Η ΔΕΥΤΕΡΗ ΑΙΤΙΑ, ΑΠΟ ΤΟ §8.62**: ο αριθμός μιλά για **άλλο σύνολο**
        από τις κάρτες που ζωγραφίστηκαν. Ο συναγερμός είναι **ο ίδιος επίτηδες** —
        με τον Δρόμο Α τίποτα δεν κρύβεται σκόπιμα, άρα και οι δύο αιτίες είναι
        **σφάλμα, όχι κατάσταση**, ακριβώς όπως λέει το κείμενο του κλειδιού. Δες
        {@link ledgerCoversRendered} για το γιατί δεν είναι δεύτερο μήνυμα.
      */}
      {!(balanced && covers) && (
        <strong role="alert" className="text-destructive">
          {t('search-results:ledger.imbalanced')}
        </strong>
      )}
    </output>
  );
}
