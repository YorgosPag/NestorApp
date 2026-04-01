'use client';

/**
 * @module reports/sections/executive/TopOverdueCard
 * @enterprise ADR-265 Phase 4 — Top overdue payments table
 *
 * Phase 4: Simplified view from unit commercial data.
 * Phase 6: Full aging integration with payment plan installments.
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportTable,
  ReportEmptyState,
  type ReportColumnDef,
} from '@/components/reports/core';
import type { OverdueItem } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TopOverdueCardProps {
  data: OverdueItem[];
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TopOverdueCard({ data, loading }: TopOverdueCardProps) {
  const { t } = useTranslation('reports');

  const columns: ReportColumnDef<OverdueItem>[] = [
    {
      key: 'propertyName',
      header: t('executive.overdue.unit'),
      sortable: true,
    },
    {
      key: 'projectName',
      header: t('executive.overdue.project'),
      sortable: true,
    },
    {
      key: 'buyerName',
      header: t('executive.overdue.buyer'),
      sortable: true,
    },
    {
      key: 'amount',
      header: t('executive.overdue.amount'),
      format: 'currency' as const,
      align: 'right' as const,
      sortable: true,
    },
  ];

  if (!loading && data.length === 0) {
    return (
      <ReportSection
        title={t('executive.overdue.title')}
        description={t('executive.overdue.description')}
        id="top-overdue"
      >
        <ReportEmptyState
          type="no-data"
          description={t('executive.overdue.noOverdue')}
        />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('executive.overdue.title')}
      description={t('executive.overdue.description')}
      id="top-overdue"
    >
      <ReportTable<OverdueItem>
        columns={columns}
        data={data}
        size="compact"
        showPagination={false}
        sortable
        loading={loading}
      />
    </ReportSection>
  );
}
