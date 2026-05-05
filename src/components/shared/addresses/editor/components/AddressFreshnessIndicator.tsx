'use client';

import { CheckCircle2, RefreshCw, Clock, AlertTriangle, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { BadgeVariantProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AddressFieldTooltip } from './AddressFieldTooltip';
import type { AddressFreshness, AddressFreshnessLevel } from '../types';

interface AddressFreshnessIndicatorProps {
  freshness: AddressFreshness;
  className?: string;
}

interface FreshnessConfig {
  icon: LucideIcon;
  variant: BadgeVariantProps['variant'];
  labelKey: string;
}

const FRESHNESS_CONFIG: Record<AddressFreshnessLevel, FreshnessConfig> = {
  fresh:  { icon: CheckCircle2, variant: 'success',     labelKey: 'editor.freshness.fresh'  },
  recent: { icon: RefreshCw,    variant: 'secondary',   labelKey: 'editor.freshness.recent' },
  aging:  { icon: Clock,        variant: 'warning',     labelKey: 'editor.freshness.aging'  },
  stale:  { icon: AlertTriangle, variant: 'destructive', labelKey: 'editor.freshness.stale' },
  never:  { icon: XCircle,      variant: 'muted',       labelKey: 'editor.freshness.never'  },
};

const STALE_REASON_KEY: Record<NonNullable<AddressFreshness['staleReason']>, string> = {
  'field-changed':          'editor.freshness.tooltip.staleFieldChanged',
  'time-elapsed':           'editor.freshness.tooltip.staleTimeElapsed',
  'force-refresh-pending':  'editor.freshness.tooltip.staleForceRefresh',
};

function buildTooltipKey(freshness: AddressFreshness): string {
  if (freshness.level === 'never') return 'editor.freshness.tooltip.never';
  if (freshness.staleReason) {
    return STALE_REASON_KEY[freshness.staleReason] ?? 'editor.freshness.tooltip.verifiedAt';
  }
  return 'editor.freshness.tooltip.verifiedAt';
}

function formatTimestamp(ms: number | null): string {
  if (ms === null) return '';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(ms));
}

export function AddressFreshnessIndicator({ freshness, className }: AddressFreshnessIndicatorProps) {
  const { t } = useTranslation('addresses');
  const cfg = FRESHNESS_CONFIG[freshness.level];
  const Icon = cfg.icon;

  const tooltipKey = buildTooltipKey(freshness);
  const when = formatTimestamp(freshness.verifiedAt);
  const tooltip = when ? t(tooltipKey, { when }) : t(tooltipKey);

  return (
    <AddressFieldTooltip content={tooltip}>
      <Badge
        variant={cfg.variant}
        className={cn('gap-1 cursor-default select-none', className)}
      >
        <Icon className="h-3 w-3" />
        <span>{t(cfg.labelKey)}</span>
      </Badge>
    </AddressFieldTooltip>
  );
}
