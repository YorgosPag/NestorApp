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
import type { BankTransaction, MatchCandidate } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface MatchingPanelProps {
  transactions: BankTransaction[];
  candidates: MatchCandidate[];
  onMatch: (transactionId: string, entityId: string) => Promise<void>;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

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

export function MatchingPanel({ transactions, candidates, onMatch }: MatchingPanelProps) {
  const { t } = useTranslation('accounting');

  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);

  const unmatchedTransactions = transactions.filter((tx) => tx.matchStatus === 'unmatched');

  const handleSelectTransaction = useCallback((transactionId: string) => {
    setSelectedTransactionId((prev) => (prev === transactionId ? null : transactionId));
  }, []);

  const handleMatch = useCallback(
    async (entityId: string) => {
      if (!selectedTransactionId) return;

      try {
        setMatching(true);
        await onMatch(selectedTransactionId, entityId);
        setSelectedTransactionId(null);
      } finally {
        setMatching(false);
      }
    },
    [selectedTransactionId, onMatch],
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
            <p className="text-muted-foreground text-center py-6">
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
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
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
            <p className="text-muted-foreground text-center py-6">
              {t('bank.selectTransactionToMatch')}
            </p>
          ) : candidates.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">
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
                        <span className="text-xs text-muted-foreground">
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
                          onClick={() => handleMatch(candidate.entityId)}
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
