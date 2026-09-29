/**
 * @fileoverview **ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΩΝ ΑΡΧΕΙΩΝ ΖΩΝΩΝ ΑΝΤΙΚΕΙΜΕΝΙΚΩΝ ΑΞΙΩΝ** — σχήμα, διαδρομές, αναγνώστες, κοινά για
 * τον γεννήτορα, τον server (τιμή ζώνης ανά αγγελία) και τον browser (στρώση χάρτη).
 * @related ADR-889 §10 · `scripts/build-value-zones.ts` (ο γραφέας) · `services/market/value-zones.reader.ts` ·
 *   `lib/market/value-zones.ts` (φορτωτής browser) · `lib/geo/admin-boundary-file.ts` (ίδιο ιδίωμα)
 * @module lib/market/value-zone-file
 *
 * 🔑 **ΕΝΑ ΑΡΧΕΙΟ ΑΝΑ ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ** (ή Δήμο χωρίς Δ.Ε.) — ίδιο κλειδί με τα όρια του ADR-883 και τις σελίδες
 * περιοχής. Ο χάρτης κατεβάζει μόνο τις ζώνες της περιοχής που βλέπει· ο server κρίνει μια αγγελία με τους
 * **ΙΔΙΟΥΣ** δακτυλίους που ζωγραφίζει ο χάρτης (αρχή ADR-890 §9.1).
 *
 * 🔑 **Δύο είδη ζώνης, δύο πίνακες** — γιατί **απαντούν σε διαφορετική ερώτηση** (ΠΟΛ.1149/1994):
 * - `zones` = **κυκλικές** (επιφάνειες): «σε ποια ζώνη πέφτει το σημείο;» — σημείο-σε-πολύγωνο.
 * - `fronts` = **γραμμικές** (μέτωπα δρόμων): ισχύουν **μόνο** για ακίνητα με **πρόσοψη** στον δρόμο τους. Μια
 *   θέση **δεν** αποδεικνύει πρόσοψη ⇒ είναι πάντα **υπό όρο**, ποτέ «η τιμή του ακινήτου».
 *
 * 🔒 **Η ανοχή είναι μέρος του δεδομένου** (όπως στο ADR-883): οι δακτύλιοι είναι απλοποιημένοι με εγγυημένη
 * απόκλιση `toleranceM`. Αρχείο χωρίς ανοχή **απορρίπτεται**.
 *
 * ⚠️ **Φύλλο χωρίς runtime εισαγωγές από `@/`**: το διαβάζει και ο γεννήτορας (`tsx`).
 */

import type { GeoBoundingBox, GeoOutline, GeoPolyline } from '@/types/geo/coordinates';
import { adminBoundaryFileName } from '../geo/admin-boundary-file';
import { geoJsonRings } from '../geo/geo-geojson';
import { isGeoPolyline } from '../geo/geo-line';
import { isFiniteNumber, isPlainRecord } from '@/lib/type-guards';

export const VALUE_ZONES_FORMAT_VERSION = 1;

/** Ο φάκελος μέσα στο `public/`. */
export const VALUE_ZONES_DIR = 'data/value-zones';

// ============================================================================
// ΤΟ ΣΧΗΜΑ ΣΤΟ ΑΡΧΕΙΟ (αυτό γράφει ο γεννήτορας)
// ============================================================================

/** `[δύση, νότος, ανατολή, βορράς]` — σειρά GeoJSON. */
export type BboxTuple = readonly [number, number, number, number];

interface ZoneFields {
  /** `ZONEREGIST` της πηγής — **δεν** είναι μοναδικό σε όλη τη χώρα (4 διπλά, μετρημένο)· ταυτότητα = id + σχήμα. */
  readonly id: number;
  /** Γράμμα ζώνης της πηγής («Α», «ΛΒ»). */
  readonly name: string;
  /** Τιμή ζώνης, **€/τ.μ.** (`CURRENTZON`). */
  readonly price: number;
  /** Έναρξη ισχύος `YYYY-MM-DD`. */
  readonly validFrom: string;
  readonly bbox: BboxTuple;
}

