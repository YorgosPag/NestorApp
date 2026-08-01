'use client';

/**
 * SpendTopBarChart — **ένα** γράφημα: top-N μπάρες ενός ποσού, με drill-down.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΕΥΡΗΜΑ (μετρημένο 2026-08-01 · ADR-742 §7quaterdecies · CHECK 3.28)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `SpendByCategoryChart` και το `SpendByProjectChart` **δεν ήταν δύο
 * γραφήματα**. Ήταν το ίδιο γράφημα δύο φορές, με τον ένα προσανατολισμό
 * γυρισμένο: ίδια δήλωση σειράς, ίδιο πλέγμα, ίδια μπάρα, ίδιο drill-down.
 * Διέφεραν σε **τέσσερα** πράγματα, και τα τέσσερα γεωμετρικά — ποιος άξονας
 * φέρει την κατηγορία, από ποια πλευρά ξεκινά το πλέγμα, ποια γωνία της μπάρας
 * στρογγυλεύει, πόσο ψηλή είναι η κάρτα.
 *
 * Το `jscpd` το είδε ως 59 tokens κοινού προλόγου. Ο πρόλογος ήταν το
 * **σύμπτωμα**· η αιτία ήταν ότι δύο αρχεία έκαναν μία δουλειά.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΓΙΑΤΙ ΤΟ `orientation` ΔΕΝ ΕΙΝΑΙ ΤΟ `type` ΠΟΥ ΑΠΑΓΟΡΕΥΕΙ ΤΟ SpendAnalyticsChart
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `SpendAnalyticsChart` δηλώνει ρητά ότι **δεν** δέχεται `type`, `showLegend`
 * ή `showTooltip` — σημάδια ότι το κέλυφος ξαναγίνεται `ReportChart.tsx`. Η
 * διάκριση του ADR-698 είναι *δεδομένα ναι, μηχανισμός όχι*:
 *
 * - ❌ `showLegend` = ο καλών **αποφασίζει συμπεριφορά** που το κέλυφος όφειλε
 *   να συμπεράνει (το υπόμνημα βγαίνει επειδή οι σειρές είναι δύο).
 * - ✅ `orientation` = **γεωμετρία των δεδομένων**. Δεν ανάβει λειτουργία· λέει
 *   σε ποιον άξονα κάθεται η κατηγορία. Είναι η ίδια διάκριση που κάνει και το
 *   Excel ονομάζοντας δύο ξεχωριστά αντικείμενα «Column» και «Bar», και το ίδιο
 *   το recharts με το `layout`.
 *
 * 🔑 **Ο κανόνας παραμονής**: αν κάποτε μπει εδώ boolean, ή prop που δέχεται
 * **συνάρτηση** αντί για τιμή, το αρχείο έγινε fabrique και πρέπει να σπάσει.
 *
 * ⚠️ **Η ορολογία δεν είναι του recharts.** Το recharts λέει
 * `layout="vertical"` για μπάρες που δείχνουν **οριζόντια** — ονομάζει τη
 * διάταξη των *κατηγοριών*, όχι των μπαρών, και μπερδεύει κάθε αναγνώστη. Εδώ
 * το όνομα περιγράφει **ό,τι βλέπει ο χρήστης**· η μετάφραση προς recharts
 * γίνεται σε ένα σημείο, παρακάτω.
 *
 * @module app/procurement/analytics/_components/SpendTopBarChart
 * @see ADR-331 §2.5, §4 D4, D5, D22, D23 · ADR-710 (chart-card shell)
 * @see ADR-698 (δευτεροτάξια fabrique) · ADR-742 §7quaterdecies
 */

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartCardTooltip,
  seriesColorVar,
  type ChartCardFigureSize,
  type ChartSeries,
} from '@/components/ui/chart-card';
import { SpendAnalyticsChart } from './SpendAnalyticsChart';
import { useDrillDownToPurchaseOrders, type ChartDrillDown } from './useDrillDownToPurchaseOrders';
import {
  CHART_MARGIN,
  EUR_NUMERIC_X_AXIS,
  EUR_VALUE_AXIS,
  ROTATED_CATEGORY_AXIS,
  formatEur,
} from './chart-utils';

/**
 * `columns` = κατακόρυφες στήλες, κατηγορία στον οριζόντιο άξονα (η συνήθης).
 * `bars`    = οριζόντιες μπάρες, κατηγορία στον κατακόρυφο άξονα — για μακριές
 *             ετικέτες που δεν χωρούν γυρισμένες κάτω από τον άξονα.
 */
export type SpendBarOrientation = 'columns' | 'bars';

