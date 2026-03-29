/**
 * @module components/reports/builder/ReportBuilder
 * @enterprise ADR-268 — Main Orchestrator Component
 *
 * Composes all builder sub-components.
 * All state from useReportBuilder() — flat prop drilling (1 level).
 */

'use client';

import '@/lib/design-system';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Database } from 'lucide-react';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { useReportBuilder } from '@/hooks/reports/useReportBuilder';
import { DomainSelector } from './DomainSelector';
import { ColumnSelector } from './ColumnSelector';
import { FilterPanel } from './FilterPanel';
import { ReportResults } from './ReportResults';
import { AIQueryInput } from './AIQueryInput';
import { GroupBySelector } from './GroupBySelector';
import { ChartSection } from './ChartSection';
import { ExportDialog } from './ExportDialog';
import { ReportKPIGrid } from '@/components/reports/core/ReportKPIGrid';
import { ReportExportBar } from '@/components/reports/core/ReportExportBar';
import { Button } from '@/components/ui/button';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { designTokens } from '@/styles/design-tokens';
import type { ExportFormat as BarExportFormat } from '@/components/reports/core/ReportExportBar';
import type {
  ExportFormat,
  WatermarkMode,
  ExportScope,
} from '@/services/report-engine/builder-export-types';

export function ReportBuilder() {
  const { t } = useTranslation('report-builder');
  const colors = useSemanticColors();
  const builder = useReportBuilder();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportBarClick = useCallback((format: BarExportFormat) => {
    if (format === 'csv') return; // CSV deferred to Phase 4
    if (builder.chartCrossFilter) {
      setExportDialogOpen(true);
    } else {
      void handleExport(format as ExportFormat, 'none', 'all');
    }
  }, [builder.chartCrossFilter, handleExport]);

  const handleExport = useCallback(async (
    format: ExportFormat,
    watermark: WatermarkMode,
    scope: ExportScope,
  ) => {
    if (!builder.results || !builder.domainDefinition) return;

    setExporting(true);
    try {
      // Capture chart image if chart is visible
      let chartImageDataUrl: string | null = null;
      if (chartContainerRef.current && builder.groupingResult) {
        try {
          chartImageDataUrl = await toPng(chartContainerRef.current, {
            backgroundColor: designTokens.colors.background.primary,
            quality: 1.0,
            pixelRatio: 2,
          });
        } catch {
          // Chart capture failed — continue without chart
        }
      }

      const params = {
        domain: builder.domain!,
        domainDefinition: builder.domainDefinition,
        results: builder.results,
        columns: builder.columns,
        filters: builder.filters,
        groupingResult: builder.groupingResult,
        filteredGroups: scope === 'filtered' && builder.chartCrossFilter
          ? builder.filteredGroups
          : (builder.groupingResult?.groups ?? null),
        grandTotals: builder.groupingResult?.grandTotals ?? {},
        chartImageDataUrl,
        activeChartType: builder.activeChartType,
        format,
        watermark,
        scope,
        userName: 'Γιώργος Παγώνης',
      };

      if (format === 'pdf') {
        const { exportBuilderToPdf } = await import(
          '@/services/report-engine/builder-pdf-exporter'
        );
        await exportBuilderToPdf(params);
        toast.success(t('export.successPdf'));
      } else {
        const { exportBuilderToExcel } = await import(
          '@/services/report-engine/builder-excel-exporter'
        );
        await exportBuilderToExcel(params);
        toast.success(t('export.successExcel'));
      }

      setExportDialogOpen(false);
    } catch {
      toast.error(t('export.error'));
    } finally {
      setExporting(false);
    }
  }, [builder, t]);

  return (
    <section className="space-y-6 p-6" aria-label={t('title')}>
      {/* Header */}
      <header className="flex items-center gap-3">
        <Database className="h-6 w-6" style={{ color: colors.primary }} />
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </header>

      {/* AI Query Input */}
      <AIQueryInput
        onSubmit={builder.submitAIQuery}
        loading={builder.aiLoading}
        result={builder.aiResult}
      />

      {/* Domain Selector */}
      <DomainSelector
        value={builder.domain}
        onChange={builder.setDomain}
      />

      {/* Builder Content — only when domain is selected */}
      {builder.domain && builder.domainDefinition && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          {/* Main content area */}
          <main className="space-y-4">
            <FilterPanel
              filters={builder.filters}
              domainDefinition={builder.domainDefinition}
              onAdd={builder.addFilter}
              onRemove={builder.removeFilter}
              onUpdate={builder.updateFilter}
              onClear={builder.clearFilters}
            />

            {/* Group By Selector */}
            <GroupBySelector
              domainDefinition={builder.domainDefinition}
              columns={builder.columns}
              groupByConfig={builder.groupByConfig}
              onConfigChange={builder.setGroupByConfig}
              showPercentOfTotal={builder.showPercentOfTotal}
              onTogglePercentOfTotal={builder.togglePercentOfTotal}
              onExpandAll={builder.expandAllGroups}
              onCollapseAll={builder.collapseAllGroups}
              hasGroups={!!builder.groupingResult && builder.groupingResult.groups.length > 0}
            />

            {/* Execute + Export buttons */}
            <div className="flex items-center gap-3">
              <Button
                onClick={builder.executeQuery}
                disabled={builder.loading || builder.columns.length === 0}
              >
                {builder.loading ? t('executing') : t('execute')}
              </Button>
              {builder.results && (
                <Button variant="outline" onClick={builder.refetch}>
                  {t('refresh')}
                </Button>
              )}
              {builder.results && (
                <ReportExportBar
                  onExport={handleExportBarClick}
                  disabled={exporting}
                  formats={['pdf', 'excel']}
                />
              )}
            </div>

            {/* KPIs — only when grouping is active */}
            {builder.kpis.length > 0 && (
              <ReportKPIGrid kpis={builder.kpis} columns={4} />
            )}

            {/* Chart — only when grouping is active */}
            {builder.groupingResult && builder.activeChartType && builder.groupByConfig && builder.filteredGroups && (
              <ChartSection
                groupByConfig={builder.groupByConfig}
                filteredGroups={builder.filteredGroups}
                activeChartType={builder.activeChartType}
                suggestedChartType={builder.suggestedChartType}
                onChartTypeChange={builder.setChartType}
                onCrossFilter={builder.applyChartCrossFilter}
                chartContainerRef={chartContainerRef}
              />
            )}

            <ReportResults
              results={builder.results}
              columns={builder.columns}
              domainDefinition={builder.domainDefinition}
              loading={builder.loading}
              error={builder.error}
              limit={builder.limit}
              onLimitChange={builder.setLimit}
              shareUrl={builder.shareUrl}
              groupingResult={builder.groupingResult}
              filteredGroups={builder.filteredGroups}
              expandedGroups={builder.expandedGroups}
              onToggleGroup={builder.toggleGroupExpanded}
              percentOfTotal={builder.percentOfTotal}
              chartCrossFilter={builder.chartCrossFilter}
              onClearCrossFilter={builder.clearChartCrossFilter}
              groupSortKey={builder.groupSortKey}
              groupSortDirection={builder.groupSortDirection}
              onGroupSort={builder.setGroupSort}
            />
          </main>

          {/* Sidebar — Column Selector */}
          <aside>
            <ColumnSelector
              domainDefinition={builder.domainDefinition}
              columns={builder.columns}
              onToggle={builder.toggleColumn}
              onReorder={builder.reorderColumns}
            />
          </aside>
        </div>
      )}

      {/* Export Dialog (cross-filter scope choice) */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExport}
        crossFilter={builder.chartCrossFilter ?? null}
        totalRecords={builder.results?.totalMatched ?? 0}
        filteredRecords={builder.filteredGroups?.reduce((sum, g) => sum + g.rowCount, 0) ?? 0}
        exporting={exporting}
      />
    </section>
  );
}
