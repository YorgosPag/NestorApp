/**
 * Τα χρώματα των ποσών κόστους του BOQ: ένα σημείο για τις κάρτες σύνοψης και τα «Υπολογιζόμενα Σύνολα» του επεξεργαστή.
 *
 * ⛔ ΟΧΙ `text-primary`: στο σκοτεινό θέμα `--primary` ≡ `--card`, άρα το ποσό είναι αόρατο (CHECK 3.38, ADR-770). Οι κάρτες το είχαν
 *    διορθώσει, η φόρμα κρατούσε αντίγραφο της παλιάς κλάσης και έμεινε αόρατη (ADR-923 §5.12).
 *
 * @module components/building-management/tabs/MeasurementsTabContent/boq-cost-accents
 */

export const BOQ_COST_ACCENTS = {
  material: 'text-[hsl(var(--text-info))]',
  labor: 'text-[hsl(var(--text-warning))]',
  equipment: 'text-[hsl(var(--text-success))]',
  total: 'text-foreground',
} as const;
