'use client';

/**
 * @fileoverview **ΤΟ ΥΠΟΜΝΗΜΑ ΤΩΝ ΥΨΟΜΕΤΡΩΝ** — η υψομετρική κλίμακα του χάρτη ως λωρίδα, με το χαμηλότερο και το υψηλότερο
 *   υψόμετρο σε κείμενο (ADR-920 Β6.2).
 * @related ./TerrainContourMap (ο καλών) · ./TerrainMapSvg (`ElevationLayer` — τα ίδια `band.color`) · lib/terrain/elevation-ramp
 * @module components/listing-detail/terrain/TerrainElevationLegend
 *
 * 🔑 **Λωρίδα, όχι πίνακας**: οι ζώνες είναι έως ~30 (μία ανά ισοδιάσταση). Πίνακας 30 γραμμών θα έκρυβε τον χάρτη. Η λωρίδα
 *   δείχνει τις ζώνες **στις αναλογίες τους** (πλάτος = εύρος υψομέτρου), όπως η υψομετρική κλίμακα ενός χάρτη USGS.
 * ♿ **Ποτέ μόνο χρώμα** (CHECK 3.41): η λωρίδα είναι διακοσμητική (`aria-hidden`)· οι αριθμοί είναι κείμενο. Οι ισοϋψείς με
 *   τις ετικέτες τους λένε το ίδιο πάνω στον χάρτη.
 * 🎨 Μηδέν inline style (N.3): θέσεις και χρώματα σε γνωρίσματα SVG.
 */

import type { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TerrainMapModel } from '@/lib/terrain/publication/terrain-map-model';

import { lengthLabel } from './terrain-map-words';

type T = ReturnType<typeof useTranslation>['t'];

const NS = 'listing-detail:terrain.map.elevation';
/** Αναλογίες της λωρίδας σε μονάδες SVG (κλιμακώνεται στο πλάτος του κουτιού). */
const STRIP_WIDTH = 100;
const STRIP_HEIGHT = 4;

export interface TerrainElevationLegendProps {
  readonly model: TerrainMapModel;
  readonly t: T;
}

export function TerrainElevationLegend({ model, t }: TerrainElevationLegendProps) {
  const { min, max } = model.elevationRangeM;
  const span = max - min;
  const xOf = (m: number) => (span > 0 ? ((m - min) / span) * STRIP_WIDTH : 0);
  return (
    <section className="flex flex-col gap-1" data-terrain-elevation-legend="" aria-label={t(`${NS}.caption`)}>
      <p className="m-0 text-xs font-medium text-muted-foreground">{t(`${NS}.caption`)}</p>
      <svg viewBox={`0 0 ${STRIP_WIDTH} ${STRIP_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true"
        className="block h-3 w-full rounded-sm border border-border">
        {model.elevationBands.map((band) => (
          <rect key={band.fromM} x={xOf(band.fromM)} y={0} height={STRIP_HEIGHT}
            width={span > 0 ? xOf(band.toM) - xOf(band.fromM) : STRIP_WIDTH} fill={band.color} />
        ))}
      </svg>
      <p className="m-0 flex justify-between gap-2 text-xs tabular-nums text-foreground">
        <span>{t(`${NS}.low`, { value: lengthLabel(t, min, model.contourIntervalM) })}</span>
        <span>{t(`${NS}.high`, { value: lengthLabel(t, max, model.contourIntervalM) })}</span>
      </p>
    </section>
  );
}
