'use client';

/**
 * Ο σταθμός ελέγχου μιας προσφοράς **στο πλαίσιο της εταιρείας** (ADR-928 §5.24 · ζωντανός έλεγχος 2026-11-06:
 * υποπλοήγηση παντού στην ενότητα).
 *
 * 🔑 Λεπτός φάκελος, όπως το `CompanyRfqDetailClient`: το κέλυφος **ΔΕΝ** μπαίνει μέσα στο `QuoteReviewClient`, γιατί
 *    τον ίδιο σταθμό αποδίδει και το έργο (`projects/[id]/procurement/quote/[quoteId]/review`), με τις δικές του καρτέλες.
 * 🔑 Τα κλειδιά της υποπλοήγησης ταξιδεύουν στο route slice της διαδρομής (η κλειστότητα ξεκινά από το `page.tsx`)· το
 *    slice το καταχωρεί το `QuoteReviewClient` κατά τη φόρτωση του module, πριν από κάθε απόδοση.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ProcurementSectionShell } from '@/subapps/procurement/components/ProcurementSectionShell';
import { QuoteReviewClient } from './QuoteReviewClient';

export function CompanyQuoteReviewClient({ id }: { readonly id: string }) {
  const { t } = useTranslation('procurement');
  return (
    <ProcurementSectionShell ariaLabel={t('nav.quotes')} scroll="shell">
      <QuoteReviewClient id={id} />
    </ProcurementSectionShell>
  );
}
