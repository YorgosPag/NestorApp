'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: OPERATOR INBOX CLIENT (UC-009)
 * =============================================================================
 *
 * Client component for the Operator Inbox UI.
 * Displays pipeline proposals awaiting human review with approve/reject actions.
 *
 * Architecture mirrors AI Inbox (centralized components):
 * - PageHeader (sticky-rounded, Live badge, dashboard toggle)
 * - UnifiedDashboard (collapsible stats)
 * - AdvancedFiltersPanel (centralized filter config)
 * - Card-wrapped queue list
 *
 * @component OperatorInboxClient
 * @enterprise Client-side UI, server-side auth via AdminContext
 * @see ADR-080 (Pipeline Implementation)
 * @see UC-009 (Internal Operator Workflow)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import {
  Inbox,
  RefreshCw,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Mail,
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import toast from 'react-hot-toast';
import type { AdminContext } from '@/server/admin/admin-guards';
import { PageContainer, ListContainer } from '@/core/containers';
import { PageHeader } from '@/core/headers';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  AdvancedFiltersPanel,
  operatorInboxFiltersConfig,
  defaultOperatorInboxFilters,
  type OperatorInboxFilterState,
} from '@/components/core/AdvancedFilters';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { useIconSizes } from '@/hooks/useIconSizes';
import { ProposalReviewCard } from '@/components/admin/operator-inbox/ProposalReviewCard';
import type {
  PipelineQueueItem,
  PipelineIntentTypeValue,
} from '@/types/ai-pipeline';
import type { ProposedItemStats } from '@/services/ai-pipeline/pipeline-queue-service';

// ============================================================================
// LOGGER
// ============================================================================

const logger = createModuleLogger('OPERATOR_INBOX_CLIENT');

// ============================================================================
// TYPES
// ============================================================================

interface OperatorInboxClientProps {
  adminContext: AdminContext;
}

interface OperatorInboxApiResponse {
  success: boolean;
  items?: PipelineQueueItem[];
  stats?: ProposedItemStats;
  error?: string;
}

// ============================================================================
// BADGE HELPERS
// ============================================================================

type IntentBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const getIntentBadgeVariant = (intent?: PipelineIntentTypeValue): IntentBadgeVariant => {
  switch (intent) {
    case 'invoice':
    case 'payment_notification':
      return 'default';
    case 'defect_report':
      return 'destructive';
    case 'appointment_request':
    case 'property_search':
      return 'secondary';
    default:
      return 'outline';
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function OperatorInboxClient({ adminContext }: OperatorInboxClientProps) {
  const { t } = useTranslation('admin');
  const layout = useLayoutClasses();
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const iconSizes = useIconSizes();

  // State
  const [items, setItems] = useState<PipelineQueueItem[]>([]);
  const [stats, setStats] = useState<ProposedItemStats>({ proposed: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<OperatorInboxFilterState>(defaultOperatorInboxFilters);

  // ── Fetch data ──
  const fetchData = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);

    try {
      const response = await fetch('/api/admin/operator-inbox', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as OperatorInboxApiResponse;

      if (!data.success) {
        throw new Error(data.error ?? 'Unknown error');
      }

      setItems(data.items ?? []);
      setStats(data.stats ?? { proposed: 0, approved: 0, rejected: 0 });
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(message);
      logger.error('Failed to fetch operator inbox data', { error: message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── Approve handler ──
  const handleApprove = useCallback(async (queueId: string) => {
    setProcessingId(queueId);
    try {
      const response = await fetch('/api/admin/operator-inbox', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId, decision: 'approved' }),
      });

      const data = await response.json() as { success: boolean; error?: string };

      if (data.success) {
        toast.success(t('operatorInbox.approveSuccess'));
        await fetchData();
      } else {
        toast.error(data.error ?? t('operatorInbox.approveFailed'));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
      logger.error('Approve failed', { queueId, error: message });
    } finally {
      setProcessingId(null);
    }
  }, [fetchData, t]);

  // ── Reject handler ──
  const handleReject = useCallback(async (queueId: string, reason: string) => {
    setProcessingId(queueId);
    try {
      const response = await fetch('/api/admin/operator-inbox', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId, decision: 'rejected', reason }),
      });

      const data = await response.json() as { success: boolean; error?: string };

      if (data.success) {
        toast.success(t('operatorInbox.rejectSuccess'));
        await fetchData();
      } else {
        toast.error(data.error ?? t('operatorInbox.rejectFailed'));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
      logger.error('Reject failed', { queueId, error: message });
    } finally {
      setProcessingId(null);
    }
  }, [fetchData, t]);

  // ── Dashboard stats ──
  const totalCount = stats.proposed + stats.approved + stats.rejected;

  const dashboardStats: DashboardStat[] = [
    {
      title: t('operatorInbox.stats.total'),
      value: totalCount,
      icon: Mail,
      color: 'blue',
    },
    {
      title: t('operatorInbox.stats.proposed'),
      value: stats.proposed,
      icon: Clock,
      color: 'yellow',
    },
    {
      title: t('operatorInbox.stats.approved'),
      value: stats.approved,
      icon: CheckCircle,
      color: 'green',
    },
    {
      title: t('operatorInbox.stats.rejected'),
      value: stats.rejected,
      icon: XCircle,
      color: 'red',
    },
  ];

  // ── Filter items client-side ──
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const understanding = item.context?.understanding;
      const sender = item.context?.intake?.normalized?.sender;
      const subject = item.context?.intake?.normalized?.subject;

      // Search filter
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const matchesSender = (sender?.name ?? '').toLowerCase().includes(term)
          || (sender?.email ?? '').toLowerCase().includes(term);
        const matchesSubject = (subject ?? '').toLowerCase().includes(term);
        if (!matchesSender && !matchesSubject) return false;
      }

      // Intent filter
      if (filters.intent !== 'all' && understanding?.intent !== filters.intent) {
        return false;
      }

      // Status filter (pipeline state)
      if (filters.status !== 'all' && item.pipelineState !== filters.status) {
        return false;
      }

      // Date filters
      if (filters.dateFrom && item.createdAt) {
        if (new Date(item.createdAt) < new Date(filters.dateFrom)) return false;
      }
      if (filters.dateTo && item.createdAt) {
        if (new Date(item.createdAt) > new Date(filters.dateTo + 'T23:59:59')) return false;
      }

      return true;
    });
  }, [items, filters]);

  // ── Format date ──
  const formatDate = (isoString?: string): string => {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleString('el-GR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <PageContainer>
        <section className="flex items-center justify-center py-20">
          <Spinner />
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer ariaLabel={t('operatorInbox.title')}>

      {/* ===== HEADER (PageHeader — centralized, mirrors AI Inbox) ===== */}
      <PageHeader
        variant="sticky-rounded"
        layout="compact"
        spacing="compact"
        title={{
          icon: Inbox,
          title: t('operatorInbox.title'),
          subtitle: t('operatorInbox.description'),
        }}
        actions={{
          showDashboard,
          onDashboardToggle: () => setShowDashboard(!showDashboard),
          customActions: [
            // Live badge (always on — data fetched on mount)
            <Badge
              key="live-indicator"
              variant="default"
              className="bg-green-600 hover:bg-green-600 text-white animate-pulse"
            >
              <span className="mr-1">&#9679;</span>
              Live
            </Badge>,

            // Pending count badge
            stats.proposed > 0 ? (
              <Badge
                key="pending-count"
                variant="outline"
                className={`${typography.body.sm} ${spacing.padding.x.sm} ${spacing.padding.y.xs}`}
              >
                {stats.proposed} {t('operatorInbox.pending')}
              </Badge>
            ) : null,

            // Refresh button
            <Button
              key="refresh"
              onClick={() => void fetchData(true)}
              variant="outline"
              size="sm"
              aria-label={t('operatorInbox.refresh')}
            >
              {refreshing ? (
                <Spinner size="small" className={layout.buttonIconSpacing} aria-label={t('operatorInbox.refresh')} />
              ) : (
                <RefreshCw className={`${iconSizes.sm} ${layout.buttonIconSpacing}`} />
              )}
              {t('operatorInbox.refresh')}
            </Button>,

            // Mobile filters toggle
            <Button
              key="mobile-filters"
              type="button"
              variant={showFilters ? 'default' : 'outline'}
              size="icon"
              className="md:hidden"
              onClick={() => setShowFilters(!showFilters)}
              aria-label={t('operatorInbox.accessibility.toggleFilters')}
            >
              <Filter className={iconSizes.sm} />
            </Button>,
          ].filter(Boolean) as React.ReactNode[],
        }}
      />

      {/* ===== DASHBOARD (collapsible, mirrors AI Inbox) ===== */}
      {showDashboard && (
        <section className={`${layout.widthFull} overflow-hidden`} aria-label={t('operatorInbox.stats.total')}>
          <UnifiedDashboard
            stats={dashboardStats}
            columns={4}
            onCardClick={(_, index) => {
              const statusMap = ['all', 'proposed', 'approved', 'rejected'];
              const nextStatus = statusMap[index] ?? 'all';
              setFilters(prev => ({ ...prev, status: nextStatus }));
            }}
            className={`${layout.dashboardPadding} overflow-hidden`}
          />
        </section>
      )}

      {/* ===== FILTERS (AdvancedFiltersPanel — centralized, ADR-051) ===== */}
      <section className={layout.widthFull} aria-label={t('operatorInbox.filters.title')}>
        {/* Desktop: always visible */}
        <aside className="hidden md:block" role="complementary" aria-label={t('operatorInbox.filters.title')}>
          <AdvancedFiltersPanel
            config={operatorInboxFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {/* Mobile: toggle */}
        {showFilters && (
          <aside className="md:hidden" role="complementary" aria-label={t('operatorInbox.filters.title')}>
            <AdvancedFiltersPanel
              config={operatorInboxFiltersConfig}
              filters={filters}
              onFiltersChange={setFilters}
              defaultOpen
            />
          </aside>
        )}
      </section>

      {/* ===== ERROR ALERT ===== */}
      {error && (
        <section className={layout.sectionMarginTop} role="alert">
          <Alert variant="destructive">
            <AlertTriangle className={iconSizes.sm} />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </section>
      )}

      {/* ===== MAIN CONTENT (Card-wrapped queue, mirrors AI Inbox) ===== */}
      <ListContainer>
        <section className={`${layout.flexColGap4} flex-1 min-h-0`} aria-label={t('operatorInbox.queueTitle')}>
          <Card>
            <CardHeader>
              <CardTitle>{t('operatorInbox.queueTitle')}</CardTitle>
              <CardDescription>{t('operatorInbox.queueDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredItems.length === 0 ? (
                <div className={`${layout.textCenter} ${spacing.padding.y.lg}`}>
                  <Inbox className={`${iconSizes.xl2} ${layout.centerHorizontal} text-muted-foreground ${spacing.margin.bottom.md}`} />
                  <p className={`${typography.body.sm} text-muted-foreground`}>
                    {t('operatorInbox.empty.title')}
                  </p>
                  <p className={`${typography.body.sm} text-muted-foreground`}>
                    {t('operatorInbox.empty.description')}
                  </p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {filteredItems.map((item) => {
                    const understanding = item.context?.understanding;
                    const sender = item.context?.intake?.normalized?.sender;
                    const subject = item.context?.intake?.normalized?.subject;
                    const confidence = understanding?.confidence ?? 0;

                    return (
                      <AccordionItem key={item.id} value={item.id}>
                        <AccordionTrigger className={`${spacing.padding.sm} hover:no-underline`}>
                          <div className={`${layout.flexGap2} items-center w-full pr-4`}>
                            <Badge variant={getIntentBadgeVariant(understanding?.intent)} className="shrink-0">
                              {understanding?.intent ?? 'unknown'}
                            </Badge>
                            <span className={`${typography.label.sm} truncate max-w-[200px]`}>
                              {sender?.name ?? sender?.email ?? '-'}
                            </span>
                            <span className={`${typography.body.sm} text-muted-foreground truncate flex-1 hidden md:inline`}>
                              {subject ? `- ${subject}` : ''}
                            </span>
                            <Badge variant="outline" className="shrink-0 ml-auto">
                              {confidence.toFixed(0)}%
                            </Badge>
                            <span className={`${typography.body.xs} text-muted-foreground shrink-0 hidden lg:inline`}>
                              {formatDate(item.createdAt)}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className={spacing.padding.sm}>
                          <ProposalReviewCard
                            queueId={item.id}
                            context={item.context}
                            onApprove={handleApprove}
                            onReject={handleReject}
                            isProcessing={processingId === item.id}
                          />
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </section>
      </ListContainer>
    </PageContainer>
  );
}
