'use client';

/**
 * @module reports/construction
 * @enterprise ADR-265 Phase 11 — Construction & Timeline Report Dashboard
 * @lazy ADR-294 — Extracted for dynamic import
 *
 * KPIs, milestone completion, EVM per building, BOQ cost comparison.
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';
import { ReportPage } from '@/components/reports/core/ReportPage';
import { useConstructionReport } from '@/hooks/reports/useConstructionReport';
import {
  ConstructionKPIs,
  MilestoneCompletionChart,
  PhaseProgressChart,
  BOQCostBreakdownChart,
} from '@/components/reports/sections/construction';

export function ReportsConstructionPageContent() {
  const { t } = useTranslation('reports');
  const report = useConstructionReport();

  return (
    <ReportPage
      title={t('nav.construction')}
      description={t('construction.description')}
      icon={Construction}
      onRefresh={report.refetch}
    >
      <ConstructionKPIs kpis={report.kpis} loading={report.loading} />

      <MilestoneCompletionChart data={report.milestonePie} loading={report.loading} />

      <PhaseProgressChart data={report.evmBuildings} loading={report.loading} />

      <BOQCostBreakdownChart data={report.boqComparison} loading={report.loading} />
    </ReportPage>
  );
}

export default ReportsConstructionPageContent;
