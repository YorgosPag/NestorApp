/**
 * @fileoverview **ΔΙΟΡΘΩΣΕΙΣ ΟΝΟΜΑΤΟΣ** — όπου η ΕΛΣΤΑΤ γράφει άλλα **γράμματα** από το επίσημο όνομα — ADR-893 §7.
 * @related `scripts/data/admin-name-corrections.json` (οι δηλώσεις) · `apply-display-names.ts` (η γραφή, μετά)
 *
 * 🔑 **ΔΥΟ ΣΤΡΩΣΕΙΣ, ΔΥΟ ΚΑΝΟΝΕΣ**: η **γραφή** (τόνοι, πεζά) αλλάζει μόνο με ίδιες λέξεις —
 * `transferWriting`, απαράβατο. Τα **γράμματα** αλλάζουν μόνο εδώ, με δήλωση και απόδειξη ανά γραμμή.
 * Άρα η διόρθωση **δεν** χαλαρώνει τον κανόνα της γραφής: του δίνει νέα ταυτότητα να ελέγξει.
 *
 * 🔒 **Ιδεμποτεντ** (ο μετασχηματιστής ξαναγράφει το ίδιο αρχείο): η γραμμή λέει ακόμη το `from` ⇒
 * διόρθωση · λέει ήδη το `to` (σε οποιαδήποτε γραφή) ⇒ τίποτα · λέει **τρίτο** όνομα ⇒ η δήλωση είναι
 * μπαγιάτικη ⇒ πρόβλημα, **όχι** σιωπή.
 *
 * 🔎 **Το παλιό όνομα μένει ψαχνόμενο** — πάει στο `an` (εναλλακτικά ονόματα), όπως το `alt_name` του OSM.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { sameWrittenWords } from './greek-orthography';

export const NAME_CORRECTIONS_FILE = join('scripts', 'data', 'admin-name-corrections.json');

export interface NameCorrection {
  readonly l: number;
  readonly c: string;
  readonly from: string;
  readonly to: string;
  readonly evidence: readonly string[];
}

export interface NamedRow {
  readonly n: string;
  readonly sn: string;
  readonly l: number;
  readonly c: string;
}

export type CorrectionOutcome =
  | { readonly kind: 'apply'; readonly n: string; readonly sn: string }
  | { readonly kind: 'done' }
  | { readonly kind: 'stale'; readonly problem: string };

function isCorrection(value: unknown): value is NameCorrection {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.l === 'number' &&
    typeof entry.c === 'string' &&
    typeof entry.from === 'string' &&
    typeof entry.to === 'string' &&
    Array.isArray(entry.evidence) &&
    entry.evidence.length > 0 &&
    entry.evidence.every((item) => typeof item === 'string')
  );
}

/** Οι δηλώσεις, ελεγμένες — γραμμή χωρίς απόδειξη ή με λάθος σχήμα ⇒ σφάλμα, όχι παράλειψη. */
export function parseNameCorrections(payload: unknown): readonly NameCorrection[] {
  const entries = (payload as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(entries)) throw new TypeError('admin-name-corrections: λείπει ο πίνακας `entries`');
  const invalid = entries.filter((entry) => !isCorrection(entry));
  if (invalid.length > 0) throw new TypeError(`admin-name-corrections: άκυρες γραμμές ${JSON.stringify(invalid)}`);
  return entries as NameCorrection[];
}

export function loadNameCorrections(repoRoot: string): readonly NameCorrection[] {
  return parseNameCorrections(JSON.parse(readFileSync(join(repoRoot, NAME_CORRECTIONS_FILE), 'utf8')));
}

/** Τι κάνει **μία** δήλωση σε **μία** γραμμή. Το πρόθεμα βαθμίδας του `n` μένει όπως είναι. */
export function correctionOutcome(row: NamedRow, correction: NameCorrection): CorrectionOutcome {
  const key = `${correction.l}:${correction.c}`;
  if (sameWrittenWords(row.sn, correction.to)) return { kind: 'done' };
  if (!sameWrittenWords(row.sn, correction.from)) {
    return { kind: 'stale', problem: `διόρθωση ονόματος ${key}: η γραμμή λέει «${row.sn}», όχι «${correction.from}»` };
  }
  if (!row.n.endsWith(row.sn)) {
    return { kind: 'stale', problem: `διόρθωση ονόματος ${key}: το «${row.n}» δεν τελειώνει σε «${row.sn}»` };
  }
  return { kind: 'apply', n: `${row.n.slice(0, row.n.length - row.sn.length)}${correction.to}`, sn: correction.to };
}

/** Η γραμμή που αφορά κάθε δήλωση — δήλωση χωρίς γραμμή είναι κι αυτή μπαγιάτικη. */
export function correctionTargets<T extends NamedRow>(
  rows: readonly T[],
  corrections: readonly NameCorrection[],
): { readonly targets: readonly { readonly row: T; readonly correction: NameCorrection }[]; readonly problems: readonly string[] } {
  const byKey = new Map(rows.map((row) => [`${row.l}:${row.c}`, row]));
  const targets: { row: T; correction: NameCorrection }[] = [];
  const problems: string[] = [];
  for (const correction of corrections) {
    const row = byKey.get(`${correction.l}:${correction.c}`);
    if (row === undefined) problems.push(`διόρθωση ονόματος χωρίς γραμμή μητρώου: ${correction.l}:${correction.c}`);
    else targets.push({ row, correction });
  }
  return { targets, problems };
}

/** Αντίγραφα των γραμμών με τα διορθωμένα γράμματα — για όποιον **διαβάζει** το μητρώο (γεννήτορας γραφής). */
export function withCorrectedNames<T extends NamedRow>(
  rows: readonly T[],
  corrections: readonly NameCorrection[],
): { readonly rows: readonly T[]; readonly problems: readonly string[] } {
  const { targets, problems } = correctionTargets(rows, corrections);
  const replaced = new Map<T, T>();
  const all = [...problems];
  for (const { row, correction } of targets) {
    const outcome = correctionOutcome(row, correction);
    if (outcome.kind === 'stale') all.push(outcome.problem);
    else if (outcome.kind === 'apply') replaced.set(row, { ...row, n: outcome.n, sn: outcome.sn });
  }
  return { rows: rows.map((row) => replaced.get(row) ?? row), problems: all };
}

/** Το δίπλωμα του `nn` της ΕΛΣΤΑΤ: χωρίς τόνους, πεζά, `ς`→`σ`, η παύλα γίνεται **κενό** (`σταγειρων ακανθου`). */
function foldLikeElstat(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ').replace(/\s*-\s*/g, ' ');
}

/**
 * Το `nn` μετά τη διόρθωση — αλλάζει **μόνο** το κομμάτι του ονόματος, στη μορφή της πηγής. Ένα `nn`
 * ξαναϋπολογισμένο από την αρχή θα είχε **άλλο** δίπλωμα από τις 20.717 υπόλοιπες γραμμές
 * (μετρημένο: `σταγιρωνακανθου` αντί για `σταγιρων ακανθου`). `null` ⇒ το `nn` δεν περιέχει το παλιό όνομα.
 */
export function correctedNormalizedName(nn: string, correction: NameCorrection): string | null {
  const from = foldLikeElstat(correction.from);
  return nn.includes(from) ? nn.replace(from, foldLikeElstat(correction.to)) : null;
}
