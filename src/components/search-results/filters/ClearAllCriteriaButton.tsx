'use client';

/**
 * **ΤΟ «ΚΑΘΑΡΙΣΜΟΣ ΟΛΩΝ» — ΜΙΑ ΦΟΡΑ** (SSoT): ο κανόνας *(πότε φαίνεται)*, η πράξη
 * *(`commit.clearAllCriteria`)* και η ετικέτα ζουν **εδώ**. Η μπάρα (`PrimaryFilterBar`) και το
 * πάνελ (`CriteriaFilterPanel`) το γράφανε το καθένα χωριστά — ίδιος κανόνας, δύο αντίγραφα,
 * και η επόμενη αλλαγή θα έφτανε στο ένα.
 *
 * 📐 Διαφέρει **μόνο** το μέγεθος (`size`): κλάσεις Tailwind **στατικά γραμμένες** σε πίνακα — το
 * Tailwind διαβάζει τα αρχεία στατικά, ποτέ δεν χτίζουμε ονόματα κλάσεων δυναμικά. Και το τι
 * δείχνει το πάνελ όταν δεν υπάρχει τίποτα να καθαριστεί (`whenEmpty`) είναι δικό του ζήτημα.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { askedCriterionKeys } from '@/lib/criteria/listing-criteria';
import type { ListingSearch } from '@/lib/listings/listing-filters';

import type { FilterCommit } from './use-filter-commit';

type ClearAllSize = 'bar' | 'panel';

const SIZE_CLASSES: Record<ClearAllSize, string> = {
  bar: 'shrink-0 rounded-md px-2 py-1.5 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline',
  panel: 'rounded-md px-2 py-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline',
};

interface ClearAllCriteriaButtonProps {
  readonly filters: ListingSearch;
  readonly commit: FilterCommit;
  readonly size: ClearAllSize;
  /** Τι τυπώνεται όταν **δεν** έχει ζητηθεί κανένα κριτήριο· προεπιλογή: τίποτα. */
  readonly whenEmpty?: React.ReactNode;
}

/**
 * 🔴 **Η ΕΞΟΔΟΣ, ΣΤΟ ΠΡΩΤΟ ΕΠΙΠΕΔΟ — ΚΑΙ ΤΟ ΕΛΑΤΤΩΜΑ ΗΤΑΝ ΜΕΤΡΗΜΕΝΟ.** Η πρώτη γραφή είχε τον
 * «Καθαρισμό» **μόνο μέσα** στο πάνελ. Ζωντανά (2026-09-04): με `?bathmin=1&bathmax=1` η οθόνη έδειχνε
 * 2 αγγελίες, **καμία στον χάρτη**, και ο άνθρωπος **δεν είχε τρόπο να βγει** χωρίς να ανοίξει ξανά
 * το συρτάρι και να θυμηθεί τι είχε πατήσει.
 *
 * ⚠️ Ο κανόνας που η έρευνα ονομάζει **αδιέξοδο**: *«κενό αποτέλεσμα — ή απόκλεισε την επιλογή, ή
 * δώσε διαδρομή επιστροφής»*. Εμείς δεν αποκλείουμε επιλογές *(τα πλήθη τις δείχνουν όλες)*, άρα
 * **οφείλουμε** τη διαδρομή επιστροφής — **ορατή**, όχι κρυμμένη.
 *
 * 🔑 **Μόνο όταν υπάρχει τι να καθαριστεί** — μονίμως ορατό κουμπί που δεν κάνει τίποτα διδάσκει
 * τον επισκέπτη να το αγνοεί.
 */
export function ClearAllCriteriaButton({ filters, commit, size, whenEmpty = null }: ClearAllCriteriaButtonProps) {
  const { t } = useTranslation(['search-filters']);
  if (askedCriterionKeys(filters.criteria).length === 0) return <>{whenEmpty}</>;
  return (
    <button type="button" onClick={commit.clearAllCriteria} className={SIZE_CLASSES[size]}>
      {t('search-filters:filters.clearAll')}
    </button>
  );
}
