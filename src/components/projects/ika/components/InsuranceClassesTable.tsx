'use client';

/**
 * =============================================================================
 * InsuranceClassesTable — Editable table for 28 EFKA insurance classes
 * =============================================================================
 *
 * Displays all 28 KPK 781 insurance classes with inline editing.
 * Used in the EFKA Settings admin panel.
 *
 * @module components/projects/ika/components/InsuranceClassesTable
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 */

import React from 'react';
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
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import type { InsuranceClass } from '../contracts';

interface InsuranceClassesTableProps {
  /** Array of 28 insurance classes */
  classes: InsuranceClass[];
  /** Whether the table is in edit mode */
  isEditing: boolean;
  /** Callback when a class field changes */
  onClassChange: (index: number, field: keyof Pick<InsuranceClass, 'minDailyWage' | 'maxDailyWage' | 'imputedDailyWage'>, value: number) => void;
}

export const InsuranceClassesTable = React.memo(function InsuranceClassesTable({ classes, isEditing, onClassChange }: InsuranceClassesTableProps) {
  const { t } = useTranslation('projects');
  const typography = useTypography();
  const spacing = useSpacingTokens();

  const handleChange = (index: number, field: keyof Pick<InsuranceClass, 'minDailyWage' | 'maxDailyWage' | 'imputedDailyWage'>, rawValue: string) => {
    const parsed = parseFloat(rawValue);
    if (!isNaN(parsed) && parsed >= 0) {
      onClassChange(index, field, parsed);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={cn(typography.label.sm, 'w-12 text-center')}>
            {t('ika.efkaSettingsTab.classNumber')}
          </TableHead>
          <TableHead className={cn(typography.label.sm, 'text-right')}>
            {t('ika.efkaSettingsTab.minDailyWage')}
          </TableHead>
          <TableHead className={cn(typography.label.sm, 'text-right')}>
            {t('ika.efkaSettingsTab.maxDailyWage')}
          </TableHead>
          <TableHead className={cn(typography.label.sm, 'text-right')}>
            {t('ika.efkaSettingsTab.imputedDailyWage')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {classes.map((cls, index) => (
          <TableRow key={cls.classNumber}>
            <TableCell className={cn(typography.label.sm, 'text-center font-medium')}>
              {cls.classNumber}
            </TableCell>
            <TableCell className="text-right">
              {isEditing ? (
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cls.minDailyWage}
                  onChange={(e) => handleChange(index, 'minDailyWage', e.target.value)}
                  className={cn('w-28 text-right', typography.label.sm)}
                />
              ) : (
                <span className={typography.label.sm}>{cls.minDailyWage.toFixed(2)}</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              {isEditing ? (
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cls.maxDailyWage}
                  onChange={(e) => handleChange(index, 'maxDailyWage', e.target.value)}
                  className={cn('w-28 text-right', typography.label.sm)}
                />
              ) : (
                <span className={typography.label.sm}>
                  {cls.maxDailyWage >= 999999 ? '∞' : cls.maxDailyWage.toFixed(2)}
                </span>
              )}
            </TableCell>
            <TableCell className="text-right">
              {isEditing ? (
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cls.imputedDailyWage}
                  onChange={(e) => handleChange(index, 'imputedDailyWage', e.target.value)}
                  className={cn('w-28 text-right', typography.label.sm)}
                />
              ) : (
                <span className={cn(typography.label.sm, 'font-semibold')}>{cls.imputedDailyWage.toFixed(2)}</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
});
