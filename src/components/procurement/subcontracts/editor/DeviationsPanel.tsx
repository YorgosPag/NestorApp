'use client';

/**
 * Οι αποκλίσεις του **αποθηκευμένου** εγγράφου και η απόφαση πάνω τους (ADR-928 §5.2.1 · Φ3γ απόφαση 6).
 *
 * 🔑 Τα κουμπιά απόφασης κρίνονται από τους φύλακες του γραφέα (`deviationDecisionBlock`): ο αιτών **δεν** τα βλέπει
 *    (διάκριση καθηκόντων — όπως ο Ironclad θέλει «additional clause approver»), ούτε όποιος δεν έχει δικαίωμα.
 *    Με μη αποθηκευμένες αλλαγές φαίνονται **ανενεργά με αιτία**: η απόφαση αφορά την αποθηκευμένη εκδοχή.
 * 🔑 Η τιμή φαίνεται με τη λέξη του εγγράφου (`renderParameterValue`), όχι ως ωμό JSON.
 */

import { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useUserDisplayNames } from '@/hooks/useUserDisplayNames';
import { useSubcontractClauseLibrary } from '@/hooks/procurement/subcontracts/useSubcontractLibrary';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { deviationDecisionBlock, deviationRowsOf, type DeviationRow } from '@/subapps/procurement/subcontracts/agreements/deviation-decisions';
import { documentLocaleOf } from '@/subapps/procurement/subcontracts/document/document-locale';
import { localizedIn, renderParameterValue } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import { DecideDeviationDialog, type DeviationDecision } from './DecideDeviationDialog';

interface DeviationsPanelProps {
  readonly agreement: SubcontractAgreement;
  readonly canApprove: boolean;
  readonly unsaved: boolean;
}

/** Ρήτρα · παράμετρος · τιμή, στη γλώσσα της οθόνης — από τους ορισμούς της βιβλιοθήκης. */
function useDescribeRow(): (row: DeviationRow) => { clause: string; parameter: string; value: string } {
  const { i18n } = useTranslation('procurement');
  const language = resolveHumanLanguage(i18n.language);
  const { clauses, library } = useSubcontractClauseLibrary();
  return (row) => {
    const definition = library.get(row.clauseKey)?.parameters.find((parameter) => parameter.key === row.parameterKey);
    const title = clauses.find((clause) => clause.clauseKey === row.clauseKey)?.title;
    return {
      clause: title ? localizedIn(title, language) : row.clauseKey,
      parameter: definition ? localizedIn(definition.label, language) : row.parameterKey,
      value: renderParameterValue(row.deviation.value, definition, documentLocaleOf(language)),
    };
  };
}

function DecisionBadge({ row }: { readonly row: DeviationRow }) {
  const { t } = useTranslation('procurement');
  const { decision } = row.deviation;
  const variant = decision === 'approved' ? 'success' : decision === 'rejected' ? 'destructive' : 'warning';
  return <Badge variant={variant}>{t(`subcontracts.editor.deviation.${decision}`)}</Badge>;
}

interface RowViewProps {
  readonly row: DeviationRow;
  readonly text: { readonly clause: string; readonly parameter: string; readonly value: string };
  readonly requester: string;
  readonly block: ReturnType<typeof deviationDecisionBlock>;
  readonly onDecide: (decision: DeviationDecision) => void;
}

function DeviationRowView({ row, text, requester, block, onDecide }: RowViewProps) {
  const { t } = useTranslation('procurement');
  const offered = block === null || block === 'unsavedChanges';
  return (
    <tr className="border-t align-top">
      <td className="py-2">{text.clause}<span className="block text-xs text-muted-foreground">{text.parameter}</span></td>
      <td className="py-2">{text.value}</td>
      <td className="py-2">{row.deviation.reason}{row.deviation.decisionReason && <span className="block text-xs text-muted-foreground">{row.deviation.decisionReason}</span>}</td>
      <td className="py-2">{requester}</td>
      <td className="py-2"><DecisionBadge row={row} /></td>
      <td className="py-2">
        {offered && (
          <span className="flex flex-wrap items-center gap-1">
            <Button type="button" size="sm" variant="outline" disabled={block !== null} onClick={() => onDecide('approved')}><Check className="mr-1 h-3 w-3" aria-hidden />{t('subcontracts.editor.deviations.approve')}</Button>
            <Button type="button" size="sm" variant="outline" disabled={block !== null} onClick={() => onDecide('rejected')}><X className="mr-1 h-3 w-3" aria-hidden />{t('subcontracts.editor.deviations.reject')}</Button>
            {block === 'unsavedChanges' && <span className="text-xs text-muted-foreground">{t('subcontracts.editor.saveFirst')}</span>}
          </span>
        )}
      </td>
    </tr>
  );
}

function DeviationsHead() {
  const { t } = useTranslation('procurement');
  return (
    <thead className="text-left text-muted-foreground">
      <tr>
        <th>{t('subcontracts.editor.deviations.clause')}</th>
        <th>{t('subcontracts.editor.deviations.value')}</th>
        <th>{t('subcontracts.editor.deviations.reason')}</th>
        <th>{t('subcontracts.editor.deviations.requestedBy')}</th>
        <th>{t('subcontracts.editor.deviations.state')}</th>
        <th><span className="sr-only">{t('subcontracts.editor.deviations.actions')}</span></th>
      </tr>
    </thead>
  );
}

export function DeviationsPanel({ agreement, canApprove, unsaved }: DeviationsPanelProps) {
  const { t } = useTranslation('procurement');
  const actorUid = useAuth().user?.uid ?? '';
  const rows = useMemo(() => deviationRowsOf(agreement), [agreement]);
  const names = useUserDisplayNames(useMemo(() => [...new Set(rows.map((row) => row.deviation.requestedBy))], [rows]));
  const describe = useDescribeRow();
  const [deciding, setDeciding] = useState<{ row: DeviationRow; decision: DeviationDecision } | null>(null);
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="agreement-deviations" className="space-y-2">
      <h3 id="agreement-deviations" className="text-base font-semibold">{t('subcontracts.editor.deviations.title')}</h3>
      <Table>
        <DeviationsHead />
        <tbody>
          {rows.map((row) => (
            <DeviationRowView
              key={`${row.clauseKey}:${row.parameterKey}`}
              row={row}
              text={describe(row)}
              requester={names.get(row.deviation.requestedBy) ?? t('subcontracts.editor.deviations.unknownUser')}
              block={deviationDecisionBlock(agreement, row, { actorUid, canApprove, unsaved })}
              onDecide={(decision) => setDeciding({ row, decision })}
            />
          ))}
        </tbody>
      </Table>
      {deciding && (
        <DecideDeviationDialog
          agreement={agreement}
          row={deciding.row}
          decision={deciding.decision}
          summary={(({ clause, parameter, value }) => `${clause} · ${parameter} · ${value}`)(describe(deciding.row))}
          onClose={() => setDeciding(null)}
        />
      )}
    </section>
  );
}