/**
 * Πλάτος του άξονα κατηγορίας όταν οι ετικέτες κάθονται αριστερά (`bars`).
 * Ονομασμένη σταθερά, όχι ελεύθερος αριθμός στη σύνθεση: αν αλλάξει, αλλάζει
 * για **κάθε** οριζόντιο γράφημα δαπανών μαζί.
 */
const CATEGORY_AXIS_WIDTH = 140;

/** Το ανώτατο πάχος στήλης — χωρίς αυτό, τρεις προμηθευτές δίνουν τρεις κολόνες. */
const MAX_COLUMN_SIZE = 36;

const RADIUS_COLUMNS: readonly [number, number, number, number] = [3, 3, 0, 0];
const RADIUS_BARS: readonly [number, number, number, number] = [0, 3, 3, 0];

export interface SpendTopBarChartProps<TRow extends object> {
  /** Τίτλος της κάρτας — ήδη μεταφρασμένος. Ονομάζει και τη σειρά. */
  readonly title: string;
  /** Μήνυμα όταν δεν υπάρχει τίποτα να σχεδιαστεί — ήδη μεταφρασμένο. */
  readonly emptyMessage: string;
  /** Επικεφαλίδα της στήλης κατηγορίας στον προσβάσιμο πίνακα δεδομένων. */
  readonly categoryLabel: string;
  /** Οι γραμμές, σε σειρά σχεδίασης (ο aggregator τις δίνει ήδη ταξινομημένες). */
  readonly rows: readonly TRow[];
  /** Το πεδίο που ονομάζει την κατηγορία στην οθόνη. */
  readonly categoryKey: Extract<keyof TRow, string>;
  /** Το πεδίο που κουβαλά το ποσό. */
  readonly valueKey: Extract<keyof TRow, string>;
  /** Σε ποιον άξονα κάθεται η κατηγορία. */
  readonly orientation: SpendBarOrientation;
  /** Πού οδηγεί το κλικ σε μπάρα. */
  readonly drillDown: ChartDrillDown;
  /** Κατάσταση φόρτωσης **της κάρτας** — κάθε γράφημα φορτώνει ανεξάρτητα. */
  readonly isLoading: boolean;
  /** Ονομασμένο βήμα ύψους. */
  readonly size?: ChartCardFigureSize;
  /** Πέρασμα από τη σελίδα (π.χ. `col-span-full`). */
  readonly className?: string;
}

export function SpendTopBarChart<TRow extends object>({
  title,
  emptyMessage,
  categoryLabel,
  rows,
  categoryKey,
  valueKey,
  orientation,
  drillDown,
  isLoading,
  size,
  className,
}: SpendTopBarChartProps<TRow>) {
  const series = useMemo<readonly ChartSeries<TRow>[]>(
    () => [{ key: valueKey, label: title }],
    [valueKey, title],
  );

  const handleBarClick = useDrillDownToPurchaseOrders(drillDown);

  const isBars = orientation === 'bars';

  return (
    <SpendAnalyticsChart
      className={className}
      isLoading={isLoading}
      series={series}
      data={rows}
      categoryKey={categoryKey}
      categoryLabel={categoryLabel}
      formatValue={formatEur}
      title={title}
      emptyMessage={emptyMessage}
      size={size}
    >
      {/* Η μοναδική μετάφραση προς την ορολογία του recharts — βλ. επικεφαλίδα. */}
      <BarChart data={rows} layout={isBars ? 'vertical' : 'horizontal'} margin={CHART_MARGIN}>
        {/* Οι γραμμές του πλέγματος τρέχουν **κάθετα** στις μπάρες, ποτέ κατά μήκος. */}
        <CartesianGrid strokeDasharray="3 3" horizontal={!isBars} vertical={isBars} />
        {isBars ? (
          <XAxis {...EUR_NUMERIC_X_AXIS} />
        ) : (
          <XAxis dataKey={categoryKey} {...ROTATED_CATEGORY_AXIS} />
        )}
        {isBars ? (
          <YAxis
            type="category"
            dataKey={categoryKey}
            tick={{ fontSize: 11 }}
            width={CATEGORY_AXIS_WIDTH}
          />
        ) : (
          <YAxis {...EUR_VALUE_AXIS} />
        )}
        <ChartCardTooltip />
        <Bar
          dataKey={valueKey}
          fill={seriesColorVar(valueKey)}
          radius={isBars ? RADIUS_BARS : RADIUS_COLUMNS}
          maxBarSize={isBars ? undefined : MAX_COLUMN_SIZE}
          cursor="pointer"
          onClick={handleBarClick}
        />
      </BarChart>
    </SpendAnalyticsChart>
  );
}
