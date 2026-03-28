'use client';

/**
 * @module reports/sections/contacts/TopBuyersTable
 * @enterprise ADR-265 Phase 9 — Top buyers by value table
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportTable, ReportEmptyState, type ReportColumnDef } from '@/components/reports/core';
import type { TopBuyerItem } from './types';

interface TopBuyersTableProps {
  data: TopBuyerItem[];
  loading?: boolean;
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function TopBuyersTable({ data, loading }: TopBuyersTableProps) {
  const { t } = useTranslation('reports');

  const columns: ReportColumnDef<TopBuyerItem>[] = [
    { key: 'name', header: t('contacts.buyers.name'), sortable: true },
    {
      key: 'totalValue',
      header: t('contacts.buyers.value'),
      sortable: true,
      render: (row) => formatEuro(row.totalValue),
    },
    { key: 'unitCount', header: t('contacts.buyers.units'), sortable: true },
  ];

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('contacts.buyers.title')} id="top-buyers">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('contacts.buyers.title')}
      description={t('contacts.buyers.description')}
      id="top-buyers"
    >
      <ReportTable data={data} columns={columns} sortable pageSize={10} />
    </ReportSection>
  );
}
