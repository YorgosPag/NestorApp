'use client';

import type { ComponentType, SVGProps } from 'react';
import { ChevronLeft, ChevronRight, CalendarPlus, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number | string }>;

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
// SUB-COMPONENTS
// ============================================================================

function RibbonDivider() {
  return <div className="w-px bg-border self-stretch my-1" aria-hidden="true" />;
}

function RibbonLargeButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: IconComponent;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 h-14 w-[52px] rounded px-1 transition-colors hover:bg-accent text-foreground"
    >
      <Icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
      <span className="text-[10px] leading-tight text-center font-medium">{label}</span>
    </button>
  );
}

function RibbonNavButton({
  icon: Icon,
  onClick,
  label,
}: {
  icon: IconComponent;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex items-center justify-center h-7 w-7 rounded transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

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
    <header className="flex items-stretch h-[60px] border-b border-border bg-card px-2 gap-1 shrink-0">

      {/* ── Group 1: New event (large Fluent-style button) ─────────────────── */}
      <div className="flex items-center px-1">
        <RibbonLargeButton
          icon={CalendarPlus}
          label={t('calendarPage.newEvent')}
          onClick={onNewEvent}
        />
      </div>

      <RibbonDivider />

      {/* ── Group 2: Today + Navigation ────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-1">
        <RibbonLargeButton
          icon={CalendarDays}
          label={t('calendarPage.today')}
          onClick={onToday}
        />

        <div className="flex flex-col items-center justify-center gap-0.5">
          <div className="flex items-center gap-0.5">
            <RibbonNavButton
              icon={ChevronLeft}
              onClick={onPrev}
              label={t('calendarPage.toolbar.prev')}
            />
            <span className="min-w-40 text-center text-sm font-semibold select-none px-0.5">
              {title}
            </span>
            <RibbonNavButton
              icon={ChevronRight}
              onClick={onNext}
              label={t('calendarPage.toolbar.next')}
            />
          </div>
        </div>
      </div>

      <RibbonDivider />

      {/* ── Group 3: View switcher ──────────────────────────────────────────── */}
      <nav
        className="flex items-center gap-0.5 px-1"
        aria-label={t('calendarPage.toolbar.viewSelection')}
      >
        {VIEWS.map(({ key, labelKey }) => {
          const isActive = activeView === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onViewChange(key)}
              className={cn(
                'relative flex flex-col items-center justify-center h-14 min-w-[52px] px-2 rounded transition-colors select-none',
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <span className="text-xs">{t(labelKey)}</span>
              {isActive && (
                <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </nav>

    </header>
  );
}
