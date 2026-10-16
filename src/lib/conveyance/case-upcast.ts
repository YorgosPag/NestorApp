/**
 * =============================================================================
 * Conveyance — ανάγνωση παλιών υποθέσεων στο σχήμα της §22 (ADR-915 §22)
 * =============================================================================
 *
 * Πριν από την §22 η υπόθεση είχε **έναν** πωλητή (`parties.seller`), τα γεγονότα του στο `facts` και τις αποκλίσεις
 * των γραμμών του με σκέτο `itemId`. Αντί για script μετάπτωσης, το παλιό σχήμα **μεταφράζεται στην ανάγνωση**
 * (schema evolution, όπως ο αναγνώστης Protobuf/Avro διαβάζει παλιό writer): κάθε διαδρομή διαβάζει μέσα από τον
 * `parseConveyanceCase`, και η πρώτη εγγραφή ολόκληρου εγγράφου (`tx.set`) το αποθηκεύει στο νέο σχήμα.
 *
 * Ιδεμπότητο: έγγραφο ήδη στο νέο σχήμα περνά αναλλοίωτο (μόνο `partyFacts: {}` αν λείπει). Ό,τι δεν αναγνωρίζεται
 * μένει ως έχει ⇒ το απορρίπτει το σχήμα (ποτέ «μαντεψιά» αλλοιωμένου εγγράφου).
 *
 * **Layering**: leaf — καθαρή συνάρτηση.
 *
 * @module lib/conveyance/case-upcast
 */

import { isPartyFact } from '@/config/conveyance-checklist/types';
import { sellerKeyOf } from './case-parties';
import { canonicalRowKey } from './case-rows';

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Ο παλιός μοναδικός πωλητής ως πρόσωπο — `null` αν το έγγραφο δεν έχει τη μορφή του. Το `kind` περνά ακατέργαστο: το
 * επικυρώνει το σχήμα.
 */
function legacySeller(parties: Raw): { readonly key: string; readonly party: Raw } | null {
  const seller = parties.seller;
  if (!isRecord(seller)) return null;
  const contactId = typeof seller.contactId === 'string' && seller.contactId.length > 0 ? seller.contactId : null;
  const key = sellerKeyOf(contactId);
  return { key, party: { key, contactId, kind: seller.kind } };
}

/** Οι παλιές απαντήσεις σε γεγονότα προσώπου φεύγουν από το `facts` προς το πρόσωπο. */
function splitFacts(facts: unknown, sellerKey: string): { readonly facts: unknown; readonly partyFacts: Raw } {
  if (!isRecord(facts)) return { facts, partyFacts: {} };
  const caseFacts: Raw = {};
  const own: Raw = {};
  for (const [factId, answer] of Object.entries(facts)) (isPartyFact(factId) ? own : caseFacts)[factId] = answer;
  return { facts: caseFacts, partyFacts: Object.keys(own).length > 0 ? { [sellerKey]: own } : {} };
}

/** Οι αποκλίσεις των γραμμών-προτύπων με σκέτο `itemId` ανήκουν στον μοναδικό πωλητή. */
function rekeyOverrides(overrides: unknown, sellerKey: string): unknown {
  if (!isRecord(overrides)) return overrides;
  const parties = { sellers: [{ key: sellerKey }] };
  return Object.fromEntries(Object.entries(overrides).map(([key, value]) => [canonicalRowKey(key, parties), value]));
}

/** Παλιό ή νέο έγγραφο `conveyance_cases` → το σχήμα της §22 (πριν από την επικύρωση). */
export function upcastStoredCase(raw: unknown): unknown {
  if (!isRecord(raw) || !isRecord(raw.parties)) return raw;
  if (Array.isArray(raw.parties.sellers)) return isRecord(raw.partyFacts) ? raw : { ...raw, partyFacts: {} };
  const seller = legacySeller(raw.parties);
  if (seller === null) return raw;
  const parties = { ...withoutKey(raw.parties, 'seller'), sellers: [seller.party] };
  const split = splitFacts(raw.facts, seller.key);
  return { ...raw, parties, facts: split.facts, partyFacts: split.partyFacts, overrides: rekeyOverrides(raw.overrides, seller.key) };
}

function withoutKey(record: Raw, omitted: string): Raw {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== omitted));
}
