/**
 * Το σχήμα του μανιφέστου του χρυσού συνόλου (ADR-929 Δ13 / Δ13.1).
 *
 * 🔑 **Το μανιφέστο ΔΕΝ ζει στο repo.** Οι σαρώσεις αδειών φέρουν ονόματα ιδιοκτητών, διευθύνσεις και
 * αριθμούς αδειών, και τα ονόματα των φακέλων τους **επίσης**. Ένα μανιφέστο με σχετικές διαδρομές μέσα
 * στο repo θα αντέγραφε αυτά τα προσωπικά δεδομένα στο ιστορικό του git, για πάντα. Γι' αυτό το
 * μανιφέστο κάθεται **μέσα** στον φάκελο του συνόλου (`NESTOR_PLAN_GOLDEN_DIR`), δίπλα στα αρχεία που
 * περιγράφει. Στο repo μένουν μόνο το **σχήμα** (εδώ), ο φορτωτής και τα συνθετικά δείγματα.
 *
 * 🔑 **Ρίζες με όνομα.** Το σύνολο απλώνεται σε δύο φακέλους του γραφείου (`6. erga` και
 * `05. Σκαναρισμένα Αρχεία`). Κάθε αρχείο δηλώνεται ως `{root, path}`, και οι ρίζες λύνονται **μία**
 * φορά: απόλυτες ή σχετικές με τον φάκελο του μανιφέστου. Έτσι το ίδιο μανιφέστο δουλεύει σε άλλο
 * μηχάνημα αλλάζοντας μία γραμμή.
 *
 * 🔑 **sha256 σε κάθε αρχείο.** Αν ένα αρχείο αλλάξει ή αντικατασταθεί, η μέτρηση το **λέει** αντί να
 * μετρήσει σιωπηλά κάτι άλλο (Δ13.1: «όχι σιωπηλό πράσινο»).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/testing/golden-manifest-schema
 */

import { z } from 'zod';
import type { PlanInputKind } from '../plan-recognition-types';

export const GOLDEN_DIR_ENV = 'NESTOR_PLAN_GOLDEN_DIR';
export const GOLDEN_MANIFEST_FILENAME = 'plan-golden-manifest.json';
export const GOLDEN_MANIFEST_SCHEMA_ID = 'nestor.plan-golden-manifest';

const PLAN_INPUT_KINDS = ['scan', 'multipage-pdf', 'listing', 'sketch'] as const satisfies readonly PlanInputKind[];

/** Σχετική διαδρομή μέσα στη ρίζα: όχι απόλυτη, όχι γράμμα δίσκου, όχι έξοδος με `..`. */
const relativePath = z
  .string()
  .min(1)
  .refine((p) => !/^([a-zA-Z]:|[\\/])/.test(p), 'path must be relative to its root')
  .refine((p) => !p.split(/[\\/]/).includes('..'), 'path must not leave its root');

const fileRef = z
  .object({
    root: z.string().min(1),
    path: relativePath,
    sha256: z.string().regex(/^[0-9a-f]{64}$/, 'sha256 must be 64 lowercase hex characters'),
  })
  .strict();

const sourceRef = fileRef.extend({ page: z.number().int().min(1) }).strict();

/**
 * Πώς προέκυψε η εικόνα από το διανυσματικό (ADR-929 §6.9). Οι μετρικές αναφέρονται **χωριστά** ανά σχέση: μια εξαγωγή
 * από το CAD αναμένεται σχεδόν τέλεια στην καταγραφή, ενώ μια σάρωση φέρει κάμψη και τάνυση χαρτιού. `unverified` ⇒
 * δεν το ξέρει κανείς ακόμη· το κρίνει η μέτρηση καταγραφής, όχι η μαντεψιά.
 */
export const GOLDEN_PAIR_RELATIONS = ['printed-from', 'scanned-from', 'unverified'] as const;

/** Βαθμίδα Α: αλήθεια από το διανυσματικό ζεύγος. Βαθμίδα Β: αποτύπωση στη Nestor, εκκρεμεί (Δ13.1). */
const truth = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('vector'),
    format: z.enum(['dxf', 'tek']),
    file: fileRef,
    relation: z.enum(GOLDEN_PAIR_RELATIONS),
    /**
     * Προαιρετικό διανυσματικό που είναι **ήδη** στο σύστημα της εικόνας. ⚠️ Μετρήθηκε (2026-11-07, §6.9): το
     * `_Image.dxf` του Παλαιολόγου Γ **δεν** είναι τέτοιο ζεύγος· είναι αυτόματη διανυσματοποίηση της σάρωσης.
     */
    alignment: fileRef.optional(),
  }).strict(),
  z.object({ kind: z.literal('manual-pending') }).strict(),
]);

const goldenCase = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'id must be kebab-case ascii'),
    kind: z.enum(PLAN_INPUT_KINDS),
    tier: z.enum(['A', 'B']),
    source: sourceRef,
    truth,
  })
  .strict()
  .refine((c) => (c.tier === 'A') === (c.truth.kind === 'vector'), 'tier A ⇔ vector truth');

const manifest = z
  .object({
    schema: z.literal(GOLDEN_MANIFEST_SCHEMA_ID),
    version: z.literal(1),
    roots: z.record(z.string().min(1)),
    cases: z.array(goldenCase).min(1),
  })
  .strict();

export type GoldenFileRef = z.infer<typeof fileRef>;
export type GoldenCase = z.infer<typeof goldenCase>;
export type GoldenManifest = z.infer<typeof manifest>;

export type GoldenManifestParse =
  | { readonly ok: true; readonly manifest: GoldenManifest }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Όλα τα αρχεία μιας περίπτωσης: πηγή, αλήθεια, ευθυγράμμιση. */
export function caseFileRefs(c: GoldenCase): readonly GoldenFileRef[] {
  if (c.truth.kind !== 'vector') return [c.source];
  return c.truth.alignment ? [c.source, c.truth.file, c.truth.alignment] : [c.source, c.truth.file];
}

/** Αναλλοίωτες που το σχήμα ανά πεδίο δεν βλέπει: μοναδικά ids, δηλωμένες ρίζες. */
function crossFieldErrors(m: GoldenManifest): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const c of m.cases) {
    if (seen.has(c.id)) errors.push(`duplicate case id: ${c.id}`);
    seen.add(c.id);
    for (const ref of caseFileRefs(c)) {
      if (!(ref.root in m.roots)) errors.push(`case ${c.id}: undeclared root "${ref.root}"`);
    }
  }
  return errors;
}

export function parseGoldenManifest(raw: unknown): GoldenManifestParse {
  const parsed = manifest.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
  }
  const errors = crossFieldErrors(parsed.data);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, manifest: parsed.data };
}
