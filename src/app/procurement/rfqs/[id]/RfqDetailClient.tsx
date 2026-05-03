'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, ClipboardList, Eye, EyeOff, Plus, ScanLine } from 'lucide-react';
import { buildRfqHeaderActions, type RfqHeaderAction } from '@/subapps/procurement/utils/rfq-header-actions';
import { RfqCancelDialog } from '@/subapps/procurement/components/RfqCancelDialog';
import { RfqLifecycleButtons } from '@/subapps/procurement/components/RfqLifecycleButtons';
import { useRfqLifecycle } from '@/subapps/procurement/hooks/useRfqLifecycle';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import { useVendorInvites } from '@/subapps/procurement/hooks/useVendorInvites';
import { buildRfqDashboardStats } from '@/subapps/procurement/utils/rfq-dashboard-stats';
import { PageHeader } from '@/core/headers';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { useQuotes } from '@/subapps/procurement/hooks/useQuotes';
import { useComparison } from '@/subapps/procurement/hooks/useComparison';
import { useRfqLines } from '@/subapps/procurement/hooks/useRfqLines';
import { useSourcingEventAggregate } from '@/subapps/procurement/hooks/useSourcingEventAggregate';
import { useRfqUrlState, type RfqTabValue } from '@/subapps/procurement/hooks/useRfqUrlState';
import { useAwardFlow } from '@/subapps/procurement/hooks/useAwardFlow';
import { useQuoteRevision } from '@/subapps/procurement/hooks/useQuoteRevision';
import { QuoteRevisionDetectedDialog } from '@/subapps/procurement/components/QuoteRevisionDetectedDialog';
import { ExpiredAwardWarningDialog } from '@/subapps/procurement/components/ExpiredAwardWarningDialog';
import { QuoteRenewalRequestDialog } from '@/subapps/procurement/components/QuoteRenewalRequestDialog';
import { useScanQueue } from '@/subapps/procurement/hooks/useScanQueue';
import { toast } from 'sonner';
import { QuoteList } from '@/subapps/procurement/components/QuoteList';
import { QuoteRightPane } from '@/subapps/procurement/components/QuoteRightPane';
import { RfqHistoryTab } from '@/subapps/procurement/components/RfqHistoryTab';
import { buildQuoteHeaderActions } from '@/subapps/procurement/utils/quote-header-actions';
import { QuoteForm } from '@/subapps/procurement/components/QuoteForm';
import { ComparisonPanel } from '@/subapps/procurement/components/ComparisonPanel';
import { ComparisonEmptyState } from '@/subapps/procurement/components/ComparisonEmptyState';
import { SourcingEventSummaryCard } from '@/subapps/procurement/components/SourcingEventSummaryCard';
import { VendorInviteSection } from '@/subapps/procurement/components/VendorInviteSection';
import { ComparisonWinnerBanner } from '@/subapps/procurement/components/ComparisonWinnerBanner';
import { RfqDetailDialogs } from '@/subapps/procurement/components/RfqDetailDialogs';
import { RfqLinesPanel } from '@/subapps/procurement/components/RfqLinesPanel';
import { SetupLockBanner } from '@/subapps/procurement/components/SetupLockBanner';
import { deriveSetupLockState } from '@/subapps/procurement/utils/rfq-lock-state';
import { rfqIsMultiTrade, type RFQ } from '@/subapps/procurement/types/rfq';
import { DirtyFormProvider } from '@/providers/DirtyFormProvider';
import { OfflineBanner } from '@/subapps/procurement/components/OfflineBanner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useFirestoreStatus } from '@/hooks/useFirestoreStatus';
interface RfqDetailClientProps {
  id: string;
}

