'use client';

/**
 * @module /reports
 * @enterprise ADR-265 Phase 4 — Executive Summary Dashboard
 *
 * CEO overview: 8 KPI cards, project health table, revenue trend,
 * top overdue payments, pipeline summary.
 */

import { useTranslation } from 'react-i18next';
import { PieChart } from 'lucide-react';
import { ReportPage } from '@/components/reports/core/ReportPage';
import { useExecutiveReport } from '@/hooks/reports/useExecutiveReport';
import {
  PortfolioKPIs,
  ProjectHealthTable,
  RevenueTrendChart,
  TopOverdueCard,
  PipelineSummary,
} from '@/components/reports/sections/executive';

export default function ReportsPage() {
  const { t } = useTranslation('reports');
  const report = useExecutiveReport();

  return (
    <ReportPage
      title={t('page.title')}
      description={t('page.description')}
      icon={PieChart}
      onRefresh={report.refetch}
      defaultPreset="quarter"
    >
      <PortfolioKPIs kpis={report.kpis} loading={report.loading} />

      <ProjectHealthTable data={report.projectHealth} loading={report.loading} />

      <RevenueTrendChart data={report.revenueTrend} loading={report.loading} />

      <TopOverdueCard data={report.topOverdue} loading={report.loading} />

      <PipelineSummary data={report.pipelineSummary} loading={report.loading} />
    </ReportPage>
  );
}
