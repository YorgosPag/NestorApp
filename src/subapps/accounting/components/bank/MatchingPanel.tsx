'use client';

/**
 * @fileoverview Accounting Subapp — Bank Transaction Matching Panel
 * @description Side-by-side panel for matching bank transactions with journal entries
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-008 Bank Reconciliation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { BankTransaction, MatchCandidate } from '@/subapps/accounting/types';
import { formatCurrency, formatDate } from '../../utils/format';

import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface MatchingPanelProps {
  transactions: BankTransaction[];
  candidates: MatchCandidate[];
  loadingCandidates?: boolean;
  onSelectTransaction: (transactionId: string | null) => void;
  selectedTransactionId: string | null;
  onMatch: (transactionId: string, entityId: string, entityType: string) => Promise<void>;
}

// ============================================================================
// HELPERS
// ============================================================================

function getConfidenceBadgeVariant(
  confidence: number,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (confidence >= 80) return 'default';
  if (confidence >= 50) return 'secondary';
  return 'outline';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MatchingPanel({
  transactions,
  candidates,
  loadingCandidates = false,
  onSelectTransaction,
  selectedTransactionId,
  onMatch,
}: MatchingPanelProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const colors = useSemanticColors();

  const [matching, setMatching] = useState(false);

  const unmatchedTransactions = transactions.filter((tx) => tx.matchStatus === 'unmatched');

  const handleSelectTransaction = useCallback((transactionId: string) => {
    const newId = selectedTransactionId === transactionId ? null : transactionId;
    onSelectTransaction(newId);
  }, [selectedTransactionId, onSelectTransaction]);

  const handleMatch = useCallback(
    async (entityId: string, entityType: string) => {
      if (!selectedTransactionId) return;

      try {
        setMatching(true);
        await onMatch(selectedTransactionId, entityId, entityType);
        onSelectTransaction(null);
      } finally {
        setMatching(false);
      }
    },
    [selectedTransactionId, onMatch, onSelectTransaction],
  );

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Unmatched Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('bank.unmatchedTransactions')}</CardTitle>
        </CardHeader>
        <CardContent>
          {unmatchedTransactions.length === 0 ? (
            <p className={cn("text-center py-6", colors.text.muted)}>
              {t('bank.allTransactionsMatched')}
            </p>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">{t('bank.date')}</TableHead>
                    <TableHead>{t('bank.bankDescription')}</TableHead>
                    <TableHead className="w-28 text-right">{t('bank.amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatchedTransactions.map((tx) => (
                    <TableRow
                      key={tx.transactionId}
                      className={`cursor-pointer ${
                        selectedTransactionId === tx.transactionId
                          ? 'bg-accent'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => handleSelectTransaction(tx.transactionId)}
                    >
                      <TableCell className="text-sm">
                        {formatDate(tx.valueDate)}
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[180px]">
                        {tx.bankDescription}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          tx.direction === 'credit'
                            ? colors.text.success
                            : colors.text.error
                        }`}
                      >
                        {formatCurrency(tx.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right: Match Candidates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('bank.matchCandidates')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedTransactionId ? (
            <p className={cn("text-center py-6", colors.text.muted)}>
              {t('bank.selectTransactionToMatch')}
            </p>
          ) : loadingCandidates ? (
            <p className={cn("text-center py-6", colors.text.muted)}>
              {t('bank.loadingCandidates')}
            </p>
          ) : candidates.length === 0 ? (
            <p className={cn("text-center py-6", colors.text.muted)}>
              {t('bank.noCandidatesFound')}
            </p>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('bank.candidateLabel')}</TableHead>
                    <TableHead className="w-24 text-right">{t('bank.amount')}</TableHead>
                    <TableHead className="w-24">{t('bank.confidence')}</TableHead>
                    <TableHead className="w-20">{t('bank.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => (
                    <TableRow key={candidate.entityId}>
                      <TableCell className="text-sm">
                        <span className="block font-medium">{candidate.displayLabel}</span>
                        <span className={cn("text-xs", colors.text.muted)}>
                          {formatDate(candidate.date)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {formatCurrency(candidate.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getConfidenceBadgeVariant(candidate.confidence)}>
                          {candidate.confidence}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMatch(candidate.entityId, candidate.entityType)}
                          disabled={matching}
                          aria-label={t('bank.matchAction')}
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
