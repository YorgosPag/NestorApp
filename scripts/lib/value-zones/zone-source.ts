/**
 * @fileoverview **Η ΠΗΓΗ ΤΩΝ ΖΩΝΩΝ** — από το zip του ΥΠΕΘΟΟ σε τυποποιημένες ζώνες στον κάνναβο ΕΓΣΑ'87.
 * @related ADR-889 §2.3 (η πηγή, μετρημένη) · §10 (η υλοποίηση) · `shapefile.ts` · `zip-extract.ts`
 *
 * 🔑 **Τα δύο στρώματα αναγνωρίζονται από τον ΤΥΠΟ ΓΕΩΜΕΤΡΙΑΣ**, όχι από το όνομα αρχείου: τα ονόματα είναι ελληνικά
 * και περιέχουν το έτος αναπροσαρμογής (`…_2021_2022`), που θα αλλάξει στην επόμενη. Polygon = κυκλικές, PolyLine = μέτωπα.
 *
 * 🔴 **Κάθε απόκλιση ΣΤΑΜΑΤΑ τον γεννήτορα** (ίδιο ήθος με την κεφαλίδα του ΜΑΜΑ, ADR-889 §5.2): πεδίο που λείπει ·
 * σύστημα συντεταγμένων άλλο από Greek Grid · πλήθος `.shp` ≠ `.dbf` · τιμή ζώνης μη θετικός ακέραιος · ημερομηνία
 * εκτός μορφής. Μια ζώνη που «χάνεται» σιωπηλά θα έδειχνε μια πραγματική θέση ως «εκτός συστήματος».
 */

import { readZip } from '../zip-extract';
import {
  SHAPE_POLYGON,
  SHAPE_POLYLINE,
  readDbfTable,
  readShapeFile,
  type ShapeCoordinate,
  type ShapeFile,
} from './shapefile';

/** Τα πεδία που διαβάζουμε — επικυρώνονται **κατά όνομα**. Τα υπόλοιπα 16 της πηγής αγνοούνται ρητά. */
export const REQUIRED_ZONE_FIELDS = ['ZONEREGIST', 'ZONENAME', 'CURRENTZON', 'ZONEDESCRI', 'VALID_FROM', 'VALID_TO'] as const;

