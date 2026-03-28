'use client';

/**
 * @module reports/sections/financial/EVMDashboard
 * @enterprise ADR-265 Phase 5 — CPI/SPI gauges + EVM KPI cards
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportGauge,
  ReportTrafficLight,
  ReportKPIGrid,
  ReportEmptyState,
  type ReportKPI,
} from '@/components/reports/core';
import type { EVMResult } from '@/services/report-engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EVMDashboardProps {
  portfolioEVM: EVMResult | null;
  evmKPIs: ReportKPI[];
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EVMDashboard({ portfolioEVM, evmKPIs, loading }: EVMDashboardProps) {
  const { t } = useTranslation('reports');

  if (!loading && !portfolioEVM) {
    return (
      <ReportSection
        title={t('financial.evm.title')}
        description={t('financial.evm.description')}
        id="evm-dashboard"
      >
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('financial.evm.title')}
      description={t('financial.evm.description')}
      id="evm-dashboard"
    >
      {/* CPI/SPI Gauges */}
      {portfolioEVM && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <GaugeCard
            value={portfolioEVM.cpi}
            health={portfolioEVM.cpiHealth}
            label={t('financial.evm.cpi')}
          />
          <GaugeCard
            value={portfolioEVM.spi}
            health={portfolioEVM.spiHealth}
            label={t('financial.evm.spi')}
          />
        </section>
      )}

      {/* EVM KPI Cards */}
      <ReportKPIGrid kpis={evmKPIs} columns={3} />
    </ReportSection>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Gauge + Traffic Light card
// ---------------------------------------------------------------------------

function GaugeCard({
  value,
  health,
  label,
}: {
  value: number;
  health: 'green' | 'amber' | 'red';
  label: string;
}) {
  return (
    <figure className="flex flex-col items-center gap-3 rounded-lg border p-4">
      <ReportGauge
        value={value}
        target={1.0}
        label={label}
        size="md"
        formatValue={(v) => v.toFixed(2)}
      />
      <ReportTrafficLight status={health} showLabel size="md" />
    </figure>
  );
}
