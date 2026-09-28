/**
 * @fileoverview **Ανάγνωση ESRI Shapefile** (`.shp` γεωμετρία + `.dbf` πίνακας) σε καθαρό Node.
 * @related ADR-889 §10 · `zone-source.ts` (ο μόνος καταναλωτής) · ESRI Shapefile Technical Description (1998)
 *
 * 🔑 **Ό,τι χρειάζεται η πηγή, τίποτα παραπάνω**: τύποι **3** (PolyLine) και **5** (Polygon) — οι δύο που
 * δημοσιεύει το ΥΠΕΘΟΟ — και τύπος **0** (κενό σχήμα, νόμιμο στο πρότυπο). Κάθε άλλος τύπος (Z/M, πολυσημεία)
 * **σταματά** την ανάγνωση: ένας αναγνώστης που «προσπερνά» ό,τι δεν ξέρει θα έβγαζε λιγότερες ζώνες σιωπηλά.
 *
 * 🔑 **Κωδικοσελίδα από τον καλούντα**: το `.dbf` δεν κουβαλά αξιόπιστα την κωδικοσελίδα του (το byte 29 είναι
 * συχνά 0)· την δηλώνει το `.cpg`. Ο καλών τη διαβάζει και τη δίνει εδώ.
 *
 * Οι συντεταγμένες μένουν **ακατέργαστες** (μονάδες του `.prj`). Η προβολή είναι δουλειά του καλούντος.
 */

export const SHAPE_NULL = 0;
export const SHAPE_POLYLINE = 3;
export const SHAPE_POLYGON = 5;

export type ShapeType = typeof SHAPE_POLYLINE | typeof SHAPE_POLYGON;

/** Σημείο στις μονάδες του αρχείου: `[x, y]` (για ΕΓΣΑ'87: `[E, N]` σε μέτρα). */
export type ShapeCoordinate = readonly [number, number];

/** Ένα σχήμα: τα μέρη του (δακτύλιοι ή πολυγραμμές), ή `null` για κενό σχήμα. */
export type ShapeParts = readonly (readonly ShapeCoordinate[])[] | null;

export interface ShapeFile {
  readonly shapeType: ShapeType;
  readonly records: readonly ShapeParts[];
}

const SHP_FILE_CODE = 9994;
const SHP_HEADER_BYTES = 100;

function readParts(buffer: Buffer, content: number): ShapeParts {
  const partCount = buffer.readInt32LE(content + 36);
  const pointCount = buffer.readInt32LE(content + 40);
  const partStarts: number[] = [];
  for (let i = 0; i < partCount; i += 1) partStarts.push(buffer.readInt32LE(content + 44 + 4 * i));

  const pointsAt = content + 44 + 4 * partCount;
  return partStarts.map((start, i) => {
    const endExclusive = i + 1 < partCount ? partStarts[i + 1] : pointCount;
    const coordinates: ShapeCoordinate[] = [];
    for (let p = start; p < endExclusive; p += 1) {
      const at = pointsAt + 16 * p;
      coordinates.push([buffer.readDoubleLE(at), buffer.readDoubleLE(at + 8)]);
    }
    return coordinates;
  });
}

/** Το `.shp` — κάθε εγγραφή με τη σειρά της (η σειρά **είναι** η σύνδεση με τη γραμμή του `.dbf`). */
export function readShapeFile(buffer: Buffer): ShapeFile {
  if (buffer.length < SHP_HEADER_BYTES || buffer.readInt32BE(0) !== SHP_FILE_CODE) {
    throw new Error('shp: λάθος κωδικός αρχείου — δεν είναι shapefile');
  }
  const shapeType = buffer.readInt32LE(32);
  if (shapeType !== SHAPE_POLYLINE && shapeType !== SHAPE_POLYGON) {
    throw new Error(`shp: τύπος σχήματος ${shapeType} δεν υποστηρίζεται (μόνο 3 PolyLine / 5 Polygon)`);
  }

  const records: ShapeParts[] = [];
  let offset = SHP_HEADER_BYTES;
  while (offset + 8 <= buffer.length) {
    const contentBytes = buffer.readInt32BE(offset + 4) * 2;
    const content = offset + 8;
    const recordType = buffer.readInt32LE(content);
    if (recordType === SHAPE_NULL) records.push(null);
    else if (recordType === shapeType) records.push(readParts(buffer, content));
    else throw new Error(`shp: εγγραφή ${records.length + 1} τύπου ${recordType} σε αρχείο τύπου ${shapeType}`);
    offset = content + contentBytes;
  }
  return { shapeType, records };
}

export interface DbfField {
  readonly name: string;
  /** `C` κείμενο · `N` αριθμός · `D` ημερομηνία `YYYYMMDD` · κ.λπ. */
  readonly type: string;
  readonly length: number;
}

export interface DbfTable {
  readonly fields: readonly DbfField[];
  /** Μία ανά εγγραφή, **και οι διαγραμμένες** (με `deleted`), ώστε η θέση να ταιριάζει με το `.shp`. */
  readonly rows: readonly { readonly deleted: boolean; readonly values: Readonly<Record<string, string>> }[];
}

const DBF_FIELD_TERMINATOR = 0x0d;
const DBF_DELETED = 0x2a;

function readFields(buffer: Buffer): { fields: DbfField[]; offsets: number[] } {
  const fields: DbfField[] = [];
  const offsets: number[] = [];
  let cursor = 32;
  let position = 1; // το byte 0 κάθε εγγραφής είναι η σημαία διαγραφής
  while (buffer[cursor] !== DBF_FIELD_TERMINATOR) {
    const rawName = buffer.subarray(cursor, cursor + 11);
    const nul = rawName.indexOf(0);
    const name = rawName.subarray(0, nul === -1 ? 11 : nul).toString('latin1');
    const length = buffer[cursor + 16];
    fields.push({ name, type: String.fromCharCode(buffer[cursor + 11]), length });
    offsets.push(position);
    position += length;
    cursor += 32;
  }
  return { fields, offsets };
}

/** Το `.dbf` (dBase III) — τιμές ως **κομμένο κείμενο**· η ερμηνεία ανήκει στον καλούντα. */
export function readDbfTable(buffer: Buffer, encoding: string): DbfTable {
  const recordCount = buffer.readUInt32LE(4);
  const headerBytes = buffer.readUInt16LE(8);
  const recordBytes = buffer.readUInt16LE(10);
  const decoder = new TextDecoder(encoding);
  const { fields, offsets } = readFields(buffer);

  const rows: DbfTable['rows'][number][] = [];
  for (let r = 0; r < recordCount; r += 1) {
    const start = headerBytes + r * recordBytes;
    const values: Record<string, string> = {};
    fields.forEach((field, i) => {
      const from = start + offsets[i];
      values[field.name] = decoder.decode(buffer.subarray(from, from + field.length)).trim();
    });
    rows.push({ deleted: buffer[start] === DBF_DELETED, values });
  }
  return { fields, rows };
}
