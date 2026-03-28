/**
 * =============================================================================
 * ENTERPRISE: CALENDAR EVENT DETAIL DIALOG
 * =============================================================================
 *
 * Dialog for viewing/editing a calendar event.
 * Uses Radix Dialog from @/components/ui/dialog.
 * All values from centralized design system hooks — zero hardcoded values.
 *
 * @module components/crm/calendar/CalendarEventDialog
 */

'use client';

import { format } from 'date-fns';
import { el, enUS } from 'date-fns/locale';
import { Calendar, Clock, User, FileText, Tag, ArrowRight, Edit3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';

import type { CalendarEvent } from '@/types/calendar-event';
import { SafeHTMLContent } from '@/components/shared/email/EmailContentRenderer';
import { CALENDAR_EVENT_COLORS } from './calendar-event-colors';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// PROPS
// ============================================================================

interface CalendarEventDialogProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback to open the edit dialog for a task-source event */
  onEditTask?: (event: CalendarEvent) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CalendarEventDialog({ event, open, onOpenChange, onEditTask }: CalendarEventDialogProps) {
  const { t, i18n } = useTranslation('crm');
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const sp = useSpacingTokens();
  const typo = useTypography();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const locale = i18n.language === 'el' ? el : enUS;

  if (!event) return null;

  const _colorScheme = CALENDAR_EVENT_COLORS[event.eventType];
  const originalLink = event.source === 'task'
    ? `/crm/tasks/${event.entityId}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={layout.flexCenterGap2}>
            <Calendar className={iconSizes.md} />
            {t('calendarPage.dialog.viewTitle')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('calendarPage.dialog.viewTitle')}
          </DialogDescription>
        </DialogHeader>

        <article className={sp.spaceBetween.md}>
          {/* Title & Type Badge */}
          <header className={`flex items-start justify-between ${sp.gap.sm}`}>
            <h3 className={typo.heading.md}>{event.title}</h3>
            <Badge
              variant="outline"
              className="calendar-event-badge"
              data-event-type={event.eventType}
            >
              {t(`calendarPage.eventTypes.${event.eventType}`)}
            </Badge>
          </header>

          {/* Date & Time */}
          <section className={`${layout.flexCenterGap2} ${typo.special.secondary}`}>
            <Clock className={`${iconSizes.sm} shrink-0`} />
            <time dateTime={event.start.toISOString()}>
              {format(event.start, 'EEEE, d MMMM yyyy', { locale })}
              {' — '}
              {format(event.start, 'HH:mm', { locale })}
              {' - '}
              {format(event.end, 'HH:mm', { locale })}
            </time>
          </section>

          {/* Description — uses centralized SafeHTMLContent (ADR-072) for XSS-safe rendering with clickable links */}
          {event.description && (
            <section className={`flex items-start ${sp.gap.sm} ${typo.body.sm}`}>
              <FileText className={`${iconSizes.sm} shrink-0 ${sp.margin.top.xs} ${colors.text.muted}`} />
              <div className="min-w-0 flex-1">
                <SafeHTMLContent html={event.description} />
              </div>
            </section>
          )}

          {/* Status & Priority */}
          <section className={`flex flex-wrap ${sp.gap.sm}`}>
            <Badge variant="secondary">
              <Tag className={`${iconSizes.xs} ${sp.margin.right.xs}`} />
              {event.status}
            </Badge>
            {event.priority && (
              <Badge variant="secondary">
                {t(`tasks.priority.${event.priority}`)}
              </Badge>
            )}
            <Badge variant="secondary">
              <User className={`${iconSizes.xs} ${sp.margin.right.xs}`} />
              {event.source === 'task' ? t('calendarPage.source.task') : t('calendarPage.source.appointment')}
            </Badge>
          </section>

          {/* Actions */}
          <footer className={`flex justify-end ${sp.gap.sm} ${sp.padding.top.sm} ${borders.quick.borderT}`}>
            {event.source === 'task' && onEditTask && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onEditTask(event);
                  onOpenChange(false);
                }}
              >
                <Edit3 className={`${iconSizes.sm} ${sp.margin.right.xs}`} />
                {t('tasks.actions.edit')}
              </Button>
            )}
            {originalLink && (
              <Button variant="outline" size="sm" asChild>
                <Link href={originalLink}>
                  {t('calendarPage.dialog.actions.viewOriginal')}
                  <ArrowRight className={`${iconSizes.sm} ${sp.margin.left.xs}`} />
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {t('calendarPage.dialog.actions.cancel')}
            </Button>
          </footer>
        </article>
      </DialogContent>
    </Dialog>
  );
}
