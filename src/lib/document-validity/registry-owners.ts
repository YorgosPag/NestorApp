/**
 * =============================================================================
 * Μητρώο λήξεων — ΠΟΙΟΣ ΕΙΝΑΙ Ο ΙΔΙΟΚΤΗΤΗΣ ενός ακινήτου (ADR-915 §25)
 * =============================================================================
 *
 * Το «Το φέρνει: Ο ιδιοκτήτης» λέει τον **κανόνα** (`DocumentObligor`)· εδώ παράγεται **ποιος** είναι, ως επαφές
 * (`cont_*`). Τα ονόματα ΔΕΝ ζουν εδώ — τα διαβάζει ζωντανά ο διακομιστής από την επαφή (ποτέ αντίγραφο, §23.10 Ζ4).
 *
 * Μία απάντηση ανά είδος ακινήτου, πάντα από το **υπάρχον** SSoT της κυριότητας:
 *
 * | Ακίνητο | Ιδιοκτήτες | Πηγή |
 * |---|---|---|
 * | ιδιώτη υπό εντολή | ο πελάτης κάθε εντολής | `BrokeredMandateCore.clientContactId` |
 * | εταιρείας, **μεταβιβασμένο** | οι αγοραστές | `commercial.owners` (ADR-244) μετά το `final_signed` (`isFinalContractSigned`) |
 * | εταιρείας, με ανοιχτή υπόθεση | οι μεταβιβάζοντες της υπόθεσης | `parties.sellers[]` (§22 — μαζί οι συμπωλητές) |
 * | εταιρείας, αλλιώς | η νομική οντότητα του έργου | `project.linkedCompanyId` (ADR-232) |
 *
 * 🔑 **Κενό ≠ άγνωστο**: `[]` = ρωτήθηκε και **δεν** ορίστηκε κανείς — η οθόνη το λέει. Ποτέ μαντεψιά από τον
 *    συγγραφέα της εγγραφής: ο υπάλληλος του γραφείου **δεν** είναι ιδιοκτήτης (`OwnerProperty.authorUserId`, §8.33).
 * 🔑 Σειρά σταθερή, χωρίς διπλά: η ίδια επαφή σε δύο εντολές είναι **ένας** ιδιοκτήτης.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 *
 * @module lib/document-validity/registry-owners
 */

import type { LegalPhase } from '@/constants/legal-phases';
import { isFinalContractSigned } from '@/lib/conveyance/case-state';

/** Οι επαφές με τη σειρά πρώτης εμφάνισης, χωρίς κενά και διπλά. */
export function distinctContactIds(ids: readonly (string | null | undefined)[]): readonly string[] {
  const seen = new Set<string>();
  for (const id of ids) {
    const trimmed = typeof id === 'string' ? id.trim() : '';
    if (trimmed !== '') seen.add(trimmed);
  }
  return [...seen];
}

/** Ακίνητο ιδιώτη υπό εντολή: οι πελάτες των εντολών του. */
export function mandatedPropertyOwners(mandates: readonly { readonly clientContactId: string }[]): readonly string[] {
  return distinctContactIds(mandates.map((mandate) => mandate.clientContactId));
}

/** Ό,τι ξέρει το μητρώο για την κυριότητα ενός ακινήτου εταιρείας. */
export interface CompanyPropertyOwnership {
  readonly legalPhase: LegalPhase | null;
  /** `commercial.owners[].contactId` — αγοραστές (πριν την υπογραφή) ή ιδιοκτήτες (μετά). */
  readonly buyerContactIds: readonly string[];
  /** Οι μεταβιβάζοντες των **ανοιχτών** υποθέσεων του ακινήτου (`null` = πωλητής χωρίς γνωστή επαφή). */
  readonly sellerContactIds: readonly (string | null)[];
  /** `project.linkedCompanyId` — `null` όταν το ακίνητο δεν έχει έργο ή το έργο δεν δηλώνει εταιρεία. */
  readonly projectCompanyContactId: string | null;
}

/**
 * ADR-915 §26 — **ποια πηγή** απάντησε: ο υπεύθυνος (`obligor-lead.ts`) ρωτά μερίδια **μόνο** στους αγοραστές
 * (`commercial.owners[].ownershipPct`) και κύριο πωλητή **μόνο** στους μεταβιβάζοντες.
 */
export type CompanyOwnersSource = 'buyers' | 'sellers' | 'project-company';

export interface CompanyPropertyOwners {
  readonly source: CompanyOwnersSource;
  readonly contactIds: readonly string[];
}

/**
 * Ακίνητο εταιρείας: πρώτα όποιος **έγινε** ιδιοκτήτης (αγοραστές μετά το οριστικό), μετά όσοι **μεταβιβάζουν** τώρα,
 * μετά η εταιρεία του έργου. Αγοραστές πριν την υπογραφή **δεν** είναι ιδιοκτήτες.
 */
export function companyPropertyOwners(ownership: CompanyPropertyOwnership): CompanyPropertyOwners {
  const buyers = distinctContactIds(ownership.buyerContactIds);
  if (isFinalContractSigned(ownership.legalPhase) && buyers.length > 0) return { source: 'buyers', contactIds: buyers };
  const sellers = distinctContactIds(ownership.sellerContactIds);
  if (sellers.length > 0) return { source: 'sellers', contactIds: sellers };
  return { source: 'project-company', contactIds: distinctContactIds([ownership.projectCompanyContactId]) };
}