/** Το `.prj` πρέπει να δηλώνει τον ελληνικό κάνναβο πάνω στο GGRS87 (EPSG:2100). */
const GREEK_GRID_PRJ = /PROJCS\["Greek_Grid".*GGRS_1987/;

export interface SourceZone {
  readonly id: number;
  readonly name: string;
  readonly price: number;
  /** `YYYY-MM-DD` */
  readonly validFrom: string;
  /** Κείμενο οριοθέτησης (κυκλικές) ή δρόμος + τμήμα (μέτωπα). */
  readonly description: string;
  /** Μέρη στον κάνναβο (μέτρα): δακτύλιοι ή πολυγραμμές. */
  readonly parts: readonly (readonly ShapeCoordinate[])[];
}

export interface ZoneSource {
  readonly zones: readonly SourceZone[];
  readonly fronts: readonly SourceZone[];
}

interface Layer {
  shp?: Buffer;
  dbf?: Buffer;
  prj?: string;
  cpg?: string;
}

function extensionOf(path: string): string {
  return path.slice(path.lastIndexOf('.') + 1).toLowerCase();
}

function groupLayers(archive: Buffer): Map<string, Layer> {
  const wanted = new Set(['shp', 'dbf', 'prj', 'cpg']);
  const layers = new Map<string, Layer>();
  for (const entry of readZip(archive, (path) => wanted.has(extensionOf(path)))) {
    const base = entry.path.slice(0, entry.path.lastIndexOf('.'));
    const layer = layers.get(base) ?? {};
    const ext = extensionOf(entry.path);
    if (ext === 'shp' || ext === 'dbf') layer[ext] = entry.data;
    else layer[ext as 'prj' | 'cpg'] = entry.data.toString('latin1').trim();
    layers.set(base, layer);
  }
  return layers;
}

/** «ANSI 1253» / «1253» / «UTF-8» → όνομα για το `TextDecoder`. */
export function dbfEncodingOf(cpg: string | undefined): string {
  if (cpg === undefined) throw new Error('value-zones: λείπει το .cpg — η κωδικοσελίδα του .dbf δεν μαντεύεται');
  if (/utf-?8/i.test(cpg)) return 'utf-8';
  const codePage = /(\d{3,4})/.exec(cpg)?.[1];
  if (codePage === undefined) throw new Error(`value-zones: άγνωστη κωδικοσελίδα «${cpg}»`);
  return `windows-${codePage}`;
}

function isoDate(raw: string, where: string): string {
  if (!/^\d{8}$/.test(raw)) throw new Error(`value-zones: ημερομηνία «${raw}» εκτός μορφής YYYYMMDD (${where})`);
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function integerAtLeast(minimum: number, raw: string, where: string): number {
  const value = Number(raw);
  if (raw === '' || !Number.isInteger(value) || value < minimum) {
    throw new Error(`value-zones: «${raw}» δεν είναι ακέραιος ≥ ${minimum} (${where})`);
  }
  return value;
}

function readLayer(base: string, layer: Layer): { shape: ShapeFile; zones: SourceZone[] } {
  if (layer.shp === undefined || layer.dbf === undefined) throw new Error(`value-zones: ελλιπές στρώμα ${base}`);
  if (layer.prj === undefined || !GREEK_GRID_PRJ.test(layer.prj)) {
    throw new Error(`value-zones: το ${base}.prj δεν είναι Greek Grid / GGRS87 — η προβολή θα ήταν λάθος`);
  }
  const shape = readShapeFile(layer.shp);
  const table = readDbfTable(layer.dbf, dbfEncodingOf(layer.cpg));
  const names = new Set(table.fields.map((field) => field.name));
  const missing = REQUIRED_ZONE_FIELDS.filter((field) => !names.has(field));
  if (missing.length > 0) throw new Error(`value-zones: λείπουν πεδία από ${base}.dbf: ${missing.join(', ')}`);
  if (table.rows.length !== shape.records.length) {
    throw new Error(`value-zones: ${base}: ${shape.records.length} σχήματα ≠ ${table.rows.length} γραμμές πίνακα`);
  }

  const zones: SourceZone[] = [];
  table.rows.forEach((row, index) => {
    const parts = shape.records[index];
    const { values } = row;
    // Διαγραμμένη γραμμή, κενό σχήμα ή ζώνη που έληξε ⇒ δεν ισχύει· μετριέται στην αναφορά από τον καλούντα.
    if (row.deleted || parts === null || values.VALID_TO !== '') return;
    const where = `${base} #${index + 1}`;
    zones.push({
      // ⚠️ Ταυτότητα ≥ 0, ΟΧΙ > 0: μετρημένο 2026-09-28, **μία** πραγματική ζώνη της Αθήνας («ΚΑ», 2.400 €/m²) έχει
      // `ZONEREGIST` 0 στην πηγή. Η τιμή όμως μένει αυστηρά θετική — ζώνη χωρίς τιμή δεν έχει νόημα.
      id: integerAtLeast(0, values.ZONEREGIST, where),
      name: values.ZONENAME,
      price: integerAtLeast(1, values.CURRENTZON, where),
      validFrom: isoDate(values.VALID_FROM, where),
      description: values.ZONEDESCRI,
      parts,
    });
  });
  return { shape, zones };
}

/** Διαβάζει το zip της πηγής: **ακριβώς** ένα στρώμα επιφανειών και ένα μετώπων, αλλιώς αποτυχία. */
export function readZoneSource(archive: Buffer): ZoneSource {
  let zones: SourceZone[] | null = null;
  let fronts: SourceZone[] | null = null;
  for (const [base, layer] of groupLayers(archive)) {
    const read = readLayer(base, layer);
    const slot = read.shape.shapeType === SHAPE_POLYGON ? 'zones' : read.shape.shapeType === SHAPE_POLYLINE ? 'fronts' : null;
    if (slot === 'zones') {
      if (zones !== null) throw new Error('value-zones: δύο στρώματα επιφανειών στο zip');
      zones = read.zones;
    } else if (slot === 'fronts') {
      if (fronts !== null) throw new Error('value-zones: δύο στρώματα μετώπων στο zip');
      fronts = read.zones;
    }
  }
  if (zones === null || fronts === null) throw new Error('value-zones: το zip δεν έχει και επιφάνειες και μέτωπα');
  return { zones, fronts };
}
