'use client';

import { MapPin, Hand, Pencil, Link2, Upload, HelpCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { BadgeVariantProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AddressFieldTooltip } from './AddressFieldTooltip';
import type { AddressSourceType } from '../types';

interface AddressSourceLabelProps {
  source: AddressSourceType;
  className?: string;
}

interface SourceConfig {
  icon: LucideIcon;
  variant: BadgeVariantProps['variant'];
  labelKey: string;
  tooltipKey: string;
}

const SOURCE_CONFIG: Record<AddressSourceType, SourceConfig> = {
  geocoded: {
    icon: MapPin,
    variant: 'info',
    labelKey: 'editor.source.geocoded',
    tooltipKey: 'editor.source.tooltip.geocoded',
  },
  dragged: {
    icon: Hand,
    variant: 'secondary',
    labelKey: 'editor.source.dragged',
    tooltipKey: 'editor.source.tooltip.dragged',
  },
  manual: {
    icon: Pencil,
    variant: 'warning',
    labelKey: 'editor.source.manual',
    tooltipKey: 'editor.source.tooltip.manual',
  },
  derived: {
    icon: Link2,
    variant: 'success',
    labelKey: 'editor.source.derived',
    tooltipKey: 'editor.source.tooltip.derived',
  },
  imported: {
    icon: Upload,
    variant: 'muted',
    labelKey: 'editor.source.imported',
    tooltipKey: 'editor.source.tooltip.imported',
  },
  unknown: {
    icon: HelpCircle,
    variant: 'outline',
    labelKey: 'editor.source.unknown',
    tooltipKey: 'editor.source.tooltip.unknown',
  },
};

export function AddressSourceLabel({ source, className }: AddressSourceLabelProps) {
  const { t } = useTranslation('addresses');
  const cfg = SOURCE_CONFIG[source];
  const Icon = cfg.icon;

  return (
    <AddressFieldTooltip content={t(cfg.tooltipKey)}>
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
