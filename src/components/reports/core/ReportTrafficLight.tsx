'use client';

/**
 * @module ReportTrafficLight
 * @enterprise ADR-265 — RAG (Red/Amber/Green) status indicator
 */

import { getStatusColor } from '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RAGStatus = 'red' | 'amber' | 'green' | 'gray';

export interface ReportTrafficLightProps {
  status: RAGStatus;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  tooltip?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIZE_MAP = {
  sm: { dot: 'h-2.5 w-2.5', gap: 'gap-1', text: 'text-xs' },
  md: { dot: 'h-3.5 w-3.5', gap: 'gap-1.5', text: 'text-sm' },
  lg: { dot: 'h-5 w-5', gap: 'gap-2', text: 'text-base' },
} as const;

const STATUS_COLORS: Record<RAGStatus, string> = {
  red: getStatusColor('error', 'bg'),
  amber: getStatusColor('reserved', 'bg'),
  green: getStatusColor('available', 'bg'),
  gray: 'bg-muted-foreground',
};

const STATUS_RING: Record<RAGStatus, string> = {
  red: `${getStatusColor('error', 'border')}/30`,
  amber: `${getStatusColor('reserved', 'border')}/30`,
  green: `${getStatusColor('available', 'border')}/30`,
  gray: 'ring-muted-foreground/30',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportTrafficLight({
  status,
  label,
  size = 'md',
  showLabel = false,
  tooltip,
  className,
}: ReportTrafficLightProps) {
  const { t } = useTranslation('reports');
  const colors = useSemanticColors();
  const tokens = SIZE_MAP[size];

  const displayLabel = label ?? t(`trafficLight.${status}`);
  const tooltipText = tooltip ?? displayLabel;

  const indicator = (
    <span
      className={cn('flex items-center', tokens.gap, className)}
      role="status"
      aria-label={displayLabel}
    >
      <span
        className={cn(
          'rounded-full ring-2',
          tokens.dot,
          STATUS_COLORS[status],
          STATUS_RING[status],
        )}
      />
      {showLabel && (
        <span className={cn(tokens.text, colors.text.secondary)}>
          {displayLabel}
        </span>
      )}
    </span>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{indicator}</TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
