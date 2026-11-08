import 'server-only';

/**
 * Η **πηγή μιας σελίδας PDF** για τον αγωγό (ADR-923 §5.5.1 · §5.5.2 Β3 Γ3): αρχείο της παρτίδας, λέξεις, κανόνες, ετικέτες δομής, και
 * οι ιδιότητες της οικογένειας όπως τις βλέπει το μοντέλο. Ένα σημείο για την **ανάγνωση** (πληρωμένη) και την **ξαναερμηνεία** ($0):
 * ό,τι ανασυντίθεται στη μία ανασυντίθεται ίδια και στην άλλη.
 * @module server/catalog/import-page-source.server
 */

import type { AuthContext } from '@/lib/auth';
import { readPdfPage, type PdfTextLayer } from '@/services/pdf/pdf-rasterize.service';
import type { PageRule, PageTagTable } from '@/lib/pdf-tables/page-table-types';
import type { PageAttributeSpec } from '@/subapps/catalog/import/page-extraction';
import { tokenizePage, type PageToken } from '@/subapps/catalog/import/page-tokens';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import { IMPORT_PAGE_DPI } from '@/subapps/catalog/vocabulary/catalog-import';
import { attributeOwnerDepth } from '@/subapps/catalog/values/attribute-levels';
import { CatalogWriteError } from './catalog-write-error';
import { fileOwnerOf, type StoredImportBatch } from './import-batch-writer.server';
import type { PageSpecs } from './import-page-flow.server';
import { downloadBatchFile, readBatchFileRecord } from './import-source.server';

export async function readBatchFile(ctx: AuthContext, batch: StoredImportBatch): Promise<Buffer> {
  if (batch.fileId === null) throw new CatalogWriteError('invalid', [{ code: 'fileNotFound', path: 'fileId' }]);
  return downloadBatchFile(await readBatchFileRecord(ctx, fileOwnerOf(batch), batch.fileId));
}

function attributeSpecOf(attribute: CatalogAttributeDefinition, depth: number): PageAttributeSpec {
  const config = attribute.config as { readonly options?: readonly { readonly code: string }[] };
  return {
    code: attribute.code,
    label: attribute.labels.el ?? attribute.labels.en ?? attribute.code,
    description: attribute.description.el ?? attribute.description.en ?? null,
    type: attribute.type,
    level: depth === 0 ? 'shared' : 'variant',
    unique: attribute.unique,
    options: config.options?.map((option) => option.code) ?? [],
  };
}

export function pageSpecs(schema: CatalogSchemaSnapshot): PageSpecs {
  const entries = [...schema.attributes].map(([id, attribute]) => ({ id, attribute }));
  return {
    specs: entries.map(({ id, attribute }) => attributeSpecOf(attribute, schema.scheme ? attributeOwnerDepth(schema.scheme, id) : 1)),
    byCode: new Map(entries.map(({ id, attribute }) => [attribute.code, { ...attribute, id }])),
    codeById: new Map(entries.map(({ id, attribute }) => [id, attribute.code])),
  };
}

export const axisAttributeIdsOf = (schema: CatalogSchemaSnapshot): string[] => schema.scheme?.levels.flatMap((level) => level.axisAttributeIds) ?? [];

export interface PdfPageSource {
  readonly png: Buffer;
  readonly tokens: readonly PageToken[];
  readonly rules: readonly PageRule[];
  readonly tagTables: readonly PageTagTable[];
  readonly textLayer: PdfTextLayer;
}

/** Μία σελίδα του αρχείου της παρτίδας, έτοιμη για ανασύνθεση πινάκων. */
export async function loadPdfPageSource(ctx: AuthContext, batch: StoredImportBatch, page: number): Promise<PdfPageSource> {
  const { png, items, rules, tagTables, textLayer } = await readPdfPage(await readBatchFile(ctx, batch), page, { dpi: IMPORT_PAGE_DPI });
  return { png, tokens: tokenizePage(items), rules, tagTables, textLayer };
}
