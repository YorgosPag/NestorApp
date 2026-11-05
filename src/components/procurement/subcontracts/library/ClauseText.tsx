'use client';

/**
 * **Μια έκδοση ρήτρας όπως θα τυπωθεί** + ο πίνακας των παραμέτρων της με τις ζώνες (ADR-928 Φ3γ-0).
 *
 * 🔑 Το κείμενο είναι ο **ίδιος** `renderClauseBlocks` με το έγγραφο (`clausePrintedBlocks`) και ο **ίδιος**
 *    `DocumentBlocks` με την προεπισκόπηση: ό,τι εγκρίνεται εδώ είναι λέξη προς λέξη ό,τι θα τυπωθεί. Δεν υπάρχει
 *    «εγκρίνω χωρίς να δω».
 * 🔑 Το κείμενο της ρήτρας είναι στη γλώσσα του (ελληνικά, η αυθεντία)· οι **ετικέτες** και οι τιμές του πίνακα στη
 *    γλώσσα του UI — όπως το έγγραφο κάνει ήδη (`renderParameterValue` ανά γλώσσα εγγράφου).
 */

import { Table } from '@/components/ui/table';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { documentLocaleOf, type DocumentLocale } from '@/subapps/procurement/subcontracts/document/document-locale';
import { localizedIn, renderParameterValue } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import { clausePrintedBlocks, type ComparableClause } from '@/subapps/procurement/subcontracts/library/clause-version-diff';
import { toleranceTextOf, type ToleranceText } from '@/subapps/procurement/subcontracts/library/tolerance-text';
import { CLAUSE_AUTHORITATIVE_LANGUAGE } from '@/subapps/procurement/subcontracts/types/clause';
import type { ClauseParameterDefinition } from '@/subapps/procurement/subcontracts/types/clause-parameter';
import { DocumentBlocks } from '../document/AgreementDocumentPreview';
import { TERM_LABEL } from './library-labels';

const AUTHORITATIVE = documentLocaleOf(CLAUSE_AUTHORITATIVE_LANGUAGE);

export function ClausePrintedText({ clause }: { readonly clause: ComparableClause }) {
  return (
    <article className="space-y-2 rounded-md border bg-card p-4 text-sm leading-relaxed text-foreground">
      {clause.body.heading && <h4 className="m-0 text-base font-semibold">{clause.body.heading}</h4>}
      <DocumentBlocks blocks={clausePrintedBlocks(clause, AUTHORITATIVE)} />
    </article>
  );
}

export function useToleranceWords(): (text: ToleranceText) => string {
  const { t } = useTranslation('procurement');
  return (text) => {
    if (text.kind === 'none') return t('subcontracts.library.tolerance.none');
    if (text.kind === 'fixed') return t('subcontracts.library.tolerance.fixed');
    const parts = text.kind === 'range'
      ? [text.acceptable && t('subcontracts.library.tolerance.acceptable', { range: text.acceptable }), text.walkAway && t('subcontracts.library.tolerance.walkAway', { range: text.walkAway })]
      : [text.acceptable.length > 0 && t('subcontracts.library.tolerance.acceptable', { range: text.acceptable.join(', ') }), text.forbidden.length > 0 && t('subcontracts.library.tolerance.forbidden', { options: text.forbidden.join(', ') })];
    const said = parts.filter((part): part is string => typeof part === 'string' && part.length > 0);
    return said.length > 0 ? said.join(' · ') : t('subcontracts.library.tolerance.none');
  };
}

function ParameterRow({ parameter, locale }: { readonly parameter: ClauseParameterDefinition; readonly locale: DocumentLocale }) {
  const { t } = useTranslation('procurement');
  const toleranceWords = useToleranceWords();
  const source = parameter.source.kind === 'term' ? t(`subcontracts.library.terms.${TERM_LABEL[parameter.source.term]}`) : t('subcontracts.library.parameters.ownValue');
  return (
    <tr className="border-t align-top">
      <th scope="row" className="py-2 pr-3 text-left font-medium">{localizedIn(parameter.label, locale.language)}</th>
      <td className="py-2 pr-3">{renderParameterValue(parameter.preferred, parameter, locale)}</td>
      <td className="py-2 pr-3">{toleranceWords(toleranceTextOf(parameter, locale))}</td>
      <td className="py-2 text-muted-foreground">{source}</td>
    </tr>
  );
}

export function ClauseParametersTable({ parameters }: { readonly parameters: readonly ClauseParameterDefinition[] }) {
  const { t, i18n } = useTranslation('procurement');
  const locale = documentLocaleOf(resolveHumanLanguage(i18n.language));
  if (parameters.length === 0) return <p className="text-sm text-muted-foreground">{t('subcontracts.library.parameters.none')}</p>;
  return (
    <Table>
      <caption className="sr-only">{t('subcontracts.library.parameters.title')}</caption>
      <thead className="text-left text-xs text-muted-foreground">
        <tr>
          <th scope="col" className="pb-1 pr-3 font-medium">{t('subcontracts.library.parameters.parameter')}</th>
          <th scope="col" className="pb-1 pr-3 font-medium">{t('subcontracts.library.parameters.preferred')}</th>
          <th scope="col" className="pb-1 pr-3 font-medium">{t('subcontracts.library.parameters.zones')}</th>
          <th scope="col" className="pb-1 font-medium">{t('subcontracts.library.parameters.source')}</th>
        </tr>
      </thead>
      <tbody>{parameters.map((parameter) => <ParameterRow key={parameter.key} parameter={parameter} locale={locale} />)}</tbody>
    </Table>
  );
}
