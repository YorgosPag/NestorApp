/**
 * ADR-923 §5.6 — η **πραγματική** μηχανή: τρέχει μόνο με `CATALOG_TYPST_BIN=<διαδρομή typst 0.15.1>`.
 *
 * ⚠️ Δηλωμένη παράκαμψη: χωρίς εκτελέσιμο, η σουίτα βγαίνει `skipped` ⇒ τα πράσινα του `typst-adapter.test.ts` **δεν**
 * αποδεικνύουν ότι το πρότυπο μεταγλωττίζεται. Το κενό καταγράφεται στο ADR-923 §5.6.1.
 * Κριτήριο εξόδου της Φάσης 5: fixture 300+ σελίδων, με μετρημένο χρόνο και μέγεθος.
 * Οι άγκυρες χρώματος/προτύπου διαβάζουν το **ίδιο το PDF** (αποσυμπιεσμένες ροές), όχι τον κώδικα του προτύπου.
 * ⚠️ Διάταξη (επικαλύψεις, ετικέτες ομάδων) ελέγχθηκε με το μάτι σε PNG σελίδων· κανένα από αυτά τα tests δεν τη βλέπει.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

import { PDFDocument } from 'pdf-lib';

import { composePublication } from '@/subapps/catalog/publishing/compose-publication';
import { judgePublicationLayout } from '@/subapps/catalog/publishing/publication-layout-judge';
import type { PublicationChapter, VariantModelEntry } from '@/subapps/catalog/publishing/publication-entries';
import type { PreviewRow } from '@/subapps/catalog/table/catalog-table';
import type { PublicationRecipeDefinition } from '@/subapps/catalog/types/publication';
import { fontDirectoryOf, renderPublicationPdf, renderPublicationPreview } from '../typst-adapter';
import { assertTypstAvailable, runTypst } from '../typst-engine.server';
import { readLayoutInChildProcess } from './pdf-layout-oracle';

jest.mock('server-only', () => ({}));

const binary = process.env.CATALOG_TYPST_BIN?.trim();
const pdfOutDirectory = process.env.CATALOG_TYPST_PDF_OUT?.trim();
const describeReal = binary ? describe : describe.skip;
const FAMILY_PAGES = 320;

const recipe: PublicationRecipeDefinition = {
  code: 'bench', labels: { el: 'Δοκιμή' }, title: { el: 'Κατάλογος' }, scope: { kind: 'all' }, pricing: { kind: 'none' }, language: 'el',
  theme: { fontCode: 'liberationSans', logoAssetId: null, primary: { rgb: '#003366', cmyk: [100, 70, 0, 40] }, accent: { rgb: '#cc0000', cmyk: [0, 100, 100, 10] } },
  templates: { enabled: ['cover', 'toc', 'chapterDivider', 'codeIndex', 'backCover'], groupStyle: 'rail', gridColumns: 3 },
  profiles: ['print', 'screen'], paper: 'a4', footerNote: {},
};

function entry(index: number): VariantModelEntry {
  const columns = Array.from({ length: 12 }, () => new Map<string, string>());
  const cells = (make: (column: number) => string) => columns.map((_, column) => make(column));
  const rows: PreviewRow[] = [
    { kind: 'axis', id: 'size', label: 'Μέγεθος', cells: cells((column) => `MFP-${column + 1}`) },
    { kind: 'groupHeader', id: 'cool', label: 'Ψύξη' },
    ...Array.from({ length: 28 }, (_, row): PreviewRow => ({ kind: 'attribute', id: `r${row}`, label: `Υψηλότατη ηλεκτρομηχανολογική ιδιότητα ${row}`, unit: 'kW', filter: null, merge: 'none', cells: cells((column) => `${column + 1},${row}`) })),
    { kind: 'attribute', id: 'dim', label: 'Διαστάσεις', unit: 'mm', filter: null, merge: 'none', cells: cells(() => '1058x596x250') },
    { kind: 'attribute', id: 'volt', label: 'Τάση', unit: null, filter: null, merge: 'all', cells: cells(() => '230V-50Hz-1Ph') },
  ];
  return {
    kind: 'variantModel', id: `m${index}`, title: `Μοντέλο ${index}`, descriptionHtml: '<p>Ηλεκτρομηχανολογικές εγκαταστάσεις υψηλότατης απόδοσης, με <strong>ελληνικό</strong> συλλαβισμό.</p>',
    imageAssetId: null, preview: { columns, hiddenColumns: 0, rows }, priceRowIds: new Set(), listingKind: 'product',
    codes: [{ code: `C-${index}`, label: `Μοντέλο ${index}` }],
  };
}

const chapters: PublicationChapter[] = Array.from({ length: 10 }, (_, chapter) => ({
  id: `c${chapter}`, title: `Κεφάλαιο ${chapter + 1}`, entries: Array.from({ length: FAMILY_PAGES / 10 }, (_, index) => entry(chapter * 100 + index)),
}));

const document = composePublication({
  recipe, title: 'Κατάλογος', footer: 'Τιμές έκδοσης 3, ισχύς από 1/11/2026', chapters,
  words: { contents: 'Περιεχόμενα', codeIndex: 'Ευρετήριο κωδικών', tablePart: (part, parts) => `Μέρος ${part} από ${parts}` },
});

const input = { document, fontCode: 'liberationSans' as const, dataAsOfEpoch: 1790000000, readAsset: async () => new Uint8Array(), run: runTypst };

/** Άθραυστος κωδικός σε στενή στήλη: το δυσκολότερο κελί του πίνακα. */
const UNBREAKABLE_CODE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123';

