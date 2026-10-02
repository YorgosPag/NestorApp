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
 * 🔑 **Πολυεπίπεδη κατοικία** (ADR-898 Φ3β-3β): `levels=-1:40,0:60` (όροφος:μικτό ανά επίπεδο) **αντί** για `floor`/`area`,
 * μόνο όταν η βάση ανά όροφο είναι **πλήρης**. Ένα επίπεδο κρατά τις παλιές παραμέτρους ⇒ οι παλιοί σύνδεσμοι δουλεύουν.
 *
 * ⚠️ **Η ανάγνωση είναι αυστηρή**: μια τιμή που δεν περνά τον έλεγχο **αγνοείται** (ο άνθρωπος θα τη ρωτηθεί), ποτέ δεν
 * «διορθώνεται». Η διεύθυνση είναι είσοδος από οποιονδήποτε.
 */

import { isDateKey } from '@/lib/calendar/date-key';
import type { GeoPoint } from '@/types/geo/coordinates';

import type { LevelDraft, ObjectiveValueDraft } from './objective-value-draft';
import { OBJECTIVE_VALUE_FORMS, RESIDENCE_FRONTAGES, type ObjectiveValueForm, type ResidenceFrontage } from './objective-value-types';

export interface ObjectiveValuePrefill {
  /** Το σημείο της αγγελίας — μόνο όταν είναι η ίδια η διεύθυνση (`valueZonePointOf`). */
  readonly point: GeoPoint | null;
  readonly form: ObjectiveValueForm;
  readonly floor: number | null;
  readonly area: number | null;
  /** Πολυεπίπεδη κατοικία με **πλήρη** βάση ανά όροφο — τότε `floor`/`area` = `null`. `null` = ένα επίπεδο. */
  readonly levels: readonly LevelDraft[] | null;
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
  levels: 'levels',
  heating: 'heating',
  elevator: 'elevator',
  frontage: 'frontage',
  permit: 'permit',
  common: 'common',
} as const;

const MAX_FLOOR = 99;
const MIN_FLOOR = -9;
/** Πάνω όριο επιπέδων στη διεύθυνση — άμυνα απέναντι σε είσοδο από οποιονδήποτε, όχι κανόνας του νόμου. */
const MAX_LEVELS = 9;
const LEVEL_SEPARATOR = ',';
const PAIR_SEPARATOR = ':';

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
  if (prefill.levels !== null) {
    params.set(PARAM.levels, prefill.levels.map((level) => `${level.floor}${PAIR_SEPARATOR}${level.area}`).join(LEVEL_SEPARATOR));
  }
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

/** `όροφος:μικτό` ανά επίπεδο — **όλα ή τίποτα**: 2…{@link MAX_LEVELS} έγκυρα ζεύγη, χωρίς διπλό όροφο, αλλιώς `null`. */
function levelsOf(raw: string | null): readonly LevelDraft[] | null {
  if (raw === null) return null;
  const pairs = raw.split(LEVEL_SEPARATOR);
  if (pairs.length < 2 || pairs.length > MAX_LEVELS) return null;
  const levels: LevelDraft[] = [];
  for (const pair of pairs) {
    const [floorRaw = null, areaRaw = null, extra] = pair.split(PAIR_SEPARATOR);
    const floor = floorOf(floorRaw);
    const area = areaOf(areaRaw);
    if (extra !== undefined || floor === null || area === null) return null;
    levels.push({ floor, area });
  }
  return new Set(levels.map((level) => level.floor)).size === levels.length ? levels : null;
}

/** Τα επίπεδα της κατοικίας: η πλήρης λίστα, αλλιώς το ένα επίπεδο από `floor`/`area`. */
function residenceLevelsOf(params: URLSearchParams): readonly LevelDraft[] {
  return levelsOf(params.get(PARAM.levels)) ?? [{ floor: floorOf(params.get(PARAM.floor)), area: areaOf(params.get(PARAM.area)) }];
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
  const heating = flagOf(params.get(PARAM.heating));
  const elevator = flagOf(params.get(PARAM.elevator));
  const draft: Partial<ObjectiveValueDraft> = {
    form,
    ...(form === 'residence' ? { levels: residenceLevelsOf(params) } : { area: areaOf(params.get(PARAM.area)) }),
    ...(heating === null ? {} : { hasCentralHeating: heating }),
    ...(elevator === null ? {} : { hasElevator: elevator }),
    ...declaredOf(params),
  };
  return { point: pointOf(params), draft };
}
