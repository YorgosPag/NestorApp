'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: OPERATOR INBOX CLIENT (UC-009)
 * =============================================================================
 *
 * @component OperatorInboxClient
 * @see ADR-080 (Pipeline Implementation), UC-009 (Internal Operator Workflow)
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { PageLoadingState } from '@/core/states';
import { Inbox, RefreshCw, Filter, CheckCircle, XCircle, Clock, AlertTriangle, Mail } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { AdminContext } from '@/server/admin/admin-guards';
import { getIntentBadgeVariant } from '@/components/admin/shared/intent-badge-utils';
import { PageContainer, ListContainer } from '@/core/containers';
import { PageHeader } from '@/core/headers';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel, operatorInboxFiltersConfig } from '@/components/core/AdvancedFilters';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { useIconSizes } from '@/hooks/useIconSizes';
import { formatDateTime } from '@/lib/intl-utils';
import { ProposalReviewCard } from '@/components/admin/operator-inbox/ProposalReviewCard';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// 🏢 ENTERPRISE: Extracted state hook
import { useOperatorInboxState } from './useOperatorInboxState';

// ============================================================================
// TYPES
// ============================================================================

interface OperatorInboxClientProps {
  adminContext: AdminContext;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function OperatorInboxClient({ adminContext: _adminContext }: OperatorInboxClientProps) {
  const { t } = useTranslation('admin');
  const colors = useSemanticColors();
  const layout = useLayoutClasses();
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const iconSizes = useIconSizes();

  const {
    stats, loading, error, processingId, refreshing,
    showDashboard, setShowDashboard, showFilters, setShowFilters,
    filters, setFilters, filteredItems,
    fetchData, handleApprove, handleReject,
  } = useOperatorInboxState();

  const totalCount = stats.proposed + stats.approved + stats.rejected;

  const dashboardStats: DashboardStat[] = [
    { title: t('operatorInbox.stats.total'), value: totalCount, icon: Mail, color: 'blue' },
    { title: t('operatorInbox.stats.proposed'), value: stats.proposed, icon: Clock, color: 'yellow' },
    { title: t('operatorInbox.stats.approved'), value: stats.approved, icon: CheckCircle, color: 'green' },
    { title: t('operatorInbox.stats.rejected'), value: stats.rejected, icon: XCircle, color: 'red' },
  ];

  if (loading) {
    return (
      <PageContainer ariaLabel={t('operatorInbox.title')}>
        <PageLoadingState icon={Inbox} message={t('operatorInbox.loading')} layout="contained" />
      </PageContainer>
    );
  }

  return (
    <PageContainer ariaLabel={t('operatorInbox.title')}>
      <PageHeader
        variant="sticky-rounded" layout="compact" spacing="compact"
        breadcrumb={<ModuleBreadcrumb />}
        title={{ icon: Inbox, title: t('operatorInbox.title'), subtitle: t('operatorInbox.description') }}
        actions={{
          showDashboard,
          onDashboardToggle: () => setShowDashboard(!showDashboard),
          customActions: [
            <Badge key="live-indicator" variant="default" className="bg-green-600 hover:bg-green-600 text-white animate-pulse">
              <span className="mr-1">&#9679;</span>Live
            </Badge>,
            stats.proposed > 0 ? (
              <Badge key="pending-count" variant="outline" className={`${typography.body.sm} ${spacing.padding.x.sm} ${spacing.padding.y.xs}`}>
                {stats.proposed} {t('operatorInbox.pending')}
              </Badge>
            ) : null,
            <Button key="refresh" onClick={() => void fetchData(true)} variant="outline" size="sm" aria-label={t('operatorInbox.refresh')}>
              {refreshing ? <Spinner size="small" className={layout.buttonIconSpacing} aria-label={t('operatorInbox.refresh')} /> : <RefreshCw className={`${iconSizes.sm} ${layout.buttonIconSpacing}`} />}
              {t('operatorInbox.refresh')}
            </Button>,
            <Button key="mobile-filters" type="button" variant={showFilters ? 'default' : 'outline'} size="icon" className="md:hidden" onClick={() => setShowFilters(!showFilters)} aria-label={t('operatorInbox.accessibility.toggleFilters')}>
              <Filter className={iconSizes.sm} />
            </Button>,
          ].filter(Boolean) as React.ReactNode[],
        }}
      />

      {showDashboard && (
        <section className={`${layout.widthFull} overflow-hidden`} aria-label={t('operatorInbox.stats.total')}>
          <UnifiedDashboard stats={dashboardStats} columns={4}
            onCardClick={(_, index) => {
              const statusMap = ['all', 'proposed', 'approved', 'rejected'];
              setFilters(prev => ({ ...prev, status: statusMap[index] ?? 'all' }));
            }}
            className={`${layout.dashboardPadding} overflow-hidden`}
          />
        </section>
      )}

      <section className={layout.widthFull} aria-label={t('operatorInbox.filters.title')}>
        <aside className="hidden md:block" role="complementary" aria-label={t('operatorInbox.filters.title')}>
          <AdvancedFiltersPanel config={operatorInboxFiltersConfig} filters={filters} onFiltersChange={setFilters} />
        </aside>
        {showFilters && (
          <aside className="md:hidden" role="complementary" aria-label={t('operatorInbox.filters.title')}>
            <AdvancedFiltersPanel config={operatorInboxFiltersConfig} filters={filters} onFiltersChange={setFilters} defaultOpen />
          </aside>
        )}
      </section>

      {error && (
        <section className={layout.sectionMarginTop} role="alert">
          <Alert variant="destructive"><AlertTriangle className={iconSizes.sm} /><AlertDescription>{error}</AlertDescription></Alert>
        </section>
      )}

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
                  <Inbox className={`${iconSizes.xl2} ${layout.centerHorizontal} ${colors.text.muted} ${spacing.margin.bottom.md}`} />
                  <p className={`${typography.body.sm} ${colors.text.muted}`}>{t('operatorInbox.empty.title')}</p>
                  <p className={`${typography.body.sm} ${colors.text.muted}`}>{t('operatorInbox.empty.description')}</p>
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
                            <Badge variant={getIntentBadgeVariant(understanding?.intent)} className="shrink-0">{understanding?.intent ?? 'unknown'}</Badge>
                            <span className={`${typography.label.sm} truncate max-w-[200px]`}>{sender?.name ?? sender?.email ?? '-'}</span>
                            <span className={`${typography.body.sm} ${colors.text.muted} truncate flex-1 hidden md:inline`}>{subject ? `- ${subject}` : ''}</span>
                            <Badge variant="outline" className="shrink-0 ml-auto">{confidence.toFixed(0)}%</Badge>
                            <span className={`${typography.body.xs} ${colors.text.muted} shrink-0 hidden lg:inline`}>{formatDateTime(item.createdAt)}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className={spacing.padding.sm}>
                          <ProposalReviewCard queueId={item.id} context={item.context} onApprove={handleApprove} onReject={handleReject} isProcessing={processingId === item.id} />
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
