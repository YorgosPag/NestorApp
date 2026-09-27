/**
 * @fileoverview **Ο ΓΕΝΝΗΤΟΡΑΣ ΤΩΝ ΟΝΟΜΑΤΩΝ ΕΜΦΑΝΙΣΗΣ** — «ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ» → «Δήμος Αθηναίων» — ADR-893.
 *
 * ```
 * ν. 3852/2010 (Βικιθήκη) ─┐
 * Wikidata (P1116 + τύποι) ─┼→ resolve-display-names (ίδιες λέξεις + μονοτονικό + ομοφωνία)
 * επιμέλεια (reviewed.json) ┘      → scripts/data/admin-display-names.json   (αποφάσεις + αναφορά)
 *                                   → build:administrative-hierarchy τις εφαρμόζει
 * ```
 *
 * **Εκτέλεση**: `npm run build:admin-display-names` (`-- --refresh` για νέα λήψη των πηγών).
 *
 * 🔑 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΣΤΟ GIT ΚΑΙ ΟΧΙ ΛΗΨΗ ΜΕΣΑ ΣΤΟΝ ΜΕΤΑΣΧΗΜΑΤΙΣΤΗ**: κάθε τόνος που
 * φτάνει στον άνθρωπο πρέπει να φαίνεται σε **diff** — με την πηγή και την απόδειξή του. Και ο
 * μετασχηματιστής της ιεραρχίας μένει **χωρίς δίκτυο**: ιδεμποτεντ, byte-προς-byte.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT, readHierarchyRows } from './lib/admin-boundaries/admin-boundary-source';
import { loadCachedSource, type CachedSourceMeta } from './lib/cached-download';
import { LAW_3852_SOURCE, lawHtmlToText, parseLaw3852 } from './lib/admin-names/law-3852';
import {
  resolveDisplayNames,
  type DisplayNameResolution,
  type RegistryRow,
  type ReviewedName,
} from './lib/admin-names/resolve-display-names';
import { WIKIDATA_QUERIES, WIKIDATA_SOURCE, parseWikidataNames } from './lib/admin-names/wikidata-names';

const OUTPUT_PATH = join(REPO_ROOT, 'scripts', 'data', 'admin-display-names.json');
const REVIEWED_PATH = join(REPO_ROOT, 'scripts', 'data', 'admin-display-names.reviewed.json');
const CACHE_DIR = join(REPO_ROOT, 'node_modules', '.cache', 'admin-names');

const refresh = process.argv.includes('--refresh');

async function fetchText(url: string, file: string, label: string): Promise<{ text: string; meta: CachedSourceMeta }> {
  const source = await loadCachedSource({ url, path: join(CACHE_DIR, file), label, refresh });
  return { text: readFileSync(source.path, 'utf8'), meta: source.meta };
}

function provenance(meta: CachedSourceMeta): { readonly url: string; readonly sha256: string; readonly lastModified: string | null } {
  return { url: meta.url, sha256: meta.sha256, lastModified: meta.lastModified };
}

function registryRows(): readonly RegistryRow[] {
  return readHierarchyRows().map((row) => ({ id: row.id, n: row.n, sn: row.sn ?? row.n, c: row.c, l: row.l, p: row.p }));
}

function readReviewed(): readonly ReviewedName[] {
  return (JSON.parse(readFileSync(REVIEWED_PATH, 'utf8')) as { entries: ReviewedName[] }).entries;
}

/** Ανά βαθμίδα: πόσα λύθηκαν, από ποια πηγή, πόσα όχι. */
function countsOf(result: DisplayNameResolution): Record<string, Record<string, number>> {
  const counts: Record<string, Record<string, number>> = {};
  const bump = (level: number, key: string): void => {
    const row = (counts[level] ??= {});
    row[key] = (row[key] ?? 0) + 1;
  };
  for (const entry of result.entries) bump(entry.l, entry.source);
  for (const entry of result.unresolved) bump(entry.l, `unresolved:${entry.reason}`);
  return counts;
}

function byLevelCode<T extends { readonly l: number; readonly c: string }>(a: T, b: T): number {
  return a.l - b.l || a.c.localeCompare(b.c);
}

async function main(): Promise<void> {
  const law = await fetchText(LAW_3852_SOURCE.url, 'law-3852-2010.html', 'ν. 3852/2010 (Βικιθήκη)');
  const byCode = await fetchText(WIKIDATA_QUERIES.byCode, 'wikidata-by-code.json', 'Wikidata κατά κωδικό ΕΛΣΤΑΤ');
  const byType = await fetchText(WIKIDATA_QUERIES.byType, 'wikidata-by-type.json', 'Wikidata κατά τύπο');

  const result = resolveDisplayNames(registryRows(), {
    law: parseLaw3852(lawHtmlToText(law.text)),
    wikidata: parseWikidataNames(JSON.parse(byCode.text), JSON.parse(byType.text)),
    reviewed: readReviewed(),
  });

  const counts = countsOf(result);
  const output = {
    meta: {
      generator: 'scripts/build-admin-display-names.ts',
      adr: 'ADR-893',
      sources: [
        { ...LAW_3852_SOURCE, ...provenance(law.meta) },
        { ...WIKIDATA_SOURCE, queries: [provenance(byCode.meta), provenance(byType.meta)] },
        { id: 'reviewed', file: 'scripts/data/admin-display-names.reviewed.json' },
      ],
      counts,
    },
    entries: [...result.entries].sort(byLevelCode),
    unresolved: [...result.unresolved].sort(byLevelCode),
  };
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 1)}\n`);
  console.log(JSON.stringify(counts, null, 1));
  console.log(`✓ ${result.entries.length} ονόματα · ${result.unresolved.length} χωρίς απόφαση → ${OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
