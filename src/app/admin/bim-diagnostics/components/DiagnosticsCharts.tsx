'use client';

/**
 * DiagnosticsCharts — ADR-366 §C.7.Q2
 *
 * Aggregated visualizations computed client-side from the 30-day query
 * subscription: FPS histogram, GPU tier pie, render-mode usage bar.
 * Colors source from CSS variables `--chart-{1..5}` (ADR-365).
 *
 * @module admin/bim-diagnostics/components/DiagnosticsCharts
 */

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import type { PerformanceDiagnostic } from '@/types/performance-diagnostic';

interface DiagnosticsChartsProps {
  rows: ReadonlyArray<PerformanceDiagnostic>;
}

const FPS_BINS = [0, 10, 20, 30, 40, 50, 60, 90, 120, 240] as const;
const PIE_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

function bucketFps(value: number): string {
  for (let i = FPS_BINS.length - 1; i >= 0; i -= 1) {
    if (value >= FPS_BINS[i]) {
      const next = FPS_BINS[i + 1];
      return next === undefined ? `${FPS_BINS[i]}+` : `${FPS_BINS[i]}–${next - 1}`;
    }
  }
  return '<0';
}

export function DiagnosticsCharts({ rows }: DiagnosticsChartsProps) {
  const { t } = useTranslation('admin');

  const fpsHistogram = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const fps = row.metrics?.fps;
      if (typeof fps !== 'number' || Number.isNaN(fps)) continue;
      const bucket = bucketFps(fps);
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    return FPS_BINS.map((lo, i) => {
      const next = FPS_BINS[i + 1];
      const label = next === undefined ? `${lo}+` : `${lo}–${next - 1}`;
      return { bucket: label, count: counts.get(label) ?? 0 };
    });
  }, [rows]);

  const gpuTierPie = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const tier = row.metrics?.gpuTier;
      const label = typeof tier === 'number' ? `T${tier}` : '?';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [rows]);

  const modeBar = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const mode = row.renderMode || '?';
      counts.set(mode, (counts.get(mode) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([mode, count]) => ({ mode, count }));
  }, [rows]);

  if (rows.length === 0) {
    return (
      <section className="text-sm text-muted-foreground p-4">
        {t('bimDiagnostics.charts.noData')}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="text-sm font-semibold">{t('bimDiagnostics.charts.title')}</header>

      <article>
        <h3 className="text-xs font-medium mb-2">{t('bimDiagnostics.charts.fpsHistogram')}</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={fpsHistogram}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Bar dataKey="count" fill="hsl(var(--chart-1))" name={t('bimDiagnostics.charts.fpsHistogramCount')} />
          </BarChart>
        </ResponsiveContainer>
      </article>

      <article>
        <h3 className="text-xs font-medium mb-2">{t('bimDiagnostics.charts.gpuTierPie')}</h3>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={gpuTierPie} dataKey="value" nameKey="name" outerRadius={70} label>
              {gpuTierPie.map((entry, idx) => (
                <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Legend />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </article>

      <article>
        <h3 className="text-xs font-medium mb-2">{t('bimDiagnostics.charts.modeUsageBar')}</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={modeBar} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" fontSize={11} />
            <YAxis dataKey="mode" type="category" fontSize={11} width={80} />
            <Tooltip />
            <Bar dataKey="count" fill="hsl(var(--chart-3))" />
          </BarChart>
        </ResponsiveContainer>
      </article>
    </section>
  );
}
