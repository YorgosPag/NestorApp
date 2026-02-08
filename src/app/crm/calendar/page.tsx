/**
 * =============================================================================
 * ENTERPRISE: CRM CALENDAR PAGE
 * =============================================================================
 *
 * Full-page calendar view with Month/Week/Day/Agenda views.
 * Displays Tasks + Appointments from Firestore.
 *
 * Pattern: Same as `app/crm/tasks/page.tsx`.
 * All values from centralized design system hooks — zero hardcoded values.
 *
 * @route /crm/calendar
 */

'use client';

import { useState, useCallback } from 'react';
import { startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { CalendarDays, Plus } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { cn, getSpacingClass, getResponsiveClass } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { CrmCalendar } from '@/components/crm/calendar/CrmCalendar';
import { CalendarCreateDialog } from '@/components/crm/calendar/CalendarCreateDialog';

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function CrmCalendarPage() {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const sp = useSpacingTokens();
  const typo = useTypography();
  const borders = useBorderTokens();
  const pageGap = getSpacingClass('m', 'lg', 'b');
  const { loading: authLoading } = useAuth();

  // Date range state — default to current month ± 1 month buffer
  const [dateRange, setDateRange] = useState(() => ({
    start: startOfMonth(subMonths(new Date(), 1)),
    end: endOfMonth(addMonths(new Date(), 1)),
  }));

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Fetch events
  const { events, loading, stats, refresh } = useCalendarEvents({
    dateRange,
  });

  // Handle range change from calendar navigation
  const handleRangeChange = useCallback((range: { start: Date; end: Date }) => {
    setDateRange({
      start: startOfMonth(subMonths(range.start, 1)),
      end: endOfMonth(addMonths(range.end, 1)),
    });
  }, []);

  // Handle event created
  const handleEventCreated = useCallback(() => {
    refresh();
  }, [refresh]);

  // Auth loading state
  if (authLoading) {
    return (
      <main className={cn('min-h-screen', colors.bg.secondary, sp.padding.lg)}>
        <Skeleton className={cn(iconSizes.xl, 'w-48', sp.margin.bottom.md)} />
        <Skeleton className={cn('h-[600px] w-full', borders.radiusClass.lg)} />
      </main>
    );
  }

  return (
    <>
      <Toaster position="top-right" />

      <main className={cn('min-h-screen', colors.bg.secondary)}>
        {/* Header */}
        <header className={cn(colors.bg.primary, 'shadow-sm border-b')}>
          <div className={cn(sp.padding.x.lg, sp.padding.y.md)}>
            <div className={cn('flex items-center justify-between')}>
              <div className={cn('flex items-center', sp.gap.sm)}>
                <CalendarDays className={cn(iconSizes.lg, colors.text.info)} />
                <div>
                  <h1 className={typo.special.containerTitle}>
                    {t('calendarPage.title')}
                  </h1>
                  <p className={cn(typo.special.secondary, sp.margin.top.xs)}>
                    {t('calendarPage.description')}
                  </p>
                </div>
              </div>

              <div className={cn('flex items-center', sp.gap.sm)}>
                {/* Stats badges */}
                {!loading && (
                  <nav
                    className={cn('hidden', getResponsiveClass('md', 'flex'), 'items-center', sp.gap.sm, typo.special.secondary)}
                    aria-label={t('calendarPage.stats.ariaLabel')}
                  >
                    <span>{stats.tasks} {t('tasks.title').toLowerCase()}</span>
                    <span aria-hidden="true">·</span>
                    <span>{stats.appointments} {t('calendarPage.eventTypes.appointment').toLowerCase()}</span>
                  </nav>
                )}

                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className={cn(iconSizes.sm, sp.margin.right.sm)} />
                  {t('calendarPage.newEvent')}
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Calendar */}
        <section className={cn(sp.padding.x.lg, sp.padding.y.lg, pageGap)}>
          <article className={cn(colors.bg.primary, borders.radiusClass.lg, 'shadow', sp.padding.md)}>
            {loading ? (
              <Skeleton className={cn('h-[600px] w-full', borders.radiusClass.lg)} />
            ) : (
              <CrmCalendar
                events={events}
                loading={loading}
                onRangeChange={handleRangeChange}
                onEventCreated={handleEventCreated}
              />
            )}
          </article>
        </section>
      </main>

      {/* Create dialog from header button */}
      <CalendarCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={handleEventCreated}
      />
    </>
  );
}
