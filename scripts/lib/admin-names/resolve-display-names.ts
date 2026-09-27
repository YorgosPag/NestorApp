/**
 * @fileoverview **ΠΟΙΟ ΕΙΝΑΙ ΤΟ ΟΝΟΜΑ ΕΜΦΑΝΙΣΗΣ, ΚΑΙ ΠΟΙΟΣ ΤΟ ΑΠΟΔΕΙΚΝΥΕΙ** — ADR-893.
 * @related `build-admin-display-names.ts` (εκτελεί) · `build-administrative-hierarchy.ts` (εφαρμόζει)
 *
 * Καθαρή συνάρτηση: γραμμές μητρώου + πηγές → αποφάσεις. Καμία λήψη, κανένα αρχείο.
 *
 * 🔑 **Η ΣΕΙΡΑ ΤΩΝ ΠΗΓΩΝ ΕΙΝΑΙ Η ΠΟΛΙΤΙΚΗ**:
 * 1. **επιμέλεια** (`reviewed`) — απόφαση ανθρώπου με απόδειξη· κερδίζει τα πάντα·
 * 2. **νόμος** + **Wikidata** — όταν **συμφωνούν** ή υπάρχει μόνο ο ένας, γίνεται δεκτό·
 *    όταν **διαφωνούν**, **κανένας** δεν κερδίζει: η γραμμή πάει για επιμέλεια. Δύο ανεξάρτητες
 *    πηγές που λένε άλλο είναι ακριβώς η περίπτωση που δεν μαντεύουμε.
 * 3. **καμία πηγή** ⇒ το όνομα μένει όπως είναι, και η αναφορά το **ονομάζει**.
 *
 * 🔒 **Κάθε υποψήφιος** περνά από το `transferWriting`: ίδιες λέξεις με το επίσημο όνομα **και**
 * μονοτονικό. Άρα καμία πηγή δεν μπορεί να αλλάξει **ποιο** όνομα είναι — μόνο **πώς γράφεται**.
 */

import { splitAdminPrefix } from '../../../src/utils/address/place-name';
import { sameWrittenWords, transferWriting, wordsOf, type WritingRejection } from './greek-orthography';
import type { Law3852 } from './law-3852';
import { levelCodeKey, type WikidataNames } from './wikidata-names';

/** Οι βαθμίδες που η πηγή γράφει κεφαλαία — οι 7 και 8 έρχονται ήδη τονισμένες. */
export const DISPLAY_NAME_LEVELS: readonly number[] = [1, 2, 3, 4, 5, 6];

export interface RegistryRow {
  readonly id: string;
  readonly n: string;
  readonly sn: string;
  readonly c: string;
  readonly l: number;
  readonly p: string | null;
}

export type DisplaySource = 'reviewed' | 'law-3852-2010' | 'wikidata' | 'law-3852-2010+wikidata';

/** Μια επιμελημένη απόφαση: το όνομα **χωρίς** πρόθεμα βαθμίδας, όπως γράφεται, με απόδειξη. */
export interface ReviewedName {
  readonly l: number;
  readonly c: string;
  readonly name: string;
  readonly evidence: string;
}

export interface DisplayNameEntry {
  readonly l: number;
  readonly c: string;
  readonly n: string;
  readonly sn: string;
  readonly source: DisplaySource;
  readonly evidence: string;
}

export interface UnresolvedName {
  readonly l: number;
  readonly c: string;
  readonly n: string;
  readonly reason: 'no-source' | 'conflict' | 'ambiguous';
  readonly law: readonly string[];
  readonly wikidata: readonly string[];
  readonly rejected: readonly string[];
}

export interface DisplayNameSources {
  readonly law: Law3852;
  readonly wikidata: WikidataNames;
  readonly reviewed: readonly ReviewedName[];
}

/** Τι απάντησε μία πηγή για μία γραμμή. */
interface Verdict {
  readonly accepted: readonly string[];
  readonly evidence: readonly string[];
  readonly rejected: readonly string[];
}

