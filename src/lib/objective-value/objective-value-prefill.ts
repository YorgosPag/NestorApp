/**
 * @fileoverview **Η αγγελία ανοίγει τον υπολογιστή ήδη συμπληρωμένο** — ό,τι ξέρει η αγγελία, στη διεύθυνση του
 * υπολογιστή, ώστε ο αγοραστής να απαντήσει **μόνο** όσα έμειναν ανοιχτά (ADR-898 Φ3).
 * @related `listing-objective-value.ts` (ο συνθέτης στον server) · `lib/listings/listing-routes.ts` (`objectiveValueHref`) ·
 *   `components/objective-value/useObjectiveValuePrefill.ts` (ο αναγνώστης στον browser)
 * @module lib/objective-value/objective-value-prefill
 *
 * 🔑 **ΜΙΑ δήλωση και για τις δύο κατευθύνσεις** (γραφή στον server, ανάγνωση στον browser): αλλιώς δύο ονόματα
 * παραμέτρων θα μπορούσαν να αποκλίνουν σιωπηλά.
 *
 * 🔑 **Μόνο ό,τι είναι ήδη δημόσιο στην αγγελία** (θέση ακριβείας διεύθυνσης, όροφος, εμβαδόν, θέρμανση,
 * ανελκυστήρας, και οι **δηλώσεις** του αγγελιοδότη — ADR-898 Φ3β: πρόσοψη, ημερομηνία άδειας, μικτά με κοινόχρηστους).
 * Η ημερομηνία άδειας προσυμπληρώνεται **μόνο όταν δηλώθηκε**: η προσέγγιση από το έτος κατασκευής δεν έχει θέση στον
 * υπολογιστή, που ζητά τη **νόμιμη** ημερομηνία.
 *
 * ⚠️ **Η ανάγνωση είναι αυστηρή**: μια τιμή που δεν περνά τον έλεγχο **αγνοείται** (ο άνθρωπος θα τη ρωτηθεί), ποτέ δεν
 * «διορθώνεται». Η διεύθυνση είναι είσοδος από οποιονδήποτε.
 */

import { isDateKey } from '@/lib/calendar/date-key';
import type { GeoPoint } from '@/types/geo/coordinates';

import type { ObjectiveValueDraft } from './objective-value-draft';
import { OBJECTIVE_VALUE_FORMS, RESIDENCE_FRONTAGES, type ObjectiveValueForm, type ResidenceFrontage } from './objective-value-types';

export interface ObjectiveValuePrefill {
  /** Το σημείο της αγγελίας — μόνο όταν είναι η ίδια η διεύθυνση (`valueZonePointOf`). */
  readonly point: GeoPoint | null;
  readonly form: ObjectiveValueForm;
  readonly floor: number | null;
  readonly area: number | null;
  readonly hasCentralHeating: boolean | null;
  readonly hasElevator: boolean | null;
  readonly frontage: ResidenceFrontage | null;
  /** Μόνο **δηλωμένη** — ποτέ η προσέγγιση από το έτος κατασκευής. */
  readonly permitDate: string | null;
  /** Μόνο **δηλωμένο** — η κανονική περίπτωση («όχι») δεν προσυμπληρώνεται, είναι ήδη η προεπιλογή. */
  readonly areaIncludesCommon: boolean | null;
}

/** Τα ονόματα των παραμέτρων — η ΜΙΑ δήλωση. */
const PARAM = {
  lat: 'lat',
  lng: 'lng',
  form: 'form',
  floor: 'floor',
  area: 'area',
  heating: 'heating',
  elevator: 'elevator',
  frontage: 'frontage',
  permit: 'permit',
  common: 'common',
} as const;

const MAX_FLOOR = 99;
const MIN_FLOOR = -9;

function flag(value: boolean): string {
  return value ? '1' : '0';
}

