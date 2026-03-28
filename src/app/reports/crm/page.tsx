'use client';

/**
 * @module /reports/crm
 * @enterprise ADR-265 Phase 8 — CRM & Pipeline Report Dashboard
 *
 * KPIs, pipeline stages, task distribution, communications,
 * lead sources, team performance.
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { Phone } from 'lucide-react';
import { ReportPage } from '@/components/reports/core/ReportPage';
import { useCrmReport } from '@/hooks/reports/useCrmReport';
import {
  CrmKPIs,
  PipelineFunnelChart,
  TaskDistributionChart,
  CommunicationChannelChart,
  LeadSourceChart,
  TeamPerformanceChart,
} from '@/components/reports/sections/crm';

export default function CrmReportsPage() {
  const { t } = useTranslation('reports');
  const report = useCrmReport();

  return (
    <ReportPage
      title={t('nav.crm')}
      description={t('crm.description')}
      icon={Phone}
      onRefresh={report.refetch}
    >
      <CrmKPIs kpis={report.kpis} loading={report.loading} />

      <PipelineFunnelChart data={report.pipelineStages} loading={report.loading} />

      <TaskDistributionChart
        statusData={report.taskStatusPie}
        priorityData={report.taskPriorityPie}
        loading={report.loading}
      />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CommunicationChannelChart data={report.channelBars} loading={report.loading} />
        <LeadSourceChart data={report.leadSourcePie} loading={report.loading} />
      </section>

      <TeamPerformanceChart data={report.teamBars} loading={report.loading} />
    </ReportPage>
  );
}
