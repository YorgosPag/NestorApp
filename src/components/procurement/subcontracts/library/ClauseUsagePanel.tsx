'use client';

/**
 * **Επίπτωση πριν την απόφαση** (ADR-928 Φ3γ-0): ποια πρότυπα δένουν τη ρήτρα (θα πάρουν τη νέα έκδοση σε κάθε **νέο**
 * συμφωνητικό) και ποια πρόχειρα είναι καρφωμένα σε ποια έκδοση («πίσω» = θα δουν «νέα έκδοση διαθέσιμη»).
 *
 * 🔑 Καθαρό `clauseUsageOf` πάνω σε δύο ζωντανές αναγνώσεις: τα πρότυπα (ήδη φορτωμένα στη σελίδα) και τα πρόχειρα της
 *    εταιρείας (υπάρχων δείκτης `companyId + status + updatedAt`). Τα εκδοθέντα **δεν** αλλάζουν (§5.6) — το λέμε ρητά.
 */

import { useMemo } from 'react';
import { useCompanyDraftSubcontractAgreements } from '@/hooks/procurement/subcontracts/useProjectSubcontractAgreements';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { getSubcontractAgreementUrl } from '@/lib/navigation/procurement-urls';
import { Link } from '@/lib/workspace/navigation';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import { clauseUsageOf, type DraftClauseUse } from '@/subapps/procurement/subcontracts/library/clause-usage';
import type { SubcontractClause } from '@/subapps/procurement/subcontracts/types/clause';
import type { SubcontractTradeTemplate } from '@/subapps/procurement/subcontracts/types/trade-template';

interface ClauseUsagePanelProps {
  readonly clause: Pick<SubcontractClause, 'clauseKey' | 'currentVersion'>;
  readonly templates: readonly SubcontractTradeTemplate[];
}

function DraftItem({ use, projectId }: { readonly use: DraftClauseUse; readonly projectId: string | undefined }) {
  const { t } = useTranslation('procurement');
  const label = `${use.agreement.documentNumber} · ${use.agreement.title}`;
  return (
    <li>
      {projectId ? <Link href={getSubcontractAgreementUrl(projectId, use.agreement.id)} className="underline-offset-2 hover:underline">{label}</Link> : label}
      <span className="ml-2 text-xs text-muted-foreground">
        {use.behind ? t('subcontracts.library.usage.behind', { version: use.pinnedVersion }) : t('subcontracts.library.usage.pinned', { version: use.pinnedVersion })}
      </span>
    </li>
  );
}

export function ClauseUsagePanel({ clause, templates }: ClauseUsagePanelProps) {
  const { t, i18n } = useTranslation(['procurement', 'quotes']);
  const language = resolveHumanLanguage(i18n.language);
  const drafts = useCompanyDraftSubcontractAgreements();
  const live = useMemo(() => templates.filter((template) => !template.isArchived), [templates]);
  const usage = useMemo(() => clauseUsageOf(clause.clauseKey, clause.currentVersion, live, drafts.items), [clause.clauseKey, clause.currentVersion, live, drafts.items]);
  const projectOf = (id: string) => drafts.items.find((agreement) => agreement.id === id)?.projectIds[0];

  return (
    <section aria-labelledby="clause-usage" className="space-y-2 text-sm">
      <h4 id="clause-usage" className="m-0 text-sm font-semibold">{t('subcontracts.library.usage.title')}</h4>
      <p className="m-0">{t('subcontracts.library.usage.templates', { count: usage.templates.length })}</p>
      {usage.templates.length > 0 && (
        <ul className="m-0 list-disc pl-5">
          {usage.templates.map((template) => <li key={template.id}>{localizedIn(template.title, language)} <span className="font-mono text-xs text-muted-foreground">{template.code}</span></li>)}
        </ul>
      )}
      {drafts.loading
        ? <p className="m-0 text-muted-foreground" role="status">{t('subcontracts.library.usage.loadingDrafts')}</p>
        : <p className="m-0">{t('subcontracts.library.usage.drafts', { count: usage.drafts.length })}</p>}
      {usage.drafts.length > 0 && (
        <ul className="m-0 list-disc pl-5">{usage.drafts.map((use) => <DraftItem key={use.agreement.id} use={use} projectId={projectOf(use.agreement.id)} />)}</ul>
      )}
      <p className="m-0 text-xs text-muted-foreground">{t('subcontracts.library.usage.issuedNote')}</p>
    </section>
  );
}
