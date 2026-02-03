'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: AI INBOX CLIENT - UI Component
 * =============================================================================
 *
 * Client component για AI Inbox UI rendering και interactions.
 * Receives admin context from Server Component parent.
 *
 * @component AIInboxClient
 * @enterprise Client-side UI, server-side auth
 * @created 2026-02-03
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Inbox, CheckCircle, XCircle, Eye, AlertTriangle, Filter } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import toast from 'react-hot-toast';
import type { Communication, FirestoreishTimestamp, TriageStatus } from '@/types/crm';
import { TRIAGE_STATUSES } from '@/types/crm';
import type { AdminContext } from '@/server/admin/admin-guards';
import { PageContainer, ListContainer } from '@/core/containers';
import { PageHeader } from '@/core/headers';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel, aiInboxFiltersConfig, defaultAIInboxFilters, type AIInboxFilterState } from '@/components/core/AdvancedFilters';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { useIconSizes } from '@/hooks/useIconSizes';
import {
  getTriageCommunications,
  getTriageStats,
  approveCommunication,
  rejectCommunication
} from '@/services/communications.service';

// ============================================================================
// LOGGER
// ============================================================================

const logger = createModuleLogger('AI_INBOX_CLIENT');

// ============================================================================
// DESIGN SYSTEM - Badge Variants
// ============================================================================

type IntentBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const getIntentBadgeVariant = (intentType?: string): IntentBadgeVariant => {
  switch (intentType) {
    case 'delivery':
    case 'appointment':
      return 'default';
    case 'issue':
      return 'destructive';
    case 'payment':
    case 'info_update':
      return 'secondary';
    default:
      return 'outline';
  }
};

const getConfidenceBadgeVariant = (confidence?: number): IntentBadgeVariant => {
  if (!confidence) return 'outline';
  return confidence >= 0.8 ? 'default' : confidence >= 0.6 ? 'secondary' : 'destructive';
};

// ============================================================================
// PROPS
// ============================================================================

interface AIInboxClientProps {
  adminContext: AdminContext;
}

// ============================================================================
// TYPES
// ============================================================================

interface TriageStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  reviewed: number;
}

const TRIAGE_STATUS_SET = new Set<TriageStatus>(Object.values(TRIAGE_STATUSES));

