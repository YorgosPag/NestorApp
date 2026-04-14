/**
 * @fileoverview CandidatesPanel Component (Phase 2d)
 * @description Right panel: match candidates and groups for selected transaction
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q11 (Split view — right panel)
 * @compliance CLAUDE.md Enterprise Standards — semantic HTML, no inline styles
 */

'use client';

import { useTranslation } from 'react-i18next';
import { Search, XCircle, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type {
  BankTransaction,
  MatchCandidate,
  MatchCandidateGroup,
  MatchableEntityType,
  MatchedEntityRef,
} from '@/subapps/accounting/types';
import { CandidateCard } from './CandidateCard';
import { CandidateGroupCard } from './CandidateGroupCard';

interface CandidatesPanelProps {
  transaction: BankTransaction | null;
  candidates: MatchCandidate[];
  groups: MatchCandidateGroup[];
  loading: boolean;
  matching: boolean;
  onMatch: (entityId: string, entityType: MatchableEntityType) => void;
  onGroupMatch: (transactionIds: string[], entityRefs: MatchedEntityRef[]) => void;
  onExclude: (transactionId: string) => void;
}

export function CandidatesPanel({
  transaction,
  candidates,
  groups,
  loading,
  matching,
  onMatch,
  onGroupMatch,
  onExclude,
}: CandidatesPanelProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);

  // Empty state: no transaction selected
  if (!transaction) {
    return (
      <EmptyState
        icon={<Search className="h-8 w-8 text-muted-foreground" />}
        message={t('reconciliation.selectTransaction')}
      />
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  // No candidates found
  if (candidates.length === 0 && groups.length === 0) {
    return (
      <section className="flex flex-col h-full">
        <TransactionHeader transaction={transaction} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
          <XCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t('reconciliation.noCandidates')}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExclude(transaction.transactionId)}
            disabled={matching}
          >
            <Ban className="h-4 w-4 mr-1" />
            {t('reconciliation.excludeAction')}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col h-full">
      <TransactionHeader transaction={transaction} />
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {/* N:M Groups first */}
        {groups.map((group) => (
          <CandidateGroupCard
            key={group.groupId}
            group={group}
            transactionAmount={transaction.amount}
            onMatch={() =>
              onGroupMatch(
                [transaction.transactionId],
                group.candidates.map((c) => ({
                  entityId: c.entityId,
                  entityType: c.entityType,
                  amount: c.amount,
                }))
              )
            }
            matching={matching}
          />
        ))}

        {/* Individual candidates */}
        {candidates.map((candidate) => (
          <CandidateCard
            key={candidate.entityId}
            candidate={candidate}
            onMatch={onMatch}
            matching={matching}
          />
        ))}

        {/* Exclude button at bottom */}
        <div className="pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => onExclude(transaction.transactionId)}
            disabled={matching}
          >
            <Ban className="h-4 w-4 mr-1" />
            {t('reconciliation.excludeAction')}
          </Button>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function TransactionHeader({ transaction }: { transaction: BankTransaction }) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  return (
    <header className="p-3 border-b">
      <h3 className="text-sm font-semibold mb-1">
        {t('reconciliation.candidates')}
      </h3>
      <p className="text-xs text-muted-foreground truncate">
        {transaction.bankDescription}
      </p>
    </header>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
      {icon}
      <p className="text-sm text-muted-foreground text-center">{message}</p>
    </div>
  );
}
