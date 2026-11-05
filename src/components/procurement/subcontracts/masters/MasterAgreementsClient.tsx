'use client';

/**
 * Οι **κύριες συμβάσεις** υπεργολαβίας της εταιρείας (ADR-928 §5.24 · AIA A421 · ConsensusDocs 755 · Swinerton/CMiC:
 * η κύρια σύμβαση δίνεται σε επίπεδο εταιρείας, η εντολή εργασίας ανά έργο).
 *
 * 🔑 Εδώ ζει μια κύρια σύμβαση από τη γέννηση ως την πρώτη εντολή εργασίας — πριν από αυτήν δεν έχει έργο (`projectIds`
 *    κενό), άρα δεν φαινόταν σε **καμία** λίστα. Μετά, φαίνεται **και** στην καρτέλα κάθε έργου με εντολή.
 * 🔑 Ίδια λίστα με την καρτέλα έργου (`SubcontractAgreementsList`, `projectId: null`): σύνολα ανά φάση, φίλτρο στο URL,
 *    αναζήτηση, ενέργειες από τους κριτές του γραφέα· η στήλη εμβέλειας μετρά εντολές και έργα.
 */

import { BookOpen } from 'lucide-react';
import { useCompanyMasterSubcontractAgreements } from '@/hooks/procurement/subcontracts/useProjectSubcontractAgreements';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getSubcontractLibraryUrl } from '@/lib/navigation/procurement-urls';
import { Link } from '@/lib/workspace/navigation';
import { NewAgreementButton } from '@/components/projects/procurement/subcontracts/SubcontractCreateButtons';
import { SubcontractAgreementsList } from '@/components/projects/procurement/subcontracts/SubcontractAgreementsList';
import routeSlice from '@/i18n/generated/routes/o__workspace__procurement__subcontracts.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export function MasterAgreementsClient() {
  const { t } = useTranslation('procurement');
  const { items, loading, error } = useCompanyMasterSubcontractAgreements();
  return (
    <section aria-labelledby="masters-title" className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <hgroup>
          <h2 id="masters-title" className="text-lg font-semibold">{t('subcontracts.masters.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('subcontracts.masters.subtitle')}</p>
        </hgroup>
        <nav aria-label={t('subcontracts.masters.related')} className="flex flex-wrap items-center gap-3">
          <Link href={getSubcontractLibraryUrl()} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <BookOpen className="h-4 w-4" aria-hidden />{t('nav.subcontractLibrary')}
          </Link>
          <NewAgreementButton projectId={null} />
        </nav>
      </header>
      <SubcontractAgreementsList projectId={null} items={items} loading={loading} error={error} emptyText={t('subcontracts.masters.empty')} />
    </section>
  );
}
