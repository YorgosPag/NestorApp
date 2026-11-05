'use client';

/**
 * **Η σελίδα του επεξεργαστή προτύπου** — κοινή για «Νέο πρότυπο» και «Επεξεργασία» (ADR-928 §5.22 · Φ3γ-0b-2).
 *
 * 🔑 Κέλυφος προμηθειών, όπως η βιβλιοθήκη· δρόμος πίσω στο πρότυπο (ή στην καρτέλα «Πρότυπα»).
 * 🔑 Νέο πρότυπο = αντίγραφο ενός υπάρχοντος (`?from=<id>`, αλλιώς το πρώτο ενεργό)· αν δεν υπάρχει κανένα, ο
 *    επεξεργαστής ξεκινά από το προτεινόμενο της βιβλιοθήκης του Nestor App (με `import()`).
 * 🔑 Fail-closed: όσο φορτώνουν πρότυπα/ρήτρες, «φόρτωση»· άγνωστο πρότυπο ⇒ «δεν βρέθηκε».
 * 🔑 Ο επεξεργαστής (κριτές, μοντέλο εγγράφου, ενότητες) φτάνει με `import()` (ADR-744 §34).
 * ⚠️ `useSearchParams` (`?from=`) ⇒ η σελίδα τυλίγει σε `<Suspense>` (CHECK 3.55).
 */

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, LayoutTemplate } from 'lucide-react';
import { PageContainer } from '@/core/containers';
import { PageHeader } from '@/core/headers';
import { StaticPageLoading } from '@/core/states';
import { useSubcontractLibraryAuthority } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import { useSubcontractClauseLibrary, useSubcontractTradeTemplates } from '@/hooks/procurement/subcontracts/useSubcontractLibrary';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { getSubcontractLibraryTemplateUrl, getSubcontractLibraryUrl } from '@/lib/navigation/procurement-urls';
import { Link } from '@/lib/workspace/navigation';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import type { SubcontractTradeTemplate } from '@/subapps/procurement/subcontracts/types/trade-template';

const TemplateEditor = dynamic(() => import('./TemplateEditorLoader'), { ssr: false, loading: () => <StaticPageLoading /> });

interface TemplateEditorPageProps {
  /** `null` = νέο πρότυπο. */
  readonly templateId: string | null;
}

function useHeading(template: SubcontractTradeTemplate | null, isNew: boolean): string {
  const { t, i18n } = useTranslation('procurement');
  if (isNew) return t('subcontracts.library.templateEditor.newTitle');
  return template ? t('subcontracts.library.templateEditor.editTitle', { title: localizedIn(template.title, resolveHumanLanguage(i18n.language)) }) : t('subcontracts.library.templateEditor.editTitleBare');
}

export function TemplateEditorPage({ templateId }: TemplateEditorPageProps) {
  const { t } = useTranslation('procurement');
  const from = useSearchParams()?.get('from') ?? null;
  const library = useSubcontractClauseLibrary({ includeArchived: true });
  const templates = useSubcontractTradeTemplates({ includeArchived: true });
  const authority = useSubcontractLibraryAuthority();
  const template = templateId ? templates.items.find((candidate) => candidate.id === templateId) ?? null : null;
  const loading = library.loading || templates.loading;
  const title = useHeading(template, templateId === null);
  return (
    <PageContainer ariaLabel={title}>
      <div className="mt-2 px-2"><ProcurementSubNav className="mb-0" /></div>
      <PageHeader variant="sticky-rounded" layout="compact" spacing="compact" title={{ icon: LayoutTemplate, title, subtitle: t('subcontracts.library.templateEditor.lead') }} />
      <nav aria-label={t('subcontracts.library.authoring.breadcrumb')} className="px-2">
        <Link href={templateId ? getSubcontractLibraryTemplateUrl(templateId) : getSubcontractLibraryUrl()} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden />{t('subcontracts.library.title')}
        </Link>
      </nav>
      <section className="px-2">
        {loading && <StaticPageLoading />}
        {!loading && templateId !== null && template === null && (
          <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />{t('subcontracts.library.templateEditor.notFound')}
          </p>
        )}
        {!loading && (templateId === null || template !== null) && (
          <TemplateEditor template={template} sourceId={from} templates={templates.items} clauses={library.clauses} library={library.library} authority={authority} />
        )}
      </section>
    </PageContainer>
  );
}