export interface ValueZoneRecord extends ZoneFields {
  readonly geometry: GeoJSON.MultiPolygon;
}

export interface ValueFrontRecord extends ZoneFields {
  /** Ο δρόμος και το τμήμα του, όπως τα γράφει η πηγή (`ZONEDESCRI`) — π.χ. «ΒΑΣ. ΣΟΦΙΑΣ (από … μέχρι …) αριστερά». */
  readonly street: string;
  readonly geometry: GeoJSON.MultiLineString;
}

export interface ValueZoneAreaFile {
  readonly v: typeof VALUE_ZONES_FORMAT_VERSION;
  readonly id: string;
  readonly bbox: BboxTuple;
  readonly toleranceM: number;
  readonly zones: readonly ValueZoneRecord[];
  readonly fronts: readonly ValueFrontRecord[];
}

export interface ValueZonesSourceMeta {
  readonly url: string;
  readonly lastModified: string | null;
  readonly sha256: string;
}

export interface ValueZonesIndexFile {
  readonly v: typeof VALUE_ZONES_FORMAT_VERSION;
  /** Εύρος ημερομηνιών έναρξης ισχύος στα δεδομένα (οι αναθεωρήσεις είναι μερικές). */
  readonly validFrom: { readonly from: string; readonly to: string };
  readonly source: ValueZonesSourceMeta;
  /** Περιοχή → bbox του αρχείου της: ο server διαλέγει από εδώ ποια αρχεία να ανοίξει για ένα σημείο. */
  readonly areas: Readonly<Record<string, BboxTuple>>;
}

export function valueZonesPublicPath(areaId: string): readonly string[] {
  return [...VALUE_ZONES_DIR.split('/'), adminBoundaryFileName(areaId)];
}

export const VALUE_ZONES_INDEX_PUBLIC_PATH: readonly string[] = [...VALUE_ZONES_DIR.split('/'), 'index.json'];

// ============================================================================
// ΤΟ ΣΧΗΜΑ ΣΤΗ ΜΝΗΜΗ (αυτό διαβάζουν server και browser)
// ============================================================================

export interface ValueZone extends Omit<ValueZoneRecord, 'bbox'> {
  readonly bbox: GeoBoundingBox;
  /** Οι δακτύλιοι για τον κριτή (even–odd, `isPointInGeoRings`) — από το **ίδιο** `geometry` που ζωγραφίζεται. */
  readonly rings: readonly GeoOutline[];
}

export interface ValueFront extends Omit<ValueFrontRecord, 'bbox'> {
  readonly bbox: GeoBoundingBox;
  readonly lines: readonly GeoPolyline[];
}

export interface ValueZoneArea {
  readonly id: string;
  readonly bbox: GeoBoundingBox;
  readonly toleranceM: number;
  readonly zones: readonly ValueZone[];
  readonly fronts: readonly ValueFront[];
}

export interface ValueZonesIndex {
  readonly validFrom: { readonly from: string; readonly to: string };
  readonly source: ValueZonesSourceMeta;
  readonly areas: ReadonlyMap<string, GeoBoundingBox>;
}

// ============================================================================
// ΑΝΑΓΝΩΣΤΕΣ — `null` = «δεν ξέρω», ΠΟΤΕ «καμία ζώνη»
// ============================================================================

function bboxOfTuple(value: unknown): GeoBoundingBox | null {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(isFiniteNumber)) return null;
  const [west, south, east, north] = value as [number, number, number, number];
  if (south > north || west > east) return null;
  return { west, south, east, north };
}

