/**
 * @fileoverview ReconciliationPageContent — Main Reconciliation Page (Phase 2d)
 * @description Orchestrates split-view reconciliation: transactions (left) + candidates (right)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q2, Q11
 * @compliance CLAUDE.md Enterprise Standards — semantic HTML, no inline styles
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { GitCompareArrows } from 'lucide-react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AccountingPageHeader } from '../shared/AccountingPageHeader';
import { TransactionsPanel } from './TransactionsPanel';
import { CandidatesPanel } from './CandidatesPanel';
import { BatchActionsToolbar } from './BatchActionsToolbar';
import { MatchingSettingsDialog } from './MatchingSettingsDialog';
import { useBankTransactions } from '../../hooks/useBankTransactions';
import { useMatchCandidates } from '../../hooks/useMatchCandidates';
import { useMatchActions } from '../../hooks/useMatchActions';
import { useMatchingConfig } from '../../hooks/useMatchingConfig';
import type { MatchStatus, MatchableEntityType, MatchedEntityRef } from '@/subapps/accounting/types';

type StatusFilter = MatchStatus | 'all';

export function ReconciliationPageContent() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedTxnId, setSelectedTxnId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('unmatched');
  const [showDashboard, setShowDashboard] = useState(false);

  // ── Data hooks ──────────────────────────────────────────────────────────────
  const { transactions, loading: txnsLoading, refetch: refetchTxns } = useBankTransactions();
  const { candidates, groups, loading: candidatesLoading } = useMatchCandidates(selectedTxnId);
  const { matchSingle, matchGroup, matchBatch, excludeTransaction, matching, batchProgress } = useMatchActions();
  const { config, saving, saveConfig } = useMatchingConfig();

  // ── Derived data ───────────────────────────────────────────────────────────
  const selectedTxn = useMemo(
    () => transactions.find((t) => t.transactionId === selectedTxnId) ?? null,
    [transactions, selectedTxnId]
  );

  const autoMatchableIds = useMemo(
    () => transactions
      .filter((t) => t.matchStatus === 'unmatched')
      .map((t) => t.transactionId),
    [transactions]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSelect = useCallback((id: string) => {
    setSelectedTxnId(id);
  }, []);

  const handleCheckToggle = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCheckAll = useCallback(() => {
    const filtered = statusFilter === 'all'
      ? transactions
      : transactions.filter((t) => t.matchStatus === statusFilter);
    const allChecked = filtered.every((t) => checkedIds.has(t.transactionId));
    if (allChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(filtered.map((t) => t.transactionId)));
    }
  }, [transactions, statusFilter, checkedIds]);

  const handleMatch = useCallback(async (entityId: string, entityType: MatchableEntityType) => {
    if (!selectedTxnId) return;
    await matchSingle(selectedTxnId, entityId, entityType);
    await refetchTxns();
    advanceToNextUnmatched();
  }, [selectedTxnId, matchSingle, refetchTxns]);

  const handleGroupMatch = useCallback(async (
    transactionIds: string[],
    entityRefs: MatchedEntityRef[]
  ) => {
    await matchGroup(transactionIds, entityRefs);
    await refetchTxns();
    advanceToNextUnmatched();
  }, [matchGroup, refetchTxns]);

  const handleExclude = useCallback(async (transactionId: string) => {
    await excludeTransaction(transactionId);
    await refetchTxns();
    advanceToNextUnmatched();
  }, [excludeTransaction, refetchTxns]);

  const handleAcceptAll = useCallback(async () => {
    if (autoMatchableIds.length === 0) return;
    await matchBatch(autoMatchableIds);
    await refetchTxns();
    setCheckedIds(new Set());
  }, [autoMatchableIds, matchBatch, refetchTxns]);

  const handleAcceptSelected = useCallback(async () => {
    const ids = [...checkedIds];
    if (ids.length === 0) return;
    await matchBatch(ids);
    await refetchTxns();
    setCheckedIds(new Set());
  }, [checkedIds, matchBatch, refetchTxns]);

  const advanceToNextUnmatched = useCallback(() => {
    const next = transactions.find(
      (t) => t.matchStatus === 'unmatched' && t.transactionId !== selectedTxnId
    );
    setSelectedTxnId(next?.transactionId ?? null);
  }, [transactions, selectedTxnId]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        <AccountingPageHeader
          icon={GitCompareArrows}
          titleKey="reconciliation.title"
          descriptionKey="reconciliation.description"
          showDashboard={showDashboard}
          onDashboardToggle={() => setShowDashboard((p) => !p)}
          actions={[
            <MatchingSettingsDialog
              key="settings"
              config={config}
              onSave={saveConfig}
              saving={saving}
            />,
          ]}
        />

        <BatchActionsToolbar
          selectedCount={checkedIds.size}
          autoMatchableCount={autoMatchableIds.length}
          onAcceptAll={handleAcceptAll}
          onAcceptSelected={handleAcceptSelected}
          batchProgress={batchProgress}
          disabled={matching}
        />

        <ResizablePanelGroup
          direction="horizontal"
          className="flex-1 min-h-[400px]"
        >
          <ResizablePanel defaultSize={45} minSize={25}>
            <TransactionsPanel
              transactions={transactions}
              selectedTransactionId={selectedTxnId}
              checkedIds={checkedIds}
              statusFilter={statusFilter}
              loading={txnsLoading}
              onSelect={handleSelect}
              onCheckToggle={handleCheckToggle}
              onCheckAll={handleCheckAll}
              onStatusFilterChange={setStatusFilter}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={55} minSize={30}>
            <CandidatesPanel
              transaction={selectedTxn}
              candidates={candidates}
              groups={groups}
              loading={candidatesLoading}
              matching={matching}
              onMatch={handleMatch}
              onGroupMatch={handleGroupMatch}
              onExclude={handleExclude}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
}
