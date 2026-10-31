'use client';

/**
 * @fileoverview **Έλεγχος μιας πρότασης** (ADR-923 §5.5): γραμμές με διαφορά ανά πεδίο, ευρήματα κανόνων, μαζικές αποφάσεις,
 *   έγκριση. Το PDF το κρατά η γονική όψη· εδώ μόνο δηλώνεται ποιο πεδίο εστιάστηκε.
 * @module components/catalog/imports/ProposalReview
 */

import React, { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type { ImportProposalField, ImportProposalRow } from '@/subapps/catalog/types/catalog-import';
import type { ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { PROPOSAL_STATUS_KEYS, ROW_ACTION_KEYS, useImportIssueMessage, useImportText } from './import-text';
import { ProposalFieldRow } from './ProposalFieldRow';
import type { ProposalChange } from './use-import-batch';

interface ProposalReviewProps {
  readonly proposal: ImportProposalWire;
  readonly focused: ImportProposalField | null;
  readonly onFocus: (field: ImportProposalField) => void;
  readonly onChange: (proposal: ImportProposalWire, change: ProposalChange) => void;
  readonly onApply: (proposal: ImportProposalWire) => void;
  readonly onReject: (proposal: ImportProposalWire) => void;
}

const pendingCount = (rows: readonly ImportProposalRow[]): number => rows.flatMap((row) => row.fields).filter((field) => field.decision === 'pending').length;

type RowProps = Pick<ProposalReviewProps, 'proposal' | 'focused' | 'onFocus' | 'onChange'> & { readonly row: ImportProposalRow };

function RowFields({ row, proposal, focused, onFocus, onChange }: RowProps) {
  const { t } = useImportText();
  const readOnly = proposal.status !== 'pending';
  return (
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="p-2 font-medium">{t('review.field')}</th>
            <th className="p-2 font-medium">{t('review.live')}</th>
            <th className="p-2 font-medium">{t('review.incoming')}</th>
            <th className="p-2 font-medium">{t('review.status')}</th>
            <th className="p-2 font-medium">{t('review.confidence')}</th>
            <th className="p-2 font-medium">{t('review.decision')}</th>
          </tr>
        </thead>
        <tbody>
          {row.fields.map((field) => {
            const targetKey = importTargetKey(field.target);
            return (
              <ProposalFieldRow
                key={targetKey}
                field={field}
                active={field === focused}
                readOnly={readOnly}
                onFocus={() => onFocus(field)}
                onDecide={(decision) => onChange(proposal, { decisions: [{ rowKey: row.rowKey, targetKey, decision }] })}
                onEdit={(text) => onChange(proposal, { edits: [{ rowKey: row.rowKey, targetKey, text }] })}
              />
            );
          })}
        </tbody>
      </table>
  );
}

function RowSection(props: RowProps) {
  const { row, proposal, onChange } = props;
  const { t } = useImportText();
  const message = useImportIssueMessage();
  const acceptAll = () => onChange(proposal, {
    decisions: row.fields.filter((field) => field.incoming !== null).map((field) => ({ rowKey: row.rowKey, targetKey: importTargetKey(field.target), decision: 'accept' as const })),
  });
  return (
    <section className="flex flex-col gap-1" aria-label={row.label}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="m-0 text-sm font-semibold">{row.label} · {t(ROW_ACTION_KEYS[row.action])}</h4>
        <Button type="button" size="sm" variant="outline" disabled={proposal.status !== 'pending'} onClick={acceptAll}>{t('review.acceptRow')}</Button>
      </header>
      {row.issues.length > 0 ? (
        <ul className="m-0 list-none p-0 text-xs text-destructive" role="alert">
          {row.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{message(issue)}</li>)}
        </ul>
      ) : null}
      <RowFields {...props} />
    </section>
  );
}

function ModelCodeField({ proposal, onChange }: Pick<ProposalReviewProps, 'proposal' | 'onChange'>) {
  const { t } = useImportText();
  const [code, setCode] = useState('');
  return (
    <p className="m-0 flex items-end gap-2">
      <span className="flex flex-col gap-1">
        <Label htmlFor={`model-${proposal.id}`}>{t('review.modelCode')}</Label>
        <Input id={`model-${proposal.id}`} value={code} onChange={(event) => setCode(event.target.value)} />
      </span>
      <Button type="button" size="sm" disabled={code.trim() === ''} onClick={() => onChange(proposal, { modelCode: code.trim() })}>{t('review.setModelCode')}</Button>
    </p>
  );
}

export function ProposalReview({ proposal, focused, onFocus, onChange, onApply, onReject }: ProposalReviewProps) {
  const { t } = useImportText();
  const pending = useMemo(() => pendingCount(proposal.rows), [proposal.rows]);
  const open = proposal.status === 'pending';
  return (
    <article className="flex flex-col gap-3 rounded-md border border-border p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-base font-semibold">{proposal.modelCode ?? t('review.noModel')} · {t(PROPOSAL_STATUS_KEYS[proposal.status])}</h3>
        {open ? (
          <span className="flex items-center gap-2">
            {pending > 0 ? <span className="text-sm text-muted-foreground" role="status">{t('review.pending', { count: pending })}</span> : null}
            <Button type="button" variant="outline" onClick={() => onReject(proposal)}>{t('review.rejectAll')}</Button>
            <Button type="button" disabled={pending > 0} onClick={() => onApply(proposal)}>{t('review.apply')}</Button>
          </span>
        ) : null}
      </header>
      {open && proposal.modelCode === null && proposal.purpose === 'attributes' && proposal.variantSchemeCode !== null ? <ModelCodeField proposal={proposal} onChange={onChange} /> : null}
      {proposal.violations.length > 0 ? <p className="m-0 text-sm text-destructive" role="status">{t('review.violations', { count: proposal.violations.length })}</p> : null}
      {proposal.rows.map((row) => <RowSection key={row.rowKey} row={row} proposal={proposal} focused={focused} onFocus={onFocus} onChange={onChange} />)}
    </article>
  );
}
