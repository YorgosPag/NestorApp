/**
 * ADR-923 §5.6 — ο προσαρμογέας, **χωρίς** εκτελέσιμο: ορίσματα ανά προφίλ, φάκελος εργασίας, κουτιά εκτύπωσης, ρητές αποτυχίες.
 * Το πραγματικό PDF το κρίνει το `typst-real.test.ts`, που τρέχει μόνο με `CATALOG_TYPST_BIN`.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import { PDFDocument } from 'pdf-lib';

import { PUBLICATION_A4 } from '@/subapps/catalog/publishing/compose-publication';
import type { LayoutDocument } from '@/subapps/catalog/publishing/layout-model';
import { readPdfTextLayout } from '@/services/pdf/pdf-rasterize.service';
import { UNCHECKED_PUBLICATION_LAYOUT } from '@/subapps/catalog/types/publication';
import { applyPrintBoxes, inspectRenderedLayout, renderPublicationPdf, typstCompileArgs, typstPreviewArgs } from '../typst-adapter';
import { parseTypstVersion, typstJobsFor, type TypstRunner } from '../typst-engine.server';
import { PUBLICATION_TYPST_TEMPLATE } from '../typst-template';
import { measurePdfCheckPeakInChildProcess, parsePeakOutput } from './pdf-layout-oracle';

jest.mock('server-only', () => ({}));
jest.mock('@/services/pdf/pdf-rasterize.service', () => ({ readPdfTextLayout: jest.fn() }));

const readLayout = jest.mocked(readPdfTextLayout);
const colour = { rgb: '#000000', cmyk: [0, 0, 0, 100] as const };
const document: LayoutDocument = {
  schemaVersion: 1, title: 'Τ', language: 'el', page: PUBLICATION_A4, footer: 'f',
  theme: { fontFamily: 'Liberation Sans', primary: colour, accent: colour, tint: colour, text: colour, rule: colour },
  sections: [{ id: 's', template: 'family', blocks: [{ kind: 'image', image: { assetId: 'a1', alt: 'x', widthMm: 60 } }, { kind: 'paragraph', inlines: [{ text: '#import "/etc/passwd"' }] }] }],
};

async function pdfBytes(pages: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1) pdf.addPage([612.28, 858.9]);
  return pdf.save();
}

describe('ορίσματα ανά προφίλ (§5.6)', () => {
  const base = { fontDirectory: '/fonts', dataAsOfEpoch: 1700000000, output: 'o.pdf' };

  it('εκτύπωση: χωρίς ετικέτες, χωρίς πρότυπο', () => {
    const args = typstCompileArgs({ ...base, profile: 'print' });
    expect(args).toContain('--no-pdf-tags');
    expect(args).not.toContain('--pdf-standard');
    expect(args).toContain('profile=print');
  });

  it('οθόνη: PDF/A-2b με ετικέτες', () => {
    const args = typstCompileArgs({ ...base, profile: 'screen' });
    expect(args.slice(args.indexOf('--pdf-standard'), args.indexOf('--pdf-standard') + 2)).toEqual(['--pdf-standard', 'a-2b']);
    expect(args).not.toContain('--no-pdf-tags');
  });

  it('🔒 κλειστή μηχανή: root ο φάκελος, καμία γραμματοσειρά συστήματος', () => {
    for (const args of [typstCompileArgs({ ...base, profile: 'print' }), typstPreviewArgs(base)]) {
      expect(args).toEqual(expect.arrayContaining(['--ignore-system-fonts', '--root', '.']));
    }
  });

  it('🔑 η χρονοσφραγίδα έρχεται από τα δεδομένα, όχι από το «τώρα»', () => {
    const args = typstCompileArgs({ ...base, profile: 'print' });
    expect(args[args.indexOf('--creation-timestamp') + 1]).toBe('1700000000');
  });
});

describe('το πρότυπο', () => {
  it('🔒 κανένα πακέτο, κανένα `eval`, κανένα `read` — το κείμενο μένει δεδομένο', () => {
    expect(PUBLICATION_TYPST_TEMPLATE).not.toMatch(/@preview|\beval\(|\bread\(/);
  });

  it('🔴 καμία ρητή `black`/`luma`: στο CMYK αρχείο κάθε χρώμα περνά από το ink()', () => {
    expect(PUBLICATION_TYPST_TEMPLATE).not.toMatch(/\bblack\b|\bluma\(|\bwhite\b/);
  });

  it('η κεφαλίδα του πίνακα επαναλαμβάνεται, και η ζώνη ομάδας μαζί της', () => {
    expect(PUBLICATION_TYPST_TEMPLATE).toContain('table.header(repeat: true');
    expect(PUBLICATION_TYPST_TEMPLATE).toContain('table.header(level: 2, repeat: true');
  });

  it('🔴 μέσα σε πίνακα όχι `justify`: ο βελτιστοποιητής γραμμών αφήνει την τιμή να πατήσει τη διπλανή', () => {
    const tableBody = PUBLICATION_TYPST_TEMPLATE.slice(PUBLICATION_TYPST_TEMPLATE.indexOf('#let table-of(t)'));
    expect(tableBody.slice(0, 80)).toContain('set par(justify: false)');
  });

  it('🔑 το πλάτος ετικέτας δεν ζει δεύτερη φορά στο πρότυπο', () => {
    expect(PUBLICATION_TYPST_TEMPLATE).toContain('t.labelColumnMm');
    expect(PUBLICATION_TYPST_TEMPLATE).not.toContain('52mm');
  });
});

describe('renderPublicationPdf', () => {
  const input = (run: TypstRunner, profile = 0) => ({ document, fontCode: 'liberationSans' as const, fonts: [], dataAsOfEpoch: profile + 1, readAsset: async () => new Uint8Array([1, 2, 3]), run });

  it('γράφει πρότυπο + JSON + εικόνες, και το κείμενο μένει JSON (όχι κώδικας)', async () => {
    const seen: { files: string[]; json: LayoutDocument | null } = { files: [], json: null };
    const run: TypstRunner = async ({ cwd }) => {
      seen.files = readdirSync(cwd).sort();
      seen.json = JSON.parse(readFileSync(path.join(cwd, 'document.json'), 'utf8')) as LayoutDocument;
      expect(existsSync(path.join(cwd, 'assets', 'a1.jpg'))).toBe(true);
      expect(readFileSync(path.join(cwd, 'catalog.typ'), 'utf8')).not.toContain('/etc/passwd');
      writeFileSync(path.join(cwd, 'output.pdf'), await pdfBytes(2));
    };
    const result = await renderPublicationPdf(input(run), 'screen');
    expect(seen.files).toEqual(['assets', 'catalog.typ', 'document.json']);
    expect(result.pageCount).toBe(2);
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('🔑 οι όψεις του προμηθευτή μπαίνουν στον φάκελο εργασίας, με τη γραμματοσειρά της πλατφόρμας ως εφεδρεία', async () => {
    const seen: { font: boolean; args: readonly string[] } = { font: false, args: [] };
    const run: TypstRunner = async ({ cwd, args }) => {
      seen.font = existsSync(path.join(cwd, 'fonts', 'a.ttf'));
      seen.args = args;
      writeFileSync(path.join(cwd, 'output.pdf'), await pdfBytes(1));
    };
    await renderPublicationPdf({ ...input(run), fonts: [{ name: 'a.ttf', bytes: new Uint8Array([1]) }] }, 'screen');
    expect(seen.font).toBe(true);
    expect(seen.args.filter((arg, index) => seen.args[index - 1] === '--font-path')).toEqual(['fonts', expect.stringContaining('fonts')]);
  });

  it('🔴 ο φάκελος εργασίας σβήνεται και σε αποτυχία', async () => {
    let directory = '';
    const run: TypstRunner = async ({ cwd }) => { directory = cwd; throw new Error('boom'); };
    await expect(renderPublicationPdf(input(run), 'print')).rejects.toThrow('boom');
    expect(existsSync(directory)).toBe(false);
    mkdirSync(directory, { recursive: true });
  });
});

describe('applyPrintBoxes', () => {
  it('🔑 TrimBox = η σελίδα χωρίς το bleed · BleedBox = ολόκληρη', async () => {
    const boxed = await applyPrintBoxes(await pdfBytes(1), PUBLICATION_A4);
    const page = (await PDFDocument.load(boxed.bytes)).getPage(0);
    const bleed = PUBLICATION_A4.bleedMm * (72 / 25.4);
    expect(page.getTrimBox().x).toBeCloseTo(bleed, 2);
    expect(page.getTrimBox().width).toBeCloseTo(612.28 - 2 * bleed, 2);
    expect(page.getBleedBox().width).toBeCloseTo(612.28, 2);
    expect(boxed.pageCount).toBe(1);
  });
});

describe('inspectRenderedLayout', () => {
  const size = [8, 0, 0, 8] as const;
  const onPage = (runs: readonly { text: string; transform: readonly number[]; width: number }[]) => [{ widthPt: 600, heightPt: 850, runs }];

  it('🔑 η κρίση φτάνει στην αναφορά, με το bleed μόνο στην εκτύπωση', async () => {
    readLayout.mockResolvedValue(onPage([{ text: 'α', transform: [...size, 5, 400], width: 20 }]));
    await expect(inspectRenderedLayout(new Uint8Array(), 'screen', PUBLICATION_A4)).resolves.toMatchObject({ layoutChecked: true, clippedTextCount: 0 });
    await expect(inspectRenderedLayout(new Uint8Array(), 'print', PUBLICATION_A4)).resolves.toMatchObject({ layoutChecked: true, clippedTextCount: 1 });
  });

  it('🔴 αποτυχία ανάγνωσης: «δεν ελέγχθηκε», και η έκδοση δεν πέφτει', async () => {
    readLayout.mockRejectedValue(new Error('corrupt'));
    await expect(inspectRenderedLayout(new Uint8Array(), 'print', PUBLICATION_A4)).resolves.toEqual(UNCHECKED_PUBLICATION_LAYOUT);
  });

  it('🔴 PDF χωρίς κείμενο: «δεν ελέγχθηκε», όχι μηδενικά που μοιάζουν καθαρά', async () => {
    readLayout.mockResolvedValue(onPage([]));
    await expect(inspectRenderedLayout(new Uint8Array(), 'print', PUBLICATION_A4)).resolves.toEqual(UNCHECKED_PUBLICATION_LAYOUT);
  });
});

describe('typstJobsFor', () => {
  it('🔑 ένας πυρήνας μένει στον web server, ποτέ λιγότερο από ένα νήμα', () => {
    expect(typstJobsFor(4)).toBe(3);
    expect(typstJobsFor(2)).toBe(1);
    expect(typstJobsFor(1)).toBe(1);
    expect(typstJobsFor(0)).toBe(1);
  });
});

describe('μέτρηση μνήμης του ελέγχου (CHECK 3.110)', () => {
  it('🔴 προειδοποίηση βιβλιοθήκης στο stdout δεν χαλά το αποτέλεσμα, και αναφέρεται μία φορά', () => {
    const result = '{"baselineRssKb":1,"peakRssKb":2,"pages":3,"runs":4}';
    expect(parsePeakOutput(`Warning: Χ\nWarning: Χ\n${result}`)).toEqual({ baselineRssKb: 1, peakRssKb: 2, pages: 3, runs: 4, warnings: ['Warning: Χ'] });
    expect(parsePeakOutput(result).warnings).toEqual([]);
  });

  it.each(['print', 'screen'] as const)('προφίλ %s: η διεργασία διαβάζει πραγματικό PDF και αναφέρει αληθινή κορυφή', async (profile) => {
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText('Katalogos');
    const peak = measurePdfCheckPeakInChildProcess(await pdf.save(), profile);
    expect(peak).toMatchObject({ pages: 1, runs: 1 });
    expect(peak.baselineRssKb).toBeGreaterThan(10_000);
    expect(peak.peakRssKb).toBeGreaterThanOrEqual(peak.baselineRssKb);
  }, 30_000);
});

describe('parseTypstVersion', () => {
  it('διαβάζει την έκδοση, και αλλιώς δεν μαντεύει', () => {
    expect(parseTypstVersion('typst 0.15.1 (abc1234)')).toBe('0.15.1');
    expect(parseTypstVersion('command not found')).toBeNull();
  });
});
