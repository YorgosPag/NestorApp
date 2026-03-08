
'use client';
import React, { useState } from 'react';
import Header from './AnalyticsTabContent/Header';
import KPICards from './AnalyticsTabContent/KPICards';
import AnalyticsOverview from './AnalyticsTabContent/AnalyticsOverview';
import AnalyticsFinancial from './AnalyticsTabContent/AnalyticsFinancial';
import AnalyticsProgress from './AnalyticsTabContent/AnalyticsProgress';
import AnalyticsComparison from './AnalyticsTabContent/AnalyticsComparison';
// BuildingStats moved here from GeneralTabContent (consistency refactor)
import { BuildingStats } from './BuildingStats';
import type { Building } from '../BuildingsPageContent';

interface AnalyticsTabContentProps {
  building: Building;
}

export default function AnalyticsTabContent({ building }: AnalyticsTabContentProps) {
  const [timeRange, setTimeRange] = useState<'1M' | '3M' | '6M' | '1Y'>('6M');
  const [analyticsView, setAnalyticsView] = useState<'overview' | 'financial' | 'progress' | 'comparison'>('overview');

  return (
    <section className="space-y-2">
      {/* Building Stats — aggregated unit/sales data */}
      <BuildingStats buildingId={String(building.id)} />

      <Header
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        analyticsView={analyticsView}
        setAnalyticsView={setAnalyticsView}
      />

      <KPICards />

      {analyticsView === 'overview' && <AnalyticsOverview />}
      {analyticsView === 'financial' && <AnalyticsFinancial building={building} />}
      {analyticsView === 'progress' && <AnalyticsProgress building={building} />}
      {analyticsView === 'comparison' && <AnalyticsComparison />}
    </section>
  );
}
