/**
 * Φορτωτής του χρυσού συνόλου (ADR-929 Δ13.1): εντοπίζει τον φάκελο από το `NESTOR_PLAN_GOLDEN_DIR`,
 * διαβάζει το μανιφέστο, λύνει τις ρίζες και ελέγχει την ακεραιότητα κάθε αρχείου με sha256.
 *
 * 🔑 **Ρητή παράλειψη, ποτέ σιωπηλό πράσινο.** Κάθε λόγος για τον οποίο δεν μετρά τίποτα είναι
 * **κατάσταση με όνομα** (`not-configured` · `missing-dir` · `missing-manifest` · `invalid`), και ο
 * καλών τη δείχνει. Ένα σενάριο μέτρησης που «περνά» επειδή δεν βρήκε αρχεία είναι η κατηγορία
 * σφάλματος που το `CLAUDE.md` καταγράφει ως «0 = κανείς δεν κοίταξε».
 *
 * 🔑 **Το I/O ενίεται** (`GoldenIo`). Η λογική ελέγχεται σε jest χωρίς δίσκο, και η υλοποίηση Node
 * ({@link nodeGoldenIo}) είναι η μόνη που αγγίζει το σύστημα αρχείων.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/testing/golden-set-loader
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  GOLDEN_DIR_ENV,
  GOLDEN_MANIFEST_FILENAME,
  caseFileRefs,
  parseGoldenManifest,
  type GoldenCase,
  type GoldenFileRef,
  type GoldenManifest,
} from './golden-manifest-schema';

export interface GoldenIo {
  isDirectory(absPath: string): boolean;
  isFile(absPath: string): boolean;
  readText(absPath: string): string;
  sha256(absPath: string): string;
}

export const nodeGoldenIo: GoldenIo = {
  isDirectory: (p) => existsSync(p) && statSync(p).isDirectory(),
  isFile: (p) => existsSync(p) && statSync(p).isFile(),
  readText: (p) => readFileSync(p, 'utf8'),
  sha256: (p) => createHash('sha256').update(readFileSync(p)).digest('hex'),
};

export type GoldenFileIntegrity = 'ok' | 'missing' | 'changed';

export interface ResolvedGoldenFile {
  readonly ref: GoldenFileRef;
  readonly absPath: string;
  readonly integrity: GoldenFileIntegrity;
}

export interface ResolvedGoldenCase {
  readonly case: GoldenCase;
  readonly files: readonly ResolvedGoldenFile[];
  /** Μετρήσιμη μόνο όταν **κάθε** αρχείο της είναι παρόν και αναλλοίωτο. */
  readonly measurable: boolean;
}

export type GoldenSetStatus =
  | { readonly status: 'not-configured'; readonly envVar: string }
  | { readonly status: 'missing-dir'; readonly dir: string }
  | { readonly status: 'missing-manifest'; readonly manifestPath: string }
  | { readonly status: 'invalid'; readonly manifestPath: string; readonly errors: readonly string[] }
  | { readonly status: 'ready'; readonly dir: string; readonly manifest: GoldenManifest; readonly cases: readonly ResolvedGoldenCase[] };

function resolveRoot(dir: string, root: string): string {
  return path.isAbsolute(root) ? root : path.resolve(dir, root);
}

function resolveFile(dir: string, m: GoldenManifest, ref: GoldenFileRef, io: GoldenIo): ResolvedGoldenFile {
  const absPath = path.resolve(resolveRoot(dir, m.roots[ref.root]), ref.path);
  if (!io.isFile(absPath)) return { ref, absPath, integrity: 'missing' };
  return { ref, absPath, integrity: io.sha256(absPath) === ref.sha256 ? 'ok' : 'changed' };
}

function resolveCase(dir: string, m: GoldenManifest, c: GoldenCase, io: GoldenIo): ResolvedGoldenCase {
  const files = caseFileRefs(c).map((ref) => resolveFile(dir, m, ref, io));
  return { case: c, files, measurable: files.every((f) => f.integrity === 'ok') };
}

function readManifest(manifestPath: string, io: GoldenIo): GoldenSetStatus | GoldenManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(io.readText(manifestPath));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'invalid', manifestPath, errors: [`unreadable JSON: ${message}`] };
  }
  const parsed = parseGoldenManifest(raw);
  return parsed.ok ? parsed.manifest : { status: 'invalid', manifestPath, errors: parsed.errors };
}

/** Η μία είσοδος: από το περιβάλλον στην κατάσταση του συνόλου. */
export function loadGoldenSet(
  env: Readonly<Record<string, string | undefined>>,
  io: GoldenIo = nodeGoldenIo,
): GoldenSetStatus {
  const configured = env[GOLDEN_DIR_ENV]?.trim();
  if (!configured) return { status: 'not-configured', envVar: GOLDEN_DIR_ENV };
  const dir = path.resolve(configured);
  if (!io.isDirectory(dir)) return { status: 'missing-dir', dir };
  const manifestPath = path.join(dir, GOLDEN_MANIFEST_FILENAME);
  if (!io.isFile(manifestPath)) return { status: 'missing-manifest', manifestPath };
  const manifest = readManifest(manifestPath, io);
  if ('status' in manifest) return manifest;
  const cases = manifest.cases.map((c) => resolveCase(dir, manifest, c, io));
  return { status: 'ready', dir, manifest, cases };
}

/** Μία γραμμή για την έξοδο του σεναρίου μέτρησης: **γιατί** δεν μετρήθηκε κάτι. */
export function describeGoldenSetStatus(s: GoldenSetStatus): string {
  switch (s.status) {
    case 'not-configured': return `SKIPPED: golden set not configured (set ${s.envVar})`;
    case 'missing-dir': return `SKIPPED: golden set directory not found: ${s.dir}`;
    case 'missing-manifest': return `SKIPPED: golden manifest not found: ${s.manifestPath}`;
    case 'invalid': return `FAILED: golden manifest invalid (${s.errors.length} errors): ${s.manifestPath}`;
    case 'ready': {
      const measurable = s.cases.filter((c) => c.measurable).length;
      return `READY: ${measurable}/${s.cases.length} cases measurable in ${s.dir}`;
    }
  }
}
