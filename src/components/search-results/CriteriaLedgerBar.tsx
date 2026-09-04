'use client';

/**
 * **Η ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ ΤΩΝ ΚΡΙΤΗΡΙΩΝ** — «7 ταιριάζουν · 3 χωρίς δηλωμένα στοιχεία ·
 * 4 δεν ταιριάζουν» (ADR-777 §8.51).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΟ ΣΗΜΕΙΟ ΟΠΟΥ ΕΙΜΑΣΤΕ ΜΟΝΟΙ — ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ ΟΤΙ ΚΑΝΕΙΣ ΔΕΝ ΤΟ ΚΑΝΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι μηχανές αναζήτησης **έχουν** το primitive: το Elasticsearch δίνει `missing`
 * aggregation, το Solr `missing:true`. **Κανείς δεν το εκθέτει στην οθόνη** — η
 * καταγεγραμμένη σύμβαση είναι η αντίθετη: *«a conditional is added to eliminate any
 * buckets that have zero documents»*. Και η μελέτη *Strategic under-disclosure in
 * online property platforms* δείχνει ότι η μη-δήλωση πεδίων είναι **ενδημική** στην
 * αγορά ακινήτων, δηλαδή ακριβώς εκεί που η σιωπή μετράει περισσότερο.
 *
 * ⇒ Ο επισκέπτης ενός portal που φιλτράρει «ενεργειακή κλάση B» βλέπει **3
 * αποτελέσματα** και δεν μαθαίνει ποτέ ότι υπήρχαν **11** που **κανείς δεν τους
 * ρώτησε**. Εδώ ο αριθμός που λείπει **τυπώνεται**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΙΤΗ ΓΡΑΜΜΗ, ΟΧΙ ΑΝΤΙΚΑΤΑΣΤΑΣΗ — ΤΡΕΙΣ ΔΙΑΜΕΡΙΣΕΙΣ ΤΟΥ ΙΔΙΟΥ ΣΥΝΟΛΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * *«Πού;»* ({@link ListingLedgerBar}) · *«Πότε;»* ({@link StayLedgerBar}) · *«Ταιριάζει;»*
 * (εδώ). Ένα ακίνητο είναι **ταυτόχρονα** στον χάρτη, κρατημένο, και χωρίς δηλωμένη
 * ενεργειακή κλάση — δεν είναι κάδοι της ίδιας μέτρησης.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΥΠΩΝΕΤΑΙ ΜΟΝΟ ΟΤΑΝ ΥΠΑΡΧΕΙ ΕΡΩΤΗΣΗ — ΚΑΙ ΔΕΝ ΑΝΤΙΦΑΣΚΕΙ ΜΕ ΤΟ «ΠΑΝΤΑ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κανόνας 27 λέει *«το άθροισμα τυπώνεται πάντα, ακόμη και στο μηδέν»* — και ισχύει
 * για τις **θέσεις**, που υπάρχουν είτε τις ρωτήσεις είτε όχι. Η **σιωπή** δεν υπάρχει
 * χωρίς ερώτηση: *«κανείς δεν δήλωσε ό,τι ζήτησες»* όταν **δεν ζήτησες τίποτα** δεν
 * είναι αριθμός που λείπει — είναι πρόταση χωρίς νόημα. Ίδιο ιδίωμα με το `asked` του
 * {@link StayLedgerBar}.
 *
 * 🔴 **Ο ΦΡΟΥΡΟΣ ΟΜΩΣ ΤΡΕΧΕΙ ΠΑΝΤΑ** — δες {@link criteriaLedgerBalances}. Ο κανόνας
 * *«το 0 μετριέται ακόμη κι όταν δεν φαίνεται»* τηρείται εκεί που έχει σημασία: στον
 * **έλεγχο**, όχι στο ύφος.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  criteriaLedgerBalances,
  type ListingCriteriaLedger,
} from '@/lib/criteria/listing-criteria-judge';
import { cn } from '@/lib/utils';

interface CriteriaLedgerBarProps {
  readonly ledger: ListingCriteriaLedger;
  /**
   * Ρώτησε ο άνθρωπος **κάτι**;
   *
   * ⚠️ **Ξεχωριστό όρισμα και όχι `ledger.excluded > 0`** — τα δύο δεν ταυτίζονται:
   * μια αναζήτηση με ενεργό φίλτρο όπου **όλα** ταιριάζουν έχει `excluded === 0` και
   * **οφείλει** να τυπώσει τη γραμμή *(«8 ταιριάζουν · 0 χωρίς δηλωμένα στοιχεία»)*.
   * Ένας καταναλωτής που το συμπέραινε μόνος του θα έκρυβε ακριβώς την **καλή** είδηση.
   */
  readonly asked: boolean;
  readonly className?: string;
}

export function CriteriaLedgerBar({ ledger, asked, className }: CriteriaLedgerBarProps) {
  const { t } = useTranslation(['search-filters']);
  const balanced = criteriaLedgerBalances(ledger);

  // 🔴 Ο ΦΡΟΥΡΟΣ ΤΡΕΧΕΙ ΠΡΙΝ ΤΗΝ ΕΞΟΔΟ: μια λογιστική που δεν κλείνει είναι σφάλμα
  //    ακόμη κι όταν κανείς δεν ρώτησε τίποτα, και οφείλει να φωνάξει.
  if (!balanced) {
    return (
      <output aria-live="polite" className={cn('text-sm', className)}>
        <strong role="alert" className="text-destructive">
          {t('search-filters:criteriaLedger.imbalanced')}
        </strong>
      </output>
    );
  }

  if (!asked) return null;

  return (
    <output
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground',
        className
      )}
    >
      <span>
        {t('search-filters:criteriaLedger.summary', {
          matching: ledger.matching,
          undeclared: ledger.undeclared,
          excluded: ledger.excluded,
        })}
      </span>

      {/*
        ⚠️ **Η εξήγηση εμφανίζεται ΜΟΝΟ όταν υπάρχει σιωπή να εξηγηθεί.** Μια μόνιμη
        πρόταση δίπλα σε κάθε αναζήτηση θα γινόταν θόρυβος, και ο άνθρωπος θα σταματούσε
        να τη διαβάζει ακριβώς την ημέρα που τον αφορά.
      */}
      {ledger.undeclared > 0 && (
        <span className="text-xs">{t('search-filters:criteriaLedger.undeclaredHint')}</span>
      )}
    </output>
  );
}
