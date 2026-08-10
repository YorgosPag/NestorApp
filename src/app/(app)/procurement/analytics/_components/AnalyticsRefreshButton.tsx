'use client';

/**
 * AnalyticsRefreshButton — Manual cache invalidation trigger (ADR-331 §4 D28).
 *
 * @see ADR-331 §4 D14, D28
 */

import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface AnalyticsRefreshButtonProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function AnalyticsRefreshButton({ onRefresh, isRefreshing }: AnalyticsRefreshButtonProps) {
  const { t } = useTranslation('procurement');
  const Icon = isRefreshing ? Loader2 : RefreshCw;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onRefresh}
      disabled={isRefreshing}
      aria-label={t('analytics.refresh.ariaLabel')}
    >
      <Icon className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden />
      {t('analytics.refresh.button')}
    </Button>
  );
}