function readZoneFields(row: Record<string, unknown>): (Omit<ZoneFields, 'bbox'> & { bbox: GeoBoundingBox }) | null {
  const bbox = bboxOfTuple(row.bbox);
  if (bbox === null || !Number.isInteger(row.id) || (row.id as number) < 0 || !isFiniteNumber(row.price) || row.price <= 0) return null;
  if (typeof row.name !== 'string' || typeof row.validFrom !== 'string') return null;
  return { id: row.id, name: row.name, price: row.price, validFrom: row.validFrom, bbox };
}

function readZone(value: unknown): ValueZone | null {
  if (!isPlainRecord(value) || !isPlainRecord(value.geometry)) return null;
  const fields = readZoneFields(value);
  const geometry = value.geometry as Partial<GeoJSON.MultiPolygon>;
  if (fields === null || geometry.type !== 'MultiPolygon' || !Array.isArray(geometry.coordinates)) return null;
  const multi: GeoJSON.MultiPolygon = { type: 'MultiPolygon', coordinates: geometry.coordinates };
  const rings = geoJsonRings(multi);
  return rings.length === 0 ? null : { ...fields, geometry: multi, rings };
}

function toPolyline(line: readonly GeoJSON.Position[]): GeoPolyline | null {
  const points = line.map((position) => ({ lng: position[0], lat: position[1] }));
  return isGeoPolyline(points) ? points : null;
}

function readFront(value: unknown): ValueFront | null {
  if (!isPlainRecord(value) || !isPlainRecord(value.geometry) || typeof value.street !== 'string') return null;
  const fields = readZoneFields(value);
  const geometry = value.geometry as Partial<GeoJSON.MultiLineString>;
  if (fields === null || geometry.type !== 'MultiLineString' || !Array.isArray(geometry.coordinates)) return null;
  const lines = geometry.coordinates.map(toPolyline).filter((line): line is GeoPolyline => line !== null);
  if (lines.length === 0) return null;
  return { ...fields, street: value.street, geometry: { type: 'MultiLineString', coordinates: geometry.coordinates }, lines };
}

/** Χαλασμένη ζώνη **ακυρώνει** το αρχείο: μια ζώνη που λείπει σιωπηλά θα έδινε «εκτός συστήματος» για αληθινή θέση. */
function readAll<T>(value: unknown, read: (item: unknown) => T | null): readonly T[] | null {
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const item of value) {
    const parsed = read(item);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

export function readValueZoneArea(payload: unknown, expectedId: string): ValueZoneArea | null {
  if (!isPlainRecord(payload) || payload.v !== VALUE_ZONES_FORMAT_VERSION || payload.id !== expectedId) return null;
  if (!isFiniteNumber(payload.toleranceM) || payload.toleranceM < 0) return null;
  const bbox = bboxOfTuple(payload.bbox);
  const zones = readAll(payload.zones, readZone);
  const fronts = readAll(payload.fronts, readFront);
  if (bbox === null || zones === null || fronts === null) return null;
  return { id: expectedId, bbox, toleranceM: payload.toleranceM, zones, fronts };
}

export function readValueZonesIndex(payload: unknown): ValueZonesIndex | null {
  if (!isPlainRecord(payload) || payload.v !== VALUE_ZONES_FORMAT_VERSION) return null;
  const { validFrom, source, areas } = payload;
  if (!isPlainRecord(validFrom) || typeof validFrom.from !== 'string' || typeof validFrom.to !== 'string') return null;
  if (!isPlainRecord(source) || typeof source.url !== 'string' || typeof source.sha256 !== 'string') return null;
  if (!isPlainRecord(areas)) return null;
  const boxes = new Map<string, GeoBoundingBox>();
  for (const [id, tuple] of Object.entries(areas)) {
    const box = bboxOfTuple(tuple);
    if (box === null) return null;
    boxes.set(id, box);
  }
  const lastModified = typeof source.lastModified === 'string' ? source.lastModified : null;
  return {
    validFrom: { from: validFrom.from, to: validFrom.to },
    source: { url: source.url, lastModified, sha256: source.sha256 },
    areas: boxes,
  };
}
