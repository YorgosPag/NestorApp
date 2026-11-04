/**
 * Το **συμβόλαιο σύρματος** της ανάγνωσης κάτοψης (ADR-929 Δ5): τι επιστρέφει το VLM, **ένα** σχήμα zod από το οποίο
 * βγαίνουν **και** το strict JSON schema της OpenAI **και** ο έλεγχος της απάντησης. Δύο χειρόγραφα αντίγραφα (JSON +
 * guard) θα απέκλιναν σιωπηλά με την πρώτη αλλαγή πεδίου.
 *
 * 🔑 **Χώρος συντεταγμένων: η όψη σε χιλιοστά (`view-‰`).** Τα πλαίσια κειμένου και τα τμήματα είναι ακέραιοι 0–1000 πάνω
 * στην εικόνα που **στάλθηκε** (`plan-reading-view.ts`). Ανεξάρτητο από το αν ο πάροχος μίκρυνε την εικόνα, και ο **ίδιος**
 * χώρος στον οποίο του δίνουμε τα τμήματα. Σε αρχικά px περνά **μόνο** ο πελάτης, με την ομογραφία της Φ1 (Δ3).
 *
 * 🔑 **Το VLM δεν δίνει γεωμετρία.** Δίνει κείμενα με πλαίσιο, και **IDs** τμημάτων της Φ2. Κάθε ID που δεν στάλθηκε
 * πετιέται εδώ (επινόηση του μοντέλου) και **μετριέται** στο `dropped`, ώστε η μέτρηση να βλέπει την ψευδαίσθηση.
 *
 * 🔑 **Οι βεβαιότητες περιορίζονται, δεν απορρίπτονται.** Μια βεβαιότητα 1.2 δεν ακυρώνει ολόκληρη την ανάγνωση.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-wire
 */

import { z } from 'zod/v4';
import { clamp, clamp01 } from '@/lib/geometry/scalar';
import type { PlanOpeningKind, PlanTextKind } from '../plan-recognition-types';

/** Αλλάζει μαζί με το prompt ή το σχήμα ⇒ νέο κλειδί ανάγνωσης ⇒ ποτέ μπαγιάτικη απάντηση από την κρυφή μνήμη (Δ11). */
export const PLAN_READING_SCHEMA_VERSION = 1;
export const PLAN_READING_SCHEMA_NAME = 'plan_reading';
/** Η πλευρά του πλέγματος της όψης: συντεταγμένες 0…1000. */
export const PLAN_VIEW_GRID = 1000;

const TEXT_KINDS = ['dimension', 'room-name', 'area', 'scale', 'title', 'opening-size', 'other'] as const satisfies readonly PlanTextKind[];
const OPENING_KINDS = ['door', 'window'] as const satisfies readonly PlanOpeningKind[];

const coord = z.number().describe('integer 0..1000');
const viewBox = z.strictObject({ x0: coord, y0: coord, x1: coord, y1: coord });
const confidence = z.number().describe('0..1, how sure you are about this item');

const wireText = z.strictObject({
  id: z.string().describe('your own id, e.g. "t1"; referenced by dimensions, scale and rooms'),
  kind: z.enum(TEXT_KINDS),
  raw: z.string().describe('exactly as written on the drawing, no interpretation'),
  box: viewBox.describe('the text box on the image, per-mille of width/height (0..1000), origin top-left'),
  confidence,
});

const wireDimension = z.strictObject({
  textId: z.string(),
  valueMm: z.number().nullable().describe('the written length in millimetres; null if unsure of the unit'),
  segmentIds: z.array(z.string()).describe('ids of the given segments this dimension measures (the dimensioned wall faces)'),
  confidence,
});

const wireScale = z.strictObject({ textId: z.string(), denominator: z.number(), confidence });

const wireRoom = z.strictObject({
  name: z.string(),
  nameTextId: z.string().nullable(),
  writtenAreaM2: z.number().nullable().describe('only if an area is written for this room'),
  boundarySegmentIds: z.array(z.string()),
  confidence,
});

const wireOpening = z.strictObject({
  kind: z.enum(OPENING_KINDS),
  hostSegmentId: z.string(),
  alongFraction: z.number().describe('position along the host segment, 0 at its first point, 1 at its second'),
  sizeTextId: z.string().nullable(),
  confidence,
});

const wireReading = z.strictObject({
  texts: z.array(wireText),
  dimensions: z.array(wireDimension),
  writtenScale: wireScale.nullable(),
  rooms: z.array(wireRoom),
  openings: z.array(wireOpening),
});

export type PlanViewBox = z.infer<typeof viewBox>;
export type PlanViewText = z.infer<typeof wireText>;
export type PlanViewDimension = z.infer<typeof wireDimension>;
export type PlanViewRoom = z.infer<typeof wireRoom>;
export type PlanViewOpening = z.infer<typeof wireOpening>;
/** Η ανάγνωση όπως την είδε ο πάροχος, **ελεγμένη**: όλα τα IDs υπάρχουν, όλες οι βεβαιότητες στο [0, 1]. */
export type PlanViewReading = z.infer<typeof wireReading>;

