'use client';

/**
 * =============================================================================
 * AI INBOX CLIENT — UI Component (presentation layer)
 * =============================================================================
 *
 * Client component for AI Inbox UI rendering and interactions.
 * Receives admin context from Server Component parent.
 *
 * State logic extracted to useAIInboxState (SRP).
 * Helper functions extracted to ai-inbox-helpers (SRP).
 *
 * @component AIInboxClient
 * @enterprise Client-side UI, server-side auth
 * @created 2026-02-03
 * @refactored 2026-03-28 — split into 3 modules (ADR N.7.1)
 */

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Inbox, CheckCircle, XCircle, Eye, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EmailContentWithSignature } from '@/components/shared/email/EmailContentRenderer';
import { TRIAGE_STATUSES } from '@/types/crm';
import type { AdminContext } from '@/server/admin/admin-guards';
import { PageContainer, ListContainer } from '@/core/containers';
import AIInboxHeader from '@/components/admin/ai-inbox/AIInboxHeader';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { Spinner } from '@/components/ui/spinner';
import { PageLoadingState } from '@/core/states';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel, aiInboxFiltersConfig } from '@/components/core/AdvancedFilters';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { useIconSizes } from '@/hooks/useIconSizes';
import { ENTITY_ROUTES } from '@/lib/routes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// Extracted modules (SRP)
import {
  getIntentBadgeVariant,
  getConfidenceBadgeVariant,
  getDisplayContent,
  resolveFirestoreTimestamp,
  AttachmentDisplay,
} from './ai-inbox-helpers';
import { useAIInboxState } from './useAIInboxState';

// Re-exports for backward compatibility
export {
  getIntentBadgeVariant,
  getConfidenceBadgeVariant,
  getDisplayContent,
  resolveFirestoreTimestamp,
  AttachmentDisplay,
} from './ai-inbox-helpers';
export { useAIInboxState } from './useAIInboxState';
export type { TriageStats, AIInboxState } from './useAIInboxState';

// ============================================================================
// PROPS
// ============================================================================

interface AIInboxClientProps {
  adminContext: AdminContext;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AIInboxClient({ adminContext }: AIInboxClientProps) {
  const router = useRouter();
  const { t } = useTranslation('admin');
  const colors = useSemanticColors();
  const layout = useLayoutClasses();
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const iconSizes = useIconSizes();

  const {
    filteredCommunications,
    loading,
    statsLoading,
    error,
    actionLoading,
    stats,
    pendingCount,
    isRefreshing,
    connected,
    filters,
    showDashboard,
    showFilters,
    isMounted,
    setFilters,
    setShowDashboard,
    setShowFilters,
    handleRefresh,
    handleApprove,
    handleReject,
  } = useAIInboxState(adminContext);

  // =========================================================================
  // DASHBOARD STATS
  // =========================================================================

  const dashboardStatusFilters = useMemo(() => ([
    'all',
    TRIAGE_STATUSES.PENDING,
    TRIAGE_STATUSES.APPROVED,
    TRIAGE_STATUSES.REJECTED,
  ]), []);

  const dashboardStats = useMemo<DashboardStat[]>(() => ([
    {
      title: t('aiInbox.stats.total'),
      value: statsLoading ? '...' : stats?.total ?? 0,
      icon: Inbox,
      color: 'blue',
    },
    {
      title: t('aiInbox.stats.pending'),
      value: statsLoading ? '...' : stats?.pending ?? 0,
      icon: AlertTriangle,
      color: 'yellow',
    },
    {
      title: t('aiInbox.stats.approved'),
      value: statsLoading ? '...' : stats?.approved ?? 0,
      icon: CheckCircle,
      color: 'green',
    },
    {
      title: t('aiInbox.stats.rejected'),
      value: statsLoading ? '...' : stats?.rejected ?? 0,
      icon: XCircle,
      color: 'red',
    },
  ]), [stats, statsLoading, t]);

  if (!isMounted) {
    return null;
  }

  // =========================================================================
  // RENDER
  // =========================================================================

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
        breadcrumb={<ModuleBreadcrumb />}
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
                <PageLoadingState icon={Inbox} message={t('inbox.loading')} layout="contained" />
              ) : filteredCommunications.length === 0 ? (
                <div className={`${layout.textCenter} ${spacing.padding.y.lg}`}>
                  <Inbox className={`${iconSizes.xl2} ${layout.centerHorizontal} ${colors.text.muted} ${spacing.margin.bottom.md}`} />
                  <p className={`${typography.body.sm} ${colors.text.muted}`}>{t('aiInbox.empty.title')}</p>
                  <p className={`${typography.body.sm} ${colors.text.muted}`}>{t('aiInbox.empty.description')}</p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {filteredCommunications.map((comm) => {
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

                            <Badge variant="secondary" className="shrink-0">{comm.type}</Badge>

                            <span className={`${typography.label.sm} truncate ${isPending ? 'font-semibold text-foreground' : 'font-normal'}`}>
                              {comm.from || t('aiInbox.unknownSender')}
                            </span>

                            {comm.subject && (
                              <span className={`truncate flex-1 ${isPending ? 'font-semibold text-foreground' : `font-normal ${colors.text.muted}`}`}>
                                - {comm.subject}
                              </span>
                            )}

                            <span className={`${typography.body.xs} shrink-0 ml-auto ${isPending ? 'font-medium text-foreground' : colors.text.muted}`}>
                              {formattedDate}
                            </span>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent variant="bordered">
                          <div className={`${layout.flexColGap4} pt-2`}>
                            <div className="bg-muted/50 rounded-lg p-4">
                              <div className={typography.body.sm}>
                                <EmailContentWithSignature content={getDisplayContent(comm.content)} />
                              </div>
                            </div>

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

                            {comm.attachments && comm.attachments.length > 0 && (
                              <div className="bg-background rounded-lg p-4 border border-border">
                                <AttachmentDisplay attachments={comm.attachments} />
                              </div>
                            )}

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
                                    router.push(ENTITY_ROUTES.crm.task(comm.linkedTaskId!));
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
            <CardContent className={`${typography.body.sm} ${colors.text.muted} ${layout.flexColGap2}`}>
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
