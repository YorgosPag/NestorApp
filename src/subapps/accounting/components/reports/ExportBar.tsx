'use client';

/**
 * @fileoverview Export Bar — PDF/Excel/CSV Action Buttons (Phase 2e)
 * @description Export financial reports in multiple formats
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md §2e (Q8 — export formats)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, semantic HTML
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, FileSpreadsheet, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReportType, ReportDataMap, ResolvedPeriods } from '@/subapps/accounting/types';
import { exportReportPdf } from '../../services/export/pdf-exporter';
import { exportReportExcel } from '../../services/export/excel-exporter';
import { exportReportCsv } from '../../services/export/csv-exporter';

// ============================================================================
// TYPES
// ============================================================================

interface ExportBarProps {
  reportType: ReportType;
  data: ReportDataMap[ReportType];
  period: ResolvedPeriods;
  reportTitle: string;
}

type ExportFormat = 'pdf' | 'excel' | 'csv';

// ============================================================================
// COMPONENT
// ============================================================================

export function ExportBar({ reportType, data, period, reportTitle }: ExportBarProps) {
  const { t } = useTranslation('accounting');
  const [loadingFormat, setLoadingFormat] = useState<ExportFormat | null>(null);

  const handleExport = useCallback(async (format: ExportFormat) => {
    setLoadingFormat(format);
    try {
      switch (format) {
        case 'pdf':
          await exportReportPdf(reportType, data, period, reportTitle);
          break;
        case 'excel':
          await exportReportExcel(reportType, data, period, reportTitle);
          break;
        case 'csv':
          exportReportCsv(reportType, data, period, reportTitle);
          break;
      }
    } finally {
      setLoadingFormat(null);
    }
  }, [reportType, data, period, reportTitle]);

  return (
    <nav className="flex items-center gap-2" aria-label="Export options">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport('pdf')}
        disabled={loadingFormat !== null}
      >
        {loadingFormat === 'pdf' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        {t('reports.export.pdf')}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport('excel')}
        disabled={loadingFormat !== null}
      >
        {loadingFormat === 'excel' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="mr-2 h-4 w-4" />
        )}
        {t('reports.export.excel')}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport('csv')}
        disabled={loadingFormat !== null}
      >
        {loadingFormat === 'csv' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="mr-2 h-4 w-4" />
        )}
        {t('reports.export.csv')}
      </Button>
    </nav>
  );
}
