/**
 * Calendar event tooltip — hover preview showing event details.
 * Used as custom event component in react-big-calendar.
 */

'use client';

import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { CalendarEvent } from '@/types/calendar-event';
import type { EventProps } from 'react-big-calendar';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

export function CalendarEventTooltip({ event, title }: EventProps<CalendarEvent>) {
  const { t } = useTranslation(['crm', 'crm-inbox']);
  const colors = useSemanticColors();

  const descriptionPreview = event.description
    ? event.description.length > 100
      ? `${event.description.substring(0, 100)}...`
      : event.description
    : null;

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span className="block truncate text-xs leading-tight">
          {title}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <article className="space-y-1.5">
          <header className="flex items-center justify-between gap-2">
            <strong className="text-sm font-semibold truncate">{event.title}</strong>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {t(`calendarPage.eventTypes.${event.eventType}`)}
            </Badge>
          </header>
          <time className={cn("block text-xs", colors.text.muted)}>
            {format(event.start, 'HH:mm')} — {format(event.end, 'HH:mm')}
          </time>
          {descriptionPreview && (
            <p className={cn("text-xs leading-relaxed", colors.text.muted)}>
              {descriptionPreview}
            </p>
          )}
        </article>
      </TooltipContent>
    </Tooltip>
  );
}
