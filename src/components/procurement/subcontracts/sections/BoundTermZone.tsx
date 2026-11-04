'use client';

/**
 * **Η ζώνη της ρήτρας δίπλα στο πεδίο του όρου** (ADR-928 Φ3γ-2 απόφαση 2, Ironclad «σημάδι στο σημείο»).
 *
 * Ο άνθρωπος αλλάζει την κράτηση στους όρους· εδώ βλέπει αμέσως ότι βγήκε από το playbook της ρήτρας «Κράτηση καλής
 * εκτέλεσης», γράφει τον λόγο, και βλέπει τα ευρήματα του κριτή για αυτή την παράμετρο. Είναι **η μόνη** θέση εισαγωγής
 * του λόγου. Η κάρτα της ρήτρας τον δείχνει μόνο για ανάγνωση.
 */

import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { HumanLanguage } from '@/i18n/languages';
import type { BoundTerm } from '@/subapps/procurement/subcontracts/agreements/bound-terms';
import { issuesAt } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import { FieldIssues } from '../editor/FieldIssues';
import { ParameterZoneBadge, zoneOf } from '../editor/ParameterZoneBadge';
import type { BoundTermsView } from './section-types';

interface BoundTermZoneProps {
  /** Το πεδίο, σχετικό με το τμήμα της ενότητας (π.χ. `retention.rate` στο σχέδιο πληρωμών). */
  readonly termPath: string;
  readonly bound: BoundTermsView;
  readonly issues: readonly SubcontractIssue[];
  readonly language: HumanLanguage;
}

function BoundOne({ bound, view, issues, language }: { readonly bound: BoundTerm; readonly view: BoundTermsView; readonly issues: readonly SubcontractIssue[]; readonly language: HumanLanguage }) {
  const { t } = useTranslation('procurement');
  const label = localizedIn(bound.definition.label, language);
  const { setReason } = view;
  return (
    <li className="space-y-1">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {t('subcontracts.sections.bound.governedBy', { clause: view.titleOf(bound.clauseKey), parameter: label })}
        <ParameterZoneBadge verdict={bound.verdict} />
      </p>
      {setReason && zoneOf(bound.verdict) === 'needsApproval' && (
        <Textarea aria-label={t('subcontracts.editor.clauses.reason')} placeholder={t('subcontracts.editor.clauses.reasonPlaceholder')} rows={2}
          value={bound.reason} onChange={(event) => setReason(bound, event.target.value)} />
      )}
      <FieldIssues issues={issuesAt(issues, bound.clausePath)} />
    </li>
  );
}

export function BoundTermZone({ termPath, bound, issues, language }: BoundTermZoneProps) {
  const governing = bound.at(termPath);
  if (governing.length === 0) return null;
  return (
    <ul className="space-y-1">
      {governing.map((one) => <BoundOne key={one.clausePath} bound={one} view={bound} issues={issues} language={language} />)}
    </ul>
  );
}
