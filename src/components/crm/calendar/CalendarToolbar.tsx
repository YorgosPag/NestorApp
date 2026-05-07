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

const RIBBON_BLUE = '#3b82f6';

const VIEWS = [
  { key: 'timeGridWeek', labelKey: 'calendarPage.views.day' },
  { key: 'dayGridMonth', labelKey: 'calendarPage.views.month' },
  { key: 'listWeek', labelKey: 'calendarPage.views.agenda' },
] as const;

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function RibbonDivider() {
  return <div className="w-px bg-border self-stretch my-1.5 shrink-0" aria-hidden="true" />;
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
      className="flex flex-col items-center justify-center gap-1 h-[52px] w-[56px] rounded-md px-1 transition-colors hover:bg-accent"
    >
      <Icon
        className="h-6 w-6 shrink-0"
        strokeWidth={1.5}
        style={{ color: RIBBON_BLUE }}
      />
      <span className="text-[10px] leading-tight text-center text-foreground font-medium whitespace-nowrap">
        {label}
      </span>
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
      className="flex items-center justify-center h-7 w-7 rounded transition-colors hover:bg-accent text-foreground"
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

      {/* ── Group 1: New event ─────────────────────────────────────────────── */}
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

        <div className="flex items-center gap-0.5">
          <RibbonNavButton
            icon={ChevronLeft}
            onClick={onPrev}
            label={t('calendarPage.toolbar.prev')}
          />
          <span className="min-w-40 text-center text-sm font-semibold text-foreground select-none px-0.5">
            {title}
          </span>
          <RibbonNavButton
            icon={ChevronRight}
            onClick={onNext}
            label={t('calendarPage.toolbar.next')}
          />
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
              style={isActive ? { color: RIBBON_BLUE } : undefined}
              className={cn(
                'relative flex flex-col items-center justify-center h-[52px] min-w-[52px] px-2 rounded-md transition-colors select-none text-xs',
                isActive
                  ? 'font-semibold'
                  : 'text-foreground hover:bg-accent'
              )}
            >
              {t(labelKey)}
              {isActive && (
                <span
                  className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                  style={{ backgroundColor: RIBBON_BLUE }}
                />
              )}
            </button>
          );
        })}
      </nav>

    </header>
  );
}
