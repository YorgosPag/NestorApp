
'use client';
import React, { useState } from 'react';
import Header from './AnalyticsTabContent/Header';
import KPICards from './AnalyticsTabContent/KPICards';
import AnalyticsOverview from './AnalyticsTabContent/AnalyticsOverview';
import AnalyticsFinancial from './AnalyticsTabContent/AnalyticsFinancial';
import AnalyticsProgress from './AnalyticsTabContent/AnalyticsProgress';
import AnalyticsComparison from './AnalyticsTabContent/AnalyticsComparison';
import type { Building } from '../BuildingsPageContent';

interface AnalyticsTabContentProps {
  building: Building;
}

export default function AnalyticsTabContent({ building }: AnalyticsTabContentProps) {
  const [timeRange, setTimeRange] = useState<'1M' | '3M' | '6M' | '1Y'>('6M');
  const [analyticsView, setAnalyticsView] = useState<'overview' | 'financial' | 'progress' | 'comparison'>('overview');

  return (
    <div className="space-y-6">
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
    </div>
  );
}
