'use client';

/**
 * **Σύγκριση δύο εκδόσεων σε δύο κανάλια** (ADR-928 Φ3γ-0): το κείμενο λέξη-προς-λέξη όπως τυπώνεται **και** οι
 * παράμετροι ανά πτυχή, με την ερώτηση του εγκρίνοντος: «η μέχρι σήμερα συνηθισμένη τιμή είναι ακόμη ελεύθερη;».
 *
 * 🔑 Η διαφορά είναι του καθαρού `diffClauseVersions` (ίδιος `renderClauseBlocks`, ίδιος `toleranceVerdict`)· εδώ μόνο
 *    τοποθέτηση. `<ins>`/`<del>` = σημασιολογία που διαβάζει και ο αναγνώστης οθόνης, όχι μόνο χρώμα (ADR-771).
 */

import { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { CLAUSE_AUTHORITATIVE_LANGUAGE } from '@/subapps/procurement/subcontracts/types/clause';
import { documentLocaleOf } from '@/subapps/procurement/subcontracts/document/document-locale';
import { localizedIn, renderParameterValue } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import { diffClauseVersions, type ComparableClause, type ParameterChange } from '@/subapps/procurement/subcontracts/library/clause-version-diff';
import { hasTextChange, type TextDiffPart } from '@/subapps/procurement/subcontracts/library/text-diff';
import { ParameterZoneBadge } from '../editor/ParameterZoneBadge';

const AUTHORITATIVE = documentLocaleOf(CLAUSE_AUTHORITATIVE_LANGUAGE);

function TextDiff({ parts }: { readonly parts: readonly TextDiffPart[] }) {
  return (
    <p className="m-0 whitespace-pre-wrap rounded-md border bg-card p-3 text-sm leading-relaxed">
      {parts.map((part, index) => {
        if (part.kind === 'added') return <ins key={index} className="rounded-sm bg-[hsl(var(--bg-success))] px-0.5 no-underline">{part.text}</ins>;
        if (part.kind === 'removed') return <del key={index} className="rounded-sm bg-[hsl(var(--bg-error))] px-0.5">{part.text}</del>;
        return <span key={index}>{part.text}</span>;
      })}
    </p>
  );
}

function ChangeLine({ change }: { readonly change: ParameterChange }) {
  const { t, i18n } = useTranslation('procurement');
  const locale = documentLocaleOf(resolveHumanLanguage(i18n.language));
  const definition = change.change === 'removed' ? change.before : change.after;
  const label = localizedIn(definition.label, locale.language);
  if (change.change !== 'changed') {
    return <li><strong className="font-medium">{label}</strong> — {t(`subcontracts.library.diff.${change.change}`)}</li>;
  }
  const aspects = change.aspects.map((aspect) => t(`subcontracts.library.diff.aspects.${aspect}`)).join(', ');
  const before = renderParameterValue(change.before.preferred, change.before, locale);
  const after = renderParameterValue(change.after.preferred, change.after, locale);
  return (
    <li className="space-y-1">
      <span><strong className="font-medium">{label}</strong> — {aspects}</span>
      {change.aspects.includes('preferred') && <span className="block text-muted-foreground">{t('subcontracts.library.diff.preferredChange', { before, after })}</span>}
      {change.previousPreferredUnderNew !== null && (
        <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
          {t('subcontracts.library.diff.previousPreferred', { value: before })}
          <ParameterZoneBadge verdict={change.previousPreferredUnderNew} />
        </span>
      )}
    </li>
  );
}

interface ClauseVersionDiffViewProps {
  readonly before: ComparableClause | null;
  readonly after: ComparableClause;
}

export function ClauseVersionDiffView({ before, after }: ClauseVersionDiffViewProps) {
  const { t } = useTranslation('procurement');
  const diff = useMemo(() => diffClauseVersions(before, after, AUTHORITATIVE), [before, after]);
  if (before === null) return <p className="text-sm text-muted-foreground">{t('subcontracts.library.diff.firstVersion')}</p>;
  return (
    <section className="space-y-3">
      <h5 className="m-0 text-sm font-semibold">{t('subcontracts.library.diff.text')}</h5>
      {hasTextChange(diff.text) ? <TextDiff parts={diff.text} /> : <p className="text-sm text-muted-foreground">{t('subcontracts.library.diff.noTextChange')}</p>}
      <h5 className="m-0 text-sm font-semibold">{t('subcontracts.library.diff.parameters')}</h5>
      {diff.parameters.length > 0
        ? <ul className="m-0 list-disc space-y-2 pl-5 text-sm">{diff.parameters.map((change) => <ChangeLine key={`${change.change}:${change.key}`} change={change} />)}</ul>
        : <p className="text-sm text-muted-foreground">{t('subcontracts.library.diff.noParameterChange')}</p>}
    </section>
  );
}
