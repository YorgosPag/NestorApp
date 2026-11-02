import 'server-only';

/**
 * Η **ανάγνωση μιας γραμματοσειράς προμηθευτή** (ADR-923 §5.6.1): τα γεγονότα βγαίνουν από τα bytes, ποτέ από δήλωση του πελάτη.
 *
 * 🔑 Το όνομα οικογένειας το δίνει η μηχανή (`typst fonts`), όχι ο πίνακας `name`: το Typst κόβει καταλήξεις βάρους, και άλλο
 *    όνομα από το δικό του θα έδινε **σιωπηλά** άλλη γραμματοσειρά στο PDF.
 * ⚠️ Τα μεταβλητά αρχεία απορρίπτονται: η έξοδός τους στο PDF δεν έχει μετρηθεί. Ο προμηθευτής ανεβάζει στατικές όψεις.
 * @module server/catalog/publishing/publication-font-file.server
 */

import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import * as opentype from 'opentype.js';

import { fontEmbeddingOf } from '@/subapps/catalog/publishing/publication-font-rights';
import type { CatalogIssueCode } from '@/subapps/catalog/schema/catalog-issues';
import type { CatalogFontFacts } from '@/subapps/catalog/types/asset';
import { readTypstFontFamily } from './typst-engine.server';

export type FontInspection =
  | { readonly kind: 'ready'; readonly facts: CatalogFontFacts }
  | { readonly kind: 'refused'; readonly code: CatalogIssueCode };

type NameRecords = Readonly<Record<string, Readonly<Record<string, string>> | undefined>>;

/** Ό,τι διαβάζουμε από το `opentype.js`, δηλωμένο ρητά γιατί οι τύποι του δεν περιγράφουν τους πίνακες. */
interface ParsedFont {
  readonly names: NameRecords & { readonly windows?: NameRecords; readonly macintosh?: NameRecords };
  readonly tables: {
    readonly os2?: { readonly fsType: number; readonly usWeightClass: number; readonly fsSelection: number };
    readonly cmap?: { readonly glyphIndexMap: Readonly<Record<number, number>> };
    readonly fvar?: unknown;
  };
}

const FS_SELECTION_ITALIC = 0x0001;
const MAX_NOTICE_LENGTH = 500;
/** Αντιπροσωπευτικά σύνολα: όχι όλο το Unicode, αλλά ό,τι χρειάζεται για να τυπωθεί ένας κατάλογος. */
const LATIN_SAMPLE = 'ABCXYZabcxyz0123456789';
const GREEK_SAMPLE = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψωςάέήίόύώ';

function parseFont(bytes: Uint8Array): ParsedFont | null {
  try {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return opentype.parse(buffer, { lowMemory: true }) as unknown as ParsedFont;
  } catch {
    return null;
  }
}

function nameOf(font: ParsedFont, key: string): string | null {
  const table = font.names.windows ?? font.names.macintosh ?? font.names;
  const record = table[key];
  const value = record ? record.en ?? Object.values(record)[0] ?? '' : '';
  return value.trim().slice(0, MAX_NOTICE_LENGTH) || null;
}

const covers = (font: ParsedFont, sample: string): boolean =>
  [...sample].every((char) => (font.tables.cmap?.glyphIndexMap[char.codePointAt(0) ?? 0] ?? 0) !== 0);

/** Το αρχείο μόνο του σε φάκελο: ό,τι απαντήσει η μηχανή αφορά αυτό και τίποτε άλλο. */
async function engineFamilyOf(bytes: Uint8Array, readFamily: typeof readTypstFontFamily): Promise<string | null> {
  const directory = await mkdtemp(path.join(tmpdir(), 'nestor-font-'));
  try {
    // Η μηχανή ανοίγει μόνο κατάληξη γραμματοσειράς και κρίνει τη μορφή από τα bytes, άρα το `.ttf` ισχύει και για OTF.
    await writeFile(path.join(directory, 'font.ttf'), bytes);
    return await readFamily(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** Η μία κρίση ενός αρχείου. Κάθε άρνηση έχει κωδικό που μπορεί να διορθώσει ο άνθρωπος. */
export async function inspectFontFile(bytes: Uint8Array, readFamily: typeof readTypstFontFamily = readTypstFontFamily): Promise<FontInspection> {
  const font = parseFont(bytes);
  const os2 = font?.tables.os2;
  if (!font || !os2 || !font.tables.cmap) return { kind: 'refused', code: 'fontFileUnreadable' };
  if (font.tables.fvar) return { kind: 'refused', code: 'fontVariableUnsupported' };
  const embedding = fontEmbeddingOf(os2.fsType);
  if (embedding === null) return { kind: 'refused', code: 'fontEmbeddingForbidden' };
  const family = await engineFamilyOf(bytes, readFamily);
  if (family === null) return { kind: 'refused', code: 'fontFileUnreadable' };
  return {
    kind: 'ready',
    facts: {
      family,
      weight: os2.usWeightClass,
      italic: (os2.fsSelection & FS_SELECTION_ITALIC) !== 0,
      embedding,
      coversLatin: covers(font, LATIN_SAMPLE),
      coversGreek: covers(font, GREEK_SAMPLE),
      copyright: nameOf(font, 'copyright'),
      license: nameOf(font, 'license'),
      licenseUrl: nameOf(font, 'licenseURL'),
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
  };
}
