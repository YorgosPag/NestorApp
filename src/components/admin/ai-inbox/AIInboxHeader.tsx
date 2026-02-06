'use client';

/**
 * 🏢 ENTERPRISE: AI Inbox Header (centralized)
 * Mirrors the Contacts header behavior: dashboard toggle + mobile filters.
 * ZERO hardcoded strings (i18n only).
 */

import React from 'react';
import { Inbox, Filter, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/core/headers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';

interface AIInboxHeaderProps {
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  pendingCount: number;
  isRefreshing: boolean;
  onRefresh: () => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  /** Real-time Firestore listener is active (ADR-079) */
  isLive?: boolean;
}

export function AIInboxHeader({
  showDashboard,
  setShowDashboard,
  pendingCount,
  isRefreshing,
  onRefresh,
  showFilters,
  setShowFilters,
  isLive = false,
}: AIInboxHeaderProps) {
  const { t } = useTranslation('admin');
  const iconSizes = useIconSizes();
  const layout = useLayoutClasses();
  const spacing = useSpacingTokens();
  const typography = useTypography();

  return (
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
          isLive ? (
            <Badge
              key="live-indicator"
              variant="default"
              className="bg-green-600 hover:bg-green-600 text-white animate-pulse"
            >
              <span className="mr-1">&#9679;</span>
              Live
            </Badge>
          ) : null,
          pendingCount > 0 ? (
            <Badge
              key="pending-count"
              variant="outline"
              className={`${typography.body.sm} ${spacing.padding.x.sm} ${spacing.padding.y.xs}`}
            >
              {pendingCount} {t('aiInbox.pending')}
            </Badge>
          ) : null,
          <Button key="refresh" onClick={onRefresh} variant="outline" size="sm" aria-label={t('aiInbox.refresh')}>
            {isRefreshing ? (
              <Spinner size="small" className={layout.buttonIconSpacing} aria-label={t('aiInbox.refresh')} />
            ) : (
              <RefreshCw className={`${iconSizes.sm} ${layout.buttonIconSpacing}`} />
            )}
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
        ].filter(Boolean) as React.ReactNode[]
      }}
    />
  );
}

export default AIInboxHeader;
