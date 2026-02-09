/**
 * @fileoverview Journal Filters — Φίλτρα αναζήτησης εγγραφών Ε-Ε
 * @description FiscalYearPicker + type dropdown + quarter picker
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-001 Chart of Accounts
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EntryType, FiscalQuarter } from '@/subapps/accounting/types';
import { FiscalYearPicker } from '../shared/FiscalYearPicker';

// ============================================================================
// TYPES
// ============================================================================

export interface JournalFilterState {
  fiscalYear: number;
  type: EntryType | '';
  quarter: FiscalQuarter | '';
}

interface JournalFiltersProps {
  filters: JournalFilterState;
  onFilterChange: (partial: Partial<JournalFilterState>) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const QUARTERS: FiscalQuarter[] = [1, 2, 3, 4];

const QUARTER_LABELS: Record<FiscalQuarter, string> = {
  1: 'Q1 (Ιαν-Μαρ)',
  2: 'Q2 (Απρ-Ιουν)',
  3: 'Q3 (Ιουλ-Σεπ)',
  4: 'Q4 (Οκτ-Δεκ)',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function JournalFilters({ filters, onFilterChange }: JournalFiltersProps) {
  const { t } = useTranslation('accounting');

  return (
    <nav className="flex flex-wrap gap-3" aria-label={t('common.filter')}>
      <div className="w-32">
        <FiscalYearPicker
          value={filters.fiscalYear}
          onValueChange={(year) => onFilterChange({ fiscalYear: year })}
        />
      </div>

      <div className="w-40">
        <Select
          value={filters.type || 'all'}
          onValueChange={(v) => onFilterChange({ type: v === 'all' ? '' : v as EntryType })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('journal.type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="income">{t('journal.income')}</SelectItem>
            <SelectItem value="expense">{t('journal.expense')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-44">
        <Select
          value={filters.quarter ? String(filters.quarter) : 'all'}
          onValueChange={(v) =>
            onFilterChange({ quarter: v === 'all' ? '' : (Number(v) as FiscalQuarter) })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('common.quarter')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            {QUARTERS.map((q) => (
              <SelectItem key={q} value={String(q)}>
                {QUARTER_LABELS[q]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </nav>
  );
}
