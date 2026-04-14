'use client';

/**
 * @fileoverview Report Date Filter Bar (Phase 2e)
 * @description Preset date selector + custom date range for financial reports
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md §2e (Q9 — date filtering)
 * @compliance CLAUDE.md Enterprise Standards — Radix Select only (ADR-001)
 */

import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ReportDateFilter, ReportDatePreset } from '@/subapps/accounting/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const PRESETS: readonly ReportDatePreset[] = [
  'this_month',
  'last_month',
  'this_quarter',
  'last_quarter',
  'this_year',
  'last_year',
  'ytd',
  'custom',
] as const;

// ============================================================================
// TYPES
// ============================================================================

interface ReportDateFilterBarProps {
  value: ReportDateFilter;
  onValueChange: (filter: ReportDateFilter) => void;
  disabled?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ReportDateFilterBar({ value, onValueChange, disabled }: ReportDateFilterBarProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);

  return (
    <nav className="flex items-center gap-3 flex-wrap" aria-label={t('reports.datePresets.this_month')}>
      <Select
        value={value.preset}
        onValueChange={(preset: string) => {
          onValueChange({
            preset: preset as ReportDatePreset,
            customFrom: preset === 'custom' ? value.customFrom : undefined,
            customTo: preset === 'custom' ? value.customTo : undefined,
          });
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((preset) => (
            <SelectItem key={preset} value={preset}>
              {t(`reports.datePresets.${preset}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.preset === 'custom' && (
        <>
          <input
            type="date"
            value={value.customFrom ?? ''}
            onChange={(e) => onValueChange({ ...value, customFrom: e.target.value })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            disabled={disabled}
            aria-label={t('reports.detail.from')}
          />
          <span className="text-sm text-muted-foreground">—</span>
          <input
            type="date"
            value={value.customTo ?? ''}
            onChange={(e) => onValueChange({ ...value, customTo: e.target.value })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            disabled={disabled}
            aria-label={t('reports.detail.to')}
          />
        </>
      )}
    </nav>
  );
}
