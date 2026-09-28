/**
 * @jest-environment node
 *
 * ADR-889 Φ5 — η πηγή των ζωνών: zip → shp/dbf → τυποποιημένες ζώνες. Κάθε απόκλιση της πηγής ΣΤΑΜΑΤΑ τον γεννήτορα.
 */

import { readZip } from '../../zip-extract';
import { SHAPE_POLYGON, SHAPE_POLYLINE, readDbfTable, readShapeFile } from '../shapefile';
import { dbfEncodingOf, readZoneSource } from '../zone-source';
import {
  GREEK_GRID_PRJ,
  ZONE_FIELDS,
  buildDbf,
  buildShp,
  buildZip,
  clockwiseSquare,
} from './shapefile-fixtures';

const ZONE_ROW = { ZONEREGIST: '4953', ZONENAME: 'Θ', CURRENTZON: '3850', ZONEDESCRI: 'ΑΚΑΔΗΜΙΑΣ', VALID_FROM: '20220101', VALID_TO: '' };
const FRONT_ROW = { ZONEREGIST: '4944', ZONENAME: 'Α', CURRENTZON: '8550', ZONEDESCRI: 'ΒΑΣ. ΣΟΦΙΑΣ αριστερά', VALID_FROM: '20250101', VALID_TO: '' };

interface LayerOptions {
  readonly prj?: string;
  readonly fields?: typeof ZONE_FIELDS;
}

function layer(base: string, shp: Buffer, rows: Parameters<typeof buildDbf>[1], options: LayerOptions = {}) {
  return [
    { path: `Z/${base}.shp`, data: shp },
    { path: `Z/${base}.dbf`, data: buildDbf(options.fields ?? ZONE_FIELDS, rows) },
    { path: `Z/${base}.prj`, data: Buffer.from(options.prj ?? GREEK_GRID_PRJ) },
    { path: `Z/${base}.cpg`, data: Buffer.from('ANSI 1253') },
  ];
}

function sourceZip(zoneRows: Parameters<typeof buildDbf>[1], options: LayerOptions = {}): Buffer {
  const polygons = buildShp(SHAPE_POLYGON, zoneRows.map(() => [clockwiseSquare(476_000, 4_205_000, 100)]));
  const lines = buildShp(SHAPE_POLYLINE, [[[[476_000, 4_205_000], [476_100, 4_205_000]]]]);
  // Ελληνικά ονόματα αρχείων, όπως στην πηγή — τα στρώματα αναγνωρίζονται από τον τύπο, όχι από αυτά.
  return buildZip([...layer('ΚΥΚΛΙΚΕΣ_ΖΩΝΕΣ_2021_2022', polygons, zoneRows, options), ...layer('ΓΡΑΜΜΙΚΕΣ_ΖΩΝΕΣ_2021_2022', lines, [{ values: FRONT_ROW }])]);
}

describe('zip + shapefile', () => {
  it('διαβάζει εγγραφές deflate με ελληνικά ονόματα, επιλεκτικά κατά κατάληξη', () => {
    const zip = buildZip([{ path: 'Α/ένα.txt', data: Buffer.from('καλημέρα') }, { path: 'Α/δύο.bin', data: Buffer.alloc(3) }]);
    const entries = readZip(zip, (path) => path.endsWith('.txt'));
    expect(entries.map((entry) => [entry.path, entry.data.toString('utf8')])).toEqual([['Α/ένα.txt', 'καλημέρα']]);
  });

  it('απορρίπτει ό,τι δεν είναι zip', () => {
    expect(() => readZip(Buffer.from('όχι zip, απλό κείμενο αρκετά μακρύ για κεφαλίδα'), () => true)).toThrow(/κεντρικός κατάλογος/);
  });

  it('shp: μέρη, κενά σχήματα, και άρνηση τύπου που δεν υποστηρίζεται', () => {
    const shape = readShapeFile(buildShp(SHAPE_POLYGON, [[clockwiseSquare(0, 0, 1)], null]));
    expect(shape.records[0]).toHaveLength(1);
    expect(shape.records[0]?.[0]).toHaveLength(5);
    expect(shape.records[1]).toBeNull();
    expect(() => readShapeFile(buildShp(1, []))).toThrow(/τύπος σχήματος 1/);
  });

  it('dbf: αποκωδικοποίηση Windows-1253 και σημαία διαγραφής', () => {
    const table = readDbfTable(buildDbf(ZONE_FIELDS, [{ values: ZONE_ROW }, { values: ZONE_ROW, deleted: true }]), 'windows-1253');
    expect(table.rows[0].values.ZONENAME).toBe('Θ');
    expect(table.rows[0].values.ZONEDESCRI).toBe('ΑΚΑΔΗΜΙΑΣ');
    expect(table.rows.map((row) => row.deleted)).toEqual([false, true]);
  });

  it('κωδικοσελίδα από το .cpg — ποτέ μαντεψιά', () => {
    expect(dbfEncodingOf('ANSI 1253')).toBe('windows-1253');
    expect(dbfEncodingOf('UTF-8')).toBe('utf-8');
    expect(() => dbfEncodingOf(undefined)).toThrow(/cpg/);
  });
});

describe('readZoneSource', () => {
  it('επιφάνειες και μέτωπα από τον τύπο γεωμετρίας· τιμή, ημερομηνία ISO, ελληνικό όνομα', () => {
    const source = readZoneSource(sourceZip([{ values: ZONE_ROW }]));
    expect(source.zones).toEqual([expect.objectContaining({ id: 4953, name: 'Θ', price: 3850, validFrom: '2022-01-01', description: 'ΑΚΑΔΗΜΙΑΣ' })]);
    expect(source.fronts).toEqual([expect.objectContaining({ id: 4944, price: 8550, validFrom: '2025-01-01', description: 'ΒΑΣ. ΣΟΦΙΑΣ αριστερά' })]);
  });

  it('ταυτότητα 0 γίνεται δεκτή (μετρημένη στην πηγή)· τιμή 0 ΣΤΑΜΑΤΑ', () => {
    expect(readZoneSource(sourceZip([{ values: { ...ZONE_ROW, ZONEREGIST: '0' } }])).zones[0].id).toBe(0);
    expect(() => readZoneSource(sourceZip([{ values: { ...ZONE_ROW, CURRENTZON: '0' } }]))).toThrow(/ακέραιος ≥ 1/);
  });

  it('διαγραμμένες γραμμές και ζώνες που έληξαν δεν ισχύουν', () => {
    const source = readZoneSource(sourceZip([{ values: ZONE_ROW, deleted: true }, { values: { ...ZONE_ROW, VALID_TO: '20240101' } }, { values: ZONE_ROW }]));
    expect(source.zones).toHaveLength(1);
  });

  it('ΣΤΑΜΑΤΑ σε άλλο σύστημα συντεταγμένων, πεδίο που λείπει, ή λάθος ημερομηνία', () => {
    expect(() => readZoneSource(sourceZip([{ values: ZONE_ROW }], { prj: 'GEOGCS["WGS 84"]' }))).toThrow(/Greek Grid/);
    const withoutPrice = ZONE_FIELDS.filter((field) => field.name !== 'CURRENTZON');
    expect(() => readZoneSource(sourceZip([{ values: ZONE_ROW }], { fields: withoutPrice }))).toThrow(/CURRENTZON/);
    expect(() => readZoneSource(sourceZip([{ values: { ...ZONE_ROW, VALID_FROM: '2022-01' } }]))).toThrow(/YYYYMMDD/);
  });
});