/** Το ερώτημα της διεύθυνσης του υπολογιστή (χωρίς `?`). Κενό ⇒ τίποτα δεν προσυμπληρώνεται. */
export function serializeObjectiveValuePrefill(prefill: ObjectiveValuePrefill): string {
  const params = new URLSearchParams();
  if (prefill.point !== null) {
    params.set(PARAM.lat, prefill.point.lat.toFixed(6));
    params.set(PARAM.lng, prefill.point.lng.toFixed(6));
  }
  params.set(PARAM.form, prefill.form);
  if (prefill.floor !== null) params.set(PARAM.floor, String(prefill.floor));
  if (prefill.area !== null) params.set(PARAM.area, String(prefill.area));
  if (prefill.hasCentralHeating !== null) params.set(PARAM.heating, flag(prefill.hasCentralHeating));
  if (prefill.hasElevator !== null) params.set(PARAM.elevator, flag(prefill.hasElevator));
  if (prefill.frontage !== null) params.set(PARAM.frontage, prefill.frontage);
  if (prefill.permitDate !== null) params.set(PARAM.permit, prefill.permitDate);
  if (prefill.areaIncludesCommon !== null) params.set(PARAM.common, flag(prefill.areaIncludesCommon));
  return params.toString();
}

function finite(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function pointOf(params: URLSearchParams): GeoPoint | null {
  const lat = finite(params.get(PARAM.lat));
  const lng = finite(params.get(PARAM.lng));
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function flagOf(raw: string | null): boolean | null {
  if (raw === '1') return true;
  if (raw === '0') return false;
  return null;
}

function floorOf(raw: string | null): number | null {
  const floor = finite(raw);
  return floor !== null && Number.isInteger(floor) && floor >= MIN_FLOOR && floor <= MAX_FLOOR ? floor : null;
}

function areaOf(raw: string | null): number | null {
  const area = finite(raw);
  return area !== null && area > 0 ? area : null;
}

/** Οι δηλώσεις του αγγελιοδότη (ADR-898 Φ3β) — καθεμία αυστηρά: άκυρη ⇒ αγνοείται. */
function declaredOf(params: URLSearchParams): Partial<ObjectiveValueDraft> {
  const frontage = RESIDENCE_FRONTAGES.find((candidate) => candidate === params.get(PARAM.frontage));
  const permit = params.get(PARAM.permit);
  const common = flagOf(params.get(PARAM.common));
  return {
    ...(frontage === undefined ? {} : { frontage }),
    ...(isDateKey(permit) ? { permitDate: permit } : {}),
    ...(common === null ? {} : { areaIncludesCommon: common }),
  };
}

export interface ParsedObjectiveValuePrefill {
  readonly point: GeoPoint | null;
  /** Ό,τι μπαίνει στο πρόχειρο — μόνο πεδία που πέρασαν τον έλεγχο. */
  readonly draft: Partial<ObjectiveValueDraft>;
}

/** Η ανάγνωση του ερωτήματος· `null` όταν δεν υπάρχει προσυμπλήρωση (δεν δηλώνει είδος). */
export function parseObjectiveValuePrefill(search: string): ParsedObjectiveValuePrefill | null {
  const params = new URLSearchParams(search);
  const form = OBJECTIVE_VALUE_FORMS.find((candidate) => candidate === params.get(PARAM.form));
  if (form === undefined) return null;
  const floor = floorOf(params.get(PARAM.floor));
  const area = areaOf(params.get(PARAM.area));
  const heating = flagOf(params.get(PARAM.heating));
  const elevator = flagOf(params.get(PARAM.elevator));
  const draft: Partial<ObjectiveValueDraft> = {
    form,
    ...(form === 'residence' ? { levels: [{ floor, area }] } : { area }),
    ...(heating === null ? {} : { hasCentralHeating: heating }),
    ...(elevator === null ? {} : { hasElevator: elevator }),
    ...declaredOf(params),
  };
  return { point: pointOf(params), draft };
}
