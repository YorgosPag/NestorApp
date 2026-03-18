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
      return new Intl.NumberFormat('el-GR', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(value);
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
              className="h-5 w-5"
              style={{ color: colors.textMuted }}
            />
            <Badge variant={STATUS_BADGE_VARIANT[status]}>
              {STATUS_LABEL[status]}
            </Badge>
          </header>
          <dl>
            <dt
              className="text-sm font-medium mb-1"
              style={{ color: colors.textMuted }}
            >
              {title}
            </dt>
            <dd className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
              {formatValue(value, format)}
            </dd>
          </dl>
          {subtitle && (
            <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
              {subtitle}
            </p>
          )}
        </article>
      </CardContent>
    </Card>
  );
}
