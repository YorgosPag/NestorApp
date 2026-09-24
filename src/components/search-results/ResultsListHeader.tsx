'use client';

/**
 * **Η ΚΕΦΑΛΙΔΑ ΤΗΣ ΛΙΣΤΑΣ** — τίτλος, ταξινόμηση, λογιστικές. Στην κορυφή της στήλης, όχι της σελίδας.
 *
 * @related ADR-777 §8.80 · Α5 κανόνας 27 · ResultsList · filters/ResultsOrderControl
 * @module components/search-results/ResultsListHeader
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΦΥΓΕ ΑΠΟ ΤΗΝ ΚΟΡΥΦΗ ΤΗΣ ΣΕΛΙΔΑΣ (στιγμιότυπο του Giorgio, 2026-09-24)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Τέσσερις γραμμές λογιστικής + τίτλος πάνω από **χάρτη και λίστα μαζί** έσπρωχναν τον χάρτη
 * ~200px κάτω. Η Zillow βάζει «60,721 results · Sort: Homes for You» **στην κορυφή της λίστας**,
 * και ο χάρτης ξεκινά αμέσως κάτω από τη γραμμή φίλτρων. Ίδια απόφαση εδώ.
 *
 * ⚠️ **Ο ΚΑΝΟΝΑΣ 27 ΔΕΝ ΧΑΛΑΡΩΝΕΙ — ΜΕΤΑΚΟΜΙΖΕΙ.** Οι λογιστικές τυπώνονται **ακριβώς** όπως
 * πριν (ίδια συστατικά, ίδιοι φρουροί, ίδιο `aria-live`)· αλλάζει μόνο το **πού**. Και η θέση είναι
 * η σωστότερη: μια λογιστική που λέει «3 στον χάρτη · 0 χωρίς θέση» κάθεται δίπλα στα ίδια τα
 * αποτελέσματα που μετρά. *(Η παλιά κεφαλίδα του αρχείου έγραφε «η λογιστική είναι πάνω από ΚΑΙ
 * ΤΑ ΔΥΟ» — στη ευρεία διάταξη η στήλη είναι δίπλα στον χάρτη, και στο φύλλο του κινητού η
 * κεφαλίδα είναι η ζώνη που φαίνεται στη στάση `peek`, πάνω από τον χάρτη.)*
 *
 * 🔑 **Κέλυφος, όχι λογιστής**: δεν ξέρει τι μετρά. Τα συστατικά και τα δεδομένα τους τα συνθέτει
 * η οθόνη, ώστε οι άγκυρες του §8.62 (`rendered={renderedCount}`) να μένουν εκεί που ζει η αριθμητική.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ResultsListHeaderProps {
  /** Ο επιλογέας σειράς — δεξιά του τίτλου. */
  readonly order: React.ReactNode;
  /** Οι λογιστικές, με τη σειρά που τις συνθέτει η οθόνη. */
  readonly children: React.ReactNode;
  readonly loading: boolean;
  readonly error: boolean;
}

export function ResultsListHeader({ order, children, loading, error }: ResultsListHeaderProps) {
  const { t } = useTranslation(['search-results']);
  return (
    <header className="flex flex-col gap-1 border-b border-border px-3 pb-2 pt-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h1 className="m-0 text-lg font-semibold text-foreground">{t('search-results:page.title')}</h1>
        {order}
      </div>
      {children}
      {loading && <p className="m-0 text-xs text-muted-foreground">{t('search-results:page.loading')}</p>}
      {error && <p role="alert" className="m-0 text-sm text-destructive">{t('search-results:page.error')}</p>}
    </header>
  );
}
