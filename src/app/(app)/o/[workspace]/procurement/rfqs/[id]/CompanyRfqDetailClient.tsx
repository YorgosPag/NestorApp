'use client';

/**
 * Ένα RFQ **στο πλαίσιο της εταιρείας** (ADR-928 §5.24 · ζωντανός έλεγχος 2026-11-06: υποπλοήγηση παντού στην ενότητα).
 *
 * 🔑 Λεπτός φάκελος: κέλυφος της ενότητας + η κοινή σελίδα. Το κέλυφος **ΔΕΝ** μπαίνει μέσα στο `RfqDetailClient`,
 *    γιατί την ίδια σελίδα αποδίδει και το έργο (`projects/[id]/procurement/rfq/[rfqId]`), όπου την υποπλοήγηση τη δίνει
 *    το layout του έργου — εκεί θα έβγαινε **διπλή**.
 * ⚠️ Αποδίδεται **μέσα** στο `<Suspense>` της σελίδας: το `useSearchParams` του σώματος στέλνει όλο το όριο στον client,
 *    άρα και η υποπλοήγηση ζωγραφίζεται εκεί όπου το `procurement` έχει φορτώσει — όχι ωμά κλειδιά στο HTML του server.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ProcurementSectionShell } from '@/subapps/procurement/components/ProcurementSectionShell';
import { RfqDetailClient } from './RfqDetailClient';

export function CompanyRfqDetailClient({ id }: { readonly id: string }) {
  const { t } = useTranslation('procurement');
  return (
    <ProcurementSectionShell ariaLabel={t('nav.rfqs')} scroll="shell">
      <RfqDetailClient id={id} />
    </ProcurementSectionShell>
  );
}
