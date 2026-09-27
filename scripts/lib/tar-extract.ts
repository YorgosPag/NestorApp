/**
 * @fileoverview **Ανάγνωση tar.gz σε καθαρό Node** — επιλεκτική εξαγωγή, με τα symlinks λυμένα σε αντίγραφα.
 * @related ADR-891 §9 (assets χάρτη φόντου) · `basemap/basemap-assets.ts`
 *
 * 🔑 **ΓΙΑΤΙ ΟΧΙ `tar.exe`**: το tarball του `protomaps/basemaps-assets` έχει **252 symlinks** (η γραμματοσειρά
 * Devanagari δείχνει στις κοινές περιοχές της Noto Sans). Στα Windows η δημιουργία symlink θέλει δικαιώματα ή
 * Developer Mode ⇒ η εξαγωγή αποτυγχάνει ή βγάζει κενά αρχεία, ανάλογα με το μηχάνημα. Εδώ κάθε symlink γίνεται
 * **αντίγραφο** του στόχου του: ίδιο αποτέλεσμα σε κάθε πλατφόρμα, και ο στατικός διακομιστής δεν ακολουθεί links.
 *
 * Υποστηρίζει ό,τι παράγει το GitHub (`git archive`): ustar + pax (`x` για μακριά ονόματα, `g` σφαιρικό σχόλιο).
 */

import { gunzipSync } from 'node:zlib';

const BLOCK = 512;

export interface TarEntry {
  readonly path: string;
  readonly data: Buffer;
}

interface RawEntry {
  readonly path: string;
  readonly type: 'file' | 'symlink';
  readonly data: Buffer;
  readonly linkTarget: string;
}

function field(header: Buffer, offset: number, length: number): string {
  const raw = header.subarray(offset, offset + length);
  const end = raw.indexOf(0);
  return raw.subarray(0, end === -1 ? length : end).toString('utf8');
}

function octal(header: Buffer, offset: number, length: number): number {
  const text = field(header, offset, length).trim();
  return text === '' ? 0 : Number.parseInt(text, 8);
}

/** Εγγραφές pax: `"<μήκος> <κλειδί>=<τιμή>\n"` επαναλαμβανόμενες. */
function parsePax(data: Buffer): Map<string, string> {
  const records = new Map<string, string>();
  let cursor = 0;
  while (cursor < data.length) {
    const space = data.indexOf(0x20, cursor);
    if (space === -1) break;
    const length = Number.parseInt(data.subarray(cursor, space).toString('utf8'), 10);
    if (!Number.isFinite(length) || length <= 0) break;
    const record = data.subarray(space + 1, cursor + length - 1).toString('utf8');
    const eq = record.indexOf('=');
    if (eq > 0) records.set(record.slice(0, eq), record.slice(eq + 1));
    cursor += length;
  }
  return records;
}

function readRawEntries(archive: Buffer): RawEntry[] {
  const entries: RawEntry[] = [];
  let pax = new Map<string, string>();
  for (let offset = 0; offset + BLOCK <= archive.length; ) {
    const header = archive.subarray(offset, offset + BLOCK);
    if (header.every((byte) => byte === 0)) break;
    const size = octal(header, 124, 12);
    const typeflag = field(header, 156, 1);
    const data = archive.subarray(offset + BLOCK, offset + BLOCK + size);
    offset += BLOCK + Math.ceil(size / BLOCK) * BLOCK;

    if (typeflag === 'x') {
      pax = parsePax(data);
      continue;
    }
    if (typeflag === 'g') continue;
    const prefix = field(header, 345, 155);
    const name = field(header, 0, 100);
    const path = pax.get('path') ?? (prefix === '' ? name : `${prefix}/${name}`);
    const linkTarget = pax.get('linkpath') ?? field(header, 157, 100);
    pax = new Map();
    if (typeflag === '0' || typeflag === '') entries.push({ path, type: 'file', data, linkTarget: '' });
    else if (typeflag === '2') entries.push({ path, type: 'symlink', data: Buffer.alloc(0), linkTarget });
  }
  return entries;
}

/** `a/b/../c` → `a/c` — πάντα POSIX, όπως μέσα στο tar. */
function normalizePosix(path: string): string {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.' && part !== '') parts.push(part);
  }
  return parts.join('/');
}

function dirnamePosix(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : path.slice(0, slash);
}

/**
 * Τα αρχεία του tar.gz που περνούν το φίλτρο, με διαδρομή **χωρίς** τον πρώτο φάκελο (το `<repo>-<sha>/` του
 * GitHub). Τα symlinks επιστρέφονται ως αντίγραφα του στόχου· symlink προς κάτι που λείπει ⇒ σφάλμα, όχι σιωπή.
 */
export function readTarGz(gzipped: Buffer, include: (path: string) => boolean): TarEntry[] {
  const raw = readRawEntries(gunzipSync(gzipped));
  const files = new Map(raw.filter((e) => e.type === 'file').map((e) => [e.path, e.data]));
  const stripRoot = (path: string): string => path.slice(path.indexOf('/') + 1);
  const result: TarEntry[] = [];
  for (const entry of raw) {
    const path = stripRoot(entry.path);
    if (!include(path)) continue;
    if (entry.type === 'file') {
      result.push({ path, data: entry.data });
      continue;
    }
    const target = normalizePosix(`${dirnamePosix(entry.path)}/${entry.linkTarget}`);
    const data = files.get(target);
    if (data === undefined) throw new Error(`tar: το symlink ${entry.path} δείχνει στο ${target}, που δεν υπάρχει`);
    result.push({ path, data });
  }
  return result;
}
