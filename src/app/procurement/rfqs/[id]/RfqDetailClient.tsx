'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Building2, ClipboardList, Plus, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PageHeader } from '@/core/headers';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { useQuotes } from '@/subapps/procurement/hooks/useQuotes';
import { useComparison } from '@/subapps/procurement/hooks/useComparison';
import { useRfqLines } from '@/subapps/procurement/hooks/useRfqLines';
import { useSourcingEventAggregate } from '@/subapps/procurement/hooks/useSourcingEventAggregate';
import { useRfqUrlState, type RfqTabValue } from '@/subapps/procurement/hooks/useRfqUrlState';
import { QuoteList } from '@/subapps/procurement/components/QuoteList';
import { QuoteDetailsHeader } from '@/subapps/procurement/components/QuoteDetailsHeader';
import { QuoteDetailSummary } from '@/subapps/procurement/components/QuoteDetailSummary';
import { QuoteForm } from '@/subapps/procurement/components/QuoteForm';
import { ComparisonPanel } from '@/subapps/procurement/components/ComparisonPanel';
import { ComparisonEmptyState } from '@/subapps/procurement/components/ComparisonEmptyState';
import { SourcingEventSummaryCard } from '@/subapps/procurement/components/SourcingEventSummaryCard';
import { VendorInviteSection } from '@/subapps/procurement/components/VendorInviteSection';
import { RfqLinesPanel } from '@/subapps/procurement/components/RfqLinesPanel';
import { SetupLockBanner } from '@/subapps/procurement/components/SetupLockBanner';
import { deriveSetupLockState } from '@/subapps/procurement/utils/rfq-lock-state';
import type { RFQ } from '@/subapps/procurement/types/rfq';
import { rfqIsMultiTrade } from '@/subapps/procurement/types/rfq';

interface RfqDetailClientProps {
  id: string;
}

export function RfqDetailClient({ id }: RfqDetailClientProps) {
  const { t } = useTranslation('quotes');
  const router = useRouter();

  // Belt-and-suspenders: SC page.tsx has redirect() but Turbopack dev mode may skip it.
  useEffect(() => {
    if (id.startsWith('[')) {
      router.replace('/procurement/rfqs');
    }
  }, [id, router]);

  const { quotes, loading, refetch } = useQuotes({ rfqId: id });
  const { lines, loading: linesLoading, addLine, deleteLine } = useRfqLines(id);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
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
    handleTabChange,
    handleSelectQuote,
    handleComparisonDrillDown,
  } = useRfqUrlState({ quotes, quotesLoading: loading });

  const lockState = useMemo(() => deriveSetupLockState(rfq, quotes), [rfq, quotes]);

  const winnerVendorName = useMemo(() => {
    if (!rfq?.winnerQuoteId) return undefined;
    const winner = quotes.find((q) => q.id === rfq.winnerQuoteId);
    return winner?.extractedData?.vendorName?.value ?? undefined;
  }, [rfq, quotes]);

  const handleAward = useCallback(async (winnerQuoteId: string, overrideReason: string | null) => {
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
          ],
        }}
      />

      <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as RfqTabValue)}>
        <TabsList>
          <TabsTrigger value="quotes">{t('rfqs.tabs.quotes')}</TabsTrigger>
          <TabsTrigger value="comparison">{t('rfqs.tabs.comparison')}</TabsTrigger>
          <TabsTrigger value="setup">{t('rfqs.tabs.setup')}</TabsTrigger>
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
              />
            </div>
            <aside className={cn(selectedQuote ? 'block' : 'hidden md:block')}>
              {selectedQuote && (
                <>
                  <button
                    type="button"
                    className="md:hidden mb-2 flex items-center gap-2 text-sm font-medium"
                    onClick={() => handleSelectQuote(null)}
                    aria-label={t('rfqs.mobile.backToList')}
                  >
                    <ArrowLeft className="size-4" />
                    {t('rfqs.mobile.backToList')}
                  </button>
                  <QuoteDetailsHeader quote={selectedQuote} />
                  <QuoteDetailSummary quote={selectedQuote} />
                </>
              )}
              {!selectedQuote && (
                <div className="hidden md:flex h-full items-center justify-center text-sm text-muted-foreground">
                  {t('rfqs.selectQuoteHint')}
                </div>
              )}
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          {quotes.length < 2 ? (
            <ComparisonEmptyState
              quotes={quotes}
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
                  rfqAwarded={Boolean(rfq?.winnerQuoteId)}
                  awardMode={rfq?.awardMode ?? 'whole_package'}
                  onAward={handleAward}
                  onRowClick={handleComparisonDrillDown}
                />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="setup" className="space-y-6">
          <SetupLockBanner
            lockState={lockState}
            vendorName={winnerVendorName}
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
          <VendorInviteSection rfqId={id} lockState={lockState} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
