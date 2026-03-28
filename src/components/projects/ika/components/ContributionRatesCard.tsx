'use client';

/**
 * =============================================================================
 * ContributionRatesCard — Editable card for employer/employee contribution rates
 * =============================================================================
 *
 * Displays EFKA contribution rates (mainPension, health, supplementary,
 * unemployment, IEK, oncePayment) with inline editing.
 *
 * @module components/projects/ika/components/ContributionRatesCard
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 */

import React, { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
import type { ContributionRates } from '../contracts';
import '@/lib/design-system';

interface ContributionRatesCardProps {
  /** Current contribution rates */
  rates: ContributionRates;
  /** Whether in edit mode */
  isEditing: boolean;
  /** Callback for rate change */
  onRateChange: (rates: ContributionRates) => void;
}

/** Rate row definition for rendering */
interface RateRow {
  key: string;
  labelKey: string;
  employer: number | null;
  employee: number;
  getUpdated: (rates: ContributionRates, field: 'employer' | 'employee', value: number) => ContributionRates;
}

export const ContributionRatesCard = React.memo(function ContributionRatesCard({ rates, isEditing, onRateChange }: ContributionRatesCardProps) {
  const { t } = useTranslation('projects');
  const colors = useSemanticColors();
  const typography = useTypography();

  const rows = useMemo<RateRow[]>(() => [
    {
      key: 'mainPension',
      labelKey: 'mainPension',
      employer: rates.mainPension.employer,
      employee: rates.mainPension.employee,
      getUpdated: (r, field, value) => ({
        ...r,
        mainPension: { ...r.mainPension, [field]: value },
      }),
    },
    {
      key: 'health',
      labelKey: 'health',
      employer: rates.health.employer,
      employee: rates.health.employee,
      getUpdated: (r, field, value) => ({
        ...r,
        health: { ...r.health, [field]: value },
      }),
    },
    {
      key: 'supplementary',
      labelKey: 'supplementary',
      employer: rates.supplementary.employer,
      employee: rates.supplementary.employee,
      getUpdated: (r, field, value) => ({
        ...r,
        supplementary: { ...r.supplementary, [field]: value },
      }),
    },
    {
      key: 'unemployment',
      labelKey: 'unemployment',
      employer: rates.unemployment.employer,
      employee: rates.unemployment.employee,
      getUpdated: (r, field, value) => ({
        ...r,
        unemployment: { ...r.unemployment, [field]: value },
      }),
    },
    {
      key: 'iek',
      labelKey: 'iek',
      employer: rates.iek.employer,
      employee: rates.iek.employee,
      getUpdated: (r, field, value) => ({
        ...r,
        iek: { ...r.iek, [field]: value },
      }),
    },
    {
      key: 'oncePayment',
      labelKey: 'oncePayment',
      employer: null,
      employee: rates.oncePayment.employee,
      getUpdated: (r, _field, value) => ({
        ...r,
        oncePayment: { employee: value },
      }),
    },
  ], [rates]);

  const handleChange = (row: RateRow, field: 'employer' | 'employee', rawValue: string) => {
    const parsed = parseFloat(rawValue);
    if (!isNaN(parsed) && parsed >= 0) {
      onRateChange(row.getUpdated(rates, field, parsed));
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={typography.label.sm}>
            {t('ika.efkaSettingsTab.category')}
          </TableHead>
          <TableHead className={cn(typography.label.sm, 'text-right')}>
            {t('ika.efkaSettingsTab.employer')}
          </TableHead>
          <TableHead className={cn(typography.label.sm, 'text-right')}>
            {t('ika.efkaSettingsTab.employee')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell className={cn(typography.label.sm, 'font-medium')}>
              {t(`ika.efkaSettingsTab.${row.labelKey}`)}
            </TableCell>
            <TableCell className="text-right">
              {row.employer === null ? (
                <span className={cn(typography.label.sm, colors.text.muted)}>—</span>
              ) : isEditing ? (
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  max="100"
                  value={row.employer}
                  onChange={(e) => handleChange(row, 'employer', e.target.value)}
                  className={cn('w-24 text-right', typography.label.sm)}
                />
              ) : (
                <span className={typography.label.sm}>{row.employer.toFixed(3)}</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              {isEditing ? (
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  max="100"
                  value={row.employee}
                  onChange={(e) => handleChange(row, 'employee', e.target.value)}
                  className={cn('w-24 text-right', typography.label.sm)}
                />
              ) : (
                <span className={typography.label.sm}>{row.employee.toFixed(3)}</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
});
