'use client';
import React, { useState } from 'react';
import Header from './Header';
import KPICards from './KPICards';
import AnalyticsOverview from './AnalyticsOverview';
import AnalyticsFinancial from './AnalyticsFinancial';
import AnalyticsProgress from './AnalyticsProgress';
import AnalyticsComparison from './AnalyticsComparison';
import type { Building } from '../../BuildingsPageContent';

interface AnalyticsTabContentProps {
  building: Building;
}

export default function AnalyticsTabContent({ building }: AnalyticsTabContentProps) {
  const [timeRange, setTimeRange] = useState<'1M' | '3M' | '6M' | '1Y'>('6M');
  const [analyticsView, setAnalyticsView] = useState<'overview' | 'financial' | 'progress' | 'comparison'>('overview');

  return (
    <section className="space-y-2">
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
