import 'server-only';

/**
 * Η **συσκευασία IDML** (ADR-923 §5.6.1): `catalog.idml` + `Links/`, όπως το Package του InDesign.
 *
 * 🔑 Το InDesign δεν λύνει σχετικούς συνδέσμους, και η ενσωμάτωση εικόνων υψηλής ανάλυσης μέσα στο XML θα φούσκωνε το αρχείο. Ο σχεδιαστής
 *    ανοίγει το `.idml` και κάνει «Relink to Folder» στο `Links/`, που έχει τις αποδόσεις εκτύπωσης σε CMYK ή στον χώρο της πηγής.
 * 🔒 Το ZIP μέσα στο ZIP είναι σκόπιμο: το `.idml` είναι από μόνο του πακέτο με αυστηρούς κανόνες (`mimetype` πρώτο και ασυμπίεστο).
 * ⚠️ Όλες οι εικόνες περνούν από τη μνήμη του web server, όπως και το PDF. Το λύνει το στάδιο 2 του σχεδίου εκτελεστή (§5.6.1).
 * @module server/catalog/publishing/idml-package.server
 */

import { createHash } from 'node:crypto';

import sharp from 'sharp';

import { buildZip, type ZipEntry } from '@/lib/zip/zip-builder';
import { IDML_MIMETYPE, idmlParts } from '@/subapps/catalog/publishing/idml-document';
import type { IdmlImage } from '@/subapps/catalog/publishing/idml-story';
import { collectLayoutAssetIds, type LayoutDocument } from '@/subapps/catalog/publishing/layout-model';
import type { AssetBytesReader, RenderedPdf } from './typst-adapter';

export interface IdmlRenderInput {
  readonly document: LayoutDocument;
  readonly pageCount: number;
  readonly readAsset: AssetBytesReader;
}

const encoder = new TextEncoder();

async function linkedImage(assetId: string, read: AssetBytesReader): Promise<{ readonly image: IdmlImage; readonly bytes: Uint8Array }> {
  const bytes = await read(assetId, 'print');
  const { width, height } = await sharp(bytes).metadata();
  return { image: { fileName: `${assetId}.jpg`, widthPx: width ?? 1, heightPx: height ?? 1 }, bytes };
}

/** Μία εικόνα τη φορά: η σειρά είναι του εγγράφου, άρα ίδιες είσοδοι δίνουν ίδια bytes. */
async function linkedImages(document: LayoutDocument, read: AssetBytesReader) {
  const linked = new Map<string, Awaited<ReturnType<typeof linkedImage>>>();
  for (const assetId of collectLayoutAssetIds(document)) linked.set(assetId, await linkedImage(assetId, read));
  return linked;
}

function idmlZip(document: LayoutDocument, pageCount: number, images: ReadonlyMap<string, IdmlImage>): Uint8Array {
  const parts: ZipEntry[] = idmlParts({ document, pageCount, images }).map(({ path, content }) => ({ filename: path, data: encoder.encode(content) }));
  return buildZip([{ filename: 'mimetype', data: encoder.encode(IDML_MIMETYPE), stored: true }, ...parts]);
}

/** Το πακέτο μιας έκδοσης. Ντετερμινιστικό, όπως το PDF: το ZIP δεν γράφει ώρα. */
export async function renderPublicationIdml(input: IdmlRenderInput): Promise<RenderedPdf> {
  const started = performance.now();
  const linked = await linkedImages(input.document, input.readAsset);
  const idml = idmlZip(input.document, input.pageCount, new Map([...linked].map(([id, entry]) => [id, entry.image])));
  const links = [...linked.values()].map(({ image, bytes }) => ({ filename: `Links/${image.fileName}`, data: bytes, stored: true }));
  const bytes = buildZip([{ filename: 'catalog.idml', data: idml, stored: true }, ...links]);
  return { bytes, pageCount: input.pageCount, sha256: createHash('sha256').update(bytes).digest('hex'), renderMs: Math.round(performance.now() - started) };
}
