'use client';

/**
 * Μια κύρια σύμβαση **στο πλαίσιο της εταιρείας** (ADR-928 §5.24). Λεπτός φάκελος: route slice της εταιρείας + το
 * κέλυφος της ενότητας + η κοινή σελίδα (`SubcontractAgreementDetail`, `projectId: null` ⇒ κάθε κρίση πέφτει στην
 * εταιρεία, «πίσω» στις κύριες).
 *
 * 🔑 Το κέλυφος (`ProcurementSectionShell`) ζει **εδώ**, όχι στην κοινή σελίδα: στο πλαίσιο του έργου την υποπλοήγηση τη
 *    δίνει το layout του έργου (`ProjectProcurementTabs`). Ζωντανός έλεγχος 2026-11-06, εύρημα #1: έλειπε.
 * 🔑 `scroll="shell"`: το έγγραφο ρέει· ο επεξεργαστής μετρά το ύψος του ως προς τον πρόγονο που κόβει
 *    (`measureFillHeight`, §5.23.1), δηλαδή την περιοχή κύλισης του κελύφους — όχι το παράθυρο.
 */

import { SubcontractAgreementDetail } from '@/components/procurement/subcontracts/SubcontractAgreementDetail';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import routeSlice from '@/i18n/generated/routes/o__workspace__procurement__subcontracts__agreementId.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
import { ProcurementSectionShell } from '@/subapps/procurement/components/ProcurementSectionShell';

registerRouteSlice(routeSlice);

export function MasterAgreementDetailClient({ agreementId }: { readonly agreementId: string }) {
  const { t } = useTranslation('procurement');
  return (
    <ProcurementSectionShell ariaLabel={t('subcontracts.masters.title')} scroll="shell">
      <div className="px-2 py-4">
        <SubcontractAgreementDetail projectId={null} agreementId={agreementId} />
      </div>
    </ProcurementSectionShell>
  );
}
