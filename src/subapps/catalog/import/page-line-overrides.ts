/**
 * Οι **αποφάσεις γραμμής** του ανθρώπου πάνω στην αντιστοίχιση του μοντέλου (ADR-923 §5.5.2 Β3 Γ1–Γ2). Καθαρό.
 *
 * 🔑 Η απόφαση είναι **διόρθωση της αντιστοίχισης**, όχι νέα ανάγνωση: η φυλαγμένη απάντηση (`RawTableMapping`) αλλάζει μόνο στις
 *    γραμμές που αποφάσισε ο άνθρωπος, με βεβαιότητα 1, και ο ίδιος αγωγός (`readPageTables`) ξαναδιαβάζει τις τιμές από τον πίνακα.
 * 🔑 Η «Αγνόηση» δεν αλλάζει την αντιστοίχιση: η γραμμή μένει χωρίς πεδίο, και απλώς λογίζεται **αποφασισμένη**.
 * 🔑 Κωδικός της απάντησης που δεν υπάρχει πια στο σχήμα δεν πέφτει σιωπηλά: επιστρέφεται ως `staleCodes`.
 * @module subapps/catalog/import/page-line-overrides
 */

import { fnv1a64Hex } from '@/lib/hash/fnv1a';
import { canonicalJson } from '@/lib/legal/canonical-json';
import type { ImportLineDecision, ImportLineOverride, ImportPageUnmappedLine } from '../types/catalog-import';
import type { RawLineMapping, RawTableMapping } from './page-table-mapping';

/** Ο άνθρωπος είδε τη γραμμή και διάλεξε: καμία αμφιβολία να μεταφερθεί στο πεδίο. */
const HUMAN_CONFIDENCE = 1;

type LineAddress = Pick<ImportLineOverride, 'page' | 'table' | 'line'>;

export const lineKeyOf = ({ page, table, line }: LineAddress): string => `${page}\u0000${table}\u0000${line}`;

/** Ίδια γραμμή: ίδια σελίδα, ίδιος πίνακας, ίδια θέση — για αποφάσεις και για γραμμές χωρίς πεδίο (`ImportPageUnmappedLine`). */
export const sameLine = (a: LineAddress, b: LineAddress): boolean => a.page === b.page && a.table === b.table && a.line === b.line;

/** Ολόκληρη η απόφαση της γραμμής (με ταυτότητα και προέλευση), ή `null`. */
export function lineOverrideOf(overrides: readonly ImportLineOverride[] | undefined, address: LineAddress): ImportLineOverride | null {
  return overrides?.find((override) => sameLine(override, address)) ?? null;
}

/** Η απόφαση της γραμμής, ή `null`. */
export function lineDecisionOf(overrides: readonly ImportLineOverride[] | undefined, address: LineAddress): ImportLineDecision | null {
  return lineOverrideOf(overrides, address)?.decision ?? null;
}

/**
 * §5.5.2 Β3 Γ13: **όλες** οι ιδιότητες που δείχνει μια απόφαση, η κύρια πρώτη. Ο **ένας** δρόμος προς το `alsoAttributeIds`: κανείς
 * δεν το διαβάζει απευθείας, ώστε ο καταναλωτής που ξέρει μόνο το `attributeId` να μη χάνει σιωπηλά τη δεύτερη ιδιότητα.
 */
export function decisionAttributeIds(decision: ImportLineDecision): readonly string[] {
  if (decision.kind === 'attribute') return [decision.attributeId, ...(decision.alsoAttributeIds ?? [])];
  return decision.kind === 'axis' ? [decision.attributeId] : [];
}

/**
 * §5.5.2 Β3 Γ13: η απόφαση `attribute` με **έναν ακόμη** στόχο. Ίδιος στόχος που υπάρχει ήδη ⇒ ίδια απόφαση (ιδεμπότητη). Χωρίς
 * απόφαση `attribute` ⇒ `null`: δεν υπάρχει γραμμή αντιστοιχισμένη για να προστεθεί κάτι.
 */
export function withAlsoAttribute(decision: ImportLineDecision | null, attributeId: string): ImportLineDecision | null {
  if (decision?.kind !== 'attribute') return null;
  if (decisionAttributeIds(decision).includes(attributeId)) return decision;
  return { ...decision, alsoAttributeIds: [...(decision.alsoAttributeIds ?? []), attributeId] };
}

/**
 * §5.5.2 Β3 Γ13: η ιδιότητα που **φέρνει** μια απόφαση σε σχέση με την προηγούμενη — όποια δεν έδειχνε πριν· αλλιώς η κύρια. Ο ένας
 * κανόνας για το δέσιμο στην οικογένεια (δένεται αυτή, όχι η κύρια που ήταν ήδη δεμένη) και για το όνομα του βήματος αναίρεσης.
 */
