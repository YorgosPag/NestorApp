'use client';

/**
 * **Η σελίδα συγγραφής ρήτρας** — κοινή για «Νέα ρήτρα» και «Πρόταση αλλαγής» (ADR-928 §5.22 · Φ3γ-0b-1).
 *
 * 🔑 Κέλυφος προμηθειών (`PageContainer` + `ProcurementSubNav` + `PageHeader`), όπως η βιβλιοθήκη· δρόμος πίσω στη
 *    βιβλιοθήκη (στη ρήτρα, όταν υπάρχει).
 * 🔑 Fail-closed: όσο φορτώνουν ρήτρες/εκδόσεις, «φόρτωση» — ποτέ κενό πρόχειρο που θα πρότεινε «νέα» έκδοση από το
 *    μηδέν. Άγνωστη ή ξένη ρήτρα ⇒ «δεν βρέθηκε».
 * 🔑 Ο επεξεργαστής (TipTap, κριτές, μοντέλο εγγράφου) φτάνει με `import()` (ADR-744 §34)· εδώ μόνο ό,τι ζωγραφίζει το
 *    πρώτο καρέ. Το route slice το καταχωρεί η λεπτή είσοδος κάθε σελίδας.
 */

import dynamic from 'next/dynamic';
import { AlertCircle, ArrowLeft, FilePen } from 'lucide-react';
import { PageContainer } from '@/core/containers';
import { PageHeader } from '@/core/headers';
import { StaticPageLoading } from '@/core/states';
import { useSubcontractLibraryAuthority } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import { useClauseVersions, useSubcontractClauseLibrary, useSubcontractTradeTemplates } from '@/hooks/procurement/subcontracts/useSubcontractLibrary';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { getSubcontractLibraryClauseUrl, getSubcontractLibraryUrl } from '@/lib/navigation/procurement-urls';
import { Link } from '@/lib/workspace/navigation';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import type { SubcontractClause } from '@/subapps/procurement/subcontracts/types/clause';

const ClauseAuthoringEditor = dynamic(() => import('./ClauseAuthoringEditor'), { ssr: false, loading: () => <StaticPageLoading /> });

interface ClauseAuthoringPageProps {
  /** `null` = νέα ρήτρα· αλλιώς πρόταση νέας έκδοσης αυτής της ρήτρας. */
  readonly clauseId: string | null;
}

function BackLink({ clauseId }: ClauseAuthoringPageProps) {
  const { t } = useTranslation('procurement');
  return (
    <nav aria-label={t('subcontracts.library.authoring.breadcrumb')} className="px-2">
      <Link href={clauseId ? getSubcontractLibraryClauseUrl(clauseId) : getSubcontractLibraryUrl()} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden />{t('subcontracts.library.title')}
      </Link>
    </nav>
  );
}

function useHeading(clause: SubcontractClause | null, isNew: boolean): string {
  const { t, i18n } = useTranslation('procurement');
  if (isNew) return t('subcontracts.library.authoring.newTitle');
  return clause ? t('subcontracts.library.authoring.proposeTitle', { title: localizedIn(clause.title, resolveHumanLanguage(i18n.language)) }) : t('subcontracts.library.authoring.proposeTitleBare');
}

export function ClauseAuthoringPage({ clauseId }: ClauseAuthoringPageProps) {
  const { t } = useTranslation('procurement');
  const library = useSubcontractClauseLibrary({ includeArchived: true });
  const templates = useSubcontractTradeTemplates();
  const authority = useSubcontractLibraryAuthority();
  const history = useClauseVersions(clauseId);
  const clause = clauseId ? library.clauses.find((candidate) => candidate.id === clauseId) ?? null : null;
  const loading = library.loading || templates.loading || history.loading;
  const title = useHeading(clause, clauseId === null);
  return (
    <PageContainer ariaLabel={title}>
      <div className="mt-2 px-2"><ProcurementSubNav className="mb-0" /></div>
      <PageHeader variant="sticky-rounded" layout="compact" spacing="compact" title={{ icon: FilePen, title, subtitle: t('subcontracts.library.authoring.lead') }} />
      <BackLink clauseId={clauseId} />
      <section className="px-2">
        {loading && <StaticPageLoading />}
        {!loading && clauseId !== null && clause === null && (
          <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />{t('subcontracts.library.authoring.notFound')}
          </p>
        )}
        {!loading && (clauseId === null || clause !== null) && (
          <ClauseAuthoringEditor clause={clause} versions={history.versions} clauses={library.clauses} templates={templates.items} authority={authority} />
        )}
      </section>
    </PageContainer>
  );
}
