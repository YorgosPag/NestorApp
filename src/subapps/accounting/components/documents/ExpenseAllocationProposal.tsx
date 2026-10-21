'use client';

/**
 * ExpenseAllocationProposal — the proposal from a purchase order, and finding that order (ADR-917 Φ4).
 *
 * The proposal is NEVER stored by showing it: «Use proposal» puts it in the draft, the human saves. Finding the
 * order runs the ADR-267 Phase C matcher (`/api/procurement/invoice-match`, supplier VAT + amounts), which had
 * no screen until now; choosing a candidate asks the server for ITS proposal.
 *
 * @module subapps/accounting/components/documents/ExpenseAllocationProposal
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { costCodeLabelKey, costCodeGroupOf } from '@/config/cost-taxonomy';
import { formatCurrency } from '@/lib/intl-utils';
import type { POMatchCandidate, POMatchResult } from '@/types/procurement';
import type { AllocationProposal } from '../../hooks/useExpenseCostAllocations';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface ExpenseAllocationProposalProps {
  documentId: string;
  proposal: AllocationProposal | null;
  disabled: boolean;
  onAccept: (proposal: AllocationProposal) => void;
  onChoosePurchaseOrder: (purchaseOrderId: string) => void;
  t: Translate;
}

type MatchState = { kind: 'idle' } | { kind: 'searching' } | { kind: 'failed' } | { kind: 'done'; candidates: POMatchCandidate[] };

function ProposalPanel({ proposal, disabled, onAccept, t }: Pick<ExpenseAllocationProposalProps, 'disabled' | 'onAccept' | 't'> & { proposal: AllocationProposal }) {
  return (
    <section className="space-y-2 rounded-md border border-dashed p-3">
      <h4 className="text-sm font-medium">{t('documents.allocation.proposal.title', { poNumber: proposal.purchaseOrder.poNumber })}</h4>
      {proposal.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('documents.allocation.proposal.empty')}</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{t('documents.allocation.proposal.note')}</p>
          <ul className="text-sm">
            {proposal.lines.map((line) => (
              <li key={line.costCode} className="flex justify-between gap-4">
                <span>{`${t(costCodeLabelKey(costCodeGroupOf(line.costCode)))} (${line.costCode})`}</span>
                <span className="tabular-nums">{formatCurrency(line.netAmount)}</span>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => onAccept(proposal)}>
            {t('documents.allocation.proposal.accept')}
          </Button>
        </>
      )}
    </section>
  );
}

function MatchResults({ match, onChoose, t }: { match: MatchState; onChoose: (poId: string) => void; t: Translate }) {
  if (match.kind === 'searching') return <p className="text-sm text-muted-foreground">{t('documents.allocation.match.searching')}</p>;
  if (match.kind === 'failed') return <p role="alert" className="text-sm text-destructive">{t('documents.allocation.match.failed')}</p>;
  if (match.kind !== 'done') return null;
  if (match.candidates.length === 0) return <p className="text-sm text-muted-foreground">{t('documents.allocation.match.none')}</p>;
  return (
    <ul className="space-y-1 text-sm">
      {match.candidates.map((candidate) => (
        <li key={candidate.poId} className="flex items-center justify-between gap-4">
          <span>{t('documents.allocation.match.candidate', { poNumber: candidate.poNumber, confidence: candidate.confidence })}</span>
          <Button size="sm" variant="ghost" onClick={() => onChoose(candidate.poId)}>{t('documents.allocation.match.choose')}</Button>
        </li>
      ))}
    </ul>
  );
}

export function ExpenseAllocationProposal({ documentId, proposal, disabled, onAccept, onChoosePurchaseOrder, t }: ExpenseAllocationProposalProps) {
  const [match, setMatch] = useState<MatchState>({ kind: 'idle' });

  const findOrder = async () => {
    setMatch({ kind: 'searching' });
    try {
      const result = await apiClient.post<POMatchResult>(API_ROUTES.PROCUREMENT.INVOICE_MATCH, { expenseDocId: documentId });
      setMatch({ kind: 'done', candidates: result.candidates });
    } catch {
      setMatch({ kind: 'failed' });
    }
  };

  return (
    <section className="space-y-2">
      {proposal ? <ProposalPanel proposal={proposal} disabled={disabled} onAccept={onAccept} t={t} /> : null}
      <Button size="sm" variant="ghost" disabled={disabled || match.kind === 'searching'} onClick={() => void findOrder()}>
        {t('documents.allocation.match.button')}
      </Button>
      <MatchResults match={match} onChoose={onChoosePurchaseOrder} t={t} />
    </section>
  );
}
