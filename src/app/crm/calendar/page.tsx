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
import { useTranslation } from 'react-i18next';

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
  const { isAuthenticated, loading: authLoading } = useAuth();

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
      <main className={`min-h-screen ${colors.bg.secondary} ${sp.padding.lg}`}>
        <Skeleton className={`${iconSizes.xl} w-48 ${sp.margin.bottom.md}`} />
        <Skeleton className={`h-[600px] w-full ${borders.radiusClass.lg}`} />
      </main>
    );
  }

  return (
    <>
      <Toaster position="top-right" />

      <main className={`min-h-screen ${colors.bg.secondary}`}>
        {/* Header */}
        <header className={`${colors.bg.primary} shadow-sm border-b`}>
          <div className={`${sp.padding.x.lg} ${sp.padding.y.md}`}>
            <div className={`flex items-center justify-between`}>
              <div className={`flex items-center ${sp.gap.sm}`}>
                <CalendarDays className={`${iconSizes.lg} ${colors.text.info}`} />
                <div>
                  <h1 className={typo.special.containerTitle}>
                    {t('calendarPage.title')}
                  </h1>
                  <p className={`${typo.special.secondary} ${sp.margin.top.xs}`}>
                    {t('calendarPage.description')}
                  </p>
                </div>
              </div>

              <div className={`flex items-center ${sp.gap.sm}`}>
                {/* Stats badges */}
                {!loading && (
                  <nav
                    className={`hidden md:flex items-center ${sp.gap.sm} ${typo.special.secondary}`}
                    aria-label="Event statistics"
                  >
                    <span>{stats.tasks} {t('tasks.title').toLowerCase()}</span>
                    <span aria-hidden="true">·</span>
                    <span>{stats.appointments} {t('calendarPage.eventTypes.appointment').toLowerCase()}</span>
                  </nav>
                )}

                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className={`${iconSizes.sm} ${sp.margin.right.sm}`} />
                  {t('calendarPage.newEvent')}
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Calendar */}
        <section className={`${sp.padding.x.lg} ${sp.padding.y.lg}`}>
          <article className={`${colors.bg.primary} ${borders.radiusClass.lg} shadow ${sp.padding.md}`}>
            {loading ? (
              <Skeleton className={`h-[600px] w-full ${borders.radiusClass.lg}`} />
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
