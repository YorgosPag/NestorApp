'use client';

/**
 * @module ScheduleAlertBanner
 * @enterprise ADR-266 §5.8 / Phase D.3
 *
 * Collapsible alert banner placed above KPIs in the Schedule Dashboard.
 * Shows count + worst severity collapsed; expands to list with per-alert dismiss.
 */

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSemanticColors, type UseSemanticColorsReturn } from '@/hooks/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { ConstructionAlert, AlertSeverity } from '@/types/building/construction';

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function worstSeverity(alerts: ConstructionAlert[]): AlertSeverity {
  return alerts.reduce<AlertSeverity>(
    (worst, a) => (SEVERITY_ORDER[a.severity] > SEVERITY_ORDER[worst] ? a.severity : worst),
    'low',
  );
}

function severityBg(severity: AlertSeverity, colors: UseSemanticColorsReturn): string {
  switch (severity) {
    case 'critical': return cn(colors.bg.errorLight, colors.border.error);
    case 'high':     return cn(colors.bg.warningLight, colors.border.warning);
    case 'medium':   return cn(colors.bg.warningSubtle, colors.border.warning);
    case 'low':      return cn(colors.bg.infoSubtle, colors.border.info);
  }
}

function severityBadge(severity: AlertSeverity, colors: UseSemanticColorsReturn): string {
  switch (severity) {
    case 'critical': return cn(colors.bg.error, colors.text.onError);
    case 'high':     return cn(colors.bg.warning, colors.text.onWarning);
    case 'medium':   return cn(colors.bg.warningSubtle, colors.text.onWarning);
    case 'low':      return cn(colors.bg.info, colors.text.onInfo);
  }
}

interface ScheduleAlertBannerProps {
  alerts: ConstructionAlert[];
  loading: boolean;
  refreshing: boolean;
  onDismiss: (alertId: string) => void;
  onRefresh: () => void;
  onNavigate?: (alert: ConstructionAlert) => void;
}

export function ScheduleAlertBanner({
  alerts,
  loading,
  refreshing,
  onDismiss,
  onRefresh,
  onNavigate,
}: ScheduleAlertBannerProps) {
  const { t } = useTranslation(['building-timeline']);
  const colors = useSemanticColors();
  const [expanded, setExpanded] = useState(false);

  if (loading || alerts.length === 0) return null;

  const worst = worstSeverity(alerts);
  const sorted = [...alerts].sort(
    (a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity],
  );

  return (
    <section
      role="alert"
      aria-label={t('alerts.bannerAriaLabel', { count: alerts.length })}
      className={cn(
        'rounded-lg border p-3 transition-colors',
        severityBg(worst, colors),
      )}
    >
      <header className="flex items-center gap-2">
        <AlertTriangle className={cn('h-4 w-4 shrink-0', colors.text.warning)} aria-hidden />
        <span className="flex-1 text-sm font-medium">
          {t('alerts.bannerTitle', { count: alerts.length })}
        </span>

        <Badge className={cn('text-xs font-semibold', severityBadge(worst, colors))}>
          {t(`alerts.severity.${worst}`)}
        </Badge>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={t(refreshing ? 'alerts.refreshing' : 'alerts.refresh')}
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={expanded ? t('alerts.collapse') : t('alerts.expand')}
          aria-expanded={expanded}
          onClick={() => setExpanded(v => !v)}
        >
          {expanded
            ? <ChevronUp className="h-3.5 w-3.5" />
            : <ChevronDown className="h-3.5 w-3.5" />
          }
        </Button>
      </header>

      {expanded && (
        <ul className="mt-2 space-y-2" role="list">
          {sorted.map(alert => (
            <li
              key={alert.id}
              className={cn(
                'flex items-start gap-2 rounded-md px-3 py-2',
                colors.bg.overlay,
              )}
            >
              <Badge
                className={cn('mt-0.5 shrink-0 text-xs', severityBadge(alert.severity, colors))}
                aria-label={t(`alerts.severity.${alert.severity}`)}
              >
                {t(`alerts.severity.${alert.severity}`)}
              </Badge>

              <button
                type="button"
                className={cn(
                  'flex-1 text-left text-sm',
                  onNavigate && 'cursor-pointer hover:underline',
                  colors.text.primary,
                )}
                onClick={() => onNavigate?.(alert)}
                disabled={!onNavigate}
                aria-label={alert.title}
              >
                <span className="font-medium">{alert.title}</span>
                <span className={cn('ml-1', colors.text.muted)}>— {alert.message}</span>
              </button>

              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                aria-label={t('alerts.dismissAlert', { title: alert.title })}
                onClick={() => onDismiss(alert.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
