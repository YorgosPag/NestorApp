'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: OPERATOR INBOX CLIENT (UC-009)
 * =============================================================================
 *
 * Client component for the Operator Inbox UI.
 * Displays pipeline proposals awaiting human review with approve/reject actions.
 *
 * @component OperatorInboxClient
 * @enterprise Client-side UI, server-side auth via AdminContext
 * @see ADR-080 (Pipeline Implementation)
 * @see UC-009 (Internal Operator Workflow)
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import toast from 'react-hot-toast';
import type { AdminContext } from '@/server/admin/admin-guards';
import { PageContainer, ListContainer } from '@/core/containers';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
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
  const dashboardStats: DashboardStat[] = [
    {
      title: t('operatorInbox.stats.proposed'),
      value: stats.proposed,
      icon: Clock,
    },
    {
      title: t('operatorInbox.stats.approved'),
      value: stats.approved,
      icon: CheckCircle,
    },
    {
      title: t('operatorInbox.stats.rejected'),
      value: stats.rejected,
      icon: XCircle,
    },
  ];

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
    <PageContainer>
      {/* Header */}
      <header className={`${spacing.gap.md} flex items-center justify-between`}>
        <div className={`${spacing.gap.sm} flex items-center`}>
          <Inbox className={iconSizes.md} />
          <h1 className={typography.heading.lg}>{t('operatorInbox.title')}</h1>
          {stats.proposed > 0 && (
            <Badge variant="secondary">{stats.proposed}</Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchData(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {t('operatorInbox.refresh')}
        </Button>
      </header>

      {/* Description */}
      <p className={`${typography.body.sm} text-muted-foreground ${spacing.margin.bottom.md}`}>
        {t('operatorInbox.description')}
      </p>

      {/* Dashboard Stats */}
      <UnifiedDashboard stats={dashboardStats} />

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className={spacing.margin.top.md}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Queue List */}
      <ListContainer className={spacing.margin.top.md}>
        <h2 className={`${typography.heading.md} ${spacing.margin.bottom.sm}`}>
          {t('operatorInbox.queueTitle')}
        </h2>

        {items.length === 0 ? (
          <Card>
            <CardContent className={`${spacing.padding.lg} text-center`}>
              <Inbox className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <h3 className={`${typography.heading.sm} ${spacing.margin.top.sm}`}>
                {t('operatorInbox.empty.title')}
              </h3>
              <p className={`${typography.body.sm} text-muted-foreground`}>
                {t('operatorInbox.empty.description')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="single" collapsible className={spacing.gap.sm}>
            {items.map((item) => {
              const understanding = item.context?.understanding;
              const sender = item.context?.intake?.normalized?.sender;
              const subject = item.context?.intake?.normalized?.subject;
              const confidence = understanding?.confidence ?? 0;

              return (
                <AccordionItem key={item.id} value={item.id}>
                  <AccordionTrigger className={`${spacing.padding.sm} hover:no-underline`}>
                    <div className={`${spacing.gap.sm} flex flex-1 items-center`}>
                      <Badge variant={getIntentBadgeVariant(understanding?.intent)}>
                        {understanding?.intent ?? 'unknown'}
                      </Badge>
                      <span className={`${typography.body.sm} truncate max-w-[200px]`}>
                        {sender?.name ?? sender?.email ?? '-'}
                      </span>
                      <span className={`${typography.body.sm} text-muted-foreground truncate max-w-[300px] hidden md:inline`}>
                        {subject ?? '-'}
                      </span>
                      <Badge variant="outline" className="ml-auto">
                        {confidence.toFixed(0)}%
                      </Badge>
                      <span className={`${typography.body.sm} text-muted-foreground hidden lg:inline`}>
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
      </ListContainer>
    </PageContainer>
  );
}
