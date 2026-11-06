'use client';

/**
 * Οι **κύριες συμβάσεις** υπεργολαβίας της εταιρείας (ADR-928 §5.24 · AIA A421 · ConsensusDocs 755 · Swinerton/CMiC:
 * η κύρια σύμβαση δίνεται σε επίπεδο εταιρείας, η εντολή εργασίας ανά έργο).
 *
 * 🔑 Εδώ ζει μια κύρια σύμβαση από τη γέννηση ως την πρώτη εντολή εργασίας — πριν από αυτήν δεν έχει έργο (`projectIds`
 *    κενό), άρα δεν φαινόταν σε **καμία** λίστα. Μετά, φαίνεται **και** στην καρτέλα κάθε έργου με εντολή.
 * 🔑 Ίδια λίστα με την καρτέλα έργου (`SubcontractAgreementsList`, `projectId: null`): σύνολα ανά φάση, φίλτρο στο URL,
 *    αναζήτηση, ενέργειες από τους κριτές του γραφέα· η στήλη εμβέλειας μετρά εντολές και έργα.
 * 🔑 Κέλυφος προμηθειών (`ProcurementSectionShell` + `PageHeader`), όπως η βιβλιοθήκη — ο ζωντανός έλεγχος (2026-11-06,
 *    εύρημα #1) βρήκε τη σελίδα **χωρίς** υποπλοήγηση. Η λίστα ρέει ⇒ `scroll="shell"`.
 */

import { BookOpen, FileSignature } from 'lucide-react';
import { PageHeader } from '@/core/headers';
import { useCompanyMasterSubcontractAgreements } from '@/hooks/procurement/subcontracts/useProjectSubcontractAgreements';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getSubcontractLibraryUrl } from '@/lib/navigation/procurement-urls';
import { Link } from '@/lib/workspace/navigation';
import { NewAgreementButton } from '@/components/projects/procurement/subcontracts/SubcontractCreateButtons';
import { SubcontractAgreementsList } from '@/components/projects/procurement/subcontracts/SubcontractAgreementsList';
import { ProcurementSectionShell } from '@/subapps/procurement/components/ProcurementSectionShell';
import routeSlice from '@/i18n/generated/routes/o__workspace__procurement__subcontracts.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

function MastersHeaderActions() {
  const { t } = useTranslation('procurement');
  return (
    <nav aria-label={t('subcontracts.masters.related')} className="flex flex-wrap items-center gap-3">
      <Link href={getSubcontractLibraryUrl()} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <BookOpen className="h-4 w-4" aria-hidden />{t('nav.subcontractLibrary')}
      </Link>
      <NewAgreementButton projectId={null} />
    </nav>
  );
}

export function MasterAgreementsClient() {
  const { t } = useTranslation('procurement');
  const { items, loading, error } = useCompanyMasterSubcontractAgreements();
  const title = t('subcontracts.masters.title');
  return (
    <ProcurementSectionShell ariaLabel={title} scroll="shell">
      <PageHeader
        variant="sticky-rounded"
        layout="compact"
        spacing="compact"
        title={{ icon: FileSignature, title, subtitle: t('subcontracts.masters.subtitle') }}
        actions={{ customActions: [<MastersHeaderActions key="masters-actions" />] }}
      />
      <div className="px-2 pb-4">
        <SubcontractAgreementsList projectId={null} items={items} loading={loading} error={error} emptyText={t('subcontracts.masters.empty')} />
      </div>
    </ProcurementSectionShell>
  );
}
