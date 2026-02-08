'use client';

/**
 * =============================================================================
 * MonthYearSelector — Month/Year navigation with Radix Select (ADR-001)
 * =============================================================================
 *
 * Provides month and year selection for stamps calculation period.
 * Uses Radix Select for dropdowns as per ADR-001.
 *
 * @module components/projects/ika/components/MonthYearSelector
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 3)
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

interface MonthYearSelectorProps {
  /** Selected month (1-12) */
  month: number;
  /** Selected year */
  year: number;
  /** Callback when month/year changes */
  onChange: (month: number, year: number) => void;
}

export function MonthYearSelector({ month, year, onChange }: MonthYearSelectorProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: t(`ika.stampsTab.months.${i + 1}`),
  }));

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => ({
    value: String(currentYear - 2 + i),
    label: String(currentYear - 2 + i),
  }));

  function handlePrev() {
    if (month === 1) {
      onChange(12, year - 1);
    } else {
      onChange(month - 1, year);
    }
  }

  function handleNext() {
    if (month === 12) {
      onChange(1, year + 1);
    } else {
      onChange(month + 1, year);
    }
  }

  return (
    <nav className={cn('flex items-center', spacing.gap.sm)} aria-label="Month/year selector">
      <Button variant="outline" size="icon" onClick={handlePrev} aria-label="Previous month">
        <ChevronLeft className={iconSizes.sm} />
      </Button>

      <Select value={String(month)} onValueChange={(val) => onChange(parseInt(val, 10), year)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(year)} onValueChange={(val) => onChange(month, parseInt(val, 10))}>
        <SelectTrigger className="w-[90px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y.value} value={y.value}>
              {y.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="icon" onClick={handleNext} aria-label="Next month">
        <ChevronRight className={iconSizes.sm} />
      </Button>
    </nav>
  );
}
