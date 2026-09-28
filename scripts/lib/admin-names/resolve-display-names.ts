/**
 * @fileoverview **ΠΟΙΟ ΕΙΝΑΙ ΤΟ ΟΝΟΜΑ ΕΜΦΑΝΙΣΗΣ, ΚΑΙ ΠΟΙΟΣ ΤΟ ΑΠΟΔΕΙΚΝΥΕΙ** — ADR-893.
 * @related `build-admin-display-names.ts` (εκτελεί) · `build-administrative-hierarchy.ts` (εφαρμόζει)
 *
 * Καθαρή συνάρτηση: γραμμές μητρώου + πηγές → αποφάσεις. Καμία λήψη, κανένα αρχείο.
 *
 * 🔑 **Η ΣΕΙΡΑ ΤΩΝ ΠΗΓΩΝ ΕΙΝΑΙ Η ΠΟΛΙΤΙΚΗ**:
 * 1. **επιμέλεια** (`reviewed`) — απόφαση ανθρώπου με απόδειξη· κερδίζει τα πάντα — αλλά όπου
 *    **διαφωνεί** με αυτόματη πηγή, το **λέει** (`disputes`), αλλιώς σφάλμα ({@link applyReviewed})·
 * 2. **νόμος** · **Wikidata** · **ekloges.ypes.gr** — **ισότιμες ψήφοι, ομοφωνία**: όσες απαντούν
 *    πρέπει να λένε το ίδιο. Διαφωνία ⇒ **κανένας** δεν κερδίζει, η γραμμή πάει για επιμέλεια.
 *    ⚠️ Όχι «το κράτος σήμερα κερδίζει» (πρόταση του handoff, **απορρίφθηκε με μέτρηση** 2026-09-27):
 *    το ekloges γράφει `Μονεμβασίας` ενώ ο δήμος αυτοαποκαλείται `Μονεμβασιάς`, και `Φρέ` με τόνο σε
 *    μονοσύλλαβο. Καμία πηγή δεν είναι αλάνθαστη· ομοφωνία ανεξάρτητων πηγών είναι.
 * 3. **καμία πηγή** ⇒ το όνομα μένει όπως είναι, και η αναφορά το **ονομάζει**.
 *
 * 🔒 **Κάθε υποψήφιος** περνά από το `transferWriting`: ίδιες λέξεις με το επίσημο όνομα **και**
 * μονοτονικό. Άρα καμία πηγή δεν μπορεί να αλλάξει **ποιο** όνομα είναι — μόνο **πώς γράφεται**.
 */

import { splitAdminPrefix } from '../../../src/utils/address/place-name';
import { sameWrittenWords, transferWriting, wordsOf, type WritingRejection } from './greek-orthography';
import { EKLOGES_SOURCE, eklogesMunicipalitiesFor, type EklogesNames } from './ekloges-names';
import { LAW_3852_SOURCE, type Law3852 } from './law-3852';
import { WIKIDATA_SOURCE, levelCodeKey, type WikidataNames } from './wikidata-names';

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

/** Οι αυτόματες πηγές, με τη σειρά που γράφονται στο `source` (`law-3852-2010+wikidata`). */
export const AUTO_SOURCES = [LAW_3852_SOURCE.id, WIKIDATA_SOURCE.id, EKLOGES_SOURCE.id] as const;
export type AutoSourceId = (typeof AUTO_SOURCES)[number];

/** `reviewed`, ή οι αυτόματες πηγές που **συμφώνησαν**, ενωμένες με `+` με τη σειρά του {@link AUTO_SOURCES}. */
export type DisplaySource = string;

/** Μια επιμελημένη απόφαση: το όνομα **χωρίς** πρόθεμα βαθμίδας, όπως γράφεται, με απόδειξη. */
export interface ReviewedName {
  readonly l: number;
  readonly c: string;
  readonly name: string;
  readonly evidence: string;
  /**
   * **Γιατί η επιμέλεια διαφωνεί με αυτή την αυτόματη πηγή** — υποχρεωτικό για **κάθε** πηγή που
   * λέει άλλο. Χωρίς αυτό, μια πηγή που αλλάζει γνώμη (ή μια επιμέλεια που ξεχάστηκε) περνά σιωπηλά.
   */
  readonly disputes?: Readonly<Partial<Record<AutoSourceId, string>>>;
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
  readonly ekloges: readonly string[];
  readonly rejected: readonly string[];
}

export interface DisplayNameSources {
  readonly law: Law3852;
  readonly wikidata: WikidataNames;
  readonly ekloges: EklogesNames;
  readonly reviewed: readonly ReviewedName[];
}

/** Τι απάντησε μία πηγή για μία γραμμή. */
interface Verdict {
  readonly accepted: readonly string[];
  /** Για κάθε δεκτή γραφή, ο **πρώτος** υποψήφιος της πηγής που την έδωσε — η απόδειξη. */
  readonly evidenceOf: ReadonlyMap<string, string>;
  readonly rejected: readonly string[];
}

