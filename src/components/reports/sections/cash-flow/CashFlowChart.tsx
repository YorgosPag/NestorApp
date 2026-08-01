'use client';

import '@/lib/design-system';

/**
 * @module reports/sections/cash-flow/CashFlowChart
 * @enterprise ADR-268 Phase 8 — Q1: Combo chart (stacked bars + cumulative line)
 * @description ComposedChart with inflow/outflow bars + balance line overlay.
 *
 * ⚠️ **ADR-710 (μετανάστευση 2026-08-01)**: πλαίσιο κάρτας, υπόμνημα, κενή
 * κατάσταση και `ResponsiveContainer` ζουν στο `<ChartCard>`· ελεύθερο ύψος
 * 320px → βήμα `lg`.
 *
 * 🔴 **Boy Scout (N.11)**: και οι έξι μεταφράσεις της κάρτας περνούσαν αγγλικό
 * κείμενο ως **δεύτερο θεσιακό όρισμα** — hardcoded defaultValue — ενώ τα
 * κλειδιά **υπήρχαν ήδη** και στα δύο locales. Δηλαδή η ελληνική μετάφραση
 * υπήρχε και δεν εμφανιζόταν ποτέ αν το κλειδί αστοχούσε, και κανένα gate δεν
 * το έβλεπε: ο scanner ψάχνει `defaultValue:`, όχι τη θεσιακή μορφή (βλ. N.11
 * «τι ΔΕΝ καλύπτει»).
 *
 * ⚠️ Το παράδειγμα από πάνω **δεν** γράφεται εδώ αυτούσιο: η CHECK 3.8 σαρώνει
 * το αρχείο ως κείμενο και **δεν εξαιρεί σχόλια** — ένα κλειδί-δείγμα μέσα σε
 * docblock μετριέται ως αληθινή κλήση και μπλοκάρει το commit.
 *
 * 🔑 Τα χρώματα ήταν χειρόγραφα `--chart-2 / --chart-1 / --chart-4` με σχόλια
 * «green / blue / orange». Το χρώμα ενός slot **δεν είναι** το όνομά του: η
 * σειρά των slots είναι ο μετρημένος μηχανισμός διαχωρισμού CVD (CHECK 3.32).
 * Πλέον θεσιακά, από τη δήλωση σειρών.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  ChartCard,
  seriesColorVar,
  type ChartSeries,
} from '@/components/ui/chart-card';
import type { CashFlowChartRow } from '@/hooks/reports/useCashFlowReport';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CashFlowChartProps {
  data: CashFlowChartRow[];
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

function formatAmount(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `€${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `€${(value / 1_000).toFixed(0)}K`;
  }
  return `€${value.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CashFlowChart({ data, loading }: CashFlowChartProps) {
  const { t } = useTranslation('cash-flow');

  const series = useMemo<readonly ChartSeries<CashFlowChartRow>[]>(
    () => [
      { key: 'inflow', label: t('chart.inflow') },
      { key: 'outflow', label: t('chart.outflow') },
      { key: 'balance', label: t('chart.balance') },
    ],
    [t],
  );

  /**
   * Η φόρτωση **δεν** είναι κενή κατάσταση: «δεν ξέρω ακόμη» και «δεν υπάρχει»
   * λένε διαφορετικά πράγματα στον χρήστη. Το shell εκφράζει το δεύτερο, οπότε
   * το μήνυμα διαφοροποιείται ρητά ενώ ο κλάδος μένει ένας.
   */
  const rows = loading ? [] : data;

  return (
    <ChartCard
      series={series}
      data={rows}
      categoryKey="label"
      categoryLabel={t('chart.period')}
      formatValue={formatAmount}
    >
      <ChartCard.Header title={t('chart.title')} />
      <ChartCard.Figure
        emptyMessage={loading ? t('chart.loading') : t('chart.noData')}
        size="lg"
      >
        <ComposedChart data={rows} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            tickFormatter={formatAmount}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <ChartCard.Tooltip />
          <Bar dataKey="inflow" fill={seriesColorVar('inflow')} radius={[2, 2, 0, 0]} />
          <Bar dataKey="outflow" fill={seriesColorVar('outflow')} radius={[2, 2, 0, 0]} />
          <Line
            type="monotone"
            dataKey="balance"
            stroke={seriesColorVar('balance')}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ChartCard.Figure>
    </ChartCard>
  );
}
