'use client';

/**
 * DiagnosticsCharts — ADR-366 §C.7.Q2
 *
 * Aggregated visualizations computed client-side from the 30-day query
 * subscription: FPS histogram, GPU tier pie, render-mode usage bar.
 *
 * ⚠️ **ADR-710 (μετανάστευση 2026-08-01)**: και τα τρία γραφήματα περνούν από
 * `<ChartCard>`. Το αρχείο ήταν το πιο διδακτικό δείγμα του προβλήματος: **τρία**
 * γραφήματα, **τρία** χειρόγραφα `ResponsiveContainer`, **τρία** ελεύθερα ύψη
 * (180/180/160) και **μηδέν** πίνακες δεδομένων — σε οθόνη **διαγνωστικών**,
 * όπου ο αριθμός είναι το προϊόν.
 *
 * 🔴 **Το `PIE_COLORS[idx % length]` ήταν σφάλμα, όχι στιλ.** Το `%` **τυλίγει**:
 * με έξι κατηγορίες GPU, η έκτη έπαιρνε **το ίδιο** χρώμα με την πρώτη και οι
 * δύο γίνονταν μία στο μάτι. Η μετρημένη παλέτα (ADR-710 §10) **δεν τυλίγει
 * ποτέ** — πέρα από το `CHART_SERIES_LIMIT` επιστρέφει ουδέτερο, που διαβάζεται
 * ως «αταξινόμητο» αντί να ψεύδεται. Ο πίνακας χρωματίζεται πλέον με
 * `chartCategoryColor` πάνω σε **δηλωμένη** σειρά κατηγοριών: ένα φιλτράρισμα
 * δεν μετακινεί πια το χρώμα κάθε κατηγορίας από κάτω του.
 *
 * @module admin/bim-diagnostics/components/DiagnosticsCharts
 */

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import {
  ChartCard,
  chartCategoryColor,
  seriesColorVar,
  type ChartSeries,
} from '@/components/ui/chart-card';
import type { PerformanceDiagnostic } from '@/types/performance-diagnostic';

interface DiagnosticsChartsProps {
  rows: ReadonlyArray<PerformanceDiagnostic>;
}

const FPS_BINS = [0, 10, 20, 30, 40, 50, 60, 90, 120, 240] as const;

interface FpsRow {
  bucket: string;
  count: number;
}
interface TierRow {
  name: string;
  value: number;
}
interface ModeRow {
  mode: string;
  count: number;
}

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

  const fpsHistogram = useMemo<FpsRow[]>(() => {
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

  const gpuTierPie = useMemo<TierRow[]>(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const tier = row.metrics?.gpuTier;
      const label = typeof tier === 'number' ? `T${tier}` : '?';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [rows]);

  /**
   * 🔑 Η **δηλωμένη** σειρά κατηγοριών, ταξινομημένη σταθερά — όχι η σειρά που
   * έτυχε να έχουν τα δεδομένα. Διαβάζοντας τη σειρά από τις γραμμές, μια
   * κατηγορία που έλειπε σε ένα παράθυρο 30 ημερών θα μετατόπιζε το χρώμα
   * **όλων** των επόμενων: το ίδιο GPU tier θα άλλαζε χρώμα ανάμεσα σε δύο
   * φορτώσεις της ίδιας οθόνης.
   */
  const gpuTierOrder = useMemo(
    () => [...gpuTierPie.map((r) => r.name)].sort((a, b) => a.localeCompare(b)),
    [gpuTierPie],
  );

  const modeBar = useMemo<ModeRow[]>(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const mode = row.renderMode || '?';
      counts.set(mode, (counts.get(mode) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([mode, count]) => ({ mode, count }));
  }, [rows]);

  const fpsSeries = useMemo<readonly ChartSeries<FpsRow>[]>(
    () => [{ key: 'count', label: t('bimDiagnostics.charts.fpsHistogramCount') }],
    [t],
  );
  const tierSeries = useMemo<readonly ChartSeries<TierRow>[]>(
    () => [{ key: 'value', label: t('bimDiagnostics.charts.tierCount') }],
    [t],
  );
  const modeSeries = useMemo<readonly ChartSeries<ModeRow>[]>(
    () => [{ key: 'count', label: t('bimDiagnostics.charts.fpsHistogramCount') }],
    [t],
  );

  const formatCount = (value: number) => String(value);

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

      <ChartCard
        series={fpsSeries}
        data={fpsHistogram}
        categoryKey="bucket"
        categoryLabel={t('bimDiagnostics.charts.fpsHistogramAxis')}
        formatValue={formatCount}
      >
        <ChartCard.Header title={t('bimDiagnostics.charts.fpsHistogram')} />
        <ChartCard.Figure emptyMessage={t('bimDiagnostics.charts.noData')} size="sm">
          <BarChart data={fpsHistogram}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" fontSize={11} />
            <YAxis fontSize={11} />
            <ChartCard.Tooltip />
            <Bar dataKey="count" fill={seriesColorVar('count')} />
          </BarChart>
        </ChartCard.Figure>
      </ChartCard>

      <ChartCard
        series={tierSeries}
        data={gpuTierPie}
        categoryKey="name"
        categoryLabel={t('bimDiagnostics.charts.gpuTierLabel')}
        categoryOrder={gpuTierOrder}
        formatValue={formatCount}
      >
        <ChartCard.Header title={t('bimDiagnostics.charts.gpuTierPie')} />
        <ChartCard.Figure emptyMessage={t('bimDiagnostics.charts.noData')} size="sm">
          <PieChart>
            <Pie data={gpuTierPie} dataKey="value" nameKey="name" outerRadius={70} label>
              {gpuTierPie.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={chartCategoryColor(gpuTierOrder, entry.name)}
                />
              ))}
            </Pie>
            <ChartCard.Tooltip />
          </PieChart>
        </ChartCard.Figure>
      </ChartCard>

      <ChartCard
        series={modeSeries}
        data={modeBar}
        categoryKey="mode"
        categoryLabel={t('bimDiagnostics.charts.modeLabel')}
        formatValue={formatCount}
      >
        <ChartCard.Header title={t('bimDiagnostics.charts.modeUsageBar')} />
        <ChartCard.Figure emptyMessage={t('bimDiagnostics.charts.noData')} size="sm">
          <BarChart data={modeBar} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" fontSize={11} />
            <YAxis dataKey="mode" type="category" fontSize={11} width={80} />
            <ChartCard.Tooltip />
            <Bar dataKey="count" fill={seriesColorVar('count')} />
          </BarChart>
        </ChartCard.Figure>
      </ChartCard>
    </section>
  );
}
