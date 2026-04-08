'use client';

/**
 * @module reports/sales
 * @enterprise ADR-265 Phase 6 — Sales & Collections Report Dashboard
 * @lazy ADR-294 — Extracted for dynamic import
 *
 * KPIs, payment coverage, cheque status, legal phases,
 * conversion funnel, and aging analysis.
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { ReportPage } from '@/components/reports/core/ReportPage';
import { useSalesReport } from '@/hooks/reports/useSalesReport';
import {
  SalesKPIs,
  PaymentStatusChart,
  ChequeStatusChart,
  LegalPhaseChart,
  ConversionFunnelChart,
  OverdueAgingSection,
} from '@/components/reports/sections/sales';

export function ReportsSalesPageContent() {
  const { t } = useTranslation('reports');
  const report = useSalesReport();

  return (
    <ReportPage
      title={t('nav.sales')}
      description={t('sales.description')}
      icon={BarChart3}
      onRefresh={report.refetch}
    >
      <SalesKPIs kpis={report.kpis} loading={report.loading} />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PaymentStatusChart data={report.paymentPie} loading={report.loading} />
        <ChequeStatusChart data={report.chequesPie} loading={report.loading} />
      </section>

      <LegalPhaseChart data={report.legalBars} loading={report.loading} />

      <ConversionFunnelChart data={report.funnelStages} loading={report.loading} />

      <OverdueAgingSection agingBuckets={report.agingBuckets} loading={report.loading} />
    </ReportPage>
  );
}

export default ReportsSalesPageContent;
