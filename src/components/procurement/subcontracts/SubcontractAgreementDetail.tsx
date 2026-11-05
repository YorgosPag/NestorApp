'use client';

/**
 * Η σελίδα ενός συμφωνητικού υπεργολαβίας — **κοινή** για το πλαίσιο έργου και το πλαίσιο εταιρείας (ADR-928 Φ3γ
 * απόφαση 5 · §5.24). Κάθε πλαίσιο είναι λεπτός φάκελος που καταχωρεί το δικό του route slice (ADR-744) και λέει πού
 * γυρίζει το «πίσω».
 *
 * Ιδιοκτησία κατάστασης:
 *   - έγγραφο → ζωντανή ανάγνωση (`useSubcontractAgreement`): η αλλαγή άλλου (και μια νέα εντολή εργασίας) φτάνει αμέσως·
 *   - πρόχειρο, κρίση, αποθήκευση → μέσα στο σώμα (`AgreementDetailBody`), που φορτώνεται με `import()`.
 * Ανύπαρκτο ή ξένου χώρου ⇒ «δεν βρέθηκε» — δεν ξεχωρίζουν (ADR-742).
 */

import dynamic from 'next/dynamic';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SubcontractAgreementStatusBadge } from '@/components/procurement/subcontracts/SubcontractAgreementStatusBadge';
import { KpiChartSkeleton } from '@/components/projects/procurement/overview/skeleton/KpiSkeleton';
import { useSubcontractAgreement } from '@/hooks/procurement/subcontracts/useSubcontractAgreement';
import { getMasterAgreementsUrl, getProjectProcurementUrl } from '@/lib/navigation/procurement-urls';
import { Link } from '@/lib/workspace/navigation';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import { CLAUSE_AUTHORITATIVE_LANGUAGE } from '@/subapps/procurement/subcontracts/types/clause';

// Επεξεργαστής, μοντέλο εγγράφου, κριτής και bundles εγγράφου φτάνουν μόνο εδώ (ADR-744 §34 · ADR-928 §5.17).
const AgreementDetailBody = dynamic(() => import('@/components/procurement/subcontracts/editor/AgreementDetailBody'), {
  ssr: false,
  loading: () => <KpiChartSkeleton />,
});

interface SubcontractAgreementDetailProps {
  /** Το έργο του πλαισίου· `null` ⇒ η εταιρεία (κύριες συμβάσεις). */
  readonly projectId: string | null;
  readonly agreementId: string;
}

/**
 * Ο τίτλος του εγγράφου. Μπαίνει **μέσα** στη γραμμή κεφαλίδας του σώματος (§5.23 — δεξιά οι ενέργειες), άρα εδώ μόνο
 * `hgroup`: τη `header` την κατέχει το σώμα.
 */
function DetailTitle({ agreement }: { readonly agreement: SubcontractAgreement }) {
  const { t } = useTranslation(['procurement', 'quotes']);
  // ADR-928 §5.20 #1: ο τίτλος στη γλώσσα του ΕΓΓΡΑΦΟΥ (το ελληνικό που επεξεργάζεται το πεδίο «Τίτλος»), όχι της οθόνης.
  return (
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
  );
}

function BackLink({ projectId }: { readonly projectId: string | null }) {
  const { t } = useTranslation('procurement');
  const href = projectId === null ? getMasterAgreementsUrl() : getProjectProcurementUrl(projectId, 'subcontracts');
  return (
    <nav aria-label={t('subcontracts.editor.breadcrumb')}>
      <Link href={href} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden />{t(projectId === null ? 'subcontracts.masters.title' : 'subcontracts.list.title')}
      </Link>
    </nav>
  );
}

export function SubcontractAgreementDetail({ projectId, agreementId }: SubcontractAgreementDetailProps) {
  const { t } = useTranslation('procurement');
  const read = useSubcontractAgreement(agreementId);
  return (
    <section className="space-y-4">
      <BackLink projectId={projectId} />
      {read.state === 'loading' && <KpiChartSkeleton />}
      {read.state === 'missing' && (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />{t('subcontracts.editor.notFound')}
        </p>
      )}
      {read.state === 'ready' && (
        <AgreementDetailBody agreement={read.agreement} projectId={projectId} title={<DetailTitle agreement={read.agreement} />} />
      )}
    </section>
  );
}
