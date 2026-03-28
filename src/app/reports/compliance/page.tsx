'use client';

/**
 * @module /reports/compliance
 * @enterprise ADR-265 Phase 12 — Compliance & Labor Report Dashboard
 *
 * KPIs, attendance methods, ΕΦΚΑ insurance class distribution.
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { Shield } from 'lucide-react';
import { ReportPage } from '@/components/reports/core/ReportPage';
import { useComplianceReport } from '@/hooks/reports/useComplianceReport';
import {
  ComplianceKPIs,
  AttendanceMethodChart,
  InsuranceClassChart,
} from '@/components/reports/sections/compliance';

export default function ComplianceReportsPage() {
  const { t } = useTranslation('reports');
  const report = useComplianceReport();

  return (
    <ReportPage
      title={t('nav.compliance')}
      description={t('compliance.description')}
      icon={Shield}
      onRefresh={report.refetch}
    >
      <ComplianceKPIs kpis={report.kpis} loading={report.loading} />

      <AttendanceMethodChart data={report.methodPie} loading={report.loading} />

      <InsuranceClassChart data={report.insuranceBars} loading={report.loading} />
    </ReportPage>
  );
}
