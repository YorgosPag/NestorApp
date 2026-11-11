/**
 * @fileoverview **ΗΛΙΑΣΜΟΣ ΟΨΕΩΝ** — πόσες ώρες άμεσου ήλιου παίρνουν οι όψεις ενός ακινήτου, και πότε μέσα στη μέρα.
 * @related ADR-937 Φάση Α · lib/solar/solar-position (θέση ήλιου) · lib/geometry/azimuth-orientation (όψη → αζιμούθιο) ·
 *   components/listing-detail/ListingSunExposure (ο αναγνώστης)
 * @module lib/solar/facade-sun-exposure
 *
 * 🔑 **Τι μετρά.** Μια κατακόρυφη όψη με εξωτερική κάθετο στο αζιμούθιο της δηλωμένης κατεύθυνσης «βλέπει» τον ήλιο όταν
 *    ο ήλιος είναι **πάνω από τον ορίζοντα** και **μπροστά της** (γωνία ήλιου–καθέτου < 90°). Οι όψεις ενώνονται: μια
 *    στιγμή με ήλιο σε δύο όψεις μετρά **μία** φορά. Δειγματοληψία ανά 10′ σε **τρεις** χαρακτηριστικές μέρες.
 * 🔑 **Ηλιακή ώρα** (12 = ηλιακό μεσημέρι): καμία ζώνη ώρας, κανένα γεωγραφικό μήκος — μόνο το πλάτος αλλάζει το αποτέλεσμα.
 * ⚠️ **Τι ΔΕΝ μετρά**: σκιές από γειτονικά κτίρια, βουνά, δέντρα, προεξοχές. Είναι **εκτίμηση από τον προσανατολισμό** και
 *    έτσι πρέπει να παρουσιάζεται — ποτέ ως μέτρηση.
 */

import type { OrientationType } from '@/constants/property-features-enterprise';
import { azimuthOfOrientation } from '@/lib/geometry/azimuth-orientation';
import { solarPositionAtSolarHour } from '@/lib/solar/solar-position';

/** Οι τρεις χαρακτηριστικές μέρες: χειμερινό ηλιοστάσιο, ισημερία, θερινό ηλιοστάσιο. */
export const SUN_SEASONS = ['winter', 'equinox', 'summer'] as const;
export type SunSeason = typeof SUN_SEASONS[number];

const SEASON_DAY_OF_YEAR: Readonly<Record<SunSeason, number>> = { winter: 355, equinox: 80, summer: 172 };

/** Τα τμήματα της μέρας, σε ηλιακή ώρα: πρωί έως 11:00, μεσημέρι 11:00–15:00, απόγευμα μετά τις 15:00. */
export const DAY_PERIODS = ['morning', 'midday', 'afternoon'] as const;
export type DayPeriod = typeof DAY_PERIODS[number];

const MIDDAY_START_HOUR = 11;
const AFTERNOON_START_HOUR = 15;
const SAMPLE_MINUTES = 10;
/** Ένα τμήμα της μέρας «έχει ήλιο» όταν μαζεύει τουλάχιστον τόσα λεπτά — κάτω από αυτό είναι θόρυβος. */
const PERIOD_MIN_MINUTES = 30;

export interface SeasonSunExposure {
  readonly season: SunSeason;
  /** Ώρες άμεσου ήλιου, στρογγυλεμένες στη μισή ώρα. */
  readonly sunHours: number;
  /** Τα τμήματα της μέρας με ήλιο, με τη σειρά της μέρας. */
  readonly periods: readonly DayPeriod[];
}

function periodOf(solarHour: number): DayPeriod {
  if (solarHour < MIDDAY_START_HOUR) return 'morning';
  return solarHour < AFTERNOON_START_HOUR ? 'midday' : 'afternoon';
}

/** Είναι ο ήλιος μπροστά από έστω μία από τις όψεις; (γωνία ήλιου–καθέτου < 90° ⇔ θετικό συνημίτονο) */
function facesSun(sunAzimuthDeg: number, facadeAzimuthsDeg: readonly number[]): boolean {
  return facadeAzimuthsDeg.some((facade) => Math.cos(((sunAzimuthDeg - facade) * Math.PI) / 180) > 0);
}

function seasonExposure(season: SunSeason, latDeg: number, facadeAzimuthsDeg: readonly number[]): SeasonSunExposure {
  const minutesByPeriod: Record<DayPeriod, number> = { morning: 0, midday: 0, afternoon: 0 };
  const doy = SEASON_DAY_OF_YEAR[season];
  for (let minute = SAMPLE_MINUTES / 2; minute < 24 * 60; minute += SAMPLE_MINUTES) {
    const solarHour = minute / 60;
    const sun = solarPositionAtSolarHour(doy, solarHour, latDeg);
    if (sun.elevationDeg > 0 && facesSun(sun.azimuthDeg, facadeAzimuthsDeg)) {
      minutesByPeriod[periodOf(solarHour)] += SAMPLE_MINUTES;
    }
  }
  const totalMinutes = DAY_PERIODS.reduce((sum, p) => sum + minutesByPeriod[p], 0);
  return {
    season,
    sunHours: Math.round(totalMinutes / 30) / 2,
    periods: DAY_PERIODS.filter((p) => minutesByPeriod[p] >= PERIOD_MIN_MINUTES),
  };
}

/**
 * Ηλιασμός των όψεων στις τρεις χαρακτηριστικές μέρες, ή `null` όταν δεν υπάρχει τίποτα να υπολογιστεί
 * (καμία όψη ή μη πεπερασμένο πλάτος) — ποτέ μαντεψιά.
 */
export function facadeSunExposure(
  latDeg: number,
  orientations: readonly OrientationType[],
): readonly SeasonSunExposure[] | null {
  if (!Number.isFinite(latDeg) || orientations.length === 0) return null;
  const facadeAzimuthsDeg = orientations.map(azimuthOfOrientation);
  return SUN_SEASONS.map((season) => seasonExposure(season, latDeg, facadeAzimuthsDeg));
}
