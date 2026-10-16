/**
 * =============================================================================
 * Conveyance — οι ΓΡΑΜΜΕΣ μιας υπόθεσης: κατάλογος × πρόσωπα (ADR-915 §22)
 * =============================================================================
 *
 * Ο κατάλογος δηλώνει γραμμές· η υπόθεση έχει **πρόσωπα**. Γραμμή με `partyRole` γίνεται μία γραμμή **ανά πρόσωπο**
 * του ρόλου (πρότυπο απαίτησης × μέρος — το σχήμα του Procore για τα έγγραφα συμμόρφωσης ανά εταιρεία), με:
 *  - δικό της κλειδί (`rowKeyOf`) ⇒ δικές της αποκλίσεις/έλεγχο,
 *  - δικά της αρχεία: μόνο της **επαφής του προσώπου** (`rowFiles`),
 *  - δικά της γεγονότα: της υπόθεσης + του προσώπου (`rowFacts`).
 *
 * Ο ΕΝΑΣ επιλυτής: τον ρωτούν ο κατάλογος (`deriveChecklist`), το μητρώο λήξεων (`caseDocumentRequirements`), οι
 * εντολές (`applyConveyanceCommand`), οι αποστολές, η ανάγνωση κειμένου και τα σήματα των όψεων. Κανείς δεν
 * ξαναφτιάχνει γραμμή από `getChecklistItem(itemId)` μόνος του.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, ασφαλές σε server/client/tests.
 *
 * @module lib/conveyance/case-rows
 */

import { getChecklistItem, itemsForProfile } from '@/config/conveyance-checklist/catalog';
import { parseRowKey, rowKeyOf } from '@/config/conveyance-checklist/row-key';
import { isPartyFact, type ChecklistItem, type ConveyancePartyRole, type EvidenceLevel } from '@/config/conveyance-checklist/types';
import type { ConveyanceCase, ConveyanceCaseParties, ConveyanceSellerParty, EvidenceFile } from '@/types/conveyance-case';
import { resolveFacts, resolvePartyFacts, type FactValues } from './derive-facts';
import { filesForMatchers } from './evidence-match';

/** Μία γραμμή της υπόθεσης: η γραμμή του καταλόγου + (αν είναι πρότυπο) το πρόσωπό της. */
export interface CaseRow {
  readonly key: string;
  readonly item: ChecklistItem;
  readonly party: ConveyanceSellerParty | null;
}

type CaseRowSource = Pick<ConveyanceCase, 'profile' | 'parties'>;

/** Το επίπεδο τεκμηρίων όπου ζουν τα προσωπικά έγγραφα κάθε ρόλου (ADR-901 §2 Ε-Γ). */
const PARTY_EVIDENCE_LEVEL: Readonly<Record<ConveyancePartyRole, EvidenceLevel>> = {
  seller: 'seller_contact',
};

/** Ό,τι χρειάζεται για να βρεθούν τα πρόσωπα ενός ρόλου — ως `ConveyanceCaseParties` ή μόνο τα κλειδιά τους. */
interface PartiesShape<P> {
  readonly sellers: readonly P[];
}

/** Μόνο οι ταυτότητες των προσώπων (το `canonicalRowKey` δεν χρειάζεται τίποτα άλλο). */
type PartyKeys = PartiesShape<Pick<ConveyanceSellerParty, 'key'>>;

/** Τα πρόσωπα ενός ρόλου, με τη σειρά της υπόθεσης. */
function partiesOfRole<P>(parties: PartiesShape<P>, role: ConveyancePartyRole): readonly P[] {
  switch (role) {
    case 'seller': return parties.sellers;
  }
}

/** Γραμμή καταλόγου → οι γραμμές της υπόθεσης (μία, ή μία ανά πρόσωπο του ρόλου της). */
function rowsOfItem(item: ChecklistItem, parties: ConveyanceCaseParties): readonly CaseRow[] {
  if (item.partyRole === undefined) return [{ key: item.id, item, party: null }];
  return partiesOfRole(parties, item.partyRole).map((party) => ({ key: rowKeyOf(item.id, party.key), item, party }));
}

/** Οι γραμμές από δοσμένες γραμμές καταλόγου — με τη σειρά του καταλόγου, τα πρόσωπα με τη σειρά της υπόθεσης. */
export function caseRowsOf(items: readonly ChecklistItem[], parties: ConveyanceCaseParties): readonly CaseRow[] {
  return items.flatMap((item) => rowsOfItem(item, parties));
}

/** Όλες οι γραμμές της υπόθεσης (προφίλ × πρόσωπα). */
export function caseRows(record: CaseRowSource): readonly CaseRow[] {
  return caseRowsOf(itemsForProfile(record.profile), record.parties);
}

