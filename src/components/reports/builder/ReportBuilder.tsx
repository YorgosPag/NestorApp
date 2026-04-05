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
import { Database, Save, FolderOpen } from 'lucide-react';
import { useNotifications } from '@/providers/NotificationProvider';
import { cn } from '@/lib/utils';
import { toPng } from 'html-to-image';
import { useReportBuilder } from '@/hooks/reports/useReportBuilder';
import { useSavedReports } from '@/hooks/reports/useSavedReports';
import { DomainSelector } from './DomainSelector';
import { SaveReportDialog } from './SaveReportDialog';
import { SavedReportsList } from './SavedReportsList';
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
  const { success, error: notifyError } = useNotifications();
  const colors = useSemanticColors();
  const builder = useReportBuilder();
  const savedReports = useSavedReports();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogMode, setSaveDialogMode] = useState<'save' | 'saveAs'>('save');
  const [showSavedList, setShowSavedList] = useState(false);

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
        success(t('export.successPdf'));
      } else {
        const { exportBuilderToExcel } = await import(
          '@/services/report-engine/builder-excel-exporter'
        );
        await exportBuilderToExcel(params);
        success(t('export.successExcel'));
      }

      setExportDialogOpen(false);
    } catch {
      notifyError(t('export.error'));
    } finally {
      setExporting(false);
    }
  }, [builder, t, success, notifyError]);

  const handleExportBarClick = useCallback((format: BarExportFormat) => {
    if (format === 'csv') return; // CSV deferred to Phase 4
    if (builder.chartCrossFilter) {
      setExportDialogOpen(true);
    } else {
      void handleExport(format as ExportFormat, 'none', 'all');
    }
  }, [builder.chartCrossFilter, handleExport]);

  // Saved Reports handlers
  const handleSaveClick = useCallback(() => {
    if (builder.activeSavedReport) {
      // Quick save — update existing
      void savedReports.updateReport(builder.activeSavedReport.id, {
        config: builder.getCurrentConfig(),
      }).then(updated => {
        builder.setActiveSavedReport(updated);
      });
    } else {
      setSaveDialogMode('save');
      setSaveDialogOpen(true);
    }
  }, [builder, savedReports]);

  const handleSaveAs = useCallback(() => {
    setSaveDialogMode('saveAs');
    setSaveDialogOpen(true);
  }, []);

  const handleSaveComplete = useCallback(async (input: Parameters<typeof savedReports.createReport>[0]) => {
    const created = await savedReports.createReport(input);
    builder.setActiveSavedReport(created);
    return created;
  }, [savedReports, builder]);

  const handleUpdateComplete = useCallback(async (id: string, input: Parameters<typeof savedReports.updateReport>[1]) => {
    const updated = await savedReports.updateReport(id, input);
    builder.setActiveSavedReport(updated);
    return updated;
  }, [savedReports, builder]);

  const handleLoadReport = useCallback((report: Parameters<typeof builder.loadSavedReport>[0]) => {
    builder.loadSavedReport(report);
    void savedReports.trackRun(report.id);
    setShowSavedList(false);
    success(t('messages.loaded', { ns: 'saved-reports' }));
  }, [builder, savedReports, t, success]);

  const handleDuplicate = useCallback((report: Parameters<typeof builder.loadSavedReport>[0]) => {
    builder.loadSavedReport(report);
    builder.clearSavedReport();
    setSaveDialogMode('saveAs');
    setSaveDialogOpen(true);
  }, [builder]);

  return (
    <section className="space-y-6 p-6" aria-label={t('title')}>
      {/* Header */}
      <header className="flex items-center gap-3">
        <Database className={cn("h-6 w-6", colors.text.primary)} />
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </header>

      {/* Unsaved Changes Bar (HubSpot pattern) */}
      {builder.hasUnsavedChanges && builder.activeSavedReport && (
        <aside
          className={cn(
            'flex items-center justify-between rounded-md border px-4 py-2',
            colors.border.warning,
            colors.bg.warning,
          )}
          role="status"
          aria-live="polite"
        >
          <p className={cn('text-sm font-medium', colors.text.warning)}>
            {t('messages.unsavedChanges', { ns: 'saved-reports', name: builder.activeSavedReport.name })}
          </p>
          <nav className="flex gap-2">
            <Button size="sm" onClick={handleSaveClick}>
              {t('actions.save', { ns: 'saved-reports' })}
            </Button>
            <Button size="sm" variant="outline" onClick={handleSaveAs}>
              {t('actions.saveAs', { ns: 'saved-reports' })}
            </Button>
          </nav>
        </aside>
      )}

      {/* Saved Reports List Panel */}
      {showSavedList && (
        <SavedReportsList
          reports={savedReports.reports}
          loading={savedReports.loading}
          activeTab={savedReports.activeTab}
          onTabChange={savedReports.setActiveTab}
          searchQuery={savedReports.searchQuery}
          onSearchChange={savedReports.setSearchQuery}
          filteredReports={savedReports.filteredReports}
          onLoad={handleLoadReport}
          onDelete={savedReports.deleteReport}
          onToggleFavorite={savedReports.toggleFavorite}
          onDuplicate={handleDuplicate}
        />
      )}

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

            {/* Execute + Save/Load + Export buttons */}
            <div className="flex flex-wrap items-center gap-3">
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
              <Button variant="outline" onClick={() => setShowSavedList(prev => !prev)}>
                <FolderOpen className="mr-2 h-4 w-4" />
                {t('actions.load', { ns: 'saved-reports' })}
              </Button>
              <Button
                variant="outline"
                onClick={handleSaveClick}
                disabled={!builder.domain}
              >
                <Save className="mr-2 h-4 w-4" />
                {t('actions.save', { ns: 'saved-reports' })}
              </Button>
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

      {/* Save Report Dialog */}
      <SaveReportDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        mode={saveDialogMode}
        existingReport={builder.activeSavedReport}
        currentConfig={builder.getCurrentConfig()}
        onSave={handleSaveComplete}
        onUpdate={handleUpdateComplete}
      />

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
