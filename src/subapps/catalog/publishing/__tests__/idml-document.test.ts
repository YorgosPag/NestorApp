/**
 * @jest-environment jsdom
 *
 * ADR-923 §5.6.1 — το πακέτο IDML: ό,τι ελέγχεται χωρίς InDesign. Το αν ανοίγει εκεί δεν το απαντά αυτή η σουίτα.
 */
import { buildZip } from '@/lib/zip/zip-builder';
import { idmlParts, IDML_MIMETYPE } from '../idml-document';
import { IDML_QR_SWATCH, placeTableCells } from '../idml-story';
import { PUBLICATION_QR_INK } from '../publication-qr';
import type { LayoutCell, LayoutDocument, LayoutTable } from '../layout-model';

const colour = { rgb: '#003366', cmyk: [100, 70, 0, 40] as const };
const cell = (text: string, role: LayoutCell['role'], colSpan = 1, rowSpan = 1): LayoutCell => ({ text, role, colSpan, rowSpan });
const table: LayoutTable = {
  id: 't', caption: 'c', columnCount: 4, railColumn: true, labelColumnMm: 52, railColumnMm: 10, part: 1, parts: 1, transposeUnmet: false,
  rows: [
    { id: 'h', header: true, cells: [cell('', 'corner'), cell('Μέγεθος', 'corner'), cell('34', 'columnHead'), cell('51', 'columnHead')] },
    { id: 'r1', header: false, cells: [cell('Ψύξη', 'groupRail', 1, 2), cell('kW', 'rowHead'), cell('1,5 & <2>', 'value', 2)] },
    { id: 'r2', header: false, cells: [cell('V', 'rowHead'), cell('230', 'value'), cell('—', 'value')] },
  ],
};
const document: LayoutDocument = {
  schemaVersion: 5, title: 'Κατάλογος "Α"', language: 'el', page: { widthMm: 210, heightMm: 297, marginMm: 15, bleedMm: 3 }, footer: 'Τιμές & όροι',
  theme: { fontFamily: 'Liberation Sans', primary: colour, accent: colour, tint: colour, text: colour, rule: colour },
  sections: [
    { id: 'toc', template: 'toc', blocks: [{ kind: 'toc', title: 'Περιεχόμενα' }] },
    { id: 'm', template: 'family', blocks: [
      { kind: 'anchor', anchor: 'a' },
      { kind: 'heading', level: 2, text: '#import "x"', outlined: true },
      { kind: 'heading', level: 2, text: 'Με QR', outlined: true, qr: { url: 'https://nestorconstruct.gr/q/cpm_a&b', caption: 'Σαρώστε', modules: 21, quietModules: 4, moduleMm: 0.5, runs: [[0, 0, 7]], ink: colour } },
      { kind: 'image', image: { assetId: 'img', alt: '', widthMm: 60 } },
      { kind: 'paragraph', inlines: [{ text: 'έντονο', strong: true }, { text: ' κείμενο' }] },
      { kind: 'bullets', ordered: false, items: [[{ text: 'ένα' }]] },
      { kind: 'table', table },
    ] },
    { id: 'g', template: 'grid', blocks: [{ kind: 'grid', columns: 2, cards: [{ id: 'c', title: 'Κάρτα', code: 'X', image: { assetId: 'img', alt: '', widthMm: 45 }, lines: ['a'], price: '10,00' }, { id: 'd', title: 'Δ', code: null, image: null, lines: [], price: null }, { id: 'e', title: 'Ε', code: null, image: null, lines: [], price: null }] }] },
    { id: 'i', template: 'codeIndex', blocks: [{ kind: 'codeIndex', columns: 3, entries: [{ code: '9', label: 'Εννέα', anchor: 'a' }] }] },
  ],
} as unknown as LayoutDocument;