export function stepAttributeIdOf(previous: ImportLineDecision | null, next: ImportLineDecision | null): string | null {
  const now = next === null ? [] : decisionAttributeIds(next);
  const was = new Set(previous === null ? [] : decisionAttributeIds(previous));
  return now.find((id) => !was.has(id)) ?? now[0] ?? null;
}

/** Ό,τι συνοδεύει μια απόφαση πέρα από τη σφραγίδα (§5.5.2 Β5): ταυτότητα για τη μάθηση, προέλευση όταν την έδωσε η μνήμη. */
export type LineOverrideExtras = Pick<ImportLineOverride, 'identity' | 'origin'>;

/** Μόνο τα πεδία που υπάρχουν: το Firestore δεν δέχεται `undefined`. */
const presentExtras = ({ identity, origin }: LineOverrideExtras): LineOverrideExtras => ({ ...(identity ? { identity } : {}), ...(origin ? { origin } : {}) });

/**
 * Νέα λίστα με την απόφαση της γραμμής αντικατεστημένη (`null` = αναίρεση). Ιδεμπότητη. Χωρίς `origin` η απόφαση είναι του
 * ανθρώπου: πάνω σε απόφαση της μνήμης την αντικαθιστά ολόκληρη.
 */
export function withLineOverride(
  overrides: readonly ImportLineOverride[],
  address: LineAddress,
  decision: ImportLineDecision | null,
  stamp: Pick<ImportLineOverride, 'by' | 'at'>,
  extras: LineOverrideExtras = {},
): ImportLineOverride[] {
  const rest = overrides.filter((override) => !sameLine(override, address));
  if (decision === null) return rest;
  return [...rest, { page: address.page, table: address.table, line: address.line, decision, ...stamp, ...presentExtras(extras) }];
}

/** Οι αποφάσεις ενός πίνακα μιας σελίδας. */
export const tableOverridesOf = (overrides: readonly ImportLineOverride[] | undefined, page: number, table: string): ImportLineOverride[] =>
  (overrides ?? []).filter((override) => override.page === page && override.table === table);

/**
 * Οι αποφάσεις που **αλλάζουν τα παράγωγα** του πίνακα (`applyLineOverrides`): αντιστοίχιση · άξονας · τιμή. Η «Αγνόηση» μόνο
 * λογίζει τη γραμμή αποφασισμένη, γι' αυτό δεν ξαναχτίζει πίνακα και δεν μπαίνει στο αποτύπωμα. Ο **ένας** κανόνας για τον γραφέα
 * (πότε ξαναχτίζεται ο πίνακας) και για τη σφραγίδα σελίδας (ποιες αποφάσεις μετρούν).
 */
const DERIVING_KINDS: ReadonlySet<ImportLineDecision['kind']> = new Set(['attribute', 'axis', 'price']);

export const derivesTable = (decision: ImportLineDecision | null): boolean => decision !== null && DERIVING_KINDS.has(decision.kind);

/** Η ουσία μιας απόφασης για τα παράγωγα: θέση + απόφαση — χωρίς ποιος/πότε/ταυτότητα/προέλευση, που δεν αλλάζουν τίποτα στον πίνακα. */
const derivingMaterial = (overrides: readonly ImportLineOverride[]) =>
  overrides
    .filter((override) => derivesTable(override.decision))
    .map(({ table, line, decision }) => ({ table, line, decision }))
    .sort((a, b) => (a.table === b.table ? a.line - b.line : a.table < b.table ? -1 : 1));

/**
 * **Το αποτύπωμα των αποφάσεων μιας σελίδας** (ADR-923 §5.5.2 Β3.2): από ποιες αποφάσεις βγήκαν τα αποθηκευμένα παράγωγά της. Όπως το
 * κλειδί ενέργειας του Bazel περιέχει τα αποτυπώματα των εισόδων, έτσι η σφραγίδα της σελίδας λέει **πάνω σε τι** κρίθηκε· διαφορετικό
 * αποτύπωμα από τις τρέχουσες αποφάσεις ⇒ τα παράγωγα είναι μπαγιάτικα, και ξαναχτίζονται μόνα τους ($0). FNV-1a 64 (σύγχρονο, ίδιο
 * σε browser και Node), πάνω στην κανονική σειριοποίηση.
 */
export function pageDecisionsDigest(overrides: readonly ImportLineOverride[] | undefined, page: number): string {
  return fnv1a64Hex(canonicalJson(derivingMaterial((overrides ?? []).filter((override) => override.page === page))));
}

