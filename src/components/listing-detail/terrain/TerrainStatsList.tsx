'use client';

/**
 * @fileoverview **Το έδαφος με αριθμούς** — ό,τι διαβάζει ο αγοραστής με μια ματιά: έκταση, υψόμετρο, υψομετρική διαφορά,
 * κλίση, προς τα πού κατηφορίζει, ισοδιάσταση (ADR-920 Β4.9).
 * @related lib/terrain/publication/listing-terrain-types (`ListingTerrainStats` — οι αριθμοί, ένας υπολογισμός) ·
 *   lib/terrain/publication/listing-terrain-card (η κάρτα της αγγελίας τους κουβαλά) ·
 *   lib/terrain/publication/terrain-downslope-orientation (αζιμούθιο → ένας από τους οκτώ προσανατολισμούς) ·
 *   ./terrain-map-words (οι ΙΔΙΕΣ λέξεις με τον χάρτη)
 * @module components/listing-detail/terrain/TerrainStatsList
 *
 * 🔑 **Μία όψη, τρεις αναγνώστες**: η προεπισκόπηση του ιδιοκτήτη («αυτό θα δει ο αγοραστής»), το «δημοσιευμένο τώρα» και
 *   η δημόσια αγγελία (Β5) — πάντα από τους ΙΔΙΟΥΣ αριθμούς του στιγμιοτύπου, ποτέ από δεύτερο υπολογισμό.
 * 🔑 Χωρίς δική του επικεφαλίδα: τη δίνει η ενότητα που τη φιλοξενεί.
 * 🔑 **Κειμενική εναλλακτική του χάρτη** (WAI «σύνθετες εικόνες»): ό,τι λέει ο χάρτης με χρώμα, το λέει εδώ με λέξεις.
 * 📐 Υψόμετρα με ακρίβεια δεκατόμετρου, κλίσεις σε ακέραιο ποσοστό, εμβαδόν σε ακέραιο m² — η ακρίβεια που έχει νόημα
 *   για αγοραστή, όχι όση υπάρχει στη μνήμη.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber, formatPercentage } from '@/lib/intl-formatting';
import type { ListingTerrainStats } from '@/lib/terrain/publication/listing-terrain-types';
import { downslopeOrientationOf } from '@/lib/terrain/publication/terrain-downslope-orientation';

import { lengthLabel, metresOf } from './terrain-map-words';

const NS = 'listing-detail:terrain.stats';

/** Το βήμα στρογγύλευσης υψομέτρων — δεκατόμετρο. */
const ELEVATION_STEP_M = 0.1;

export interface TerrainStatsListProps {
  readonly stats: ListingTerrainStats;
  readonly contourIntervalM: number;
}

function Fact({ term, value }: { readonly term: string; readonly value: string }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="m-0 text-sm font-medium tabular-nums text-foreground">{value}</dd>
    </>
  );
}

export function TerrainStatsList({ stats, contourIntervalM }: TerrainStatsListProps) {
  const { t } = useTranslation('listing-detail');
  const percent = (value: number) => formatPercentage(value, { maximumFractionDigits: 0 });
  const orientation = downslopeOrientationOf(stats.downslopeAzimuthDeg);
  const range = t(`${NS}.elevationRange`, {
    min: metresOf(stats.minElevationM, ELEVATION_STEP_M),
    max: lengthLabel(t, stats.maxElevationM, ELEVATION_STEP_M),
  });
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1">
      <Fact term={t(`${NS}.area`)} value={t(`${NS}.areaValue`, { value: formatNumber(stats.planAreaM2, { maximumFractionDigits: 0 }) })} />
      <Fact term={t(`${NS}.elevation`)} value={range} />
      <Fact term={t(`${NS}.relief`)} value={lengthLabel(t, stats.reliefM, ELEVATION_STEP_M)} />
      <Fact term={t(`${NS}.meanSlope`)} value={percent(stats.meanSlopePct)} />
      <Fact term={t(`${NS}.maxSlope`)} value={percent(stats.maxSlopePct)} />
      <Fact term={t(`${NS}.downslope`)} value={orientation === null ? t(`${NS}.flat`) : t(`${NS}.towards.${orientation}`)} />
      <Fact term={t(`${NS}.contourInterval`)} value={lengthLabel(t, contourIntervalM)} />
    </dl>
  );
}
