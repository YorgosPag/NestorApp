'use client';

/**
 * SubcontractAgreementDetailClient — η σελίδα ενός συμφωνητικού υπεργολαβίας (ADR-928 Φ3γ απόφαση 5).
 *
 * Ιδιοκτησία κατάστασης:
 *   - έγγραφο → ζωντανή ανάγνωση (`useSubcontractAgreement`): η αλλαγή άλλου φτάνει αμέσως·
 *   - πρόχειρο, κρίση, αποθήκευση → μέσα στο σώμα (`AgreementDetailBody`), που φορτώνεται με `import()`.
 * Ανύπαρκτο ή ξένου χώρου ⇒ «δεν βρέθηκε» — δεν ξεχωρίζουν (ADR-742).
 */

import dynamic from 'next/dynamic';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SubcontractAgreementStatusBadge } from '@/components/procurement/subcontracts/SubcontractAgreementStatusBadge';
import { useSubcontractAgreement } from '@/hooks/procurement/subcontracts/useSubcontractAgreement';
import { getProjectProcurementUrl } from '@/lib/navigation/procurement-urls';
import { Link } from '@/lib/workspace/navigation';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import { CLAUSE_AUTHORITATIVE_LANGUAGE } from '@/subapps/procurement/subcontracts/types/clause';
import { KpiChartSkeleton } from '../overview/skeleton/KpiSkeleton';
import routeSlice from '@/i18n/generated/routes/o__workspace__projects__id__procurement__subcontracts__agreementId.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

// Επεξεργαστής, μοντέλο εγγράφου, κριτής και bundles εγγράφου φτάνουν μόνο εδώ (ADR-744 §34 · ADR-928 §5.17).
const AgreementDetailBody = dynamic(() => import('@/components/procurement/subcontracts/editor/AgreementDetailBody'), {
  ssr: false,
  loading: () => <KpiChartSkeleton />,
});

interface Props {
  readonly projectId: string;
  readonly agreementId: string;
}

function DetailHeader({ agreement }: { readonly agreement: SubcontractAgreement }) {
  const { t } = useTranslation(['procurement', 'quotes']);
  // ADR-928 §5.20 #1: ο τίτλος στη γλώσσα του ΕΓΓΡΑΦΟΥ (το ελληνικό που επεξεργάζεται το πεδίο «Τίτλος»), όχι της οθόνης.
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <hgroup className="space-y-1">
        <h2 className="flex flex-wrap items-center gap-3 text-lg font-semibold">
          <span className="font-mono">{agreement.documentNumber}</span>
          <span>{agreement.title[CLAUSE_AUTHORITATIVE_LANGUAGE] || agreement.documentNumber}</span>
          <SubcontractAgreementStatusBadge status={agreement.status} />
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(`quotes:trades.${agreement.trade}`)} · {agreement.parties.subcontractor.name} · {t(`subcontracts.list.role.${agreement.role}`)}
        </p>
      </hgroup>
    </header>
  );
}

export function SubcontractAgreementDetailClient({ projectId, agreementId }: Props) {
  const { t } = useTranslation('procurement');
  const read = useSubcontractAgreement(agreementId);
  return (
    <section className="space-y-4">
      <nav aria-label={t('subcontracts.editor.breadcrumb')}>
        <Link href={getProjectProcurementUrl(projectId, 'subcontracts')} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden />{t('subcontracts.list.title')}
        </Link>
      </nav>
      {read.state === 'loading' && <KpiChartSkeleton />}
      {read.state === 'missing' && (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />{t('subcontracts.editor.notFound')}
        </p>
      )}
      {read.state === 'ready' && (
        <>
          <DetailHeader agreement={read.agreement} />
          <AgreementDetailBody agreement={read.agreement} projectId={projectId} />
        </>
      )}
    </section>
  );
}
