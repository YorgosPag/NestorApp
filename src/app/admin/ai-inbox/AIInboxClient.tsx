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
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Inbox, CheckCircle, XCircle, Eye, AlertTriangle, Paperclip, FileText, FileImage, Download, File } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { EmailContentWithSignature } from '@/components/shared/email/EmailContentRenderer';
import toast from 'react-hot-toast';
import { useRealtimeTriageCommunications } from '@/hooks/inbox/useRealtimeTriageCommunications';
import type { Communication, FirestoreishTimestamp, TriageStatus } from '@/types/crm';
import { TRIAGE_STATUSES } from '@/types/crm';
import type { AdminContext } from '@/server/admin/admin-guards';
import { PageContainer, ListContainer } from '@/core/containers';
import AIInboxHeader from '@/components/admin/ai-inbox/AIInboxHeader';
import { Spinner } from '@/components/ui/spinner';
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

/**
 * 🏢 ENTERPRISE: Safe content extractor
 * Handles both string content AND object content { text, attachments }
 * from different message sources (email = string, telegram = object)
 */
const getDisplayContent = (content: unknown): string => {
  // Case 1: Already a string
  if (typeof content === 'string') {
    return content;
  }

  // Case 2: Object with text property (Telegram/WhatsApp format)
  if (content && typeof content === 'object') {
    const contentObj = content as Record<string, unknown>;

    // Extract text if present
    if (typeof contentObj.text === 'string') {
      return contentObj.text;
    }

    // Has attachments but no text
    if (Array.isArray(contentObj.attachments) && contentObj.attachments.length > 0) {
      return `[${contentObj.attachments.length} attachment(s)]`;
    }
  }

  // Fallback
  return '';
};

// ============================================================================
// 🏢 ENTERPRISE: ATTACHMENT DISPLAY SYSTEM (Gmail/Outlook/Salesforce Pattern)
// ============================================================================

/**
 * 🏢 ENTERPRISE: File Type Detection & Icon Mapping
 *
 * Maps file URL/extension to appropriate icon and styling.
 * Pattern: Gmail, Outlook, Salesforce attachment display
 */
const getFileTypeInfo = (url: string) => {
  const filename = url.split('/').pop() || url;
  const extension = filename.split('.').pop()?.toLowerCase() || '';

  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension)) {
    return {
      icon: FileImage,
      type: 'image',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    };
  }

  // PDF
  if (extension === 'pdf') {
    return {
      icon: FileText,
      type: 'pdf',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950',
    };
  }

  // Documents (Word, Text)
  if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(extension)) {
    return {
      icon: FileText,
      type: 'document',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    };
  }

  // Spreadsheets (Excel, CSV)
  if (['xls', 'xlsx', 'csv', 'ods'].includes(extension)) {
    return {
      icon: FileText,
      type: 'spreadsheet',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950',
    };
  }

  // Generic file
  return {
    icon: File,
    type: 'file',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-950',
  };
};

/**
 * 🏢 ENTERPRISE: Attachment Display Component
 *
 * Features (Gmail/Outlook/Salesforce standard):
 * - File type icons with semantic color coding
 * - Filename with intelligent truncation
 * - Download button with hover effects
 * - Responsive grid layout (1 col mobile, 2 col desktop)
 * - Accessibility (keyboard navigation, ARIA labels, focus states)
 * - Firebase Storage URL support
 *
 * @param attachments - Array of attachment URLs from Firebase Storage
 */
