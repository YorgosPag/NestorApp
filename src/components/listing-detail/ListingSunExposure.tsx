'use client';

/**
 * **Ο ηλιασμός στη δημόσια αγγελία** (ADR-937 Φάση Α) — αντί για «ΝΔ», ο αγοραστής διαβάζει *πόσο ήλιο* παίρνει το
 * ακίνητο και *πότε μέσα στη μέρα*, χειμώνα · ισημερία · καλοκαίρι, δίπλα σε μια μικρή πυξίδα με τις όψεις του.
 *
 * @related `lib/solar/facade-sun-exposure.ts` (ο υπολογισμός) · `constants/orientation-compass.ts` (η διάταξη της
 *   πυξίδας, κοινή με τη φόρμα) · `./ListingEnergyCertificate.tsx` (το ίδιο σχήμα ενότητας)
 *
 * 🔑 **Καμία σιωπηλή μαντεψιά.** Χωρίς δηλωμένες όψεις **ή** χωρίς γνωστή θέση η ενότητα **δεν αποδίδεται** — ένα
 *    πλάτος «περίπου Ελλάδα» θα ήταν αριθμός που μοιάζει με γεγονός.
 * ⚠️ **Είναι εκτίμηση και το λέει**: δεν ξέρει σκιές γειτονικών κτιρίων (το ίδιο όριο που ομολογεί και το Redfin Sunscore
 *    για το εσωτερικό). Η σημείωση είναι μέρος της ενότητας, όχι υποσημείωση που μπορεί να λείψει.
 * 🔑 Κάθε κλειδί i18n είναι **κυριολεκτικό** μέσα στην κλήση (βλ. `ListingEnergyCertificate` — κλειδί από μεταβλητή μένει
 *    ανεπίλυτο για τον γεννήτορα του slice).
 */

import React from 'react';

import { COMPASS_GRID_LAYOUT } from '@/constants/orientation-compass';
import type { OrientationType } from '@/constants/property-features-enterprise';
import { SectionFrame } from '@/components/ui/section-frame';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  facadeSunExposure,
  type DayPeriod,
  type SeasonSunExposure,
  type SunSeason,
} from '@/lib/solar/facade-sun-exposure';
import { cn } from '@/lib/utils';
import type { PublicListing } from '@/types/public-listing';

type Translate = (key: string, options?: Record<string, unknown>) => string;

function seasonLabel(t: Translate, season: SunSeason): string {
  switch (season) {
    case 'winter':
      return t('listing-detail:sunExposure.season.winter');
    case 'equinox':
      return t('listing-detail:sunExposure.season.equinox');
    case 'summer':
      return t('listing-detail:sunExposure.season.summer');
  }
}

function periodLabel(t: Translate, period: DayPeriod): string {
  switch (period) {
    case 'morning':
      return t('listing-detail:sunExposure.period.morning');
    case 'midday':
      return t('listing-detail:sunExposure.period.midday');
    case 'afternoon':
      return t('listing-detail:sunExposure.period.afternoon');
  }
}

function exposureText(t: Translate, row: SeasonSunExposure): string {
  if (row.sunHours === 0) return t('listing-detail:sunExposure.noDirectSun');
  const hours = t('listing-detail:sunExposure.hours', { count: row.sunHours });
  if (row.periods.length === 0) return hours;
  return t('listing-detail:sunExposure.hoursWithPeriods', {
    hours,
    periods: row.periods.map((p) => periodLabel(t, p)).join(', '),
  });
}

/** Μικρή πυξίδα, μόνο για ανάγνωση: οι όψεις του ακινήτου τονισμένες. Διακοσμητική — το κείμενο λέει τα ίδια. */
function FacadeCompass({ orientations }: { readonly orientations: readonly OrientationType[] }) {
  const { t } = useTranslation(['properties-enums']);
  return (
    <span aria-hidden="true" className="grid w-fit shrink-0 grid-cols-3 gap-0.5 text-xs">
      {COMPASS_GRID_LAYOUT.map((orientation) => (
        <span
          key={orientation ?? 'center'}
          className={cn(
            'flex h-6 w-8 items-center justify-center rounded-sm border border-border text-muted-foreground',
            orientation !== null && orientations.includes(orientation) && COLOR_BRIDGE.selectionControl.pressed,
          )}
        >
          {orientation === null ? '◎' : t(`properties-enums:orientation.short.${orientation}`)}
        </span>
      ))}
    </span>
  );
}

export function ListingSunExposure({ listing }: { readonly listing: PublicListing }) {
  const { t } = useTranslation(['listing-detail']);
  const orientations = listing.orientations ?? [];
  const latDeg = listing.position.kind === 'known' ? listing.position.point.lat : Number.NaN;
  const exposure = facadeSunExposure(latDeg, orientations);
  if (exposure === null) return null;

  return (
    <SectionFrame
      headingId="listing-sun-exposure-heading"
      title={t('listing-detail:sunExposure.heading')}
      headingLevel="h2"
      titleSize="sm"
    >
      <section className="mt-3 flex flex-wrap items-start gap-4">
        <FacadeCompass orientations={orientations} />
        <dl className="min-w-0 space-y-1">
          {exposure.map((row) => (
            <div key={row.season} className="flex flex-wrap items-baseline gap-x-3">
              <dt className="text-sm text-muted-foreground">{seasonLabel(t, row.season)}</dt>
              <dd className="text-sm font-medium text-foreground">{exposureText(t, row)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <p className="m-0 mt-2 text-xs text-muted-foreground">{t('listing-detail:sunExposure.disclaimer')}</p>
    </SectionFrame>
  );
}
