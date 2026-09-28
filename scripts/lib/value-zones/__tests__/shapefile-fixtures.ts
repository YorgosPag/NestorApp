/**
 * Συνθετικά shapefile + zip στη μνήμη — ό,τι χρειάζονται τα tests του γεννήτορα ζωνών (ADR-889 Φ5),
 * χωρίς το αρχείο των 13 MB της πηγής.
 */

import { deflateRawSync } from 'node:zlib';

import type { ShapeCoordinate } from '../shapefile';

type Parts = readonly (readonly ShapeCoordinate[])[];

/** `.shp` με εγγραφές ενός τύπου (3 ή 5)· `null` = κενό σχήμα. */
export function buildShp(shapeType: number, records: readonly (Parts | null)[]): Buffer {
  const bodies = records.map((parts, index) => {
    if (parts === null) {
      const body = Buffer.alloc(4);
      body.writeInt32LE(0, 0);
      return { index, body };
    }
    const points = parts.flat();
    const body = Buffer.alloc(44 + 4 * parts.length + 16 * points.length);
    body.writeInt32LE(shapeType, 0);
    body.writeInt32LE(parts.length, 36);
    body.writeInt32LE(points.length, 40);
    let start = 0;
    parts.forEach((part, i) => {
      body.writeInt32LE(start, 44 + 4 * i);
      start += part.length;
    });
    points.forEach(([x, y], i) => {
      body.writeDoubleLE(x, 44 + 4 * parts.length + 16 * i);
      body.writeDoubleLE(y, 44 + 4 * parts.length + 16 * i + 8);
    });
    return { index, body };
  });
  const header = Buffer.alloc(100);
  header.writeInt32BE(9994, 0);
  header.writeInt32LE(shapeType, 32);
  const chunks = bodies.map(({ index, body }) => {
    const recordHeader = Buffer.alloc(8);
    recordHeader.writeInt32BE(index + 1, 0);
    recordHeader.writeInt32BE(body.length / 2, 4);
    return Buffer.concat([recordHeader, body]);
  });
  return Buffer.concat([header, ...chunks]);
}

/** Κείμενο → Windows-1253 (αρκεί για ASCII + ελληνικά κεφαλαία/πεζά). */
export function encode1253(text: string): Buffer {
  return Buffer.from([...text].map((char) => {
    const code = char.codePointAt(0) ?? 0x3f;
    if (code < 0x80) return code;
    if (code >= 0x0391 && code <= 0x03ce) return code - 0x0391 + 0xc1;
    return 0x3f;
  }));
}

export interface DbfFieldFixture {
  readonly name: string;
  readonly length: number;
}

/** `.dbf` (dBase III), όλα τα πεδία κείμενο· `deleted` σημαδεύει γραμμή ως διαγραμμένη. */
export function buildDbf(fields: readonly DbfFieldFixture[], rows: readonly { values: Record<string, string>; deleted?: boolean }[]): Buffer {
  const recordBytes = 1 + fields.reduce((sum, field) => sum + field.length, 0);
  const headerBytes = 32 + 32 * fields.length + 1;
  const header = Buffer.alloc(headerBytes);
  header[0] = 0x03;
  header.writeUInt32LE(rows.length, 4);
  header.writeUInt16LE(headerBytes, 8);
  header.writeUInt16LE(recordBytes, 10);
  fields.forEach((field, i) => {
    header.write(field.name, 32 + 32 * i, 'latin1');
    header[32 + 32 * i + 11] = 'C'.charCodeAt(0);
    header[32 + 32 * i + 16] = field.length;
  });
  header[headerBytes - 1] = 0x0d;
  const records = rows.map((row) => {
    const record = Buffer.alloc(recordBytes, 0x20);
    record[0] = row.deleted ? 0x2a : 0x20;
    let offset = 1;
    for (const field of fields) {
      encode1253(row.values[field.name] ?? '').copy(record, offset, 0, field.length);
      offset += field.length;
    }
    return record;
  });
  return Buffer.concat([header, ...records]);
}

/** zip με deflate (μέθοδος 8), ονόματα UTF-8 (σημαία 11). */
export function buildZip(entries: readonly { path: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path, 'utf8');
    const compressed = deflateRawSync(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, compressed);
    centrals.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

export const GREEK_GRID_PRJ =
  'PROJCS["Greek_Grid",GEOGCS["GCS_GGRS_1987",DATUM["D_GGRS_1987",SPHEROID["GRS_1980",6378137.0,298.257222101]]]]';

export const ZONE_FIELDS: readonly DbfFieldFixture[] = [
  { name: 'ZONEREGIST', length: 10 },
  { name: 'ZONENAME', length: 15 },
  { name: 'CURRENTZON', length: 10 },
  { name: 'ZONEDESCRI', length: 60 },
  { name: 'VALID_FROM', length: 8 },
  { name: 'VALID_TO', length: 8 },
];

/** Τετράγωνο δεξιόστροφο (ESRI: εξωτερικός), κλειστό, στον κάνναβο. */
export function clockwiseSquare(x: number, y: number, size: number): ShapeCoordinate[] {
  return [[x, y], [x, y + size], [x + size, y + size], [x + size, y], [x, y]];
}