/**
 * Η γραμμή με αυτό το κλειδί — **μόνο** αν ανήκει σε αυτή την υπόθεση (γραμμή του προφίλ, πρόσωπο της υπόθεσης).
 * `null` ⇒ άγνωστη γραμμή, γραμμή άλλου προφίλ, ή πρόσωπο που δεν είναι (πια) μέρος της υπόθεσης. Κλειδί χωρίς
 * πρόσωπο σε γραμμή-πρότυπο (`seller_e9`) **δεν** λύνεται: θα ήταν «ποιανού;» χωρίς απάντηση.
 */
export function resolveCaseRow(record: CaseRowSource, rowKey: string): CaseRow | null {
  return caseRows(record).find((row) => row.key === rowKey) ?? null;
}

/**
 * Το **κανονικό** κλειδί ενός αποθηκευμένου κλειδιού γραμμής. Πριν από την §22 οι γραμμές πωλητή αποθηκεύονταν ως
 * σκέτο `itemId` (ένας πωλητής). Με **ακριβώς ένα** πρόσωπο του ρόλου, το παλιό κλειδί ανήκει χωρίς αμφιβολία σε
 * αυτό· αλλιώς μένει ως έχει (δεν λύνεται — ποτέ μαντεψιά ανάμεσα σε συμπωλητές).
 */
export function canonicalRowKey(rowKey: string, parties: PartyKeys): string {
  const parsed = parseRowKey(rowKey);
  if (parsed.partyKey !== null) return rowKey;
  const role = getChecklistItem(parsed.itemId)?.partyRole;
  if (role === undefined) return rowKey;
  const people = partiesOfRole(parties, role);
  return people.length === 1 ? rowKeyOf(parsed.itemId, people[0].key) : rowKey;
}

/**
 * Τα αρχεία-τεκμήρια της γραμμής, νεότερο πρώτο. Γραμμή προσώπου: στο επίπεδο των προσωπικών εγγράφων του ρόλου
 * μετρούν **μόνο** τα αρχεία της επαφής **του** (αλλιώς η ΕΝΦΙΑ του ενός συμπωλητή θα «κάλυπτε» και τον άλλον).
 */
export function rowFiles(row: CaseRow, evidence: readonly EvidenceFile[]): readonly EvidenceFile[] {
  if (row.item.satisfaction.kind !== 'files') return [];
  const files = filesForMatchers(row.item.satisfaction.matchers, evidence);
  if (row.party === null || row.item.partyRole === undefined) return files;
  const personal = PARTY_EVIDENCE_LEVEL[row.item.partyRole];
  const contactId = row.party.contactId;
  return files.filter((file) => file.level !== personal || (contactId !== null && file.entityId === contactId));
}

/** Τα επιλυμένα γεγονότα της υπόθεσης **και** κάθε προσώπου της — ό,τι χρειάζεται κάθε γραμμή. */
export interface CaseFacts {
  readonly case: FactValues;
  /** Ανά `ConveyanceSellerParty.key`. */
  readonly parties: Readonly<Record<string, FactValues>>;
}

/**
 * Η ΜΙΑ επίλυση γεγονότων της υπόθεσης: της υπόθεσης από τα παραγόμενα + ρητές απαντήσεις, κάθε προσώπου από το
 * ίδιο το πρόσωπο + τις δικές του απαντήσεις (`resolvePartyFacts`). Ίδια σε server, client και μητρώο.
 */
export function resolveCaseFacts(derived: FactValues, record: Pick<ConveyanceCase, 'facts' | 'partyFacts' | 'parties'>): CaseFacts {
  const parties: Record<string, FactValues> = {};
  for (const party of record.parties.sellers) parties[party.key] = resolvePartyFacts(party, record.partyFacts);
  return { case: withoutPartyFacts(resolveFacts(derived, record.facts)), parties };
}

/** Γεγονότα προσώπου **δεν** ζουν στο επίπεδο της υπόθεσης — ποτέ «ο πωλητής» όταν είναι πολλοί. */
function withoutPartyFacts(facts: FactValues): FactValues {
  return Object.fromEntries(Object.entries(facts).filter(([factId]) => !isPartyFact(factId)));
}

/** Τα γεγονότα που βλέπει η γραμμή: της υπόθεσης, και —για γραμμή προσώπου— **του** προσώπου. */
export function rowFacts(row: CaseRow, facts: CaseFacts): FactValues {
  if (row.party === null) return facts.case;
  return { ...facts.case, ...(facts.parties[row.party.key] ?? {}) };
}
