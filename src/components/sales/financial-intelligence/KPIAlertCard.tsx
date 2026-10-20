/* eslint-disable design-system/prefer-design-system-imports */
'use client';

/**
 * KPIAlertCard — Portfolio KPI card with health status indicator
 *
 * @enterprise SPEC-242C — Portfolio Dashboard
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { HealthAssessment } from '@/services/financial-intelligence/portfolio-health';
import { HealthStatusBadge } from './HealthStatusBadge';

// =============================================================================
// TYPES
// =============================================================================

interface KPIAlertCardProps {
  title: string;
  /** `null` = not measured — shown as a dash, never as a fabricated zero */
  value: string | number | null;
  format?: 'currency' | 'percent' | 'number' | 'days';
  health: HealthAssessment;
  icon: LucideIcon;
  subtitle?: string;
}

// =============================================================================
// FORMAT HELPERS
// =============================================================================

function formatValue(value: string | number, format?: string): string {
  if (typeof value === 'string') return value;
  switch (format) {
    case 'currency':
      return formatCurrencyWhole(value);
    case 'percent':
      return `${value.toFixed(2)}%`;
    case 'days':
      return `${Math.round(value)}d`;
    case 'number':
    default:
      return new Intl.NumberFormat('el-GR').format(value);
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function KPIAlertCard({ title, value, format, health, icon: Icon, subtitle }: KPIAlertCardProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('payments');

  return (
    <Card>
      <CardContent className="pt-6">
        <article>
          <header className="flex items-center justify-between mb-3">
            <Icon
              className={cn('h-5 w-5', colors.text.muted)}
            />
            <HealthStatusBadge status={health.status} drivers={health.drivers} />
          </header>
          <dl>
            <dt
              className={cn('text-sm font-medium mb-1', colors.text.muted)}
            >
              {title}
            </dt>
            <dd className={cn('text-2xl font-bold', colors.text.primary)}>
              {value === null ? t('portfolio.notMeasured') : formatValue(value, format)}
            </dd>
          </dl>
          {subtitle && (
            <p className={cn('text-xs mt-2', colors.text.muted)}>
              {subtitle}
            </p>
          )}
        </article>
      </CardContent>
    </Card>
  );
}
