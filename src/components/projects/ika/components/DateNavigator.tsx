'use client';

/**
 * =============================================================================
 * DateNavigator — Date navigation for attendance tab
 * =============================================================================
 *
 * Provides prev/next day navigation, "Today" shortcut, and view mode selector.
 *
 * @module components/projects/ika/components/DateNavigator
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 2)
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, addDays, subDays, isToday } from 'date-fns';
import { el } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import type { AttendanceViewMode } from '../contracts';

interface DateNavigatorProps {
  /** Currently selected date */
  date: Date;
  /** Current view mode */
  viewMode: AttendanceViewMode;
  /** Callback when date changes */
  onDateChange: (date: Date) => void;
  /** Callback when view mode changes */
  onViewModeChange: (mode: AttendanceViewMode) => void;
}

export function DateNavigator({
  date,
  viewMode,
  onDateChange,
  onViewModeChange,
}: DateNavigatorProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();

  const handlePrevDay = () => onDateChange(subDays(date, 1));
  const handleNextDay = () => onDateChange(addDays(date, 1));
  const handleToday = () => onDateChange(new Date());

  const dateLabel = format(date, 'EEEE, d MMMM yyyy', { locale: el });
  const isTodaySelected = isToday(date);

  return (
    <nav className={cn('flex items-center', spacing.gap.md)} aria-label="Date navigation">
      {/* Previous day */}
      <Button
        variant="outline"
        size="icon"
        onClick={handlePrevDay}
        aria-label="Previous day"
      >
        <ChevronLeft className={iconSizes.sm} />
      </Button>

      {/* Today button */}
      <Button
        variant={isTodaySelected ? 'default' : 'outline'}
        size="sm"
        onClick={handleToday}
      >
        <Calendar className={cn(iconSizes.xs, spacing.margin.right.xs)} />
        {t('ika.timesheetTab.today')}
      </Button>

      {/* Next day */}
      <Button
        variant="outline"
        size="icon"
        onClick={handleNextDay}
        aria-label="Next day"
      >
        <ChevronRight className={iconSizes.sm} />
      </Button>

      {/* Date label */}
      <span className="text-sm font-medium capitalize">{dateLabel}</span>

      {/* View mode selector */}
      <Select
        value={viewMode}
        onValueChange={(value) => onViewModeChange(value as AttendanceViewMode)}
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="daily">{t('ika.timesheetTab.viewMode.daily')}</SelectItem>
          <SelectItem value="weekly">{t('ika.timesheetTab.viewMode.weekly')}</SelectItem>
          <SelectItem value="monthly">{t('ika.timesheetTab.viewMode.monthly')}</SelectItem>
        </SelectContent>
      </Select>
    </nav>
  );
}