/** Τρία ελαττώματα στο ίδιο PDF: χωρίς αυτά, το «0 ευρήματα» δεν θα ξεχώριζε το καθαρό αρχείο από τον τυφλό κριτή. */
const DEFECTIVE_TYPST = `#set page(width: 120mm, height: 80mm, margin: 10mm)
#set text(font: "Liberation Sans", size: 10pt)
#place(top + left, dx: 5mm, dy: 5mm)[Πρώτο κείμενο επικάλυψης]
#place(top + left, dx: 12mm, dy: 5mm)[Δεύτερο κείμενο επικάλυψης]
#place(top + left, dx: 12mm, dy: 30mm, rotate(90deg, reflow: true)[Κάθετο κείμενο])
#place(top + left, dx: 2mm, dy: 40mm)[Οριζόντιο κείμενο πάνω στο κάθετο]
#place(top + left, dx: 95mm, dy: 50mm)[Κείμενο που βγαίνει έξω από το χαρτί]
#place(top + left, dx: 5mm, dy: 55mm, text(size: 4pt)[μικροσκοπικό])
`;

async function renderRaw(source: string): Promise<Uint8Array> {
  const directory = await mkdtemp(path.join(tmpdir(), 'nestor-witness-'));
  try {
    await writeFile(path.join(directory, 'witness.typ'), source, 'utf8');
    await runTypst({ cwd: directory, args: ['compile', 'witness.typ', 'witness.pdf', '--root', '.', '--ignore-system-fonts', '--font-path', fontDirectoryOf('liberationSans')], timeoutMs: 20_000 });
    return new Uint8Array(await readFile(path.join(directory, 'witness.pdf')));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const hostile = '<p>#import "x.typ": * και #read("/etc/passwd") και $x^2$ και *έντονο* και @ref</p>';

/** Μικρό έγγραφο με ό,τι ο όγκος δεν έχει: κακόβουλο κείμενο, τιμές, ζώνες ομάδας, πλέγμα καρτών. */
function sampler(groupStyle: 'band' | 'rail') {
  const base = entry(1);
  const priced: VariantModelEntry = {
    ...base,
    descriptionHtml: hostile,
    priceRowIds: new Set(['price']),
    preview: { ...base.preview, rows: [
      ...base.preview.rows,
      { kind: 'attribute', id: 'code', label: 'Κωδικός', unit: null, filter: null, merge: 'none', cells: base.preview.columns.map(() => UNBREAKABLE_CODE) },
      { kind: 'attribute', id: 'price', label: 'Τιμή', unit: null, filter: null, merge: 'none', cells: base.preview.columns.map(() => 'Ζητήστε προσφορά') },
    ] },
  };
  const cards = Array.from({ length: 7 }, (_, index) => ({ id: `g${index}`, title: `Εξάρτημα ${index}`, code: `ACC-${index}`, imageAssetId: null, lines: ['1058x596x250'], price: '10,50 €' }));
  return composePublication({
    recipe: { ...recipe, templates: { ...recipe.templates, groupStyle, gridColumns: 5 } },
    title: 'Δείγμα', footer: 'Υποσέλιδο',
    chapters: [{ id: 'a', title: 'Κλιματισμός και εξαερισμός επαγγελματικών χώρων', entries: [priced, { kind: 'productGrid', id: 'grid', title: 'Εξαρτήματα', listingKind: 'product', cards }] }],
    words: { contents: 'Περιεχόμενα', codeIndex: 'Ευρετήριο κωδικών', tablePart: (part, parts) => `Μέρος ${part} από ${parts}` },
  });
}

/** Οι αποσυμπιεσμένες ροές του PDF· ό,τι δεν είναι Flate μένει έξω. */
function inflatedStreams(bytes: Uint8Array): string[] {
  const buffer = Buffer.from(bytes);
  const streams: string[] = [];
  for (let at = buffer.indexOf('stream'); at !== -1; at = buffer.indexOf('stream', at + 6)) {
    const start = at + 6 + (buffer[at + 6] === 13 ? 2 : 1);
    const end = buffer.indexOf('endstream', start);
    if (end === -1) break;
    try { streams.push(inflateSync(buffer.subarray(start, end)).toString('latin1')); } catch { /* όχι Flate */ }
    at = end + 9;
  }
  return streams;
}

const NON_CMYK_OPERATOR = /(?:^|\s)(?:[\d.]+ [\d.]+ [\d.]+ (?:rg|RG)|[\d.]+ (?:g|G))\s/;

describeReal('πραγματικό Typst — κατάλογος 300+ σελίδων', () => {
  it('η μηχανή είναι η μετρημένη έκδοση', async () => {
    await expect(assertTypstAvailable()).resolves.toBe('0.15.1');
  });

  it.each(['print', 'screen'] as const)('προφίλ %s: 300+ σελίδες, μετρημένες', async (profile) => {
    const rendered = await renderPublicationPdf(input, profile);
    const pages = (await PDFDocument.load(rendered.bytes)).getPageCount();
    process.stdout.write(`[typst ${profile}] ${pages} σελ. · ${rendered.renderMs} ms · ${(rendered.bytes.length / 1048576).toFixed(1)} MB\n`);
    expect(pages).toBeGreaterThanOrEqual(300);
    expect(rendered.pageCount).toBe(pages);
  }, 300_000);

  it('🔑 ντετερμινισμός: ίδιες είσοδοι ⇒ ίδια bytes', async () => {
    const [first, second] = [await renderPublicationPdf(input, 'screen'), await renderPublicationPdf(input, 'screen')];
    expect(first.sha256).toBe(second.sha256);
  }, 300_000);

  it.each(['print', 'screen'] as const)('🔑 ντετερμινισμός %s: ο αριθμός νημάτων δεν αλλάζει τα bytes', async (profile) => {
    const withJobs = (jobs: number) => renderPublicationPdf({ ...input, run: (invocation) => runTypst({ ...invocation, jobs }) }, profile);
    const [serial, parallel] = [await withJobs(1), await withJobs(3)];
    expect(serial.sha256).toBe(parallel.sha256);
  }, 300_000);

  it.each(['rail', 'band'] as const)('δείγμα %s: τιμές, ζώνες, κάρτες σε 5 στήλες και κακόβουλο κείμενο μεταγλωττίζονται και στα δύο προφίλ', async (style) => {
    const sample = { ...input, document: sampler(style) };
    for (const profile of ['print', 'screen'] as const) await expect(renderPublicationPdf(sample, profile)).resolves.toMatchObject({ pageCount: expect.any(Number) });
  }, 60_000);

  it('🔴 εκτύπωση: ούτε ένας τελεστής RGB ή gray στις ροές περιεχομένου', async () => {
    const { bytes } = await renderPublicationPdf({ ...input, document: sampler('rail') }, 'print');
    const content = inflatedStreams(bytes).filter((stream) => /\bTf\b/.test(stream));
    expect(content.length).toBeGreaterThan(0);
    expect(content.some((stream) => /\s[\d.]+ [\d.]+ [\d.]+ [\d.]+ k\s/.test(stream))).toBe(true);
    expect(content.filter((stream) => NON_CMYK_OPERATOR.test(stream))).toEqual([]);
  }, 60_000);

  it('🧪 μάρτυρας: ο κριτής ΒΛΕΠΕΙ επικάλυψη, περιστραμμένη επικάλυψη, κομμένο και μικροσκοπικό κείμενο σε πραγματικό PDF', async () => {
    const verdict = judgePublicationLayout(readLayoutInChildProcess(await renderRaw(DEFECTIVE_TYPST)), 0);
    expect(verdict.overlappingTextCount).toBe(2);
    expect(verdict.clippedTextCount).toBe(1);
    expect(verdict.undersizedTextCount).toBe(1);
    expect(verdict.samples.join(' ')).toContain('Κάθετο');
  }, 30_000);

  it.each(['print', 'screen'] as const)('🔴 διάταξη %s: κανένα κείμενο δεν πατά άλλο, δεν βγαίνει από το χαρτί, δεν πέφτει κάτω από το όριο', async (profile) => {
    const bleedPt = profile === 'print' ? document.page.bleedMm * (72 / 25.4) : 0;
    for (const sample of [sampler('rail'), sampler('band'), document]) {
      const { bytes } = await renderPublicationPdf({ ...input, document: sample }, profile);
      const verdict = judgePublicationLayout(readLayoutInChildProcess(bytes), bleedPt);
      process.stdout.write(`[διάταξη ${profile}] ${JSON.stringify(verdict)}\n`);
      expect(verdict.runsExamined).toBeGreaterThan(100);
      expect(verdict).toMatchObject({ overlappingTextCount: 0, clippedTextCount: 0, undersizedTextCount: 0 });
    }
  }, 300_000);

  it('🔑 εκτύπωση: TrimBox = A4, μέσα σε σελίδα μεγαλωμένη κατά το bleed', async () => {
    const { bytes } = await renderPublicationPdf({ ...input, document: sampler('rail') }, 'print');
    const page = (await PDFDocument.load(bytes)).getPage(0);
    expect(page.getTrimBox().width).toBeCloseTo(210 * (72 / 25.4), 0);
    expect(page.getWidth()).toBeCloseTo(216 * (72 / 25.4), 0);
  }, 60_000);

  it('🔑 οθόνη: δηλώνει PDF/A-2b στο ίδιο το αρχείο', async () => {
    const { bytes } = await renderPublicationPdf({ ...input, document: sampler('rail') }, 'screen');
    const everything = [Buffer.from(bytes).toString('latin1'), ...inflatedStreams(bytes)].join('\n');
    expect(everything).toMatch(/pdfaid:part[>="]+\s*2/);
    expect(everything).toMatch(/pdfaid:conformance[>="]+\s*B/);
  }, 60_000);

  // Το `2B` πιο πάνω είναι δήλωση του Typst. Με `CATALOG_TYPST_PDF_OUT` τα αρχεία μένουν στον δίσκο για ανεξάρτητο έλεγχο (veraPDF).
  (pdfOutDirectory ? it : it.skip)('τα αρχεία του προφίλ οθόνης για τον ανεξάρτητο έλεγχο PDF/A', async () => {
    const outputs = { 'screen-rail.pdf': sampler('rail'), 'screen-band.pdf': sampler('band'), 'screen-volume.pdf': document };
    await mkdir(pdfOutDirectory as string, { recursive: true });
    for (const [name, sample] of Object.entries(outputs)) {
      const { bytes } = await renderPublicationPdf({ ...input, document: sample }, 'screen');
      await writeFile(path.join(pdfOutDirectory as string, name), bytes);
    }
  }, 300_000);

  it('προεπισκόπηση: βγάζει PNG μέσα στο χρονικό της όριο', async () => {
    const png = await renderPublicationPreview({ ...input, document: sampler('rail') });
    expect(Buffer.from(png).subarray(1, 4).toString('latin1')).toBe('PNG');
  }, 30_000);
});
