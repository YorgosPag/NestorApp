/**
 * @fileoverview 🖼️ **ADR-922 — ο κριτής «υπάρχει εικόνα δημοσίευσης;»** (κοινός για φόρμα και βιτρίνα).
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | διαδρομή χωρίς `ready` (π.χ. και σε `failed`) | «μόνο ready» |
 * | μη-DXF με `publishRaster` δίνει διαδρομή | «μόνο DXF» |
 * | αποτυχία ξαναζητιέται (βρόχος CPU) | «needs» |
 * | `failed` λέγεται «ετοιμάζεται» | «progress» |
 */

import {
  dxfPublishRasterPathOf,
  dxfPublishRasterProgressOf,
  isDxfFile,
  needsDxfPublishRaster,
  type DxfPublishRaster,
} from '../dxf-publish-raster';

const AT = '2026-10-24T18:00:00.000Z';
const READY: DxfPublishRaster = { status: 'ready', width: 3000, height: 2000, renderedAt: AT };
const FAILED: DxfPublishRaster = { status: 'failed', failure: 'empty-drawing', failedAt: AT };
const PATH = 'people/u/entities/property_dossier/p/domains/admin/categories/documents/files/file_a.dxf';

describe('isDxfFile — ο κατάλογος ειδών του αγωγού κάτοψης', () => {
  it.each([['dxf'], ['DXF'], ['.dxf']])('«%s» ⇒ DXF', (ext) => expect(isDxfFile({ ext })).toBe(true));
  it.each([['pdf'], ['png'], [undefined], ['']])('«%s» ⇒ όχι', (ext) => expect(isDxfFile({ ext })).toBe(false));
});

describe('dxfPublishRasterPathOf — η διαδρομή του PNG, ΜΟΝΟ όταν είναι έτοιμο', () => {
  it('μόνο ready: η διαδρομή βγαίνει από το μητρώο συνοδευτικών, δίπλα στο πρωτότυπο', () => {
    expect(dxfPublishRasterPathOf({ ext: 'dxf', storagePath: PATH, publishRaster: READY })).toBe(`${PATH}.publish.png`);
    expect(dxfPublishRasterPathOf({ ext: 'dxf', storagePath: PATH, publishRaster: FAILED })).toBeNull();
    expect(dxfPublishRasterPathOf({ ext: 'dxf', storagePath: PATH })).toBeNull();
  });

  it('μόνο DXF · μόνο με μονοπάτι', () => {
    expect(dxfPublishRasterPathOf({ ext: 'png', storagePath: PATH, publishRaster: READY })).toBeNull();
    expect(dxfPublishRasterPathOf({ ext: 'dxf', storagePath: '  ', publishRaster: READY })).toBeNull();
  });
});

describe('needs / progress — τι ζητά ο πελάτης και τι λέει η οθόνη', () => {
  it('needs: μόνο DXF χωρίς ΚΑΜΙΑ έκβαση — η αποτυχία δεν ξαναζητιέται', () => {
    expect(needsDxfPublishRaster({ ext: 'dxf' })).toBe(true);
    expect(needsDxfPublishRaster({ ext: 'dxf', publishRaster: FAILED })).toBe(false);
    expect(needsDxfPublishRaster({ ext: 'dxf', publishRaster: READY })).toBe(false);
    expect(needsDxfPublishRaster({ ext: 'png' })).toBe(false);
  });

  it('progress: preparing · failed · null (έτοιμο ή μη-DXF)', () => {
    expect(dxfPublishRasterProgressOf({ ext: 'dxf' })).toBe('preparing');
    expect(dxfPublishRasterProgressOf({ ext: 'dxf', publishRaster: FAILED })).toBe('failed');
    expect(dxfPublishRasterProgressOf({ ext: 'dxf', publishRaster: READY })).toBeNull();
    expect(dxfPublishRasterProgressOf({ ext: 'jpg' })).toBeNull();
  });
});
