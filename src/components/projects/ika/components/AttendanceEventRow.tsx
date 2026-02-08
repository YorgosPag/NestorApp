'use client';

/**
 * =============================================================================
 * AttendanceEventRow — Single event display in timeline
 * =============================================================================
 *
 * Renders a single attendance event with icon, type, time, and method.
 *
 * @module components/projects/ika/components/AttendanceEventRow
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 2)
 */

import React from 'react';
import {
  LogIn,
  LogOut,
  Coffee,
  CoffeeIcon,
  MapPinOff,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import type { AttendanceEvent, AttendanceEventType } from '../contracts';

interface AttendanceEventRowProps {
  /** The attendance event to display */
  event: AttendanceEvent;
}

/** Map event types to icons and colors */
function getEventConfig(eventType: AttendanceEventType): {
  icon: React.ElementType;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  switch (eventType) {
    case 'check_in':
      return { icon: LogIn, variant: 'default' };
    case 'check_out':
      return { icon: LogOut, variant: 'secondary' };
    case 'break_start':
      return { icon: Coffee, variant: 'outline' };
    case 'break_end':
      return { icon: CoffeeIcon, variant: 'outline' };
    case 'left_site':
      return { icon: MapPinOff, variant: 'destructive' };
    case 'returned':
      return { icon: MapPin, variant: 'default' };
    case 'exit_permission':
      return { icon: ShieldCheck, variant: 'secondary' };
    default:
      return { icon: LogIn, variant: 'outline' };
  }
}

export function AttendanceEventRow({ event }: AttendanceEventRowProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();

  const config = getEventConfig(event.eventType);
  const Icon = config.icon;
  const timeStr = format(new Date(event.timestamp), 'HH:mm');
  const eventLabel = t(`ika.timesheetTab.eventTypes.${event.eventType}`);
  const methodLabel = t(`ika.timesheetTab.methods.${event.method}`);

  return (
    <div className={cn('flex items-center', spacing.gap.sm, spacing.padding.y.xs)}>
      <Icon className={cn(iconSizes.xs, 'text-muted-foreground')} />
      <span className="text-xs font-mono tabular-nums">{timeStr}</span>
      <Badge variant={config.variant} className="text-xs">
        {eventLabel}
      </Badge>
      <span className="text-xs text-muted-foreground">{methodLabel}</span>
      {event.notes && (
        <span className={cn('text-xs italic', colors.text.secondary)}>
          — {event.notes}
        </span>
      )}
    </div>
  );
}
