import 'server-only';

/**
 * Ο **προσαρμογέας Typst** (ADR-923 §5.6): από το ουδέτερο μοντέλο στα ορίσματα μιας απόδοσης, και μετά στο τελικό αρχείο.
 *
 * | Προφίλ | Χρώμα | Πρότυπο | Ετικέτες | Κουτιά |
 * |---|---|---|---|---|
 * | `print` | CMYK + CMYK JPEG | κανένα | όχι (`--no-pdf-tags`: 2,4 MB αντί 14,4 MB στις 345 σελ.) | TrimBox + BleedBox |
 * | `screen` | RGB | PDF/A-2b | ναι | — |
 *
 * ⚠️ Το Typst αρνείται PDF/A με CMYK και δεν έχει PDF/X ⇒ **δύο χωριστές αποδόσεις**, ποτέ ένα αρχείο για όλα.
 * ⚠️ Το Typst δεν γράφει TrimBox/BleedBox: τα ορίζουμε εδώ με το `pdf-lib`, γιατί χωρίς αυτά το τυπογραφείο δεν ξέρει πού
 *    κόβεται το χαρτί. Το bleed το έχει ήδη το πρότυπο (μεγαλύτερη σελίδα, ίδια περιοχή κειμένου).
 * 🔑 **Ντετερμινισμός**: `--creation-timestamp` από τα **δεδομένα** (`dataAsOfEpoch`), `updateMetadata: false` ⇒ ίδιες είσοδοι,
 *    ίδια bytes.
 * @module server/catalog/publishing/typst-adapter
 */

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { PDFDocument } from 'pdf-lib';

import { collectLayoutAssetIds, renditionUseOf, type LayoutDocument, type LayoutPage } from '@/subapps/catalog/publishing/layout-model';
import { PUBLICATION_FONTS, type PublicationFontCode } from '@/subapps/catalog/publishing/publication-fonts';
import type { PublicationOutputProfile } from '@/subapps/catalog/publishing/publication-vocabulary';
import { TYPST_PREVIEW_TIMEOUT_MS, TYPST_RENDER_TIMEOUT_MS, type TypstRunner } from './typst-engine.server';
import { PUBLICATION_TYPST_TEMPLATE, TYPST_ASSET_DIR, TYPST_DOCUMENT_FILENAME, TYPST_TEMPLATE_FILENAME } from './typst-template';

const MM_TO_POINTS = 72 / 25.4;
const PREVIEW_PPI = 110;

/** Τα bytes μιας εικόνας για ένα προφίλ — τα φέρνει ο καλών από τις καταγεγραμμένες αποδόσεις. */
export type AssetBytesReader = (assetId: string, use: 'print' | 'web') => Promise<Uint8Array>;

export interface RenderInput {
  readonly document: LayoutDocument;
  readonly fontCode: PublicationFontCode;
  /** Χρονοσφραγίδα των δεδομένων, δευτερόλεπτα epoch — όχι «τώρα». */
  readonly dataAsOfEpoch: number;
  readonly readAsset: AssetBytesReader;
  readonly run: TypstRunner;
}

export interface RenderedPdf {
  readonly bytes: Uint8Array;
  readonly pageCount: number;
  readonly sha256: string;
  readonly renderMs: number;
}

export function fontDirectoryOf(fontCode: PublicationFontCode): string {
  return path.resolve(process.cwd(), path.dirname(PUBLICATION_FONTS[fontCode].files[0]));
}

/** Τα ορίσματα της απόδοσης — καθαρά, για να κλειδώνονται με άγκυρα: η διαφορά των προφίλ ζει **μόνο** εδώ. */
export function typstCompileArgs(input: { readonly profile: PublicationOutputProfile; readonly fontDirectory: string; readonly dataAsOfEpoch: number; readonly output: string }): string[] {
  const common = [
    'compile', TYPST_TEMPLATE_FILENAME, input.output,
    '--root', '.',
    '--input', `profile=${input.profile}`,
    '--ignore-system-fonts',
    '--font-path', input.fontDirectory,
    '--creation-timestamp', String(input.dataAsOfEpoch),
    '--diagnostic-format', 'short',
  ];
  return input.profile === 'print' ? [...common, '--no-pdf-tags'] : [...common, '--pdf-standard', 'a-2b'];
}