const parts = idmlParts({ document, pageCount: 3, images: new Map([['img', { fileName: 'img.jpg', widthPx: 1200, heightPx: 600 }]]) });
const contentOf = (path: string): string => {
  const found = parts.find((part) => part.path === path);
  if (!found) throw new Error(path);
  return found.content;
};
const parse = (xml: string): Document => new DOMParser().parseFromString(xml, 'application/xml');
const story = () => parse(contentOf('Stories/Story_ustory.xml'));

describe('το πακέτο', () => {
  it('🔴 κάθε μέρος είναι έγκυρο XML, και το κείμενο του χρήστη μένει κείμενο', () => {
    for (const part of parts) expect([part.path, parse(part.content).querySelector('parsererror')]).toEqual([part.path, null]);
    expect(story().documentElement.textContent).toContain('1,5 & <2>');
  });

  it('🔴 κάθε `Self` είναι μοναδικό σε όλο το πακέτο', () => {
    const ids = parts.flatMap((part) => [...parse(part.content).querySelectorAll('[Self]')].map((node) => node.getAttribute('Self')));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('🔴 το `designmap.xml` δείχνει μόνο μέρη που υπάρχουν, και κάθε ιστορία είναι στο `StoryList`', () => {
    const map = contentOf('designmap.xml');
    const paths = new Set(parts.map((part) => part.path));
    const refs = [...map.matchAll(/src="([^"]+)"/g)].map((match) => match[1]);
    expect(refs.filter((ref) => !paths.has(ref))).toEqual([]);
    expect(refs).toEqual(expect.arrayContaining(['Stories/Story_ustory.xml', 'Stories/Story_ufooter.xml']));
    expect(map).toContain('StoryList="ustory ufooter"');
    expect(map).toContain('product="20.0(32)"');
  });

  it('🔴 τα πλαίσια σχηματίζουν μία αλυσίδα, μία ανά σελίδα', () => {
    const frames = [0, 1, 2].map((index) => parse(contentOf(`Spreads/Spread_uspread${index}.xml`)).querySelector('TextFrame'));
    expect(frames.map((frame) => [frame?.getAttribute('PreviousTextFrame'), frame?.getAttribute('NextTextFrame')])).toEqual([['n', 'uframe1'], ['uframe0', 'uframe2'], ['uframe1', 'n']]);
    expect(frames.every((frame) => frame?.getAttribute('ParentStory') === 'ustory')).toBe(true);
  });

  it('ίδια είσοδος ⇒ ίδια μέρη', () => {
    expect(idmlParts({ document, pageCount: 3, images: new Map([['img', { fileName: 'img.jpg', widthPx: 1200, heightPx: 600 }]]) })).toEqual(parts);
  });
});

describe('το κείμενο', () => {
  it('§5.13 Σ7: το QR φτάνει στο InDesign ως η ΙΔΙΑ διεύθυνση σε κείμενο, κάτω από την επικεφαλίδα του', () => {
    const text = story().documentElement.textContent ?? '';
    expect(text).toContain('Με QR');
    expect(text).toContain('Σαρώστε: https://nestorconstruct.gr/q/cpm_a&b');
    expect(text.indexOf('Σαρώστε')).toBeGreaterThan(text.indexOf('Με QR'));
  });

  it('§5.13 Σ7 κενό δ: το QR φτάνει ως ΔΙΑΝΥΣΜΑ, μία κλειστή διαδρομή ανά σειρά μονάδων, πάνω σε χαρτί με τη ζώνη ησυχίας', () => {
    const group = story().querySelector('Group');
    if (!group) throw new Error('group');
    const [paper, symbol] = [...group.children];
    expect([paper.tagName, paper.getAttribute('FillColor'), symbol.tagName, symbol.getAttribute('FillColor')]).toEqual(['Rectangle', 'Color/Paper', 'Polygon', `Color/${IDML_QR_SWATCH}`]);
    const anchors = (node: Element) => [...node.querySelectorAll('PathPointType')].map((point) => point.getAttribute('Anchor'));
    const side = Math.round((21 + 2 * 4) * 0.5 * (72 / 25.4) * 1000) / 1000;
    expect(anchors(paper)).toEqual(['0 0', `0 ${side}`, `${side} ${side}`, `${side} 0`]);
    const module = 0.5 * (72 / 25.4);
    const at = (value: number) => String(Math.round(value * 1000) / 1000);
    expect(symbol.querySelectorAll('GeometryPathType')).toHaveLength(1);
    expect(anchors(symbol)[0]).toBe(`${at(4 * module)} ${at(4 * module)}`);
    expect(anchors(symbol)[2]).toBe(`${at(11 * module)} ${at(5 * module)}`);
  });

  it('🔴 το μελάνι του QR είναι ΕΝΑ δείγμα, από το ίδιο PUBLICATION_QR_INK με το PDF', () => {
    const swatch = parse(contentOf('Resources/Graphic.xml')).querySelector(`Color[Self="Color/${IDML_QR_SWATCH}"]`);
    expect(swatch?.getAttribute('ColorValue')).toBe(PUBLICATION_QR_INK.cmyk.join(' '));
  });

  it('🔴 ο πίνακας μένει πραγματικός: επαναλαμβανόμενη κεφαλίδα, πλήθη που συμφωνούν, στήλες στο ωφέλιμο πλάτος', () => {
    const element = [...story().querySelectorAll('Table')].find((node) => node.getAttribute('HeaderRowCount') === '1');
    if (!element) throw new Error('table');
    expect([element.getAttribute('BodyRowCount'), element.querySelectorAll('Row').length, element.querySelectorAll('Column').length]).toEqual(['2', 3, 4]);
    const widths = [...element.querySelectorAll('Column')].reduce((sum, column) => sum + Number(column.getAttribute('SingleColumnWidth')), 0);
    expect(widths).toBeCloseTo(180 * (72 / 25.4), 3);
  });

  it('🔴 κελιά με rowSpan και colSpan δεν παίρνουν τη θέση κατειλημμένου κελιού', () => {
    expect(placeTableCells(table).map(({ column, row }) => `${column}:${row}`)).toEqual(['0:0', '1:0', '2:0', '3:0', '0:1', '1:1', '2:1', '1:2', '2:2', '3:2']);
  });

  it('🔴 η εικόνα έχει κλίμακα από τις διαστάσεις της, και σύνδεσμο στο Links', () => {
    const image = story().querySelector('Image');
    expect(image?.getAttribute('ItemTransform')?.split(' ')[0]).toBe(String((60 * (72 / 25.4)) / 1200));
    expect(story().querySelector('Link')?.getAttribute('LinkResourceURI')).toBe('file:Links/img.jpg');
  });

  it('🔴 κάθε ενότητα ξεκινά σε νέα σελίδα', () => {
    expect([...story().querySelectorAll('Story > ParagraphStyleRange[StartParagraph="NextPage"]')]).toHaveLength(document.sections.length);
  });

  it('το πλέγμα συμπληρώνει τη σειρά, ώστε τα κελιά να ισούνται με γραμμές × στήλες', () => {
    const grid = [...story().querySelectorAll('Table')].find((node) => node.getAttribute('BodyRowCount') === '2' && node.getAttribute('ColumnCount') === '2');
    expect(grid?.querySelectorAll(':scope > Cell')).toHaveLength(4);
  });
});

describe('🔴 buildZip — stored', () => {
  it('το `mimetype` είναι πρώτο και ασυμπίεστο, όπως απαιτεί το InDesign', () => {
    const data = new TextEncoder().encode(IDML_MIMETYPE);
    const zip = buildZip([{ filename: 'mimetype', data, stored: true }, { filename: 'a.xml', data: new TextEncoder().encode('x'.repeat(100)) }]);
    const view = new DataView(zip.buffer, zip.byteOffset);
    expect(view.getUint16(8, true)).toBe(0);
    expect(new TextDecoder().decode(zip.slice(30, 38))).toBe('mimetype');
    expect(new TextDecoder().decode(zip.slice(38, 38 + data.length))).toBe(IDML_MIMETYPE);
  });
});