/** Το όνομα χωρίς το πρόθεμα της βαθμίδας του — αυτό που οι πηγές τονίζουν. */
function officialParts(row: RegistryRow): { readonly prefix: string | null; readonly rest: string } {
  const split = splitAdminPrefix(row.n);
  return split && split.level === row.l ? { prefix: split.written, rest: split.rest } : { prefix: null, rest: row.n };
}

/** Ετικέτα πηγής → το όνομα χωρίς πρόθεμα (οι ετικέτες γράφουν «Δημοτική Ενότητα …», «δήμος …»). */
function labelRest(label: string): string {
  return splitAdminPrefix(label)?.rest ?? label;
}

function judge(official: string, candidates: readonly string[]): Verdict {
  const accepted = new Set<string>();
  const evidence: string[] = [];
  const rejected: string[] = [];
  for (const candidate of candidates) {
    const result = transferWriting(official, candidate);
    if (result.ok) {
      accepted.add(result.text);
      evidence.push(candidate);
    } else if (result.reason !== ('different-words' satisfies WritingRejection)) {
      rejected.push(`${candidate} (${result.reason})`);
    }
  }
  return { accepted: [...accepted], evidence, rejected };
}

/** Τα σύντομα ονόματα των προγόνων — η «ουρά» που το Wikidata κολλά στο τέλος (`… Ροδόπης`). */
function ancestorNames(row: RegistryRow, byId: ReadonlyMap<string, RegistryRow>): readonly string[] {
  const names: string[] = [];
  for (let parent = row.p ? byId.get(row.p) : undefined; parent; parent = parent.p ? byId.get(parent.p) : undefined) {
    names.push(parent.sn);
  }
  return names;
}

/** «Ιάσμου Ροδόπης» → «Ιάσμου», **μόνο** αν η ουρά είναι όνομα προγόνου. */
function withoutAncestorTail(candidate: string, official: string, ancestors: readonly string[]): string {
  const words = wordsOf(candidate);
  const count = wordsOf(official).length;
  if (words.length <= count) return candidate;
  const tail = words.slice(count).join(' ');
  return ancestors.some((name) => sameWrittenWords(name, tail)) ? words.slice(0, count).join(' ') : candidate;
}

function wikidataCandidates(row: RegistryRow, rest: string, sources: DisplayNameSources, byId: ReadonlyMap<string, RegistryRow>): readonly string[] {
  const labels = sources.wikidata.byLevelCode.get(levelCodeKey(row.l, row.c)) ?? sources.wikidata.byLevel.get(row.l) ?? [];
  const ancestors = ancestorNames(row, byId);
  return labels.map((label) => withoutAncestorTail(labelRest(label), rest, ancestors));
}

/** Ο δήμος του νόμου που είναι **αυτός** ο δήμος (ίδιες λέξεις). */
function lawMunicipality(name: string, law: Law3852): readonly string[] {
  return law.municipalities.filter((entry) => sameWrittenWords(entry.name, name)).flatMap((entry) => entry.units);
}

function lawCandidates(row: RegistryRow, sources: DisplayNameSources, byId: ReadonlyMap<string, RegistryRow>): readonly string[] {
  const { law } = sources;
  if (row.l === 5) return [...law.municipalities.map((entry) => entry.name), ...law.unchanged];
  if (row.l !== 6) return [];
  const parent = row.p ? byId.get(row.p) : undefined;
  const scoped = parent ? lawMunicipality(officialParts(parent).rest, law) : [];
  // Δήμοι του Κλεισθένη: οι ενότητές τους ονομάστηκαν κάτω από τον **παλιό** δήμο ⇒ όλος ο νόμος,
  // και η ομοφωνία (παρακάτω) κρατά την ασφάλεια.
  return scoped.length > 0 ? scoped : law.municipalities.flatMap((entry) => entry.units);
}

