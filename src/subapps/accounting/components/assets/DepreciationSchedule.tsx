'use client';

/**
 * @fileoverview Accounting Subapp — Depreciation Schedule Table
 * @description Table showing annual depreciation records for a fixed asset
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-007 Fixed Assets & Depreciation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DepreciationRecord } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface DepreciationScheduleProps {
  assetDescription: string;
  records: DepreciationRecord[];
}

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DepreciationSchedule({ assetDescription, records }: DepreciationScheduleProps) {
  const { t } = useTranslation('accounting');

  const sortedRecords = [...records].sort((a, b) => a.fiscalYear - b.fiscalYear);

  if (sortedRecords.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('assets.depreciationSchedule')} - {assetDescription}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6">
            {t('assets.noDepreciationRecords')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {t('assets.depreciationSchedule')} - {assetDescription}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">{t('assets.year')}</TableHead>
                <TableHead className="text-right">{t('assets.openingValue')}</TableHead>
                <TableHead className="text-right">{t('assets.depreciation')}</TableHead>
                <TableHead className="text-right">{t('assets.closingValue')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRecords.map((record) => {
                const openingValue =
                  record.acquisitionCost - record.openingAccumulatedDepreciation;

                return (
                  <TableRow key={record.recordId}>
                    <TableCell className="font-medium">{record.fiscalYear}</TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(openingValue)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-red-600 dark:text-red-400">
                      -{formatCurrency(record.annualDepreciation)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatCurrency(record.closingNetBookValue)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
