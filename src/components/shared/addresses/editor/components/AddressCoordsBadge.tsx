'use client';

/**
 * =============================================================================
 * AddressCoordsBadge — has-coordinates chip (ADR-332 §3.10 / Phase 8)
 * =============================================================================
 *
 * Compact pill that signals whether a stored `ProjectAddress` has GPS
 * coordinates attached. Used by all read-only address surfaces alongside
 * `<AddressSourceLabel>` and `<AddressFreshnessIndicator>`.
 *
 * SSoT for the badge — replaces three identical local sub-components that
 * the Phase 8 read-only enrichment row needed.
 *
 * Tooltip uses Radix (CHECK 3.23 compliant — no `title=`).
 *
 * @module components/shared/addresses/editor/components/AddressCoordsBadge
 */

import { MapPin, MapPinOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface AddressCoordsBadgeProps {
  hasCoords: boolean;
  className?: string;
}

export function AddressCoordsBadge({ hasCoords, className }: AddressCoordsBadgeProps) {
  const { t } = useTranslation('addresses');
  const Icon = hasCoords ? MapPin : MapPinOff;
  const variant = hasCoords ? 'success' : 'muted';
  const labelKey = hasCoords ? 'card.coords.has' : 'card.coords.none';
  const tooltipKey = hasCoords ? 'card.coords.tooltipHas' : 'card.coords.tooltipNone';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={variant} className={cn('gap-1 cursor-default select-none', className)}>
          <Icon className="h-3 w-3" />
          <span>{t(labelKey)}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{t(tooltipKey)}</TooltipContent>
    </Tooltip>
  );
}
