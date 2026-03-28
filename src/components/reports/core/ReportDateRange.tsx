'use client';

/**
 * @module ReportDateRange
 * @enterprise ADR-265 — Period picker with comparison toggle
 *
 * Preset periods (week/month/quarter/half/year/ytd/custom)
 * with optional period-vs-period comparison mode (Decision 12.15).
 * Default preset: quarter (Decision 12.8).
 */

import '@/lib/design-system';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSemanticColors } from '@/hooks/useSemanticColors';

import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/intl-formatting';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PeriodPreset = 'week' | 'month' | 'quarter' | 'half' | 'year' | 'ytd' | 'custom';
export type ComparisonMode = 'yoy' | 'pop' | 'custom';

export interface DateRangeValue {
  from: Date;
  to: Date;
  preset: PeriodPreset;
  comparisonFrom?: Date;
  comparisonTo?: Date;
}

export interface ReportDateRangeProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** Default preset (default: 'quarter') */
  defaultPreset?: PeriodPreset;
  /** Enable comparison toggle (default: true) */
  enableComparison?: boolean;
  /** Comparison mode (default: 'yoy') */
  comparisonMode?: ComparisonMode;
  /** Callback when comparison mode changes */
  onComparisonModeChange?: (mode: ComparisonMode) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRESETS: PeriodPreset[] = ['week', 'month', 'quarter', 'half', 'year', 'ytd', 'custom'];

function computePresetRange(preset: PeriodPreset, referenceDate: Date = new Date()): { from: Date; to: Date } {
  const now = referenceDate;
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (preset) {
    case 'week': {
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      return { from: monday, to: sunday };
    }
    case 'month':
      return {
        from: new Date(year, month, 1),
        to: new Date(year, month + 1, 0, 23, 59, 59, 999),
      };
    case 'quarter': {
      const qStart = Math.floor(month / 3) * 3;
      return {
        from: new Date(year, qStart, 1),
        to: new Date(year, qStart + 3, 0, 23, 59, 59, 999),
      };
    }
    case 'half': {
      const hStart = month < 6 ? 0 : 6;
      return {
        from: new Date(year, hStart, 1),
        to: new Date(year, hStart + 6, 0, 23, 59, 59, 999),
      };
    }
    case 'year':
      return {
        from: new Date(year, 0, 1),
        to: new Date(year, 11, 31, 23, 59, 59, 999),
      };
    case 'ytd':
      return {
        from: new Date(year, 0, 1),
        to: now,
      };
    case 'custom':
    default:
      return { from: now, to: now };
  }
}

function computeComparisonRange(
  from: Date,
  to: Date,
  mode: ComparisonMode,
): { comparisonFrom: Date; comparisonTo: Date } {
  const durationMs = to.getTime() - from.getTime();

  if (mode === 'yoy') {
    return {
      comparisonFrom: new Date(from.getFullYear() - 1, from.getMonth(), from.getDate()),
      comparisonTo: new Date(to.getFullYear() - 1, to.getMonth(), to.getDate()),
    };
  }

  // pop — previous period of same duration
  return {
    comparisonFrom: new Date(from.getTime() - durationMs - 86400000),
    comparisonTo: new Date(from.getTime() - 86400000),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportDateRange({
  value,
  onChange,
  enableComparison = true,
  comparisonMode = 'yoy',
  onComparisonModeChange,
  className,
}: ReportDateRangeProps) {
  const { t } = useTranslation('reports');
  const colors = useSemanticColors();

  const isComparing = Boolean(value.comparisonFrom && value.comparisonTo);

  const handlePresetChange = useCallback(
    (preset: string) => {
      const typedPreset = preset as PeriodPreset;
      if (typedPreset === 'custom') {
        onChange({ ...value, preset: 'custom' });
        return;
      }
      const { from, to } = computePresetRange(typedPreset);
      const comparison = isComparing
        ? computeComparisonRange(from, to, comparisonMode)
        : {};
      onChange({ from, to, preset: typedPreset, ...comparison });
    },
    [value, onChange, isComparing, comparisonMode],
  );

  const handleComparisonToggle = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        const { comparisonFrom, comparisonTo } = computeComparisonRange(
          value.from, value.to, comparisonMode,
        );
        onChange({ ...value, comparisonFrom, comparisonTo });
      } else {
        onChange({
          from: value.from,
          to: value.to,
          preset: value.preset,
        });
      }
    },
    [value, onChange, comparisonMode],
  );

  const handleCustomDateSelect = useCallback(
    (range: { from?: Date; to?: Date } | undefined) => {
      if (!range?.from) return;
      const from = range.from;
      const to = range.to ?? range.from;
      const comparison = isComparing
        ? computeComparisonRange(from, to, comparisonMode)
        : {};
      onChange({ from, to, preset: 'custom', ...comparison });
    },
    [onChange, isComparing, comparisonMode],
  );

  const dateLabel = useMemo(() => {
    if (value.preset !== 'custom') {
      return t(`dateRange.presets.${value.preset}`);
    }
    return `${formatDate(value.from)} – ${formatDate(value.to)}`;
  }, [value, t]);

  return (
    <nav className={cn('flex flex-wrap items-center gap-3', className)} aria-label={t('dateRange.label')}>
      {/* Preset selector */}
      <Select value={value.preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[180px]">
          <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
          <SelectValue>{dateLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((preset) => (
            <SelectItem key={preset} value={preset}>
              {t(`dateRange.presets.${preset}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Custom date range popover */}
      {value.preset === 'custom' && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {formatDate(value.from)} – {formatDate(value.to)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: value.from, to: value.to }}
              onSelect={handleCustomDateSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      )}

      {/* Comparison toggle */}
      {enableComparison && (
        <div className="flex items-center gap-2">
          <Switch
            checked={isComparing}
            onCheckedChange={handleComparisonToggle}
            id="comparison-toggle"
          />
          <Label
            htmlFor="comparison-toggle"
            className={cn('text-sm cursor-pointer', colors.text.secondary)}
          >
            {t('dateRange.comparison.toggle')}
          </Label>

          {isComparing && (
            <Select
              value={comparisonMode}
              onValueChange={(mode) => onComparisonModeChange?.(mode as ComparisonMode)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yoy">{t('dateRange.comparison.yoy')}</SelectItem>
                <SelectItem value="pop">{t('dateRange.comparison.pop')}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </nav>
  );
}
