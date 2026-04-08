'use client';

/**
 * @module reports/cash-flow
 * @enterprise ADR-268 Phase 8 — Cash Flow Forecast Dashboard
 * @lazy ADR-294 Batch 2 — Extracted for dynamic import
 *
 * Standalone dedicated module: 4 KPIs + combo chart + monthly table
 * + PDC calendar + forecast vs actual + alerts + settings panel.
 */

import { useTranslation } from 'react-i18next';
import { Banknote, Settings, ChevronDown } from 'lucide-react';
import { ReportPage } from '@/components/reports/core/ReportPage';
import { ReportKPIGrid } from '@/components/reports/core/ReportKPIGrid';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { useCashFlowReport } from '@/hooks/reports/useCashFlowReport';
import { useCashFlowSettings } from '@/hooks/reports/useCashFlowSettings';
import {
  CashFlowAlerts,
  CashFlowControls,
  CashFlowChart,
  CashFlowTable,
  CashFlowSettings,
  PDCCalendarView,
  ForecastVsActualTable,
} from '@/components/reports/sections/cash-flow';

export function ReportsCashFlowPageContent() {
  const { t } = useTranslation('cash-flow');
  const report = useCashFlowReport();
  const settings = useCashFlowSettings(report.config, report.refetch);

  return (
    <ReportPage
      title={t('title', 'Cash Flow Forecast')}
      description={t('description', '12-month cash flow projection with scenario analysis')}
      icon={Banknote}
      onRefresh={report.refetch}
    >
      <CashFlowAlerts alerts={report.alerts} />

      <ReportKPIGrid kpis={report.kpis} columns={4} />

      <CashFlowControls
        activeScenario={report.activeScenario}
        onScenarioChange={report.setActiveScenario}
        projectFilter={report.projectFilter}
        onProjectFilterChange={report.setProjectFilter}
        buildingFilter={report.buildingFilter}
        onBuildingFilterChange={report.setBuildingFilter}
        loading={report.loading}
      />

      <CashFlowChart data={report.chartData} loading={report.loading} />

      <CashFlowTable rows={report.tableRows} loading={report.loading} />

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {t('settings.title', 'Cash Flow Settings')}
            </span>
            <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <CashFlowSettings settings={settings} />
        </CollapsibleContent>
      </Collapsible>

      <Tabs defaultValue="pdc" className="w-full">
        <TabsList>
          <TabsTrigger value="pdc">{t('pdc.title', 'PDC Calendar')}</TabsTrigger>
          <TabsTrigger value="comparison">
            {t('comparison.title', 'Forecast vs Actual')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pdc">
          <PDCCalendarView days={report.pdcCalendar} />
        </TabsContent>
        <TabsContent value="comparison">
          <ForecastVsActualTable rows={report.actuals} />
        </TabsContent>
      </Tabs>
    </ReportPage>
  );
}

export default ReportsCashFlowPageContent;
