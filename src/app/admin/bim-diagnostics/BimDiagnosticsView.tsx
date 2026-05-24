'use client';

/**
 * BimDiagnosticsView — ADR-366 §C.7.Q2
 *
 * Client root of the super-admin BIM Diagnostics dashboard. Holds the
 * filter state and current selection; delegates rendering to the
 * filter bar, list, detail panel, and charts panel.
 *
 * @module admin/bim-diagnostics/BimDiagnosticsView
 */

import { useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { nowISO } from '@/lib/date-local';
import { useDiagnosticsQuery } from './hooks/useDiagnosticsQuery';
import {
  DiagnosticsFiltersBar,
  EMPTY_FILTERS,
  type DiagnosticsFilters,
} from './components/DiagnosticsFiltersBar';
import { DiagnosticsList } from './components/DiagnosticsList';
import { DiagnosticsDetailPanel } from './components/DiagnosticsDetailPanel';
import { DiagnosticsCharts } from './components/DiagnosticsCharts';
import { downloadDiagnosticsCsv } from '@/lib/exports/diagnostics-csv';
import type { PerformanceDiagnostic, TriageStatus } from '@/types/performance-diagnostic';

function tsToMs(value: Timestamp | string | null | undefined): number | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  try {
    return value.toDate().getTime();
  } catch {
    return null;
  }
}

function applyFilters(
  rows: ReadonlyArray<PerformanceDiagnostic>,
  filters: DiagnosticsFilters,
): PerformanceDiagnostic[] {
  const fromMs = filters.dateFrom ? Date.parse(filters.dateFrom) : null;
  const toMs = filters.dateTo ? Date.parse(filters.dateTo) + 24 * 60 * 60 * 1000 : null;
  const fpsMin = filters.fpsMin ? Number(filters.fpsMin) : null;
  const fpsMax = filters.fpsMax ? Number(filters.fpsMax) : null;
  const projectQ = filters.projectQuery.trim().toLowerCase();

  return rows.filter((row) => {
    const status: TriageStatus = row.status ?? 'new';
    if (filters.status !== 'all' && status !== filters.status) return false;

    if (projectQ && !(row.projectId ?? '').toLowerCase().includes(projectQ)) return false;

    if (filters.gpuTier !== 'all') {
      const tier = row.metrics?.gpuTier;
      if (String(tier) !== filters.gpuTier) return false;
    }

    const fps = row.metrics?.fps;
    if (fpsMin !== null && (typeof fps !== 'number' || fps < fpsMin)) return false;
    if (fpsMax !== null && (typeof fps !== 'number' || fps > fpsMax)) return false;

    if (filters.browser !== 'all') {
      const browserFamily = (row.metrics?.['browser.family'] as unknown as string) ?? '';
      if (browserFamily !== filters.browser) return false;
    }

    const ms = tsToMs(row.createdAt);
    if (fromMs !== null && (ms === null || ms < fromMs)) return false;
    if (toMs !== null && (ms === null || ms >= toMs)) return false;

    return true;
  });
}

export function BimDiagnosticsView() {
  const { t } = useTranslation('admin');
  const [filters, setFilters] = useState<DiagnosticsFilters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCharts, setShowCharts] = useState(false);

  const { rows, loading, error } = useDiagnosticsQuery(true);

  const filteredRows = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const selected = useMemo(
    () => filteredRows.find((r) => r.id === selectedId) ?? null,
    [filteredRows, selectedId],
  );

  function handleExport() {
    downloadDiagnosticsCsv(filteredRows, {
      title: t('bimDiagnostics.title'),
      filename: `bim-diagnostics-${nowISO().slice(0, 10)}`,
      translateHeader: (key) => t(`bimDiagnostics.${key}`),
      translateStatus: (s) => t(`bimDiagnostics.status.${s}`),
    });
  }

  return (
    <section className="flex flex-col h-full">
      <header className="border-b px-4 py-3 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold">{t('bimDiagnostics.title')}</h1>
          <p className="text-xs text-muted-foreground">{t('bimDiagnostics.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowCharts((v) => !v)}>
            {t('bimDiagnostics.charts.title')}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={filteredRows.length === 0}>
            {t('bimDiagnostics.actions.exportCsv')}
          </Button>
        </div>
      </header>

      {error && (
        <p className="bg-destructive/10 text-destructive text-xs px-4 py-2 border-b">
          {t('bimDiagnostics.errors.loadFailed')}: {error.message}
        </p>
      )}

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r flex flex-col overflow-y-auto">
          <DiagnosticsFiltersBar filters={filters} onChange={setFilters} />
        </aside>

        <section className="flex-1 border-r overflow-hidden flex flex-col">
          {loading ? (
            <p className="text-sm text-muted-foreground p-4">{t('bimDiagnostics.loading')}</p>
          ) : (
            <DiagnosticsList
              rows={filteredRows}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </section>

        <aside className="w-[28rem] overflow-y-auto">
          {showCharts ? (
            <div className="p-4">
              <DiagnosticsCharts rows={filteredRows} />
            </div>
          ) : selected ? (
            <DiagnosticsDetailPanel diagnostic={selected} />
          ) : (
            <p className="text-sm text-muted-foreground p-4">{t('bimDiagnostics.selectRowHint')}</p>
          )}
        </aside>
      </div>
    </section>
  );
}