function reviewedFor(row: RegistryRow, reviewed: readonly ReviewedName[]): ReviewedName | undefined {
  return reviewed.find((entry) => entry.l === row.l && entry.c === row.c);
}

/** Το επιμελημένο όνομα **πρέπει** να περνά τον ίδιο έλεγχο — αλλιώς είναι λάθος του πίνακα. */
function applyReviewed(row: RegistryRow, rest: string, entry: ReviewedName): string {
  const result = transferWriting(rest, entry.name);
  if (!result.ok) throw new Error(`Επιμέλεια ${row.l}:${row.c} «${entry.name}» απορρίφθηκε (${result.reason}) για «${rest}».`);
  return result.text;
}

function entryFrom(row: RegistryRow, prefix: string | null, text: string, source: DisplaySource, evidence: string): DisplayNameEntry {
  const n = prefix === null ? text : `${prefix} ${text}`;
  const rest = officialParts(row).rest;
  const sn = sameWrittenWords(row.sn, rest) ? text : row.sn;
  return { l: row.l, c: row.c, n, sn, source, evidence };
}

type Decision = { readonly entry: DisplayNameEntry } | { readonly unresolved: UnresolvedName };

function decide(row: RegistryRow, sources: DisplayNameSources, byId: ReadonlyMap<string, RegistryRow>): Decision {
  const { prefix, rest } = officialParts(row);
  const review = reviewedFor(row, sources.reviewed);
  if (review) return { entry: entryFrom(row, prefix, applyReviewed(row, rest, review), 'reviewed', review.evidence) };

  const law = judge(rest, lawCandidates(row, sources, byId));
  const wikidata = judge(rest, wikidataCandidates(row, rest, sources, byId));
  const unresolved = (reason: UnresolvedName['reason']): Decision => ({
    unresolved: { l: row.l, c: row.c, n: row.n, reason, law: law.accepted, wikidata: wikidata.accepted, rejected: [...law.rejected, ...wikidata.rejected] },
  });
  if (law.accepted.length > 1) return unresolved('ambiguous');
  const [fromLaw] = law.accepted;
  // Το Wikidata διαφωνεί **με τον εαυτό του** (`Κηφισίας`/`Κηφισιάς`) και μία μορφή του είναι
  // ακριβώς του νόμου ⇒ ο νόμος **επιβεβαιώνεται** από ανεξάρτητη πηγή. Χωρίς νόμο: επιμέλεια.
  if (wikidata.accepted.length > 1) {
    if (!fromLaw || !wikidata.accepted.includes(fromLaw)) return unresolved('ambiguous');
    return { entry: entryFrom(row, prefix, fromLaw, 'law-3852-2010+wikidata', law.evidence[0]) };
  }
  const [fromWikidata] = wikidata.accepted;
  if (fromLaw && fromWikidata && fromLaw !== fromWikidata) return unresolved('conflict');
  if (fromLaw) return { entry: entryFrom(row, prefix, fromLaw, fromWikidata ? 'law-3852-2010+wikidata' : 'law-3852-2010', law.evidence[0]) };
  if (fromWikidata) return { entry: entryFrom(row, prefix, fromWikidata, 'wikidata', wikidata.evidence[0]) };
  return unresolved('no-source');
}

export interface DisplayNameResolution {
  readonly entries: readonly DisplayNameEntry[];
  readonly unresolved: readonly UnresolvedName[];
}

export function resolveDisplayNames(rows: readonly RegistryRow[], sources: DisplayNameSources): DisplayNameResolution {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const entries: DisplayNameEntry[] = [];
  const unresolved: UnresolvedName[] = [];
  for (const row of rows) {
    if (!DISPLAY_NAME_LEVELS.includes(row.l)) continue;
    const decision = decide(row, sources, byId);
    if ('entry' in decision) entries.push(decision.entry);
    else unresolved.push(decision.unresolved);
  }
  return { entries, unresolved };
}
