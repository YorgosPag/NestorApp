'use client';

/**
 * HealthStatusBadge — the one place a `HealthStatus` becomes a colored, translated badge.
 *
 * KPIAlertCard, the portfolio table and the debt maturity wall used to carry three
 * copies of the status → variant map, and two of them rendered the label as raw
 * English (`'Critical'`, or the enum value itself) instead of going through i18n.
 *
 * When the caller knows *why* (the metrics that decided the status, or that nothing
 * could be measured) the badge explains itself in a tooltip — a status without its
 * reason is a claim the user cannot check.
 *
 * @enterprise SPEC-242C — Portfolio Dashboard
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { HealthMetricKey, HealthStatus } from '@/types/interest-calculator';

type HealthBadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted';

export const HEALTH_BADGE_VARIANT: Record<HealthStatus, HealthBadgeVariant> = {
  excellent: 'success',
  good: 'info',
  warning: 'warning',
  critical: 'destructive',
  // Neutral on purpose: missing data is not good news and not bad news.
  noData: 'muted',
};

interface HealthStatusBadgeProps {
  status: HealthStatus;
  /** The metrics that set `status`. When given, the badge explains itself. */
  drivers?: readonly HealthMetricKey[];
}

export function HealthStatusBadge({ status, drivers }: HealthStatusBadgeProps) {
  const { t } = useTranslation('payments');
  const badge = (
    <Badge variant={HEALTH_BADGE_VARIANT[status]}>
      {t(`portfolio.healthStatus.${status}`)}
    </Badge>
  );

  if (drivers === undefined) return badge;

  const explanation = status === 'noData'
    ? t('portfolio.healthNoDataReason')
    : t('portfolio.healthBasis', {
        metrics: drivers.map((key) => t(`portfolio.healthMetric.${key}`)).join(', '),
      });

  return (
    <Tooltip>
      <TooltipTrigger className="cursor-help rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {badge}
        <span className="sr-only">{explanation}</span>
      </TooltipTrigger>
      <TooltipContent>{explanation}</TooltipContent>
    </Tooltip>
  );
}