/** Τι πετάχτηκε και γιατί: η μέτρηση του χρυσού συνόλου διαβάζει την ψευδαίσθηση από εδώ. */
export interface PlanReadingDropped {
  readonly unknownSegmentRefs: number;
  readonly unknownTextRefs: number;
  readonly openingsWithoutHost: number;
}

/** Το strict JSON schema για το `text.format` της OpenAI: όλα required, `additionalProperties: false`, null αντί για απουσία. */
export function planReadingJsonSchema(): Record<string, unknown> {
  const { $schema: _dialect, ...schema } = z.toJSONSchema(wireReading, { target: 'draft-2020-12' }) as Record<string, unknown>;
  return schema;
}

/** Το SSoT `clamp01` αφήνει το `NaN` να περάσει· μια βεβαιότητα που δεν είναι αριθμός είναι 0, όχι «άγνωστη». */
const confidence01 = (v: number): number => (Number.isFinite(v) ? clamp01(v) : 0);
const clampGrid = (v: number): number => clamp(Math.round(v), 0, PLAN_VIEW_GRID);

function normalizedBox(b: PlanViewBox): PlanViewBox {
  const [x0, x1] = [clampGrid(b.x0), clampGrid(b.x1)].sort((p, q) => p - q);
  const [y0, y1] = [clampGrid(b.y0), clampGrid(b.y1)].sort((p, q) => p - q);
  return { x0, y0, x1, y1 };
}

interface RefFilter {
  readonly segments: ReadonlySet<string>;
  readonly texts: ReadonlySet<string>;
  readonly dropped: { unknownSegmentRefs: number; unknownTextRefs: number; openingsWithoutHost: number };
}

function knownSegments(ids: readonly string[], f: RefFilter): string[] {
  const kept = ids.filter((id) => f.segments.has(id));
  f.dropped.unknownSegmentRefs += ids.length - kept.length;
  return [...new Set(kept)];
}

function knownText(id: string | null, f: RefFilter): string | null {
  if (id === null || f.texts.has(id)) return id;
  f.dropped.unknownTextRefs += 1;
  return null;
}

function filterReading(r: PlanViewReading, f: RefFilter): PlanViewReading {
  const dimensions = r.dimensions
    .filter((d) => knownText(d.textId, f) !== null)
    .map((d) => ({ ...d, segmentIds: knownSegments(d.segmentIds, f), confidence: confidence01(d.confidence) }));
  const scaleText = r.writtenScale === null ? null : knownText(r.writtenScale.textId, f);
  const writtenScale = r.writtenScale !== null && scaleText !== null && r.writtenScale.denominator > 0
    ? { ...r.writtenScale, confidence: confidence01(r.writtenScale.confidence) }
    : null;
  const rooms = r.rooms.map((room) => ({
    ...room,
    nameTextId: knownText(room.nameTextId, f),
    boundarySegmentIds: knownSegments(room.boundarySegmentIds, f),
    confidence: confidence01(room.confidence),
  }));
  const openings = r.openings.flatMap((o) => {
    if (!f.segments.has(o.hostSegmentId)) {
      f.dropped.openingsWithoutHost += 1;
      return [];
    }
    return [{ ...o, alongFraction: confidence01(o.alongFraction), sizeTextId: knownText(o.sizeTextId, f), confidence: confidence01(o.confidence) }];
  });
  return { texts: r.texts, dimensions, writtenScale, rooms, openings };
}

export type PlanReadingParse =
  | { readonly ok: true; readonly reading: PlanViewReading; readonly dropped: PlanReadingDropped }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Η απάντηση του παρόχου ⇒ ελεγμένη ανάγνωση. Λάθος **σχήμα** ⇒ αποτυχία (ο πάροχος παραβίασε το strict schema).
 * Λάθος **αναφορά** ⇒ πετιέται μόνο το στοιχείο και μετριέται.
 */
export function parsePlanViewReading(raw: unknown, segmentIds: Iterable<string>): PlanReadingParse {
  const parsed = wireReading.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
  const seenTextIds = new Set<string>();
  const texts = parsed.data.texts
    .filter((t) => !seenTextIds.has(t.id) && seenTextIds.add(t.id))
    .map((t) => ({ ...t, box: normalizedBox(t.box), confidence: confidence01(t.confidence) }));
  const dropped = { unknownSegmentRefs: 0, unknownTextRefs: 0, openingsWithoutHost: 0 };
  const filter: RefFilter = { segments: new Set(segmentIds), texts: seenTextIds, dropped };
  return { ok: true, reading: filterReading({ ...parsed.data, texts }, filter), dropped };
}
