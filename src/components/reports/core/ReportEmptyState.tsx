'use client';

/**
 * @module ReportEmptyState
 * @enterprise ADR-265 — Report-specific empty state with presets
 *
 * Wraps the shared EmptyState component with report-specific
 * default icons, titles, and descriptions per empty state type.
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { BarChart3, SearchX, AlertCircle, ShieldX, type LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmptyStateType = 'no-data' | 'no-results' | 'error' | 'no-permission';

export interface ReportEmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: LucideIcon;
  className?: string;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const PRESET_ICONS: Record<EmptyStateType, LucideIcon> = {
  'no-data': BarChart3,
  'no-results': SearchX,
  'error': AlertCircle,
  'no-permission': ShieldX,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportEmptyState({
  type = 'no-data',
  title,
  description,
  action,
  icon,
  className,
}: ReportEmptyStateProps) {
  const { t } = useTranslation('reports');

  const i18nKey = type === 'no-data' ? 'noData'
    : type === 'no-results' ? 'noResults'
    : type === 'no-permission' ? 'noPermission'
    : 'error';

  return (
    <EmptyState
      icon={icon ?? PRESET_ICONS[type]}
      title={title ?? t(`empty.${i18nKey}.title`)}
      description={description ?? t(`empty.${i18nKey}.description`)}
      action={action}
      size="md"
      variant="plain"
      className={cn(className)}
    />
  );
}
