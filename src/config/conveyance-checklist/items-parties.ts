/**
 * Κατάλογος — Β. Έγγραφα ΠΩΛΗΤΗ και Γ. Έγγραφα ΑΓΟΡΑΣΤΗ (ADR-901 §5.5 πίνακες Β/Γ).
 *
 * Προσωπικά έγγραφα ⇒ **ελαχιστοποίηση** (ADR-901 §5.10): μόνο η δική σου πλευρά +
 * συμβολαιογράφος. Τα αρχεία ζουν ως entry points **επαφής** (`entries-contact.ts`) —
 * πολλά υπάρχουν σε δύο persona-παραλλαγές (π.χ. `enfia-certificate` / `owner-enfia`),
 * γι' αυτό ο matcher είναι any-of.
 *
 * 🔑 Ενότητα, πάροχος, ορατότητα και επίπεδο δηλώνονται ΜΙΑ φορά ανά πλευρά (`sellerDocument` /
 *    `buyerDocument`) — καμία γραμμή δεν μπορεί να «ξεφύγει» από την ελαχιστοποίηση της ενότητάς της.
 *
 * Περιλαμβάνει και τις γραμμές στεγαστικού δανείου που ζητούσε η διαδικασία `bank_loan`
 * του AI knowledge base (σύγκλιση ADR-901 §2.3 Ε-Α).
 *
 * ⚠️ v0 — `verifiedAt: null` μέχρι τον έλεγχο Φ0 (ADR-901 §11).
 *
 * @module config/conveyance-checklist/items-parties
 */

import type { ChecklistItem, ChecklistProvider, ConveyanceFactId } from './types';
import { onBehalfEntryPointId } from '@/config/upload-entry-points/entries-conveyance-case';
import { BUYER_PRIVATE, SELLER_PRIVATE } from './visibility';

type Requirement = ChecklistItem['requirement'];
type Validity = ChecklistItem['validity'];

const MANDATORY: Requirement = { kind: 'mandatory' };
const NO_EXPIRY: Validity = { kind: 'none' };
const UNVERIFIED: Validity = { kind: 'unverified' };
const when = (fact: ConveyanceFactId, equals = true): Requirement => ({ kind: 'when', fact, equals });

/** Έγγραφο πωλητή: πάντα από την επαφή του πωλητή, ορατό μόνο στην πλευρά του + συμβολαιογράφο. */
function sellerDocument(id: string, entryPointIds: readonly string[], requirement: Requirement, validity: Validity): ChecklistItem {
  return {
    id,
    section: 'seller',
    labelKey: `items.${id}.label`,
    provider: 'seller',
    visibleTo: SELLER_PRIVATE,
    requirement,
    validity,
    satisfaction: { kind: 'files', matchers: [{ level: 'seller_contact', entryPointIds }] },
    verifiedAt: null,
  };
}

/**
 * Έγγραφο αγοραστή: ορατό μόνο στην πλευρά του + συμβολαιογράφο.
 *
 * 📤 Π2 — ικανοποιείται **πάντα** με αποστολή του δικηγόρου αγοραστή **εκ μέρους** του πελάτη (επίπεδο `contribution`,
 * `PROVIDER_FULFILMENT.buyer/bank`)· όπου υπάρχει entry point επαφής, **και** από τα αρχεία της επαφής του αγοραστή στον
 * χώρο του οικοδεσπότη (any-of — Σ-1: ο εργολάβος που τα έχει ήδη δεν τα ξανανεβάζει). Πριν το Π2 οι γραμμές χωρίς
 * entry point επαφής ήταν `offline`: «ζητούμενες» χωρίς κανέναν δρόμο για κανέναν.
 */
function buyerDocument(
  id: string,
  provider: ChecklistProvider,
  requirement: Requirement,
  validity: Validity,
  contactEntryPointIds?: readonly string[],
): ChecklistItem {
  const onBehalf = { level: 'contribution', entryPointIds: [onBehalfEntryPointId(id)] } as const;
  return {
    id,
    section: 'buyer',
    labelKey: `items.${id}.label`,
    provider,
    visibleTo: BUYER_PRIVATE,
    requirement,
    validity,
    satisfaction: {
      kind: 'files',
      matchers: contactEntryPointIds ? [{ level: 'buyer_contact', entryPointIds: contactEntryPointIds }, onBehalf] : [onBehalf],
    },
    verifiedAt: null,
  };
}

export const SELLER_ITEMS: readonly ChecklistItem[] = [
  sellerDocument('seller_identity', ['id-card', 'tax-id'], when('seller_is_legal_entity', false), NO_EXPIRY),
  sellerDocument('seller_corporate_documents', ['articles-of-association', 'gemi-certificate'], when('seller_is_legal_entity'), UNVERIFIED),
  sellerDocument('seller_enfia_certificate', ['enfia-certificate', 'owner-enfia'], MANDATORY, UNVERIFIED),
  sellerDocument('seller_e9', ['e9-declaration', 'owner-e9'], MANDATORY, UNVERIFIED),
  sellerDocument('seller_tax_clearance', ['tax-clearance'], MANDATORY, UNVERIFIED),
  sellerDocument('seller_insurance_clearance', ['insurance-clearance'], when('seller_is_legal_entity'), UNVERIFIED),
  sellerDocument('seller_power_of_attorney', ['power-of-attorney'], when('seller_by_proxy'), NO_EXPIRY),
];

export const BUYER_ITEMS: readonly ChecklistItem[] = [
  buyerDocument('buyer_identity', 'buyer', MANDATORY, NO_EXPIRY, ['id-card', 'tax-id']),
  buyerDocument('buyer_income_statement', 'buyer', MANDATORY, NO_EXPIRY, ['tax-assessment', 'client-tax-assessment']),
  buyerDocument('buyer_mortgage_approval', 'bank', when('buyer_has_mortgage'), UNVERIFIED),
  buyerDocument('buyer_employment_certificate', 'buyer', when('buyer_has_mortgage'), UNVERIFIED),
  buyerDocument('buyer_payslips', 'buyer', when('buyer_has_mortgage'), UNVERIFIED),
  buyerDocument('bank_property_valuation', 'bank', when('buyer_has_mortgage'), UNVERIFIED),
  buyerDocument('buyer_first_home_exemption', 'buyer', when('first_home_exemption'), UNVERIFIED),
  buyerDocument('buyer_payment_proofs', 'buyer', MANDATORY, NO_EXPIRY),
];
