'use client';

/**
 * @module /reports/financial
 * @enterprise ADR-265 Phase 5 — Financial Report Dashboard
 *
 * EVM Dashboard, S-curve, Cost Variance, Cash Flow & Aging,
 * Revenue Recognition by building.
 */

import { useTranslation } from 'react-i18next';
import { DollarSign } from 'lucide-react';
import { ReportPage } from '@/components/reports/core/ReportPage';
import { useFinancialReport } from '@/hooks/reports/useFinancialReport';
import {
  EVMDashboard,
  EVMTrendChart,
  CostVarianceWaterfall,
  CashFlowForecast,
  RevenueRecognition,
} from '@/components/reports/sections/financial';

export default function FinancialReportsPage() {
  const { t } = useTranslation('reports');
  const report = useFinancialReport();

  return (
    <ReportPage
      title={t('nav.financial')}
      description={t('financial.description')}
      icon={DollarSign}
      onRefresh={report.refetch}
    >
      <EVMDashboard
        portfolioEVM={report.portfolioEVM}
        evmKPIs={report.evmKPIs}
        loading={report.loading}
      />

      <EVMTrendChart data={report.sCurveData} loading={report.loading} />

      <CostVarianceWaterfall data={report.costVariance} loading={report.loading} />

      <CashFlowForecast
        totalReceivables={report.totalReceivables}
        totalCollected={report.totalCollected}
        collectionRate={report.collectionRate}
        agingBuckets={report.agingBuckets}
        loading={report.loading}
      />

      <RevenueRecognition data={report.revenueByProject} loading={report.loading} />
    </ReportPage>
  );
}
