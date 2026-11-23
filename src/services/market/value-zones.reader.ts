import 'server-only';

/**
 * @fileoverview **ΟΙ ΖΩΝΕΣ ΑΝΤΙΚΕΙΜΕΝΙΚΩΝ ΑΞΙΩΝ, ΔΙΑΒΑΣΜΕΝΕΣ ΑΠΟ ΤΟΝ SERVER** — η τιμή ζώνης στη θέση μιας αγγελίας
 * (ADR-889 Φ5).
 * @related `lib/market/value-zone-file.ts` (σχήμα) · `lib/market/value-zone-at-point.ts` (ο κριτής) ·
 *   `market-transactions.reader.ts` (ίδιο ιδίωμα)
 *
 * 🔑 **ΤΑ ΙΔΙΑ ΑΡΧΕΙΑ ΠΟΥ ΖΩΓΡΑΦΙΖΕΙ Ο ΧΑΡΤΗΣ** (`public/data/value-zones/`), με τον ίδιο αναγνώστη σχήματος: μια
 * αγγελία δεν μπορεί να «είναι» σε ζώνη που ο χάρτης τη δείχνει έξω.
 *
 * 🔑 **Τα αρχεία διαλέγονται με bbox από το ευρετήριο, ΟΧΙ με το `adminArea` της αγγελίας**: μια ζώνη που διασχίζει
 * όριο Δ.Ε. ζει στο αρχείο **μίας** από τις δύο, και μια αγγελία στο σύνορο θα την έχανε. Συνήθως ταιριάζουν 1–2 αρχεία.
 *
 * ⚠️ **Όριο μνήμης (LRU)**: 1.033 αρχεία, διάμεσος 10 KB, μέγιστο ~200 KB (Αθήνα) — οι αγγελίες συγκεντρώνονται.
 */

import { strictJsonShape } from '@/lib/data/json-shape';
import {
  createKeyedServerJsonFiles,
  createServerJsonFile,
  warnOnJsonFailure,
} from '@/lib/data/server-json-file';
import {
  FRONT_REACH_M,
  bboxWithin,
  valueZoneAtPoint,
  valueZonePointOf,
  type ValueZoneVerdict,
} from '@/lib/market/value-zone-at-point';
import {
  VALUE_ZONES_INDEX_PUBLIC_PATH,
  readValueZoneArea,
  readValueZonesIndex,
  valueZonesPublicPath,
  type ValueZoneArea,
  type ValueZonesIndex,
} from '@/lib/market/value-zone-file';
import { createModuleLogger } from '@/lib/telemetry';
import type { GeoPoint } from '@/types/geo/coordinates';
import type { PlacePosition } from '@/types/geo/public-place';

const logger = createModuleLogger('value-zones.reader');

const MAX_CACHED_AREAS = 256;

const INDEX = createServerJsonFile<ValueZonesIndex>({
  publicPath: VALUE_ZONES_INDEX_PUBLIC_PATH,
  build: strictJsonShape(readValueZonesIndex, 'value-zones/index.json'),
  onFailure: warnOnJsonFailure(logger, 'Δεν διαβάστηκε το ευρετήριο ζωνών αντικειμενικών αξιών'),
});

const AREAS = createKeyedServerJsonFiles<ValueZoneArea>(MAX_CACHED_AREAS, (areaId) => ({
  publicPath: valueZonesPublicPath(areaId),
  build: strictJsonShape((payload) => readValueZoneArea(payload, areaId), areaId),
  onFailure: warnOnJsonFailure(logger, 'Δεν διαβάστηκαν ζώνες αντικειμενικών αξιών', { areaId }),
}));

/**
 * Τα αρχεία που μπορεί να αφορούν το σημείο — ή `null` αν **κάποιο** δεν διαβάστηκε (ένα που λείπει θα έκανε
 * μια αληθινή ζώνη να μοιάζει «εκτός συστήματος»).
 */
async function areasAround(point: GeoPoint): Promise<readonly ValueZoneArea[] | null> {
  const index = await INDEX.read();
  return index === null ? null : areasOfIndex(index, point);
}

async function areasOfIndex(index: ValueZonesIndex, point: GeoPoint): Promise<readonly ValueZoneArea[] | null> {
  const ids = [...index.areas].filter(([, box]) => bboxWithin(point, box, FRONT_REACH_M)).map(([id]) => id);
  const areas = await Promise.all(ids.map((id) => AREAS.read(id)));
  return areas.every((area): area is ValueZoneArea => area !== null) ? areas : null;
}

/** **Η ζώνη αντικειμενικής αξίας μιας θέσης.** Δεν πετά ποτέ: αποτυχία ανάγνωσης ⇒ `unavailable`. */
export async function readValueZoneAt(position: PlacePosition): Promise<ValueZoneVerdict> {
  const point = valueZonePointOf(position);
  if (point === null) return { kind: 'imprecise' };
  return valueZoneAtPoint(point, await areasAround(point));
}

/** Η ταυτότητα του πίνακα ζωνών: η πηγή (με το sha256 της) και το εύρος ισχύος — το ίδιο `index.json` με την ετυμηγορία. */
export interface ValueZonesTableMeta {
  readonly validFrom: ValueZonesIndex['validFrom'];
  readonly source: ValueZonesIndex['source'];
}

/**
 * **Η ζώνη μιας θέσης ΜΑΖΙ με την ταυτότητα του πίνακα** από τον οποίο βγήκε (ADR-947 Δ3: στιγμιότυπο · απόκλιση).
 * **Μία** ανάγνωση του ευρετηρίου για τα δύο ⇒ ποτέ ετυμηγορία από τον έναν πίνακα με ταυτότητα του άλλου. Δεν πετά:
 * αποτυχία ⇒ `unavailable` και `table: null`.
 */
export async function readValueZoneWithTable(position: PlacePosition): Promise<{ readonly verdict: ValueZoneVerdict; readonly table: ValueZonesTableMeta | null }> {
  const index = await INDEX.read();
  const table = index === null ? null : { validFrom: index.validFrom, source: index.source };
  const point = valueZonePointOf(position);
  if (point === null) return { verdict: { kind: 'imprecise' }, table };
  return { verdict: valueZoneAtPoint(point, index === null ? null : await areasOfIndex(index, point)), table };
}

/**
 * **Ποια από αυτές τις περιοχές έχουν αρχείο ζωνών** — για τον χάρτη της σελίδας περιοχής, ώστε ο browser να ζητά
 * μόνο ό,τι υπάρχει (το ευρετήριο είναι ~90 KB: δεν κατεβαίνει στον browser). `null` = το ευρετήριο δεν διαβάστηκε.
 */
export async function readValueZoneFileIds(areaIds: readonly string[]): Promise<readonly string[] | null> {
  const index = await INDEX.read();
  return index === null ? null : areaIds.filter((id) => index.areas.has(id));
}