const AttachmentDisplay = ({ attachments }: { attachments: string[] }) => {
  const layout = useLayoutClasses();
  const typography = useTypography();
  const iconSizes = useIconSizes();

  if (!attachments || attachments.length === 0) return null;

  const handleDownload = (url: string) => {
    // 🏢 ENTERPRISE: Open in new tab with security attributes
    // Firebase Storage URLs are signed and secure
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className={`${layout.flexGap2} items-center`}>
        <Paperclip className={iconSizes.sm} />
        <span className={`${typography.label.sm} text-muted-foreground`}>
          {attachments.length} {attachments.length === 1 ? 'Attachment' : 'Attachments'}
        </span>
      </div>

      {/* Attachments Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {attachments.map((url, index) => {
          const filename = url.split('/').pop() || `attachment-${index + 1}`;
          const fileInfo = getFileTypeInfo(url);
          const FileIcon = fileInfo.icon;

          return (
            <div
              key={index}
              className={`${fileInfo.bgColor} rounded-lg p-3 ${layout.flexGap3} items-center group hover:shadow-sm transition-all border border-transparent hover:border-border`}
            >
              {/* File Icon */}
              <div className={`flex-shrink-0 ${fileInfo.color}`}>
                <FileIcon className={iconSizes.md} />
              </div>

              {/* Filename & Type */}
              <div className="flex-1 min-w-0">
                <p
                  className={`${typography.body.sm} truncate font-medium`}
                  title={filename}
                >
                  {filename}
                </p>
                <p className={`${typography.label.xs} text-muted-foreground`}>
                  {fileInfo.type.toUpperCase()}
                </p>
              </div>

              {/* Download Button */}
              <button
                onClick={() => handleDownload(url)}
                className="flex-shrink-0 p-2 rounded-md hover:bg-background/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={`Download ${filename}`}
                type="button"
              >
                <Download
                  className={`${iconSizes.sm} text-muted-foreground group-hover:text-foreground transition-colors`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const [isMounted, setIsMounted] = useState(false);

  // 🏢 ENTERPRISE: State for server actions fallback (super admin)
  const [serverCommunications, setServerCommunications] = useState<Array<Communication & { id: string }>>([]);
  const [serverLoading, setServerLoading] = useState(true);
  const [serverStatsLoading, setServerStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filters, setFilters] = useState<AIInboxFilterState>(defaultAIInboxFilters);
  const [serverStats, setServerStats] = useState<TriageStats | null>(null);
  const [showDashboard, setShowDashboard] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // 🏢 ENTERPRISE: Real-time mode available for ANY role with tenant context
  // super_admin with companyId gets real-time; without companyId falls back to server actions
  const isRealtimeEnabled = !!adminContext.companyId;

  // 🔥 ENTERPRISE: Real-time Firestore listener (ADR-079)
  // Replaces WebSocket dead code + server action polling for tenant admins
  const realtimeStatusFilter = useMemo((): TriageStatus | undefined => {
    if (filters.status === 'all') return undefined;
    const validStatuses = new Set<string>(Object.values(TRIAGE_STATUSES));
    return validStatuses.has(filters.status) ? (filters.status as TriageStatus) : undefined;
  }, [filters.status]);

  const {
    communications: realtimeCommunications,
    stats: realtimeStats,
    loading: realtimeLoading,
    error: realtimeError,
    connected,
  } = useRealtimeTriageCommunications({
    companyId: adminContext.companyId,
    statusFilter: realtimeStatusFilter,
    enabled: isRealtimeEnabled,
  });

  // 🏢 ENTERPRISE: Unified data source
  // Tenant admins → real-time data, Super admin → server actions
  const communications = isRealtimeEnabled ? realtimeCommunications : serverCommunications;
  const loading = isRealtimeEnabled ? realtimeLoading : serverLoading;
  const stats = isRealtimeEnabled ? realtimeStats : serverStats;
  const statsLoading = isRealtimeEnabled ? realtimeLoading : serverStatsLoading;

  // Propagate realtime errors
  useEffect(() => {
    if (realtimeError && isRealtimeEnabled) {
      setError(realtimeError);
    }
  }, [realtimeError, isRealtimeEnabled]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  // 🏢 ENTERPRISE: Server actions - ONLY for super admin fallback
  // Tenant admins use real-time Firestore listener (ADR-079)
  const loadTriageCommunications = useCallback(async () => {
    if (isRealtimeEnabled) return; // Real-time mode handles this

    setServerLoading(true);
    setError(null);

    try {
      const result = await getTriageCommunications(undefined, adminContext.operationId, resolveStatusFilter());
      if (!result.ok) {
        throw new Error(t('aiInbox.loadFailedWithErrorId', { errorId: result.errorId }));
      }
      const data = result.data;

      setServerCommunications(data as Array<Communication & { id: string }>);

      logger.info('Loaded pending communications (super admin)', {
        count: data.length,
        source: 'server-action',
        adminUid: adminContext.uid,
      });
    } catch (err) {
      logger.error('Failed to load communications', { error: err });
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setServerLoading(false);
    }
  }, [isRealtimeEnabled, adminContext.operationId, adminContext.uid, resolveStatusFilter, t]);

  const loadTriageStats = useCallback(async () => {
    if (isRealtimeEnabled) return; // Real-time mode computes stats from live data

    setServerStatsLoading(true);
    try {
      const result = await getTriageStats(undefined, adminContext.operationId);
      if (!result.ok) {
        throw new Error(t('aiInbox.loadFailedWithErrorId', { errorId: result.errorId }));
      }

      setServerStats(result.data);
    } catch (err) {
      logger.error('Failed to load triage stats', { error: err });
    } finally {
      setServerStatsLoading(false);
    }
  }, [isRealtimeEnabled, adminContext.operationId, t]);

  useEffect(() => {
    if (!isRealtimeEnabled) {
      loadTriageCommunications();
    }
  }, [loadTriageCommunications, isRealtimeEnabled]);

  useEffect(() => {
    if (!isRealtimeEnabled) {
      loadTriageStats();
    }
  }, [loadTriageStats, isRealtimeEnabled]);

  const handleRefresh = useCallback(async () => {
    if (isRealtimeEnabled) {
      // Real-time: no manual refresh needed, but toast to confirm
      toast.success('Live data is already up-to-date!', { duration: 2000 });
      return;
    }
    await Promise.all([loadTriageCommunications(), loadTriageStats()]);
  }, [isRealtimeEnabled, loadTriageCommunications, loadTriageStats]);

  // =========================================================================
  // ACTIONS
  // =========================================================================

  const handleApprove = async (commId: string) => {
    setActionLoading(commId);
    try {
      // 🏢 ENTERPRISE: Get companyId from the communication (supports global admin)
      const comm = communications.find(c => c.id === commId);
      const commCompanyId = comm?.companyId || adminContext.companyId;

      if (!commCompanyId) {
        toast.error('Cannot approve: missing company context');
        return;
      }

      // 🏢 ENTERPRISE: Real server action με idempotent task creation
      const result = await approveCommunication(
        commId,
        adminContext.uid,
        commCompanyId,
        adminContext.operationId
      );

      if (!result.ok) {
        toast.error(t('aiInbox.approveFailedWithErrorId', { errorId: result.errorId }));
        return;
      }

      // 🏢 ENTERPRISE: In real-time mode, Firestore listener auto-updates
      // In server-action mode (super admin), manually update local state
      if (!isRealtimeEnabled) {
        setServerCommunications(prev => {
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

        setServerStats(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            pending: Math.max(0, prev.pending - 1),
            approved: prev.approved + 1,
            total: prev.total
          };
        });
      }

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
      // 🏢 ENTERPRISE: Get companyId from the communication (supports global admin)
      const comm = communications.find(c => c.id === commId);
      const commCompanyId = comm?.companyId || adminContext.companyId;

      if (!commCompanyId) {
        toast.error('Cannot reject: missing company context');
        return;
      }

      // 🏢 ENTERPRISE: Real server action για reject
      const result = await rejectCommunication(
        commId,
        commCompanyId,
        adminContext.uid,
        adminContext.operationId
      );

      if (!result.ok) {
        toast.error(t('aiInbox.rejectFailedWithErrorId', { errorId: result.errorId }));
        return;
      }

      // 🏢 ENTERPRISE: In real-time mode, Firestore listener auto-updates
      if (!isRealtimeEnabled) {
        setServerCommunications(prev => {
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

        setServerStats(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            pending: Math.max(0, prev.pending - 1),
            rejected: prev.rejected + 1,
            total: prev.total
          };
        });
      }

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
        getDisplayContent(comm.content).toLowerCase().includes(term)
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
  const isRefreshing = loading || statsLoading;

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

  if (!isMounted) {
    return null;
  }

  return (
    <PageContainer ariaLabel={t('aiInbox.title')}>
      <AIInboxHeader
        showDashboard={showDashboard}
        setShowDashboard={setShowDashboard}
        pendingCount={pendingCount}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        isLive={connected}
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
              defaultOpen
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
                  <Spinner size="large" />
                </div>
              ) : filteredCommunications.length === 0 ? (
                <div className={`${layout.textCenter} ${spacing.padding.y.lg}`}>
                  <Inbox className={`${iconSizes.xl2} ${layout.centerHorizontal} text-muted-foreground ${spacing.margin.bottom.md}`} />
                  <p className={`${typography.body.sm} text-muted-foreground`}>{t('aiInbox.empty.title')}</p>
                  <p className={`${typography.body.sm} text-muted-foreground`}>{t('aiInbox.empty.description')}</p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {filteredCommunications.map((comm) => {
                    // 🏢 ENTERPRISE: Treat undefined/null triageStatus as 'pending'
                    const isPending = !comm.triageStatus || comm.triageStatus === TRIAGE_STATUSES.PENDING;
                    const isApproved = comm.triageStatus === TRIAGE_STATUSES.APPROVED;
                    const isRejected = comm.triageStatus === TRIAGE_STATUSES.REJECTED;
                    const createdAt = resolveFirestoreTimestamp(comm.createdAt);
                    const formattedDate = createdAt ? createdAt.toLocaleString('el-GR') : '';

                    return (
                      <AccordionItem
                        key={comm.id}
                        value={comm.id}
                        variant="bordered"
                        className={isPending ? 'bg-accent/10' : ''}
                      >
                        <AccordionTrigger variant="bordered" size="md" className="hover:no-underline">
                          <div className={`${layout.flexGap2} items-center w-full pr-4`}>
                            {/* Status Badge */}
                            {isApproved ? (
                              <Badge variant="default" className="shrink-0">
                                <CheckCircle className={`${iconSizes.xs} ${spacing.margin.right.xs}`} />
                                {t('aiInbox.approved')}
                              </Badge>
                            ) : isRejected ? (
                              <Badge variant="destructive" className="shrink-0">
                                <XCircle className={`${iconSizes.xs} ${spacing.margin.right.xs}`} />
                                {t('aiInbox.rejected')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="shrink-0">
                                <AlertTriangle className={`${iconSizes.xs} ${spacing.margin.right.xs}`} />
                                {t('aiInbox.pending')}
                              </Badge>
                            )}

                            {/* Channel Badge */}
                            <Badge variant="secondary" className="shrink-0">{comm.type}</Badge>

                            {/* Sender — Gmail-style: bold when pending/unread */}
                            <span className={`${typography.label.sm} truncate ${isPending ? 'font-semibold text-foreground' : 'font-normal'}`}>
                              {comm.from || t('aiInbox.unknownSender')}
                            </span>

                            {/* Subject — Gmail-style: bold + darker when pending/unread */}
                            {comm.subject && (
                              <span className={`truncate flex-1 ${isPending ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground'}`}>
                                - {comm.subject}
                              </span>
                            )}

                            {/* Date */}
                            <span className={`${typography.body.xs} shrink-0 ml-auto ${isPending ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                              {formattedDate}
                            </span>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent variant="bordered">
                          <div className={`${layout.flexColGap4} pt-2`}>
                            {/* Message Content - safe HTML rendering with signature detection (ADR-072, ADR-073) */}
                            <div className="bg-muted/50 rounded-lg p-4">
                              <div className={typography.body.sm}>
                                <EmailContentWithSignature content={getDisplayContent(comm.content)} />
                              </div>
                            </div>

                            {/* Intent Analysis */}
                            {comm.intentAnalysis && (
                              <div className={`${layout.flexGap4} flex-wrap`}>
                                <div className={layout.flexGap2}>
                                  <span className={typography.label.sm}>{t('aiInbox.intent')}:</span>
                                  <Badge variant={getIntentBadgeVariant(comm.intentAnalysis.intentType)}>
                                    {comm.intentAnalysis.intentType || t('aiInbox.unknownIntent')}
                                  </Badge>
                                </div>
                                {comm.intentAnalysis.confidence && (
                                  <div className={layout.flexGap2}>
                                    <span className={typography.label.sm}>{t('aiInbox.confidence')}:</span>
                                    <Badge variant={getConfidenceBadgeVariant(comm.intentAnalysis.confidence)}>
                                      {Math.round(comm.intentAnalysis.confidence * 100)}%
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 🏢 ENTERPRISE: Attachments Display (Gmail/Outlook Pattern) */}
                            {comm.attachments && comm.attachments.length > 0 && (
                              <div className="bg-background rounded-lg p-4 border border-border">
                                <AttachmentDisplay attachments={comm.attachments} />
                              </div>
                            )}

                            {/* Action Buttons - ALWAYS show for pending messages */}
                            <div className={`${layout.flexGap2} pt-2 border-t`}>
                              {isPending && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApprove(comm.id);
                                    }}
                                    disabled={actionLoading === comm.id}
                                  >
                                    {actionLoading === comm.id ? (
                                      <Spinner size="small" />
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReject(comm.id);
                                    }}
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/crm/tasks/${comm.linkedTaskId}`);
                                  }}
                                >
                                  <Eye className={`${iconSizes.sm} ${spacing.margin.right.xs}`} />
                                  {t('aiInbox.viewTask')}
                                </Button>
                              )}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
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

