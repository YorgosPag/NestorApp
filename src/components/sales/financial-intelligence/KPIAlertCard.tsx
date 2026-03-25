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
import { Badge } from '@/components/ui/badge';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type { HealthStatus } from '@/types/interest-calculator';

// =============================================================================
// TYPES
// =============================================================================

interface KPIAlertCardProps {
  title: string;
  value: string | number;
  format?: 'currency' | 'percent' | 'number' | 'days';
  status: HealthStatus;
  icon: LucideIcon;
  subtitle?: string;
}

// =============================================================================
// HEALTH STATUS → BADGE VARIANT MAPPING
// =============================================================================

const STATUS_BADGE_VARIANT: Record<HealthStatus, 'success' | 'info' | 'warning' | 'destructive'> = {
  excellent: 'success',
  good: 'info',
  warning: 'warning',
  critical: 'destructive',
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  excellent: 'Excellent',
  good: 'Good',
  warning: 'Warning',
  critical: 'Critical',
};

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

export function KPIAlertCard({ title, value, format, status, icon: Icon, subtitle }: KPIAlertCardProps) {
  const colors = useSemanticColors();

  return (
    <Card>
      <CardContent className="pt-6">
        <article>
          <header className="flex items-center justify-between mb-3">
            <Icon
              className={cn('h-5 w-5', colors.text.muted)}
            />
            <Badge variant={STATUS_BADGE_VARIANT[status]}>
              {STATUS_LABEL[status]}
            </Badge>
          </header>
          <dl>
            <dt
              className={cn('text-sm font-medium mb-1', colors.text.muted)}
            >
              {title}
            </dt>
            <dd className={cn('text-2xl font-bold', colors.text.primary)}>
              {formatValue(value, format)}
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