/** Οι γραμμές γύρω από μία γραμμή — πρόγονοι (ουρά Wikidata) και αδέλφια (δήμος του ekloges). */
interface RegistryContext {
  readonly byId: ReadonlyMap<string, RegistryRow>;
  readonly childrenOf: ReadonlyMap<string, readonly RegistryRow[]>;
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
  const evidenceOf = new Map<string, string>();
  const rejected: string[] = [];
  for (const candidate of candidates) {
    const result = transferWriting(official, candidate);
    if (result.ok) {
      if (!evidenceOf.has(result.text)) evidenceOf.set(result.text, candidate);
    } else if (result.reason !== ('different-words' satisfies WritingRejection)) {
      rejected.push(`${candidate} (${result.reason})`);
    }
  }
  return { accepted: [...evidenceOf.keys()], evidenceOf, rejected };
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

function wikidataCandidates(row: RegistryRow, rest: string, sources: DisplayNameSources, context: RegistryContext): readonly string[] {
  const labels = sources.wikidata.byLevelCode.get(levelCodeKey(row.l, row.c)) ?? sources.wikidata.byLevel.get(row.l) ?? [];
  const ancestors = ancestorNames(row, context.byId);
  return labels.map((label) => withoutAncestorTail(labelRest(label), rest, ancestors));
}

/** Ο δήμος του νόμου που είναι **αυτός** ο δήμος (ίδιες λέξεις). */
function lawMunicipality(name: string, law: Law3852): readonly string[] {
  return law.municipalities.filter((entry) => sameWrittenWords(entry.name, name)).flatMap((entry) => entry.units);
}

function lawCandidates(row: RegistryRow, sources: DisplayNameSources, context: RegistryContext): readonly string[] {
  const { law } = sources;
  if (row.l === 5) return [...law.municipalities.map((entry) => entry.name), ...law.unchanged];
  if (row.l !== 6) return [];
  const parent = row.p ? context.byId.get(row.p) : undefined;
  const scoped = parent ? lawMunicipality(officialParts(parent).rest, law) : [];
  // Δήμοι του Κλεισθένη: οι ενότητές τους ονομάστηκαν κάτω από τον **παλιό** δήμο ⇒ όλος ο νόμος,
  // και η ομοφωνία (παρακάτω) κρατά την ασφάλεια.
  return scoped.length > 0 ? scoped : law.municipalities.flatMap((entry) => entry.units);
}

/** Οι δήμοι του ekloges που είναι **αυτός** ο δήμος του μητρώου — κατά σύνολο δημοτικών ενοτήτων. */
function eklogesScope(municipality: RegistryRow, sources: DisplayNameSources, context: RegistryContext): readonly number[] {
  const units = (context.childrenOf.get(municipality.id) ?? []).filter((child) => child.l === 6);
  return eklogesMunicipalitiesFor(units.map((unit) => officialParts(unit).rest), sources.ekloges);
}

/**
 * Βαθμίδα 5: το όνομα του δήμου που ταυτίστηκε κατά ενότητες· αλλιώς κάθε δήμος ίδιων λέξεων.
 * Βαθμίδα 6: οι ενότητες **του** δήμου· αλλιώς όλες (η ομοφωνία κρατά την ασφάλεια, όπως στον νόμο).
 */
function eklogesCandidates(row: RegistryRow, sources: DisplayNameSources, context: RegistryContext): readonly string[] {
  const { municipalities, units } = sources.ekloges;
  if (row.l === 5) {
    const scope = eklogesScope(row, sources, context);
    return municipalities.filter((entry) => scope.length === 0 || scope.includes(entry.id)).map((entry) => entry.name);
  }
  if (row.l !== 6) return [];
  const parent = row.p ? context.byId.get(row.p) : undefined;
  const scope = parent ? eklogesScope(parent, sources, context) : [];
  return units.filter((unit) => scope.length === 0 || scope.includes(unit.municipalityId)).map((unit) => unit.name);
}

function reviewedFor(row: RegistryRow, reviewed: readonly ReviewedName[]): ReviewedName | undefined {
  return reviewed.find((entry) => entry.l === row.l && entry.c === row.c);
}

/** Μία ψήφος: ποια πηγή, τι είπε. */
interface Vote {
  readonly id: AutoSourceId;
  readonly verdict: Verdict;
}

function votesFor(row: RegistryRow, rest: string, sources: DisplayNameSources, context: RegistryContext): readonly Vote[] {
  return [
    { id: LAW_3852_SOURCE.id, verdict: judge(rest, lawCandidates(row, sources, context)) },
    { id: WIKIDATA_SOURCE.id, verdict: judge(rest, wikidataCandidates(row, rest, sources, context)) },
    { id: EKLOGES_SOURCE.id, verdict: judge(rest, eklogesCandidates(row, sources, context)) },
  ];
}

/**
 * Το επιμελημένο όνομα **πρέπει** να περνά τον ίδιο έλεγχο — αλλιώς είναι λάθος του πίνακα. Και
 * κάθε αυτόματη πηγή που λέει **μονοσήμαντα** άλλο πρέπει να είναι δηλωμένη στο `disputes`.
 */
function applyReviewed(row: RegistryRow, rest: string, entry: ReviewedName, votes: readonly Vote[]): string {
  const result = transferWriting(rest, entry.name);
  if (!result.ok) throw new Error(`Επιμέλεια ${row.l}:${row.c} «${entry.name}» απορρίφθηκε (${result.reason}) για «${rest}».`);
  const silent = votes.filter(
    ({ id, verdict }) => verdict.accepted.length === 1 && verdict.accepted[0] !== result.text && !entry.disputes?.[id],
  );
  if (silent.length > 0) {
    const said = silent.map(({ id, verdict }) => `${id}: «${verdict.accepted[0]}»`).join(' · ');
    throw new Error(`Επιμέλεια ${row.l}:${row.c} «${result.text}» διαφωνεί ΑΔΗΛΩΤΑ με ${said} — γράψε \`disputes\`.`);
  }
  return result.text;
}

function entryFrom(row: RegistryRow, prefix: string | null, text: string, source: DisplaySource, evidence: string): DisplayNameEntry {
  const n = prefix === null ? text : `${prefix} ${text}`;
  const rest = officialParts(row).rest;
  const sn = sameWrittenWords(row.sn, rest) ? text : row.sn;
  return { l: row.l, c: row.c, n, sn, source, evidence };
}

type Consensus =
  | { readonly text: string; readonly supporters: readonly Vote[] }
  | { readonly reason: UnresolvedName['reason'] };

/**
 * **Ομοφωνία** — κάθε πηγή με **μία** απάντηση ψηφίζει αυτήν· πηγή με **πολλές** (το Wikidata
 * αυτοδιαφωνεί: `Κηφισίας`/`Κηφισιάς`) στηρίζει μόνο αν μία από αυτές είναι ήδη η ψήφος άλλης πηγής.
 */
function consensusOf(votes: readonly Vote[]): Consensus {
  const answering = votes.filter(({ verdict }) => verdict.accepted.length > 0);
  const singles = new Set(answering.filter(({ verdict }) => verdict.accepted.length === 1).map(({ verdict }) => verdict.accepted[0]));
  if (singles.size > 1) return { reason: 'conflict' };
  const [text] = singles;
  if (text === undefined) return { reason: answering.length > 0 ? 'ambiguous' : 'no-source' };
  if (!answering.every(({ verdict }) => verdict.accepted.includes(text))) return { reason: 'conflict' };
  return { text, supporters: answering };
}

type Decision = { readonly entry: DisplayNameEntry } | { readonly unresolved: UnresolvedName };

function decide(row: RegistryRow, sources: DisplayNameSources, context: RegistryContext): Decision {
  const { prefix, rest } = officialParts(row);
  const votes = votesFor(row, rest, sources, context);
  const review = reviewedFor(row, sources.reviewed);
  if (review) return { entry: entryFrom(row, prefix, applyReviewed(row, rest, review, votes), 'reviewed', review.evidence) };

  const consensus = consensusOf(votes);
  if ('text' in consensus) {
    const source = consensus.supporters.map(({ id }) => id).join('+');
    return { entry: entryFrom(row, prefix, consensus.text, source, consensus.supporters[0].verdict.evidenceOf.get(consensus.text) ?? consensus.text) };
  }
  const [law, wikidata, ekloges] = votes.map(({ verdict }) => verdict.accepted);
  const rejected = votes.flatMap(({ verdict }) => verdict.rejected);
  return { unresolved: { l: row.l, c: row.c, n: row.n, reason: consensus.reason, law, wikidata, ekloges, rejected } };
}

export interface DisplayNameResolution {
  readonly entries: readonly DisplayNameEntry[];
  readonly unresolved: readonly UnresolvedName[];
}

function contextOf(rows: readonly RegistryRow[]): RegistryContext {
  const childrenOf = new Map<string, RegistryRow[]>();
  for (const row of rows) {
    if (row.p === null) continue;
    const siblings = childrenOf.get(row.p) ?? [];
    siblings.push(row);
    childrenOf.set(row.p, siblings);
  }
  return { byId: new Map(rows.map((row) => [row.id, row])), childrenOf };
}

export function resolveDisplayNames(rows: readonly RegistryRow[], sources: DisplayNameSources): DisplayNameResolution {
  const context = contextOf(rows);
  const entries: DisplayNameEntry[] = [];
  const unresolved: UnresolvedName[] = [];
  for (const row of rows) {
    if (!DISPLAY_NAME_LEVELS.includes(row.l)) continue;
    const decision = decide(row, sources, context);
    if ('entry' in decision) entries.push(decision.entry);
    else unresolved.push(decision.unresolved);
  }
  return { entries, unresolved };
}
