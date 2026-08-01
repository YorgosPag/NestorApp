/**
 * chart-utils — Shared helpers for the spend analytics chart components.
 *
 * - `formatEurShort` compact axis-tick formatter (€ short form).
 * - `buildPurchaseOrdersUrl` SSoT drill-down URL builder; reuses
 *   `serializeFilterArray` from `@/lib/url-filters/multi-value`.
 * - `readClickedRow` typed Recharts onClick payload reader (no `any`).
 * - `truncateLabel` short axis label truncation.
 *
 * @see ADR-331 §2.7 (drill-down) · §4 D5
 */

import { serializeFilterArray } from '@/lib/url-filters/multi-value';
import { formatCurrency } from '@/lib/intl-formatting';
import type { SpendAnalyticsFilters } from '@/services/procurement/aggregators/spendAnalyticsAggregator';

const PO_LIST_PATH = '/procurement/purchase-orders';

export function formatEurShort(n: number): string {
  if (!Number.isFinite(n)) return '0€';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K€`;
  return `${n.toFixed(0)}€`;
}

export type PurchaseOrdersUrlOverride = Partial<
  Pick<SpendAnalyticsFilters, 'projectId' | 'supplierId' | 'categoryCode'>
>;

/**
 * Τα φίλτρα της λίστας που ένα γράφημα μπορεί να **στοχεύσει** με κλικ.
 * Παράγεται από το override — δεν ξαναγράφεται ως δεύτερη λίστα που θα αποκλίνει.
 */
export type PurchaseOrdersFilterKey = keyof PurchaseOrdersUrlOverride;

export function buildPurchaseOrdersUrl(
  filters: SpendAnalyticsFilters,
  overrides: PurchaseOrdersUrlOverride,
): string {
  const params = new URLSearchParams();
  params.set('from', filters.from);
  params.set('to', filters.to);
  const arrays: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['projectId', overrides.projectId ?? filters.projectId],
    ['supplierId', overrides.supplierId ?? filters.supplierId],
    ['categoryCode', overrides.categoryCode ?? filters.categoryCode],
    ['status', filters.status],
  ];
  for (const [key, values] of arrays) {
    const serialized = serializeFilterArray(values);
    if (serialized) params.set(key, serialized);
  }
  return `${PO_LIST_PATH}?${params.toString()}`;
}

export function readClickedRowKey(payload: unknown, key: string): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function truncateLabel(label: string, max: number = 20): string {
  if (label.length <= max) return label;
  return `${label.slice(0, Math.max(1, max - 1))}…`;
}

/*
 * ⚠️ Το `CHART_FIGURE_CLASSES` ΑΦΑΙΡΕΘΗΚΕ (ADR-710, 2026-08-01).
 *
 * Έβαφε τον δρομέα του tooltip της recharts σε κάθε `<figure>` γραφήματος. Το
 * `ChartContainer` — που πλέον τα τυλίγει όλα μέσω `<ChartCard.Figure>` — γράφει
 * ήδη **τους ίδιους δύο κανόνες** (`[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted`
 * και `[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border`). Δύο δηλώσεις
 * του ίδιου κανόνα με **διαφορετική διαφάνεια** ήταν ακριβώς η σιωπηλή απόκλιση
 * που κλείνει το shell.
 */

// ============================================================================
// ΟΙ ΔΥΟ ΑΞΟΝΕΣ — μία δήλωση (ADR-742 §7quaterdecies, N.18)
// ============================================================================

/**
 * 🔴 **Η κεντρικοποίηση γέννησε τον κλώνο — όγδοη μετρημένη φορά.**
 *
 * Μόλις το πλαίσιο κάρτας, το υπόμνημα και η κενή κατάσταση έφυγαν στο
 * `<ChartCard>` (ADR-710), αυτό που έμεινε σε κάθε αρχείο ήταν **η ίδια ρύθμιση
 * άξονα**. Το `jscpd:diff` βρήκε **5 κλώνους** ανάμεσα στα πέντε γραφήματα
 * analytics — που πριν τη μετανάστευση ήταν θαμμένοι μέσα σε 40 γραμμές
 * φλοιού και δεν έφταναν το κατώφλι των 50 tokens.
 *
 * ⚠️ **Γιατί props και όχι components.** Το recharts **δεν** αποδίδει τα παιδιά
 * του απευθείας: το `generateCategoricalChart` τα ψάχνει με
 * `findAllByType(children, XAxis)`, δηλαδή **με τον τύπο**. Ένα
 * `<SpendCategoryAxis />` θα ήταν αόρατο — το γράφημα θα σχεδίαζε **χωρίς
 * άξονες**, χωρίς κανένα σφάλμα. Ίδιο σχήμα με το `displayName = 'Tooltip'`
 * του `ChartCardTooltip`.
 */

/** Άξονας κατηγορίας με **περιστροφή**: πολλές μακριές ετικέτες σε λίγο πλάτος. */
export const ROTATED_CATEGORY_AXIS = {
  tick: { fontSize: 11 },
  interval: 0 as const,
  angle: -25,
  textAnchor: 'end' as const,
  height: 56,
};

/** Άξονας ποσών σε ευρώ, με τη σύντομη μορφή (`1,2M€`). */
export const EUR_VALUE_AXIS = {
  tickFormatter: formatEurShort,
  tick: { fontSize: 11 },
  width: 56,
};

/**
 * Η **πλήρης** μορφή ποσού (`1.234,56 €`) — tooltip και πίνακας δεδομένων.
 *
 * Ήταν γραμμένη ως ανώνυμο βέλος `(v) => formatCurrency(v, 'EUR')` σε **πέντε**
 * αρχεία. Το `formatEurShort` από πάνω είναι η **σύντομη** μορφή για τα σημάδια
 * άξονα: δύο διαφορετικές μορφές με διαφορετικό σκοπό, μία δήλωση η καθεμία.
 */
export function formatEur(value: number): string {
  return formatCurrency(value, 'EUR');
}

/**
 * Το περιθώριο σχεδίασης — γραμμένο **πανομοιότυπα** σε τέσσερα γραφήματα.
 * Μικρό, αλλά ένα από τα τέσσερα θα αποκλίνει κάποτε και η στοίχιση των καρτών
 * στο πλέγμα θα σπάσει χωρίς να το δει κανείς.
 */
export const CHART_MARGIN = { top: 8, right: 16, left: 4, bottom: 16 };

/**
 * Άξονας **ποσών ως τιμή x** (οριζόντιες μπάρες): αριθμητικός, με τη σύντομη
 * μορφή ευρώ. Αντίστροφος του {@link EUR_VALUE_AXIS}, που είναι κατακόρυφος.
 */
export const EUR_NUMERIC_X_AXIS = {
  type: 'number' as const,
  tickFormatter: formatEurShort,
  tick: { fontSize: 11 },
};
