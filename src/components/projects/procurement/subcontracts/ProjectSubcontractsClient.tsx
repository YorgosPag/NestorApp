'use client';

/**
 * ProjectSubcontractsClient — η καρτέλα «Υπεργολαβίες» των προμηθειών ενός έργου (ADR-928 §5.14 · §5.15 · Φ3α-2 · Φ3γ ·
 * §5.24).
 *
 * Λεπτό: route slice του έργου + ζωντανή ανάγνωση (`useProjectSubcontractAgreements` — συμφωνητικά του έργου και κύριες
 * συμβάσεις με εντολή εργασίας εδώ) + η **κοινή** λίστα (`SubcontractAgreementsList`, ίδια με τη σελίδα κύριων
 * συμβάσεων). Κουμπιά: «Νέα εντολή εργασίας» (§5.24) και «Νέο» (`SubcontractCreateButtons`).
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useProjectSubcontractAgreements } from '@/hooks/procurement/subcontracts/useProjectSubcontractAgreements';
import { NewAgreementButton, NewWorkOrderButton } from './SubcontractCreateButtons';
import { SubcontractAgreementsList } from './SubcontractAgreementsList';
import routeSlice from '@/i18n/generated/routes/o__workspace__projects__id__procurement__subcontracts.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

interface Props {
  readonly projectId: string;
}

export function ProjectSubcontractsClient({ projectId }: Props) {
  const { t } = useTranslation('procurement');
  const { items, loading, error } = useProjectSubcontractAgreements(projectId);

  return (
    <section aria-labelledby="subcontracts-title" className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <hgroup>
          <h2 id="subcontracts-title" className="text-lg font-semibold">{t('subcontracts.list.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('subcontracts.list.subtitle')}</p>
        </hgroup>
        <section className="flex flex-wrap gap-2">
          <NewWorkOrderButton projectId={projectId} />
          <NewAgreementButton projectId={projectId} />
        </section>
      </header>
      <SubcontractAgreementsList projectId={projectId} items={items} loading={loading} error={error} emptyText={t('subcontracts.list.empty')} />
    </section>
  );
}
