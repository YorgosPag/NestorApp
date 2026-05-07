'use client';

import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface CalendarToolbarProps {
  title: string;
  activeView: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: string) => void;
  onNewEvent: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const VIEWS = [
  { key: 'timeGridDay', labelKey: 'calendarPage.views.day' },
  { key: 'timeGridWeek', labelKey: 'calendarPage.views.week' },
  { key: 'dayGridMonth', labelKey: 'calendarPage.views.month' },
  { key: 'listWeek', labelKey: 'calendarPage.views.agenda' },
] as const;

// ============================================================================
// COMPONENT
// ============================================================================

export function CalendarToolbar({
  title,
  activeView,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onNewEvent,
}: CalendarToolbarProps) {
  const { t } = useTranslation('crm-inbox');

  return (
    <header className="flex items-center gap-1 px-3 py-2 border-b border-border bg-card">
      {/* New event */}
      <Button onClick={onNewEvent} size="sm" className="gap-1.5 shrink-0">
        <Plus className="h-4 w-4" />
        {t('calendarPage.newEvent')}
      </Button>

      <div className="w-px h-5 bg-border mx-2 shrink-0" />

      {/* Today */}
      <Button variant="ghost" size="sm" onClick={onToday} className="gap-1.5 shrink-0">
        <CalendarDays className="h-4 w-4" />
        {t('calendarPage.today')}
      </Button>

      {/* Navigation */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrev}
          className="h-8 w-8"
          aria-label={t('calendarPage.toolbar.prev')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-36 text-center text-sm font-semibold px-1 select-none">
          {title}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          className="h-8 w-8"
          aria-label={t('calendarPage.toolbar.next')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-5 bg-border mx-2 shrink-0" />

      {/* View switcher */}
      <nav className="flex items-center gap-0.5" aria-label={t('calendarPage.toolbar.viewSelection')}>
        {VIEWS.map(({ key, labelKey }) => {
          const isActive = activeView === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onViewChange(key)}
              className={cn(
                'relative px-3 py-1.5 text-sm rounded-md transition-colors select-none',
                'hover:bg-accent hover:text-accent-foreground',
                isActive
                  ? 'text-primary font-medium after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-4/5 after:h-0.5 after:bg-primary after:rounded-full'
                  : 'text-muted-foreground'
              )}
            >
              {t(labelKey)}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
