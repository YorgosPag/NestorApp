'use client';

/**
 * @module /reports/projects
 * @enterprise ADR-265 Phase 7 — Projects & Buildings Report Dashboard
 *
 * KPIs, project status, progress, unit distribution,
 * revenue, price/m², BOQ variance, energy class.
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { Building } from 'lucide-react';
import { ReportPage } from '@/components/reports/core/ReportPage';
import { useProjectsReport } from '@/hooks/reports/useProjectsReport';
import {
  ProjectsKPIs,
  ProjectStatusChart,
  ProjectProgressChart,
  PropertyStatusChart,
  RevenueByProjectChart,
  PricePerSqmChart,
  BOQVarianceChart,
  EnergyClassDistribution,
} from '@/components/reports/sections/projects';

export default function ProjectsReportsPage() {
  const { t } = useTranslation('reports');
  const report = useProjectsReport();

  return (
    <ReportPage
      title={t('nav.projects')}
      description={t('projects.description')}
      icon={Building}
      onRefresh={report.refetch}
    >
      <ProjectsKPIs kpis={report.kpis} loading={report.loading} />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProjectStatusChart data={report.statusPie} loading={report.loading} />
        <EnergyClassDistribution data={report.energyClassData} loading={report.loading} />
      </section>

      <ProjectProgressChart data={report.projectProgress} loading={report.loading} />

      <PropertyStatusChart data={report.unitStatusByBuilding} loading={report.loading} />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueByProjectChart data={report.revenueByProject} loading={report.loading} />
        <PricePerSqmChart data={report.pricePerSqm} loading={report.loading} />
      </section>

      <BOQVarianceChart data={report.boqVariance} loading={report.loading} />
    </ReportPage>
  );
}
