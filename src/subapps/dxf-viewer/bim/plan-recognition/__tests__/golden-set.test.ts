/**
 * ADR-929 Δ13.1 — το χρυσό σύνολο ζει ΕΚΤΟΣ repo· εδώ ελέγχονται το σχήμα του μανιφέστου και ο φορτωτής,
 * με I/O στη μνήμη. Κανένα αληθινό αρχείο, καμία διαδρομή του γραφείου.
 */

import path from 'node:path';
import { describe, it, expect } from '@jest/globals';
import {
  GOLDEN_DIR_ENV,
  GOLDEN_MANIFEST_FILENAME,
  parseGoldenManifest,
} from '../testing/golden-manifest-schema';
import { describeGoldenSetStatus, loadGoldenSet, type GoldenIo } from '../testing/golden-set-loader';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

function validManifest(): Record<string, unknown> {
  return {
    schema: 'nestor.plan-golden-manifest',
    version: 1,
    roots: { scans: 'scans' },
    cases: [
      {
        id: 'case-a',
        kind: 'scan',
        tier: 'A',
        source: { root: 'scans', path: 'x/plan.pdf', sha256: SHA_A, page: 1 },
        truth: { kind: 'vector', format: 'dxf', file: { root: 'scans', path: 'x/plan.dxf', sha256: SHA_B } },
      },
      {
        id: 'case-b',
        kind: 'multipage-pdf',
        tier: 'B',
        source: { root: 'scans', path: 'y/set.pdf', sha256: SHA_B, page: 3 },
        truth: { kind: 'manual-pending' },
      },
    ],
  };
}

type Case = Record<string, unknown>;
function withFirstCase(patch: (c: Case) => Case): Record<string, unknown> {
  const m = validManifest();
  const cases = m.cases as Case[];
  return { ...m, cases: [patch(cases[0]), ...cases.slice(1)] };
}

describe('parseGoldenManifest', () => {
  it('δέχεται έγκυρο μανιφέστο', () => {
    expect(parseGoldenManifest(validManifest()).ok).toBe(true);
  });

  it.each<[string, Record<string, unknown>]>([
    ['απόλυτη διαδρομή', withFirstCase((c) => ({ ...c, source: { ...(c.source as Case), path: 'F:/x.pdf' } }))],
    ['έξοδος από τη ρίζα', withFirstCase((c) => ({ ...c, source: { ...(c.source as Case), path: '../x.pdf' } }))],
    ['άγνωστο πεδίο (π.χ. στοιχεία ιδιοκτήτη)', withFirstCase((c) => ({ ...c, owner: 'Χ' }))],
    ['βαθμίδα Α χωρίς διανυσματική αλήθεια', withFirstCase((c) => ({ ...c, truth: { kind: 'manual-pending' } }))],
    ['κακό sha256', withFirstCase((c) => ({ ...c, source: { ...(c.source as Case), sha256: 'ABC' } }))],
    ['σελίδα 0', withFirstCase((c) => ({ ...c, source: { ...(c.source as Case), page: 0 } }))],
    ['αδήλωτη ρίζα', withFirstCase((c) => ({ ...c, source: { ...(c.source as Case), root: 'erga' } }))],
    ['διπλό id', { ...validManifest(), cases: [(validManifest().cases as Case[])[0], (validManifest().cases as Case[])[0]] }],
  ])('απορρίπτει: %s', (_name, raw) => {
    const r = parseGoldenManifest(raw);
    expect(r.ok).toBe(false);
  });
});

/** Σύστημα αρχείων στη μνήμη: διαδρομή → περιεχόμενο. Το sha256 είναι η ίδια η τιμή (ψεύτικο, ελεγχόμενο). */
function memoryIo(files: Record<string, string>, dirs: readonly string[]): GoldenIo {
  const norm = (p: string) => path.resolve(p);
  const table = new Map(Object.entries(files).map(([k, v]) => [norm(k), v]));
  const dirSet = new Set(dirs.map(norm));
  return {
    isDirectory: (p) => dirSet.has(norm(p)),
    isFile: (p) => table.has(norm(p)),
    readText: (p) => table.get(norm(p)) ?? '',
    sha256: (p) => table.get(norm(p)) ?? '',
  };
}

const DIR = path.resolve('/golden');
const env = { [GOLDEN_DIR_ENV]: DIR };
const manifestPath = path.join(DIR, GOLDEN_MANIFEST_FILENAME);

describe('loadGoldenSet — ρητή παράλειψη, ποτέ σιωπηλό πράσινο', () => {
  it('χωρίς μεταβλητή περιβάλλοντος ⇒ not-configured', () => {
    const s = loadGoldenSet({}, memoryIo({}, []));
    expect(s.status).toBe('not-configured');
    expect(describeGoldenSetStatus(s)).toContain('SKIPPED');
  });

  it('φάκελος που λείπει ⇒ missing-dir', () => {
    expect(loadGoldenSet(env, memoryIo({}, [])).status).toBe('missing-dir');
  });

  it('φάκελος χωρίς μανιφέστο ⇒ missing-manifest', () => {
    expect(loadGoldenSet(env, memoryIo({}, [DIR])).status).toBe('missing-manifest');
  });

  it('χαλασμένο JSON ⇒ invalid, και η περιγραφή λέει FAILED (όχι SKIPPED)', () => {
    const s = loadGoldenSet(env, memoryIo({ [manifestPath]: '{oops' }, [DIR]));
    expect(s.status).toBe('invalid');
    expect(describeGoldenSetStatus(s)).toContain('FAILED');
  });

  it('έτοιμο: ρίζα σχετική με το μανιφέστο, ακεραιότητα ανά αρχείο', () => {
    const io = memoryIo(
      {
        [manifestPath]: JSON.stringify(validManifest()),
        [path.join(DIR, 'scans/x/plan.pdf')]: SHA_A, // αναλλοίωτο
        [path.join(DIR, 'scans/x/plan.dxf')]: SHA_A, // ΑΛΛΑΞΕ (περίμενε SHA_B)
        // y/set.pdf λείπει
      },
      [DIR],
    );
    const s = loadGoldenSet(env, io);
    if (s.status !== 'ready') throw new Error(`expected ready, got ${s.status}`);
    const [a, b] = s.cases;
    expect(a.files.map((f) => f.integrity)).toEqual(['ok', 'changed']);
    expect(a.measurable).toBe(false);
    expect(b.files.map((f) => f.integrity)).toEqual(['missing']);
    expect(describeGoldenSetStatus(s)).toBe(`READY: 0/2 cases measurable in ${DIR}`);
  });
});
