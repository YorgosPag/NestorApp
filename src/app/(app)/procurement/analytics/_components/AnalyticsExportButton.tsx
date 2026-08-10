'use client';

/**
 * AnalyticsExportButton — CSV / Excel download dropdown (ADR-331 §2.6 D6).
 *
 * Builds the export URL by mirroring the active filter state via the same
 * `serializeFilterArray` SSoT helper used by `useSpendAnalytics`.
 *
 * @see ADR-331 §2.6, §4 D6
 */

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import { serializeFilterArray } from '@/lib/url-filters/multi-value';
import type { SpendAnalyticsFilters } from '@/services/procurement/aggregators/spendAnalyticsAggregator';

const EXPORT_PATH = '/api/procurement/spend-analytics/export';

interface AnalyticsExportButtonProps {
  filters: SpendAnalyticsFilters;
  disabled?: boolean;
}

function buildExportQuery(filters: SpendAnalyticsFilters, format: 'csv' | 'xlsx'): string {
  const params = new URLSearchParams();
  params.set('format', format);
  params.set('from', filters.from);
  params.set('to', filters.to);
  const arrays: Array<[string, readonly string[]]> = [
    ['projectId', filters.projectId],
    ['supplierId', filters.supplierId],
    ['categoryCode', filters.categoryCode],
    ['status', filters.status],
  ];
  for (const [key, values] of arrays) {
    const serialized = serializeFilterArray(values);
    if (serialized) params.set(key, serialized);
  }
  return params.toString();
}

export function AnalyticsExportButton({ filters, disabled }: AnalyticsExportButtonProps) {
  const { t } = useTranslation('procurement');
  const [busy, setBusy] = useState<'csv' | 'xlsx' | null>(null);

  const handleExport = async (format: 'csv' | 'xlsx'): Promise<void> => {
    setBusy(format);
    try {
      const url = `${EXPORT_PATH}?${buildExportQuery(filters, format)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      triggerExportDownload({
        blob,
        filename: `spend-analytics-${filters.from}_${filters.to}.${format}`,
      });
    } finally {
      setBusy(null);
    }
  };

  const isBusy = busy !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled || isBusy}>
          {isBusy
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            : <Download className="mr-2 h-4 w-4" aria-hidden />}
          {t('analytics.export.button')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void handleExport('xlsx')} disabled={isBusy}>
          <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden />
          {t('analytics.export.excel')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handleExport('csv')} disabled={isBusy}>
          <FileText className="mr-2 h-4 w-4" aria-hidden />
          {t('analytics.export.csv')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