const resolveFirestoreTimestamp = (value?: FirestoreishTimestamp | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'object' && 'toDate' in value) return value.toDate();
  return null;
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function AIInboxClient({ adminContext }: AIInboxClientProps) {
  const router = useRouter();
  const { t } = useTranslation('admin');
  const layout = useLayoutClasses();
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const iconSizes = useIconSizes();

  // 🏢 ENTERPRISE: Type refinement - Firestore docs always have id
  const [communications, setCommunications] = useState<Array<Communication & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filters, setFilters] = useState<AIInboxFilterState>(defaultAIInboxFilters);
  const [stats, setStats] = useState<TriageStats | null>(null);
  const [showDashboard, setShowDashboard] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const isTriageStatus = useCallback((value: string): value is TriageStatus => {
    return TRIAGE_STATUS_SET.has(value as TriageStatus);
  }, []);

  const resolveStatusFilter = useCallback((): TriageStatus | undefined => {
    if (filters.status === 'all') return undefined;
    return isTriageStatus(filters.status) ? filters.status : undefined;
  }, [filters.status, isTriageStatus]);

  const requireCompanyId = useCallback((): string => {
    const companyId = adminContext.companyId;
    if (!companyId) {
      throw new Error('Admin user has no companyId - tenant isolation violated');
    }
    return companyId;
  }, [adminContext.companyId]);

  // =========================================================================
  // LOAD PENDING COMMUNICATIONS
  // =========================================================================

  const loadTriageCommunications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 🏢 ENTERPRISE: Real data fetching via server action with tenant isolation
      const companyId = adminContext.companyId;

      if (!companyId) {
        throw new Error('Admin user has no companyId - tenant isolation violated');
      }

      const result = await getTriageCommunications(companyId, adminContext.operationId, resolveStatusFilter());
      if (!result.ok) {
        throw new Error(t('aiInbox.loadFailedWithErrorId', { errorId: result.errorId }));
      }
      const data = result.data;

      // 🏢 ENTERPRISE: Type assertion - all Firestore documents have id
      setCommunications(data as Array<Communication & { id: string }>);

      logger.info('Loaded pending communications', {
        count: data.length,
        source: 'firestore',
        adminUid: adminContext.uid
      });
    } catch (err) {
      logger.error('Failed to load communications', { error: err });
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [adminContext.companyId, adminContext.operationId, adminContext.uid, resolveStatusFilter, t]);

  const loadTriageStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const companyId = adminContext.companyId;
      if (!companyId) {
        throw new Error('Admin user has no companyId - tenant isolation violated');
      }

      const result = await getTriageStats(companyId, adminContext.operationId);
      if (!result.ok) {
        throw new Error(t('aiInbox.loadFailedWithErrorId', { errorId: result.errorId }));
      }

      setStats(result.data);
    } catch (err) {
      logger.error('Failed to load triage stats', { error: err });
    } finally {
      setStatsLoading(false);
    }
  }, [adminContext.companyId, adminContext.operationId, t]);

  useEffect(() => {
    loadTriageCommunications();
  }, [loadTriageCommunications]);

  useEffect(() => {
    loadTriageStats();
  }, [loadTriageStats]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadTriageCommunications(), loadTriageStats()]);
  }, [loadTriageCommunications, loadTriageStats]);

  // =========================================================================
  // ACTIONS
  // =========================================================================

  const handleApprove = async (commId: string) => {
    setActionLoading(commId);
    try {
      // 🏢 ENTERPRISE: Real server action με idempotent task creation
      const result = await approveCommunication(
        commId,
        adminContext.uid,
        requireCompanyId(),
        adminContext.operationId
      );

      if (!result.ok) {
        toast.error(t('aiInbox.approveFailedWithErrorId', { errorId: result.errorId }));
        return;
      }

      // Update local state
      setCommunications(prev => {
        const updated = prev.map(comm =>
          comm.id === commId
            ? { ...comm, triageStatus: TRIAGE_STATUSES.APPROVED, linkedTaskId: result.taskId }
            : comm
        );
        if (filters.status !== 'all' && filters.status !== TRIAGE_STATUSES.APPROVED) {
          return updated.filter(comm => comm.id !== commId);
        }
        return updated;
      });

      setStats(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          pending: Math.max(0, prev.pending - 1),
          approved: prev.approved + 1,
          total: prev.total
        };
      });

      toast.success(t('aiInbox.approveSuccess'));
      logger.info('Communication approved', {
        communicationId: commId,
        taskId: result.taskId,
        adminUid: adminContext.uid
      });
    } catch (err) {
      logger.error('Approve failed', { communicationId: commId, error: err });
      toast.error(t('aiInbox.approveFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (commId: string) => {
    setActionLoading(commId);
    try {
      // 🏢 ENTERPRISE: Real server action για reject
      const result = await rejectCommunication(
        commId,
        requireCompanyId(),
        adminContext.uid,
        adminContext.operationId
      );

      if (!result.ok) {
        toast.error(t('aiInbox.rejectFailedWithErrorId', { errorId: result.errorId }));
        return;
      }

      setCommunications(prev => {
        const updated = prev.map(comm =>
          comm.id === commId
            ? { ...comm, triageStatus: TRIAGE_STATUSES.REJECTED }
            : comm
        );
        if (filters.status !== 'all' && filters.status !== TRIAGE_STATUSES.REJECTED) {
          return updated.filter(comm => comm.id !== commId);
        }
        return updated;
      });

      setStats(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          pending: Math.max(0, prev.pending - 1),
          rejected: prev.rejected + 1,
          total: prev.total
        };
      });

      toast.success(t('aiInbox.rejectSuccess'));
      logger.info('Communication rejected', {
        communicationId: commId,
        adminUid: adminContext.uid
      });
    } catch (err) {
      logger.error('Reject failed', { communicationId: commId, error: err });
      toast.error(t('aiInbox.rejectFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  // =========================================================================
  // MAIN RENDER
  // =========================================================================

  const filteredCommunications = useMemo(() => {
    let list = [...communications];

    if (filters.searchTerm.trim()) {
      const term = filters.searchTerm.trim().toLowerCase();
      list = list.filter(comm =>
        (comm.from || '').toLowerCase().includes(term) ||
        (comm.subject || '').toLowerCase().includes(term) ||
        (comm.content || '').toLowerCase().includes(term)
      );
    }

    if (filters.channel !== 'all') {
      list = list.filter(comm => comm.type === filters.channel);
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      list = list.filter(comm => {
        const createdAt = resolveFirestoreTimestamp(comm.createdAt);
        return createdAt ? createdAt.getTime() >= fromDate.getTime() : false;
      });
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      list = list.filter(comm => {
        const createdAt = resolveFirestoreTimestamp(comm.createdAt);
        return createdAt ? createdAt.getTime() <= toDate.getTime() : false;
      });
    }

    return list;
  }, [communications, filters.channel, filters.dateFrom, filters.dateTo, filters.searchTerm]);

  const pendingCount = stats?.pending ?? 0;

  const dashboardStatusFilters = useMemo(() => ([
    'all',
    TRIAGE_STATUSES.PENDING,
    TRIAGE_STATUSES.APPROVED,
    TRIAGE_STATUSES.REJECTED
  ]), []);

  const dashboardStats = useMemo<DashboardStat[]>(() => ([
    {
      title: t('aiInbox.stats.total'),
      value: statsLoading ? '...' : stats?.total ?? 0,
      icon: Inbox,
      color: 'blue'
    },
    {
      title: t('aiInbox.stats.pending'),
      value: statsLoading ? '...' : stats?.pending ?? 0,
      icon: AlertTriangle,
      color: 'yellow'
    },
    {
      title: t('aiInbox.stats.approved'),
      value: statsLoading ? '...' : stats?.approved ?? 0,
      icon: CheckCircle,
      color: 'green'
    },
    {
      title: t('aiInbox.stats.rejected'),
      value: statsLoading ? '...' : stats?.rejected ?? 0,
      icon: XCircle,
      color: 'red'
    }
  ]), [stats, statsLoading, t]);

  return (
    <PageContainer ariaLabel={t('aiInbox.title')}>
      <PageHeader
        variant="sticky-rounded"
        layout="compact"
        spacing="compact"
        title={{
          icon: Inbox,
          title: t('aiInbox.title'),
          subtitle: t('aiInbox.description')
        }}
        actions={{
          showDashboard,
          onDashboardToggle: () => setShowDashboard(!showDashboard),
          customActions: [
            pendingCount > 0 ? (
              <Badge key="pending-count" variant="outline" className={`${typography.body.sm} ${spacing.padding.x.sm} ${spacing.padding.y.xs}`}>
                {pendingCount} {t('aiInbox.pending')}
              </Badge>
            ) : null,
            <Button key="refresh" onClick={handleRefresh} variant="outline" size="sm">
              <Loader2 className={`${iconSizes.sm} ${layout.buttonIconSpacing} ${loading || statsLoading ? 'animate-spin' : ''}`} />
              {t('aiInbox.refresh')}
            </Button>,
            <Button
              key="mobile-filters"
              type="button"
              variant={showFilters ? 'default' : 'outline'}
              size="icon"
              className="md:hidden"
              onClick={() => setShowFilters(!showFilters)}
              aria-label={t('aiInbox.accessibility.toggleFilters')}
            >
              <Filter className={iconSizes.sm} />
            </Button>
          ].filter(Boolean) as ReactNode[]
        }}
      />

      {showDashboard && (
        <section className={`${layout.widthFull} overflow-hidden`} aria-label={t('aiInbox.stats.total')}>
          <UnifiedDashboard
            stats={dashboardStats}
            columns={4}
            onCardClick={(_, index) => {
              const nextStatus = dashboardStatusFilters[index] ?? 'all';
              setFilters(prev => ({ ...prev, status: nextStatus }));
            }}
            className={`${layout.dashboardPadding} overflow-hidden`}
          />
        </section>
      )}

      <section className={layout.widthFull} aria-label={t('aiInbox.filters.title')}>
        <aside className="hidden md:block" role="complementary" aria-label={t('aiInbox.filters.title')}>
          <AdvancedFiltersPanel
            config={aiInboxFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {showFilters && (
          <aside className="md:hidden" role="complementary" aria-label={t('aiInbox.filters.title')}>
            <AdvancedFiltersPanel
              config={aiInboxFiltersConfig}
              filters={filters}
              onFiltersChange={setFilters}
              defaultOpen={true}
            />
          </aside>
        )}
      </section>

      {error && (
        <section className={layout.sectionMarginTop} role="alert">
          <Alert variant="destructive">
            <AlertTriangle className={iconSizes.sm} />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </section>
      )}

      <ListContainer>
        <section className={`${layout.flexColGap4} flex-1 min-h-0`} aria-label={t('aiInbox.queueTitle')}>
          <Card>
            <CardHeader>
              <CardTitle>{t('aiInbox.queueTitle')}</CardTitle>
              <CardDescription>{t('aiInbox.queueDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className={`flex items-center justify-center ${spacing.padding.y.lg}`}>
                  <Loader2 className={`${iconSizes.xl} animate-spin text-muted-foreground`} />
                </div>
              ) : filteredCommunications.length === 0 ? (
                <div className={`${layout.textCenter} ${spacing.padding.y.lg}`}>
                  <Inbox className={`${iconSizes.xl2} ${layout.centerHorizontal} text-muted-foreground ${spacing.margin.bottom.md}`} />
                  <p className={`${typography.body.sm} text-muted-foreground`}>{t('aiInbox.empty.title')}</p>
                  <p className={`${typography.body.sm} text-muted-foreground`}>{t('aiInbox.empty.description')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('aiInbox.from')}</TableHead>
                        <TableHead>{t('aiInbox.channel')}</TableHead>
                        <TableHead>{t('aiInbox.content')}</TableHead>
                        <TableHead>{t('aiInbox.intent')}</TableHead>
                        <TableHead>{t('aiInbox.confidence')}</TableHead>
                        <TableHead>{t('aiInbox.status')}</TableHead>
                        <TableHead>{t('aiInbox.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCommunications.map((comm) => (
                        <TableRow key={comm.id}>
                        <TableCell className={typography.label.sm}>
                          {comm.from || t('aiInbox.unknownSender')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{comm.type}</Badge>
                        </TableCell>
                        <TableCell className={layout.truncate}>
                          {comm.content}
                        </TableCell>
                          <TableCell>
                            <Badge variant={getIntentBadgeVariant(comm.intentAnalysis?.intentType)}>
                              {comm.intentAnalysis?.intentType || t('aiInbox.unknownIntent')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {comm.intentAnalysis?.confidence && (
                              <Badge variant={getConfidenceBadgeVariant(comm.intentAnalysis.confidence)}>
                                {Math.round(comm.intentAnalysis.confidence * 100)}%
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {comm.triageStatus === TRIAGE_STATUSES.APPROVED ? (
                              <Badge variant="default">
                                <CheckCircle className={`${iconSizes.xs} ${spacing.margin.right.xs}`} />
                                {t('aiInbox.approved')}
                              </Badge>
                          ) : comm.triageStatus === TRIAGE_STATUSES.REJECTED ? (
                            <Badge variant="destructive">
                              <XCircle className={`${iconSizes.xs} ${spacing.margin.right.xs}`} />
                              {t('aiInbox.rejected')}
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <AlertTriangle className={`${iconSizes.xs} ${spacing.margin.right.xs}`} />
                              {t('aiInbox.pending')}
                            </Badge>
                          )}
                          </TableCell>
                          <TableCell>
                            <div className={layout.flexGap2}>
                              {comm.triageStatus === TRIAGE_STATUSES.PENDING && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleApprove(comm.id)}
                                    disabled={actionLoading === comm.id}
                                  >
                                    {actionLoading === comm.id ? (
                                      <Loader2 className={`${iconSizes.sm} animate-spin`} />
                                    ) : (
                                      <>
                                        <CheckCircle className={`${iconSizes.sm} ${spacing.margin.right.xs}`} />
                                        {t('aiInbox.approve')}
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReject(comm.id)}
                                    disabled={actionLoading === comm.id}
                                  >
                                    <XCircle className={`${iconSizes.sm} ${spacing.margin.right.xs}`} />
                                    {t('aiInbox.reject')}
                                  </Button>
                                </>
                              )}
                              {comm.linkedTaskId && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => router.push(`/crm/tasks/${comm.linkedTaskId}`)}
                                >
                                  <Eye className={`${iconSizes.sm} ${spacing.margin.right.xs}`} />
                                  {t('aiInbox.viewTask')}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
            <CardTitle className={typography.heading.md}>{t('aiInbox.howItWorks')}</CardTitle>
          </CardHeader>
          <CardContent className={`${typography.body.sm} text-muted-foreground ${layout.flexColGap2}`}>
              <p>1. {t('aiInbox.howItWorksStep1')}</p>
              <p>2. {t('aiInbox.howItWorksStep2')}</p>
              <p>3. {t('aiInbox.howItWorksStep3')}</p>
              <p>4. {t('aiInbox.howItWorksStep4')}</p>
              <p>5. {t('aiInbox.howItWorksStep5')}</p>
            </CardContent>
          </Card>
        </section>
      </ListContainer>
    </PageContainer>
  );
}

