'use client';

import { CheckCircle2, AlertCircle, HelpCircle, MinusCircle, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { BadgeVariantProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AddressFieldTooltip } from './AddressFieldTooltip';
import type { AddressFieldStatus } from '../types';

interface AddressFieldBadgeProps {
  status: AddressFieldStatus;
  className?: string;
}

interface StatusConfig {
  icon: LucideIcon;
  variant: BadgeVariantProps['variant'];
  labelKey: string;
  tooltipKey: string;
}

const STATUS_CONFIG: Record<AddressFieldStatus['kind'], StatusConfig> = {
  match: {
    icon: CheckCircle2,
    variant: 'success',
    labelKey: 'editor.field.badge.match',
    tooltipKey: 'editor.field.tooltip.match',
  },
  mismatch: {
    icon: AlertCircle,
    variant: 'warning',
    labelKey: 'editor.field.badge.mismatch',
    tooltipKey: 'editor.field.tooltip.mismatch',
  },
  unknown: {
    icon: HelpCircle,
    variant: 'info',
    labelKey: 'editor.field.badge.unknown',
    tooltipKey: 'editor.field.tooltip.unknown',
  },
  'not-provided': {
    icon: MinusCircle,
    variant: 'muted',
    labelKey: 'editor.field.badge.notProvided',
    tooltipKey: 'editor.field.tooltip.notProvided',
  },
  pending: {
    icon: Loader2,
    variant: 'secondary',
    labelKey: 'editor.field.badge.pending',
    tooltipKey: 'editor.field.tooltip.pending',
  },
};

function buildTooltipParams(status: AddressFieldStatus): Record<string, string> | undefined {
  if (status.kind === 'mismatch') {
    return { userValue: status.userValue, resolvedValue: status.resolvedValue };
  }
  if (status.kind === 'not-provided' && status.resolvedValue) {
    return { resolvedValue: status.resolvedValue };
  }
  return undefined;
}

function resolveTooltipKey(status: AddressFieldStatus, baseKey: string): string {
  if (status.kind === 'not-provided' && !status.resolvedValue) {
    return 'editor.field.tooltip.notProvidedEmpty';
  }
  return baseKey;
}

export function AddressFieldBadge({ status, className }: AddressFieldBadgeProps) {
  const { t } = useTranslation('addresses');
  const cfg = STATUS_CONFIG[status.kind];
  const Icon = cfg.icon;

  const tooltipKey = resolveTooltipKey(status, cfg.tooltipKey);
  const tooltipParams = buildTooltipParams(status);
  const tooltipContent = t(tooltipKey, tooltipParams);

  return (
    <AddressFieldTooltip content={tooltipContent}>
      <Badge
        variant={cfg.variant}
        className={cn('gap-1 cursor-default select-none', className)}
      >
        <Icon className={cn('h-3 w-3', status.kind === 'pending' && 'animate-spin')} />
        <span>{t(cfg.labelKey)}</span>
      </Badge>
    </AddressFieldTooltip>
  );
}
