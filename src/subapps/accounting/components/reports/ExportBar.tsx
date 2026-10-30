'use client';

/**
 * @fileoverview Export Bar — PDF/Excel/CSV Action Buttons (Phase 2e)
 * @description Export financial reports in multiple formats through ONE pipeline (`report-export.ts`)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md §2e (Q8 — export formats) · ADR-584 §9
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, semantic HTML
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, FileSpreadsheet, FileDown, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReportType, ReportDataMap, ResolvedPeriods } from '@/subapps/accounting/types';
import { exportReport } from '../../services/export/report-export';
import type { ReportExportFormat } from '../../services/export/report-export';

// ============================================================================
// TYPES
// ============================================================================

interface ExportBarProps {
  reportType: ReportType;
  data: ReportDataMap[ReportType];
  period: ResolvedPeriods;
  reportTitle: string;
}

/** Τα κουμπιά ως ΔΗΛΩΣΗ — η σειρά εδώ είναι η σειρά στην οθόνη. */
const EXPORT_ACTIONS: ReadonlyArray<{ format: ReportExportFormat; icon: LucideIcon; labelKey: string }> = [
  { format: 'pdf', icon: FileText, labelKey: 'reports.export.pdf' },
  { format: 'excel', icon: FileSpreadsheet, labelKey: 'reports.export.excel' },
  { format: 'csv', icon: FileDown, labelKey: 'reports.export.csv' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ExportBar({ reportType, data, period, reportTitle }: ExportBarProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const [loadingFormat, setLoadingFormat] = useState<ReportExportFormat | null>(null);

  // Το αρχείο γράφεται στη γλώσσα της διεπαφής — ο `t` περνά ΡΗΤΑ (όχι το καθολικό i18next μέσα στον exporter).
  const handleExport = useCallback(async (format: ReportExportFormat) => {
    setLoadingFormat(format);
    try {
      await exportReport(format, { reportType, data, period, title: reportTitle, t });
    } finally {
      setLoadingFormat(null);
    }
  }, [reportType, data, period, reportTitle, t]);

  return (
    <nav className="flex items-center gap-2" aria-label={t('reports.export.options')}>
      {EXPORT_ACTIONS.map(({ format, icon: Icon, labelKey }) => (
        <Button
          key={format}
          variant="outline"
          size="sm"
          onClick={() => handleExport(format)}
          disabled={loadingFormat !== null}
        >
          {loadingFormat === format ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Icon className="mr-2 h-4 w-4" />
          )}
          {t(labelKey)}
        </Button>
      ))}
    </nav>
  );
}
