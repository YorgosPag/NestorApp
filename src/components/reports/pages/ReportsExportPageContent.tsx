'use client';

/**
 * @module reports/export
 * @enterprise ADR-265 Phase 13 — Export Center
 * @lazy ADR-294 Batch 2 — Extracted for dynamic import
 *
 * Hub page for batch-exporting all report domains as PDF or Excel.
 */

import { useTranslation } from 'react-i18next';
import { FileBarChart } from 'lucide-react';
import { ReportPage } from '@/components/reports/core/ReportPage';
import { useExportCenter } from '@/hooks/reports/useExportCenter';
import {
  ExportDomainGrid,
  ExportStatusPanel,
} from '@/components/reports/sections/export';

export function ReportsExportPageContent() {
  const { t } = useTranslation('reports');
  const { domains, jobs, exportingDomains, handleExport } = useExportCenter();

  return (
    <ReportPage
      title={t('nav.export')}
      description={t('exportCenter.description')}
      icon={FileBarChart}
    >
      <ExportDomainGrid
        domains={domains}
        onExport={handleExport}
        exportingDomains={exportingDomains}
      />

      <ExportStatusPanel jobs={jobs} />
    </ReportPage>
  );
}

export default ReportsExportPageContent;
