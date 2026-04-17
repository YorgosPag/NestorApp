/**
 * Unit tests for PropertyShowcaseRenderer's photo-embedding path.
 *
 * These tests pin the contract between the renderer and `IPDFDoc.addImage`:
 * when `data.photos` is non-empty, the renderer MUST add exactly one page
 * and invoke `addImage` once per photo with the raw bytes and declared
 * format — not a string. Regressions here are the class of bug that sent
 * the showcase PDF out empty (jsPDF's string/base64 path silently no-ops on
 * Node because it reaches for a browser `Image` global).
 */

import { PropertyShowcaseRenderer } from '../PropertyShowcaseRenderer';
import type { PropertyShowcasePDFData, PropertyShowcasePDFLabels } from '../PropertyShowcaseRenderer';
import type { IPDFDoc, Margins } from '../../contracts';

function makeLabels(): PropertyShowcasePDFLabels {
  return {
    headerTitle: 'Header',
    generatedOn: 'Generated',
    specsSection: 'Specs',
    featuresSection: 'Features',
    descriptionSection: 'Description',
    mediaSection: 'Media',
    photosSection: 'Photos',
    fieldType: 'Type',
    fieldBuilding: 'Building',
    fieldFloor: 'Floor',
    fieldCode: 'Code',
    fieldGrossArea: 'Gross',
    fieldNetArea: 'Net',
    fieldBalcony: 'Balcony',
    fieldTerrace: 'Terrace',
    fieldBedrooms: 'BR',
    fieldBathrooms: 'BA',
    fieldWc: 'WC',
    fieldOrientation: 'Orientation',
    fieldEnergyClass: 'Energy',
    fieldCondition: 'Condition',
    fieldPhotos: 'Photos',
    fieldFloorplans: 'Floorplans',
    fieldVideo: 'Video',
    fieldShowcaseUrl: 'URL',
    areaUnit: 'm2',
    footerNote: 'Footer',
  };
}

function makeDoc() {
  const addImageCalls: Array<{
    imageData: string | Uint8Array;
    format: 'JPEG' | 'PNG';
    x: number; y: number; w: number; h: number;
    alias?: string; compression?: string;
  }> = [];
  let pageCount = 1;
  let currentPage = 1;

  const doc: IPDFDoc = {
    pageSize: { width: 210, height: 297 },
    getNumberOfPages: () => pageCount,
    setPage: (n: number) => { currentPage = n; },
    addPage: () => { pageCount += 1; currentPage = pageCount; },
    setFillColor: () => {},
    setDrawColor: () => {},
    setLineWidth: () => {},
    rect: () => {},
    line: () => {},
    setTextColor: () => {},
    setFont: () => {},
    setFontSize: () => {},
    text: () => {},
    splitTextToSize: (t) => [t],
    getTextWidth: () => 10,
    addImage: (imageData, format, x, y, w, h, alias, compression) => {
      addImageCalls.push({ imageData, format, x, y, w, h, alias, compression });
    },
    output: () => new ArrayBuffer(0),
  };

  return { doc, addImageCalls, getPageCount: () => pageCount, getCurrentPage: () => currentPage };
}

function makeData(photos: PropertyShowcasePDFData['photos']): PropertyShowcasePDFData {
  return {
    property: { id: 'prop_1', name: 'Test' },
    company: { name: 'Test Co' },
    showcaseUrl: 'https://example.com/showcase/abc',
    photos,
    generatedAt: new Date('2026-04-17T00:00:00Z'),
    labels: makeLabels(),
  };
}

const MARGINS: Margins = { top: 20, right: 18, bottom: 20, left: 18 };

describe('PropertyShowcaseRenderer photo embedding', () => {
  it('adds no extra page when no photos are supplied', () => {
    const { doc, addImageCalls, getPageCount } = makeDoc();
    new PropertyShowcaseRenderer().render(doc, MARGINS, makeData([]));
    expect(addImageCalls).toHaveLength(0);
    expect(getPageCount()).toBe(1);
  });

  it('adds exactly one page and one addImage call per photo', () => {
    const { doc, addImageCalls, getPageCount } = makeDoc();
    const photos = [
      { id: 'p1', bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), format: 'JPEG' as const },
      { id: 'p2', bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), format: 'PNG' as const },
      { id: 'p3', bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), format: 'JPEG' as const },
    ];
    new PropertyShowcaseRenderer().render(doc, MARGINS, makeData(photos));
    expect(getPageCount()).toBe(2);
    expect(addImageCalls).toHaveLength(3);
  });

  it('forwards raw Uint8Array bytes (never a string) to addImage', () => {
    const { doc, addImageCalls } = makeDoc();
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const photos = [{ id: 'p1', bytes, format: 'JPEG' as const }];
    new PropertyShowcaseRenderer().render(doc, MARGINS, makeData(photos));
    expect(addImageCalls).toHaveLength(1);
    const call = addImageCalls[0];
    expect(typeof call.imageData).not.toBe('string');
    expect(call.imageData).toBeInstanceOf(Uint8Array);
    expect(Array.from(call.imageData as Uint8Array)).toEqual(Array.from(bytes));
    expect(call.format).toBe('JPEG');
    expect(call.alias).toBe('p1');
    expect(call.compression).toBe('FAST');
  });

  it('lays photos out in a 3-column grid with uniform cell width', () => {
    const { doc, addImageCalls } = makeDoc();
    const photos = Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}`, bytes: new Uint8Array([0xff, 0xd8]), format: 'JPEG' as const,
    }));
    new PropertyShowcaseRenderer().render(doc, MARGINS, makeData(photos));
    expect(addImageCalls).toHaveLength(6);
    const widths = new Set(addImageCalls.map((c) => c.w));
    expect(widths.size).toBe(1);
    const row1Xs = addImageCalls.slice(0, 3).map((c) => c.x);
    const row2Xs = addImageCalls.slice(3, 6).map((c) => c.x);
    expect(row1Xs).toEqual(row2Xs);
    const row1Y = addImageCalls[0].y;
    const row2Y = addImageCalls[3].y;
    expect(row2Y).toBeGreaterThan(row1Y);
  });
});