export function RfqDetailClient({ id }: RfqDetailClientProps) {
  const { t } = useTranslation('quotes');
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const isFirestoreConnected = useFirestoreStatus();
  const isConnected = isOnline && isFirestoreConnected;
  // Belt-and-suspenders: SC page.tsx has redirect() but Turbopack dev mode may skip it.
  useEffect(() => {
    if (id.startsWith('[')) {
      router.replace('/procurement');
    }
  }, [id, router]);
  const { quotes, loading, refetch } = useQuotes({ rfqId: id }, { includeSuperseded: true });
  const activeQuotes = useMemo(
    () => quotes.filter((q) => q.status !== 'superseded'),
    [quotes],
  );
  const { invites } = useVendorInvites(id);
  const { lines, loading: linesLoading, addLine, deleteLine } = useRfqLines(id);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);

  const fetchRfq = useCallback(async () => {
    try {
      const res = await fetch(`/api/rfqs/${id}`);
      if (!res.ok) return;
      const json = await res.json();
      const rfqData = (json?.data ?? null) as RFQ | null;
      setRfq(rfqData);
      if (rfqData?.projectId) {
        const pRes = await fetch(`/api/projects/${rfqData.projectId}`).catch(() => null);
        if (pRes?.ok) {
          const pJson = await pRes.json().catch(() => ({}));
          setProjectName((pJson?.data?.name as string | undefined) ?? null);
        }
      }
    } catch {
      // silent — page renders without project name subtitle
    }
  }, [id]);
  useEffect(() => {
    void fetchRfq();
  }, [fetchRfq]);
  const cherryPickEnabled = rfq?.awardMode === 'cherry_pick';
  const { comparison, cherryPick, loading: comparisonLoading, refetch: refetchComparison } =
    useComparison(id, { cherryPick: cherryPickEnabled });
  const { aggregate, loading: aggregateLoading } = useSourcingEventAggregate(rfq?.sourcingEventId);
  const {
    activeTab,
    selectedQuote,
    pdfOpen,
    commentsOpen,
    handleTabChange,
    handleSelectQuote,
    handleComparisonDrillDown,
    handleTogglePdf,
    handleToggleComments,
  } = useRfqUrlState({ quotes: activeQuotes, quotesLoading: loading });
  const lockState = useMemo(() => deriveSetupLockState(rfq, activeQuotes), [rfq, activeQuotes]);
  const winnerVendorName = useMemo(() => {
    if (!rfq?.winnerQuoteId) return undefined;
    const winner = activeQuotes.find((q) => q.id === rfq.winnerQuoteId);
    return winner?.extractedData?.vendorName?.value ?? undefined;
  }, [rfq, activeQuotes]);
  const underReviewCount = useMemo(
    () => activeQuotes.filter(q => q.status === 'under_review').length,
    [activeQuotes],
  );
  const recommendationPending = useMemo(
    () => Boolean(comparison?.recommendation) && !activeQuotes.some(q => q.status === 'accepted'),
    [comparison, activeQuotes],
  );

  const setupAttentionCount = useMemo(() => {
    const now = Date.now();
    const deadline = rfq?.deadlineDate;
    let deadlineMs: number | null = null;
    if (deadline) {
      if (typeof deadline === 'object' && 'seconds' in (deadline as object)) {
        deadlineMs = (deadline as { seconds: number }).seconds * 1000;
      } else {
        const n = new Date(deadline as unknown as string).getTime();
        if (!Number.isNaN(n)) deadlineMs = n;
      }
    }
    return invites.filter(
      i => i.status === 'expired' || (i.status === 'pending' && deadlineMs !== null && now > deadlineMs),
    ).length;
  }, [invites, rfq]);
  const dashboardStats = useMemo(
    () => buildRfqDashboardStats(rfq, activeQuotes, invites, comparison, activeTab, t),
    [rfq, activeQuotes, invites, comparison, activeTab, t],
  );
  const onFireAward = useCallback(async (winnerQuoteId: string, overrideReason: string | null) => {
    const res = await fetch(`/api/rfqs/${id}/award`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winnerQuoteId, ...(overrideReason ? { overrideReason } : {}) }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json?.error ?? `Award failed (${res.status})`);
    }
    await Promise.all([fetchRfq(), refetch(), refetchComparison()]);
  }, [id, fetchRfq, refetch, refetchComparison]);
  const { pendingDetection, dismissDetection } = useQuoteRevision();

  const {
    optimisticWinnerId,
    pendingEntry,
    cheapestEntry,
    pendingExpiredEntry,
    handleAwardIntent,
    handleDialogConfirm,
    handleDialogCancel,
    handleExpiredDialogAction,
  } = useAwardFlow({
    comparison: comparison ?? null,
    currentWinnerId: rfq?.winnerQuoteId ?? null,
    onFireAward,
    quotes: activeQuotes,
  });

  const [renewalQuoteId, setRenewalQuoteId] = useState<string | null>(null);
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);

  const refetchAll = useCallback(async () => {
    await Promise.all([fetchRfq(), refetch(), refetchComparison()]);
  }, [fetchRfq, refetch, refetchComparison]);

  const lifecycle = useRfqLifecycle({
    rfqId: id,
    rfq,
    t,
    onChanged: refetchAll,
    onArchived: () => router.push('/procurement'),
  });

  const lifecycleActions: RfqHeaderAction[] = useMemo(
    () => buildRfqHeaderActions({
      rfq,
      onClose: () => void lifecycle.handleClose(),
      onReopen: () => void lifecycle.handleReopen(),
      onCancel: lifecycle.openCancelDialog,
      onArchive: () => void lifecycle.handleArchive(),
      t, isConnected,
    }),
    [rfq, lifecycle, t, isConnected],
  );
  const renewalQuote = useMemo(
    () => (renewalQuoteId ? quotes.find((q) => q.id === renewalQuoteId) ?? null : null),
    [renewalQuoteId, quotes],
  );
  const pendingExpiredQuote = useMemo(
    () => (pendingExpiredEntry ? quotes.find((q) => q.id === pendingExpiredEntry.quoteId) ?? null : null),
    [pendingExpiredEntry, quotes],
  );

  const scanQueue = useScanQueue({
    rfqId: id,
    projectId: rfq?.projectId,
  });

  const handleStub = useCallback(
    () => void toast.info(t('rfqs.quoteHeader.tooltip.comingSoon')),
    [t],
  );

  const patchQuoteStatus = useCallback(async (status: string) => {
    if (!selectedQuote) return;
    const res = await fetch(`/api/quotes/${selectedQuote.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { toast.error(t('quotes.errors.updateFailed')); return; }
    await refetch();
  }, [selectedQuote, refetch, t]);
  const { primaryActions, secondaryActions, overflowActions } = useMemo(
    () => !selectedQuote
      ? { primaryActions: [], secondaryActions: [], overflowActions: [] }
      : buildQuoteHeaderActions({
          quote: selectedQuote, rfq,
          onConfirm: () => void patchQuoteStatus('under_review'),
          onApprove: () => handleAwardIntent(selectedQuote.id),
          onReject: () => void patchQuoteStatus('rejected'),
          onCreatePo: handleStub, onViewPo: handleStub,
          onRestore: () => void patchQuoteStatus('submitted'),
          onDownload: handleTogglePdf,
          onOpenComments: handleToggleComments,
          onEdit: handleStub, onDuplicate: handleStub, onDelete: handleStub,
          t, isConnected,
        }),
    [selectedQuote, rfq, patchQuoteStatus, handleAwardIntent, handleStub, handleTogglePdf, handleToggleComments, t, isConnected],
  );
  const allVendorNotified = activeQuotes.filter((q) => q.status === 'accepted' || q.status === 'rejected').every((q) => !!q.lastNotifiedAt);
  const effectiveWinnerId = optimisticWinnerId ?? rfq?.winnerQuoteId ?? null;
  const winnerQuote = effectiveWinnerId ? quotes.find((q) => q.id === effectiveWinnerId) ?? null : null;

  const scanHref = useMemo(() => {
    const sp = new URLSearchParams({ rfqId: id });
    if (rfq) {
      sp.set('projectId', rfq.projectId);
      if (!rfqIsMultiTrade(rfq) && rfq.lines.length > 0) {
        sp.set('trade', rfq.lines[0].trade);
      }
    }
    return `/procurement/quotes/scan?${sp.toString()}`;
  }, [id, rfq]);
  const handleQuoteCreated = async () => {
    setShowQuoteForm(false);
    await refetch();
  };
  if (id.startsWith('[')) return null;
  const projectSubtitle = rfq?.projectId && projectName ? (
    <Link
      href={`/projects/${rfq.projectId}`}
      className="text-sm text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1"
      aria-label={t('rfqs.detail.projectLink.aria', { projectName })}
    >
      <Building2 className="size-3" />
      {projectName}
    </Link>
  ) : undefined;

  return (
    <DirtyFormProvider>
    <main className="container mx-auto max-w-5xl space-y-4 py-6">
      <PageHeader
        variant="sticky-rounded"
        breadcrumb={<ModuleBreadcrumb />}
        title={{
          icon: ClipboardList,
          title: rfq?.title ?? t('rfqs.detail.fallback.untitled'),
          subtitle: projectSubtitle,
        }}
        actions={{
          customActions: [
            <Button
              key="dashboard-toggle"
              variant="ghost"
              size="sm"
              onClick={() => setShowDashboard(v => !v)}
              aria-label={t('rfqs.dashboard.toggle')}
              title={t('rfqs.dashboard.toggle')}
            >
              {showDashboard ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>,
            <Button
              key="scan"
              variant="outline"
              size="sm"
              onClick={() => router.push(scanHref)}
              title={t('quotes.scan.scanFromRfqHint')}
            >
              <ScanLine className="mr-1 h-4 w-4" />
              {t('quotes.scan.scanFromRfq')}
            </Button>,
            ...(!showQuoteForm
              ? [
                  <Button key="add" size="sm" onClick={() => setShowQuoteForm(true)}>
                    <Plus className="mr-1 h-4 w-4" />
                    {t('quotes.create')}
                  </Button>,
                ]
              : []),
            <RfqLifecycleButtons key="lifecycle" actions={lifecycleActions} />,
          ],
        }}
      />

      <OfflineBanner isConnected={isConnected} />
      {showDashboard && (
        <UnifiedDashboard stats={dashboardStats} columns={4} />
      )}

      <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as RfqTabValue)}>
        <TabsList>
          <TabsTrigger value="quotes">
            {t('rfqs.tabs.quotes')}
            {underReviewCount > 0 && (
              <Badge variant="destructive" className="ml-2" aria-label={t('rfqs.tabs.badges.underReview')}>
                {underReviewCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="comparison">
            {t('rfqs.tabs.comparison')}
            {recommendationPending && (
              <span
                className="ml-2 inline-block size-2 rounded-full bg-yellow-500"
                aria-label={t('rfqs.tabs.badges.recommendation')}
              />
            )}
          </TabsTrigger>
          <TabsTrigger value="setup">
            {t('rfqs.tabs.setup')}
            {setupAttentionCount > 0 && (
              <Badge variant="warning" className="ml-2" aria-label={t('rfqs.tabs.badges.setupAttention')}>
                {setupAttentionCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">{t('rfqs.tabs.history')}</TabsTrigger>
        </TabsList>

        <TabsContent value="quotes" className="space-y-4">
          {showQuoteForm && (
            <QuoteForm
              rfqId={id}
              onSuccess={handleQuoteCreated}
              onCancel={() => setShowQuoteForm(false)}
            />
          )}
          <div className="md:grid md:grid-cols-[380px_1fr] md:gap-4">
            <div className={cn(selectedQuote ? 'hidden md:block' : 'block')}>
              <QuoteList
                quotes={quotes}
                loading={loading}
                onSelectQuote={handleSelectQuote}
                selectedQuoteId={selectedQuote?.id}
                scanItems={scanQueue.items}
                onRetryScan={scanQueue.retry}
                onRemoveScan={scanQueue.remove}
              />
            </div>
            <aside className={cn(selectedQuote ? 'block' : 'hidden md:block')}>
              {selectedQuote ? (
                <QuoteRightPane
                  quote={selectedQuote}
                  pdfOpen={pdfOpen}
                  commentsOpen={commentsOpen}
                  onTogglePdf={handleTogglePdf}
                  onToggleComments={handleToggleComments}
                  onSelectQuote={handleSelectQuote}
                  onRequestRenewal={() => setRenewalQuoteId(selectedQuote.id)}
                  primaryActions={primaryActions}
                  secondaryActions={secondaryActions}
                  overflowActions={overflowActions}
                />
              ) : (
                <div className="hidden md:flex h-full items-center justify-center text-sm text-muted-foreground">
                  {t('rfqs.selectQuoteHint')}
                </div>
              )}
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          {winnerQuote && (
            <ComparisonWinnerBanner
              winnerQuote={winnerQuote}
              allVendorNotified={allVendorNotified}
              onNotifyVendors={() => setNotifyDialogOpen(true)}
            />
          )}
          {activeQuotes.length < 2 ? (
            <ComparisonEmptyState
              quotes={activeQuotes}
              onNewQuote={() => setShowQuoteForm(true)}
              onScan={() => router.push(scanHref)}
              onViewInvites={() => handleTabChange('setup')}
              onViewQuoteDetails={handleComparisonDrillDown}
            />
          ) : (
            <>
              {rfq?.sourcingEventId && (
                <SourcingEventSummaryCard
                  aggregate={aggregate}
                  loading={aggregateLoading}
                  currentRfqId={id}
                />
              )}
              {comparison && (
                <ComparisonPanel
                  comparison={comparison}
                  cherryPick={cherryPick}
                  loading={comparisonLoading}
                  rfqAwarded={!!effectiveWinnerId}
                  awardMode={rfq?.awardMode ?? 'whole_package'}
                  onAwardIntent={handleAwardIntent}
                  winnerQuoteId={effectiveWinnerId}
                  onRowClick={handleComparisonDrillDown}
                />
              )}
            </>
          )}
        </TabsContent>
        <TabsContent value="history" className="space-y-4">
          <RfqHistoryTab rfqId={id} quotes={quotes} />
        </TabsContent>
        <TabsContent value="setup" className="space-y-6">
          <SetupLockBanner
            lockState={lockState}
            vendorName={winnerVendorName}
            rfqStatus={
              rfq?.status === 'closed' || rfq?.status === 'cancelled' || rfq?.status === 'archived'
                ? rfq.status
                : undefined
            }
          />
          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t('rfqs.lines')}</h2>
            <RfqLinesPanel
              rfqId={id}
              lines={lines}
              loading={linesLoading}
              onAdd={addLine}
              onDelete={deleteLine}
              lockState={lockState}
            />
          </section>
          <VendorInviteSection rfqId={id} rfq={rfq} lockState={lockState} onViewInvites={() => handleTabChange('setup')} />
        </TabsContent>
      </Tabs>

      <RfqDetailDialogs
        rfqId={id}
        rfq={rfq}
        activeQuotes={activeQuotes}
        quotes={quotes}
        pendingEntry={pendingEntry}
        cheapestEntry={cheapestEntry}
        pendingExpiredEntry={pendingExpiredEntry}
        pendingExpiredQuote={pendingExpiredQuote}
        pendingDetection={pendingDetection}
        renewalQuote={renewalQuote}
        notifyDialogOpen={notifyDialogOpen}
        cancelDialogOpen={lifecycle.cancelDialogOpen}
        setNotifyDialogOpen={setNotifyDialogOpen}
        setRenewalQuoteId={setRenewalQuoteId}
        handleDialogConfirm={handleDialogConfirm}
        handleDialogCancel={handleDialogCancel}
        handleExpiredDialogAction={handleExpiredDialogAction}
        dismissDetection={dismissDetection}
        onCancelConfirm={lifecycle.handleConfirmCancel}
        onCancelDialogClose={lifecycle.closeCancelDialog}
      />
    </main>
    </DirtyFormProvider>
  );
}
