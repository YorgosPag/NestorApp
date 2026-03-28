'use client';

/**
 * @module reports/sections/executive/ProjectHealthTable
 * @enterprise ADR-265 Phase 4 — RAG Project Health Table
 *
 * Shows active projects with CPI/SPI traffic lights and progress bars.
 * Click row → navigate to project detail.
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import {
  ReportSection,
  ReportTable,
  ReportTrafficLight,
  ReportEmptyState,
  type ReportColumnDef,
} from '@/components/reports/core';
import { Progress } from '@/components/ui/progress';
import type { ProjectHealthRow } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectHealthTableProps {
  data: ProjectHealthRow[];
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectHealthTable({ data, loading }: ProjectHealthTableProps) {
  const { t } = useTranslation('reports');
  const router = useRouter();

  const columns: ReportColumnDef<ProjectHealthRow>[] = [
    {
      key: 'name',
      header: t('executive.projectHealth.project'),
      sortable: true,
    },
    {
      key: 'progress',
      header: t('executive.projectHealth.progress'),
      sortable: true,
      width: '160px',
      render: (value: unknown) => (
        <ProgressCell value={value as number} />
      ),
    },
    {
      key: 'cpiHealth',
      header: t('executive.projectHealth.budget'),
      align: 'center' as const,
      width: '120px',
      render: (_value: unknown, row: ProjectHealthRow) => (
        <ReportTrafficLight
          status={row.cpiHealth}
          tooltip={`CPI: ${row.cpi.toFixed(2)}`}
          size="sm"
        />
      ),
    },
    {
      key: 'spiHealth',
      header: t('executive.projectHealth.timeline'),
      align: 'center' as const,
      width: '120px',
      render: (_value: unknown, row: ProjectHealthRow) => (
        <ReportTrafficLight
          status={row.spiHealth}
          tooltip={`SPI: ${row.spi.toFixed(2)}`}
          size="sm"
        />
      ),
    },
    {
      key: 'overallHealth',
      header: t('executive.projectHealth.health'),
      align: 'center' as const,
      width: '120px',
      render: (_value: unknown, row: ProjectHealthRow) => (
        <ReportTrafficLight
          status={row.overallHealth}
          showLabel
          size="sm"
        />
      ),
    },
  ];

  const handleRowClick = (row: ProjectHealthRow) => {
    router.push(`/projects/${row.id}`);
  };

  if (!loading && data.length === 0) {
    return (
      <ReportSection
        title={t('executive.projectHealth.title')}
        description={t('executive.projectHealth.description')}
        id="project-health"
      >
        <ReportEmptyState
          type="no-data"
          title={t('executive.projectHealth.title')}
        />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('executive.projectHealth.title')}
      description={t('executive.projectHealth.description')}
      id="project-health"
    >
      <ReportTable<ProjectHealthRow>
        columns={columns}
        data={data}
        sortable
        size="compact"
        showPagination={false}
        loading={loading}
        onRowClick={handleRowClick}
      />
    </ReportSection>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Progress bar cell
// ---------------------------------------------------------------------------

function ProgressCell({ value }: { value: number }) {
  return (
    <figure className="flex items-center gap-2">
      <Progress value={value} className="h-2 flex-1" />
      <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">
        {Math.round(value)}%
      </span>
    </figure>
  );
}
