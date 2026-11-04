'use client';

/**
 * Μία ρήτρα του πρόχειρου: οι παράμετροί της με ζώνη δίπλα σε κάθε πεδίο, ο λόγος όπου η τιμή θέλει έγκριση, και η
 * απόφαση που έχει ήδη πάρει η αποθηκευμένη απόκλιση (ADR-928 §5.2.1 · Φ2 απόφαση 6 · Φ3γ).
 *
 * 🔑 Δεσμευμένη παράμετρος (`source: term`) **δεν** έχει πεδίο εδώ: η τιμή ζει στους όρους (μία φορά, Φ1 απόφαση 2).
 *    Αλλάζει από την ενότητα των όρων, όπου γράφεται και ο λόγος (Φ3γ-2 απόφαση 2). Εδώ φαίνονται τιμή, ζώνη, λόγος και
 *    ευρήματα, με σύνδεσμο προς το πεδίο.
 * 🔑 Καρφωμένη έκδοση που δεν είναι πια σε ισχύ ⇒ ορατό και **μία** ενέργεια «Ενημέρωση» (Figma «update available»).
 */

import { RotateCcw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { HumanLanguage } from '@/i18n/languages';
import { resolveParameterValue, type ClauseInForce, type ClauseSelectionInput } from '@/subapps/procurement/subcontracts/agreements/judge-deviations';
import { issuesAt, issuesUnder } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { joinPath, type SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { COMMERCIAL_TERM_BINDINGS } from '@/subapps/procurement/subcontracts/clauses/commercial-term-bindings';
import { toleranceVerdict } from '@/subapps/procurement/subcontracts/clauses/tolerance-verdict';
import { sameParameterValue, validateParameterValue } from '@/subapps/procurement/subcontracts/clauses/validate-clause-parameter';
import { documentLocaleOf } from '@/subapps/procurement/subcontracts/document/document-locale';
import { localizedIn, renderParameterValue } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import type { ClauseParameterDefinition, ClauseParameterValue, LocalizedText } from '@/subapps/procurement/subcontracts/types/clause-parameter';
import type { ClauseDeviation, CommercialTerms } from '@/subapps/procurement/subcontracts/types/commercial-terms';
import { ClauseParameterInput } from './ClauseParameterInput';
import { FieldIssues } from './FieldIssues';
import { ParameterZoneBadge, zoneOf } from './ParameterZoneBadge';

export interface ClauseCardEdits {
  readonly setValue: (key: string, value: ClauseParameterValue) => void;
  readonly setReason: (key: string, reason: string) => void;
  readonly reset: (key: string) => void;
  readonly remove: () => void;
  readonly upgrade: (() => void) | null;
}

export interface ClauseCardProps {
  readonly index: number;
  readonly input: ClauseSelectionInput;
  readonly title: LocalizedText | null;
  /** `undefined` = άγνωστη/αρχειοθετημένη · `null` = χωρίς έκδοση σε ισχύ. */
  readonly inForce: ClauseInForce | null | undefined;
  readonly terms: CommercialTerms;
  /** Οι αποκλίσεις της **αποθηκευμένης** επιλογής — η απόφαση που υπάρχει ήδη. */
  readonly savedDeviations: Readonly<Record<string, ClauseDeviation>>;
  readonly issues: readonly SubcontractIssue[];
  readonly language: HumanLanguage;
  readonly edits: ClauseCardEdits;
}

interface ParameterRowProps extends Omit<ClauseCardProps, 'title' | 'inForce' | 'edits'> {
  readonly definition: ClauseParameterDefinition;
  readonly edits: ClauseCardEdits;
}

/** Η ενότητα όπου ζει το πεδίο του όρου — εκεί οδηγεί ο σύνδεσμος «Αλλαγή στους όρους». */
const sectionOfTerm = (definition: ClauseParameterDefinition): string =>
  definition.source.kind === 'term' && COMMERCIAL_TERM_BINDINGS[definition.source.term].termPath.startsWith('paymentPlan.')
    ? '#editor-plan'
    : '#editor-terms';

/**
 * Δεσμευμένη παράμετρος: η τιμή από τους όρους, η ζώνη, ο λόγος (μόνο ανάγνωση, γράφεται στο πεδίο του όρου) και τα
 * ευρήματα του κριτή στο **δικό της** μονοπάτι. Πριν τη Φ3γ-2 τα ευρήματα αυτά δεν φαίνονταν πουθενά (ADR-928 §5.21).
 */
function BoundParameter({ index, input, definition, terms, issues, language }: Pick<ParameterRowProps, 'index' | 'input' | 'definition' | 'terms' | 'issues' | 'language'>) {
  const { t } = useTranslation('procurement');
  const value = resolveParameterValue(definition, {}, terms);
  const reason = input.deviationReasons[definition.key];
  return (
    <li className="space-y-1">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{localizedIn(definition.label, language)}</span>
        <span>{value ? renderParameterValue(value, definition, documentLocaleOf(language)) : '—'}</span>
        {value && <ParameterZoneBadge verdict={toleranceVerdict(definition, value)} />}
        <a href={sectionOfTerm(definition)} className="text-xs text-foreground underline underline-offset-2">{t('subcontracts.sections.bound.editInTerms')}</a>
      </p>
      {reason && <p className="text-xs text-muted-foreground">{t('subcontracts.sections.bound.reason', { reason })}</p>}
      <FieldIssues issues={issuesAt(issues, joinPath('clauses', index, 'parameterValues', definition.key))} />
    </li>
  );
}

function DeviationState({ deviation }: { readonly deviation: ClauseDeviation | undefined }) {
  const { t } = useTranslation('procurement');
  if (!deviation) return null;
  const variant = deviation.decision === 'approved' ? 'success' : deviation.decision === 'rejected' ? 'destructive' : 'warning';
  return <Badge variant={variant}>{t(`subcontracts.editor.deviation.${deviation.decision}`)}</Badge>;
}

function ParameterRow({ index, input, definition, terms, savedDeviations, issues, language, edits }: ParameterRowProps) {
  const { t } = useTranslation('procurement');
  const path = joinPath('clauses', index, 'parameterValues', definition.key);
  const id = `clause-${index}-${definition.key}`;
  const value = resolveParameterValue(definition, input.parameterValues, terms) ?? definition.preferred;
  const valid = validateParameterValue(definition, value, path).length === 0;
  const verdict = valid ? toleranceVerdict(definition, value) : null;
  const shown = issuesAt(issues, path);
  return (
    <li className="space-y-1.5">
      <header className="flex flex-wrap items-center gap-2">
        <Label htmlFor={id}>{localizedIn(definition.label, language)}</Label>
        {verdict && <ParameterZoneBadge verdict={verdict} />}
        <DeviationState deviation={savedDeviations[definition.key]} />
        {!sameParameterValue(value, definition.preferred) && (
          <Button type="button" variant="ghost" size="sm" onClick={() => edits.reset(definition.key)}>
            <RotateCcw className="mr-1 h-3 w-3" aria-hidden />{t('subcontracts.editor.clauses.resetPreferred')}
          </Button>
        )}
      </header>
      <ClauseParameterInput id={id} definition={definition} value={value} language={language} describedBy={`${id}-issues`} onChange={(next) => edits.setValue(definition.key, next)} />
      {verdict && zoneOf(verdict) === 'needsApproval' && (
        <Textarea aria-label={t('subcontracts.editor.clauses.reason')} placeholder={t('subcontracts.editor.clauses.reasonPlaceholder')} value={input.deviationReasons[definition.key] ?? ''} onChange={(event) => edits.setReason(definition.key, event.target.value)} rows={2} />
      )}
      <FieldIssues id={`${id}-issues`} issues={shown} />
    </li>
  );
}

function VersionNotice({ inForce, input, upgrade }: { inForce: ClauseInForce | null | undefined; input: ClauseSelectionInput; upgrade: (() => void) | null }) {
  const { t } = useTranslation('procurement');
  if (inForce === undefined) return <p role="alert" className="text-sm text-destructive">{t('subcontracts.editor.clauses.unknown')}</p>;
  if (inForce === null) return <p role="alert" className="text-sm text-destructive">{t('subcontracts.editor.clauses.notApproved')}</p>;
  if (inForce.version === input.version) return null;
  return (
    <p role="alert" className="flex flex-wrap items-center gap-2 text-sm">
      {t('subcontracts.editor.clauses.outdated', { pinned: input.version, current: inForce.version })}
      {upgrade && <Button type="button" size="sm" variant="outline" onClick={upgrade}>{t('subcontracts.editor.clauses.upgrade')}</Button>}
    </p>
  );
}

export function ClauseCard(props: ClauseCardProps) {
  const { t } = useTranslation('procurement');
  const { index, input, title, inForce, issues, language, edits } = props;
  const heading = title ? localizedIn(title, language) : input.clauseKey;
  const own = issuesAt(issues, joinPath('clauses', index)).concat(issuesAt(issues, joinPath('clauses', index, 'clauseKey')));
  return (
    <article aria-label={heading} className="space-y-3 rounded-lg border p-3">
      <header className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold">{heading}<span className="ml-2 text-xs font-normal text-muted-foreground">{input.clauseKey} · v{input.version}</span></h4>
        <Button type="button" variant="ghost" size="icon" aria-label={t('subcontracts.editor.clauses.remove', { clause: heading })} onClick={edits.remove}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </header>
      <VersionNotice inForce={inForce} input={input} upgrade={edits.upgrade} />
      <FieldIssues issues={own} />
      {inForce && inForce.version === input.version && (
        <ul className="space-y-3">
          {inForce.parameters.map((definition) => (definition.source.kind === 'term'
            ? <BoundParameter key={definition.key} index={index} input={input} definition={definition} terms={props.terms} issues={issues} language={language} />
            : <ParameterRow key={definition.key} {...props} definition={definition} issues={issuesUnder(issues, joinPath('clauses', index))} />))}
        </ul>
      )}
    </article>
  );
}