export function typstPreviewArgs(input: { readonly fontDirectory: string; readonly output: string }): string[] {
  return [
    'compile', TYPST_TEMPLATE_FILENAME, input.output,
    '--root', '.',
    '--input', 'profile=screen',
    '--ignore-system-fonts',
    '--font-path', input.fontDirectory,
    '--format', 'png',
    '--pages', '1',
    '--ppi', String(PREVIEW_PPI),
  ];
}

async function prepareWorkspace(document: LayoutDocument, profile: PublicationOutputProfile, readAsset: AssetBytesReader): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'nestor-publication-'));
  await writeFile(path.join(directory, TYPST_TEMPLATE_FILENAME), PUBLICATION_TYPST_TEMPLATE, 'utf8');
  await writeFile(path.join(directory, TYPST_DOCUMENT_FILENAME), JSON.stringify(document), 'utf8');
  await mkdir(path.join(directory, TYPST_ASSET_DIR));
  const use = renditionUseOf(profile);
  for (const assetId of collectLayoutAssetIds(document)) {
    await writeFile(path.join(directory, TYPST_ASSET_DIR, `${assetId}.jpg`), await readAsset(assetId, use));
  }
  return directory;
}

/** Ορίζει TrimBox/BleedBox σε κάθε σελίδα του προφίλ εκτύπωσης· επιστρέφει και το πλήθος σελίδων. */
export async function applyPrintBoxes(bytes: Uint8Array, page: LayoutPage): Promise<{ readonly bytes: Uint8Array; readonly pageCount: number }> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  const bleed = page.bleedMm * MM_TO_POINTS;
  for (const pdfPage of pdf.getPages()) {
    const { width, height } = pdfPage.getSize();
    pdfPage.setBleedBox(0, 0, width, height);
    pdfPage.setTrimBox(bleed, bleed, width - 2 * bleed, height - 2 * bleed);
  }
  return { bytes: await pdf.save({ updateFieldAppearances: false }), pageCount: pdf.getPageCount() };
}

async function finishPdf(bytes: Uint8Array, profile: PublicationOutputProfile, page: LayoutPage) {
  if (profile === 'print') return applyPrintBoxes(bytes, page);
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  return { bytes, pageCount: pdf.getPageCount() };
}

/** Μία απόδοση ενός προφίλ. Ο φάκελος εργασίας σβήνεται πάντα. */
export async function renderPublicationPdf(input: RenderInput, profile: PublicationOutputProfile): Promise<RenderedPdf> {
  const started = performance.now();
  const directory = await prepareWorkspace(input.document, profile, input.readAsset);
  try {
    const output = 'output.pdf';
    const args = typstCompileArgs({ profile, fontDirectory: fontDirectoryOf(input.fontCode), dataAsOfEpoch: input.dataAsOfEpoch, output });
    await input.run({ cwd: directory, args, timeoutMs: TYPST_RENDER_TIMEOUT_MS });
    const finished = await finishPdf(new Uint8Array(await readFile(path.join(directory, output))), profile, input.document.page);
    const sha256 = createHash('sha256').update(finished.bytes).digest('hex');
    return { ...finished, sha256, renderMs: Math.round(performance.now() - started) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** Η πρώτη σελίδα σε PNG — η προεπισκόπηση «έτσι θα τυπωθεί». */
export async function renderPublicationPreview(input: Pick<RenderInput, 'document' | 'fontCode' | 'readAsset' | 'run'>): Promise<Uint8Array> {
  const directory = await prepareWorkspace(input.document, 'screen', input.readAsset);
  try {
    const output = 'preview.png';
    await input.run({ cwd: directory, args: typstPreviewArgs({ fontDirectory: fontDirectoryOf(input.fontCode), output }), timeoutMs: TYPST_PREVIEW_TIMEOUT_MS });
    return await readFile(path.join(directory, output));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