/** Ίδιες αποφάσεις για τα παράγωγα ενός πίνακα; Ο φρουρός της συναλλαγής: ο πίνακας κρίθηκε πάνω σε **αυτές**. */
export const sameDerivingOverrides = (left: readonly ImportLineOverride[], right: readonly ImportLineOverride[]): boolean =>
  canonicalJson(derivingMaterial(left)) === canonicalJson(derivingMaterial(right));

export interface OverriddenMapping {
  readonly mapping: RawTableMapping;
  /** Κωδικοί της απάντησης που δεν υπάρχουν πια στο σχήμα της οικογένειας. */
  readonly staleCodes: readonly string[];
  /** Αποφάσεις που δείχνουν ιδιότητα έξω από το σχήμα: δεν εφαρμόστηκαν. */
  readonly unknownAttributeIds: readonly string[];
  /** Γραμμές που ο άνθρωπος δήλωσε **τιμή** (§5.5.2 Β4): βγαίνουν από την αντιστοίχιση ιδιοτήτων, πάνε στην πρόταση τιμών. */
  readonly priceLines: readonly PagePriceLine[];
}

/** Γραμμή τιμής ενός πίνακα, με τη μονάδα που δήλωσε ο άνθρωπος. */
export interface PagePriceLine {
  readonly line: number;
  readonly unitCode: string;
}

/** Η γραμμή τιμής του πίνακα, αν υπάρχει: ο πίνακας έχει **μία** (`priceLineTaken`). */
export const priceLineOf = (overrides: readonly ImportLineOverride[]): ImportLineOverride | null =>
  overrides.find((override) => override.decision.kind === 'price') ?? null;

/**
 * Η απάντηση του μοντέλου με τις αποφάσεις από πάνω. Αντιστοίχιση ⇒ η γραμμή δείχνει την ιδιότητα με βεβαιότητα 1 (αντικαθιστά ό,τι
 * είχε πει το μοντέλο). Τιμή ⇒ η γραμμή φεύγει από την αντιστοίχιση ιδιοτήτων, ακόμη κι αν το μοντέλο της είχε δώσει ιδιότητα: ποτέ
 * τιμή ως ιδιότητα (§5.4). Αγνόηση ⇒ καμία αλλαγή.
 */
export function applyLineOverrides(
  mapping: RawTableMapping,
  overrides: readonly ImportLineOverride[],
  codeById: ReadonlyMap<string, string>,
  knownCodes: ReadonlySet<string>,
): OverriddenMapping {
  const chosen = new Map<number, RawLineMapping[]>();
  const axes: RawLineMapping[] = [];
  const priceLines: PagePriceLine[] = [];
  const unknownAttributeIds: string[] = [];
  for (const { line, decision } of overrides) {
    if (decision.kind === 'price') priceLines.push({ line, unitCode: decision.unitCode });
    if (decision.kind !== 'attribute' && decision.kind !== 'axis') continue;
    // §5.5.2 Β3 Γ13: ένα δέσιμο ανά στόχο· η ανάγνωση (`rowsOf`) δίνει σε κάθε στόχο το ίδιο κελί.
    const bound: RawLineMapping[] = [];
    for (const attributeId of decisionAttributeIds(decision)) {
      const code = codeById.get(attributeId);
      if (code === undefined) unknownAttributeIds.push(attributeId);
      else bound.push({ line, attribute: code, confidence: HUMAN_CONFIDENCE });
    }
    if (decision.kind === 'axis') axes.push(...bound);
    else if (bound.length > 0) chosen.set(line, bound);
  }
  const priced = new Set(priceLines.map(({ line }) => line));
  const kept = mapping.lines.filter((entry) => !chosen.has(entry.line) && !priced.has(entry.line));
  const staleCodes = [...new Set(kept.flatMap((entry) => (entry.attribute !== null && !knownCodes.has(entry.attribute) ? [entry.attribute] : [])))];
  const lines = [...kept, ...[...chosen.values()].flat()];
  // §5.5.2 Β7: ο άξονας **προστίθεται** στη γραμμή· ίδιο δέσιμο που υπάρχει ήδη δεν διπλασιάζει τα κελιά.
  const added = axes.filter((axis) => !priced.has(axis.line) && !lines.some((entry) => entry.line === axis.line && entry.attribute === axis.attribute));
  return { mapping: { ...mapping, lines: [...lines, ...added] }, staleCodes, unknownAttributeIds, priceLines };
}

/** Οι γραμμές χωρίς πεδίο που περιμένουν ακόμη απόφαση: όσες δεν αγνοήθηκαν ρητά. */
export function pendingUnmappedLines(lines: readonly ImportPageUnmappedLine[], overrides: readonly ImportLineOverride[] | undefined): ImportPageUnmappedLine[] {
  return lines.filter((line) => lineDecisionOf(overrides, line)?.kind !== 'ignore');
}
