/**
 * @fileoverview **Το αρχείο στον browser** (ADR-923 §5.5.1): είδος, αποτύπωμα, προεπισκόπηση πίνακα και πρώτη πρόταση στηλών.
 * Καθαρό εκτός από το `crypto.subtle`. Η αλήθεια είναι το αρχείο στον διακομιστή· εδώ είναι βοήθεια για την αντιστοίχιση.
 * @module components/catalog/imports/import-source-file
 */

import { sha256Hex } from '@/lib/hash/sha256';
import { suggestRolesFromHeaders } from '@/lib/tabular-import/column-mapping';
import { readDelimitedText } from '@/lib/tabular-import/delimited-reader';
import { readExcelToTable } from '@/lib/tabular-import/excel-reader';
import type { HeaderHints, RawTable } from '@/lib/tabular-import/tabular-types';
import { decodeSurveyText } from '@/lib/terrain/survey-import/survey-file-read';
import type { ImportColumnRule, ImportTarget } from '@/subapps/catalog/types/catalog-import';
import { ANY_SLOT } from '@/subapps/catalog/types/product';
import type { ImportPurpose, ImportSourceKind } from '@/subapps/catalog/vocabulary/catalog-import';

export function sourceKindOf(fileName: string): ImportSourceKind | null {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'pdf';
  if (extension === 'xlsx') return 'spreadsheet';
  return extension === 'csv' || extension === 'txt' ? 'delimited' : null;
}

export async function sha256Of(file: File): Promise<string> {
  return sha256Hex(await file.arrayBuffer());
}

export interface TableReadOptions {
  readonly skipRows: number;
  readonly sheetIndex: number;
}

export async function readTablePreview(file: File, kind: ImportSourceKind, options: TableReadOptions): Promise<RawTable> {
  const buffer = await file.arrayBuffer();
  if (kind === 'spreadsheet') return readExcelToTable(buffer, options);
  return readDelimitedText(decodeSurveyText(new Uint8Array(buffer)), { skipRows: options.skipRows });
}

/** Ένας ρόλος στήλης ως σταθερή συμβολοσειρά: ο πίνακας υποδείξεων δουλεύει με ισότητα, και ο επιλογέας το ίδιο. */
export type ImportRoleKey = string;
export const IGNORE_ROLE: ImportRoleKey = 'ignore';

const PRICE_HINTS: HeaderHints<ImportRoleKey> = [
  ['skuIdentifier', ['κωδικ', 'code', 'sku', 'είδος']],
  ['price:netPrice', ['τιμή', 'τιμη', 'price', 'καθαρή']],
  ['price:unitCode', ['μονάδα', 'μοναδα', 'unit', 'μ.μ']],
  ['price:priceQuantity', ['ανά', 'per', 'ποσότητα τιμής']],
  ['price:discountGroup', ['ομάδα έκπτωσης', 'discount', 'έκπτωση']],
];

const attributeRole = (attributeId: string): ImportRoleKey => `attribute:${attributeId}`;

export function targetOfRole(role: ImportRoleKey): ImportTarget | null {
  if (role === IGNORE_ROLE) return null;
  if (role === 'modelCode' || role === 'skuIdentifier') return { kind: role };
  const [kind, value] = role.split(':');
  if (kind === 'attribute') return { kind: 'attribute', attributeId: value, channel: ANY_SLOT, locale: ANY_SLOT };
  return { kind: 'price', field: value as Extract<ImportTarget, { kind: 'price' }>['field'] };
}

export interface AttributeChoice {
  readonly id: string;
  readonly label: string;
}

const attributeHints = (attributes: readonly AttributeChoice[]): HeaderHints<ImportRoleKey> => [
  ['modelCode', ['μοντέλο', 'model', 'σειρά']],
  ...attributes.map((attribute): readonly [ImportRoleKey, readonly string[]] => [attributeRole(attribute.id), [attribute.label.trim().toLowerCase()]]),
];

/** Η πρώτη πρόταση στηλών: ετικέτες αρχείου απέναντι στις ετικέτες των ιδιοτήτων. Ο άνθρωπος τη βλέπει και τη διορθώνει. */
export function proposeColumns(table: RawTable, purpose: ImportPurpose, attributes: readonly AttributeChoice[]): ImportColumnRule[] {
  const width = Math.max(table.headers.length, ...table.rows.slice(0, 20).map((row) => row.length), 0);
  const headers = table.headers.length > 0 ? table.headers : Array.from({ length: width }, () => '');
  const hints = purpose === 'priceLines' ? PRICE_HINTS : attributeHints(attributes);
  const roles = suggestRolesFromHeaders(headers, hints, IGNORE_ROLE);
  return headers.map((header, position) => ({ header, position, target: targetOfRole(roles[position] ?? IGNORE_ROLE), unitCode: null }));
}

export function roleOfTarget(target: ImportTarget | null): ImportRoleKey {
  if (target === null) return IGNORE_ROLE;
  if (target.kind === 'attribute') return attributeRole(target.attributeId);
  return target.kind === 'price' ? `price:${target.field}` : target.kind;
}
