/**
 * @fileoverview **Ποιος αγγίζει ΑΥΤΗ την ευκαιρία — ο ΕΝΑΣ κριτής πόρου** (ADR-930 §«Εξουσία κατόχου»).
 * @module services/crm/opportunity-access
 *
 * **Το ερώτημα**: *«Μπορεί αυτός ο άνθρωπος να μετακινήσει/επεξεργαστεί (ή να σβήσει) αυτή την ευκαιρία;»*
 *
 * 🔑 **Πρακτική μεγάλων**: Salesforce = Record Owner + admin · HubSpot = Edit «Owned only / Everything» ·
 *    Pipedrive = deal owner. Κοινό: κρίνει ο **κάτοχος (ανατεθειμένος)** — όχι μόνο ο δημιουργός.
 * 🔁 **Μεταβίβαση** (ADR-930 §3.8): Salesforce «Change Owner» = ο κάτοχος ∨ «Transfer Record» · Pipedrive = ο κάτοχος
 *    πάντα, τις ξένες μόνο με «Change a deal's owner». Ο **δημιουργός που δεν είναι πια κάτοχος** δεν μεταβιβάζει —
 *    η δημιουργία είναι ιστορικό, όχι ιδιοκτησία (`CreatedById` ≠ `OwnerId`).
 *
 * | Πρόθεση  | Επιτρέπεται σε                                                              | Κανόνας Firestore (`match /opportunities`) |
 * |----------|-----------------------------------------------------------------------------|---------------------------------------------|
 * | `edit`   | ικανότητα `crm:opportunities:update` ∨ δημιουργός ∨ **ανατεθειμένος**        | `crmWriterIsPrivileged ∨ (crmIsAssignee ∧ crmNotForeignTenant)` |
 * | `delete` | ικανότητα ∨ δημιουργός — **ΟΧΙ** ο ανατεθειμένος (η ανάθεση δεν δίνει εξαφάνιση) | `crmWriterIsPrivileged` |
| `transfer` | ικανότητα ∨ **ο τρέχων κάτοχος** (`opportunityOwnerOf`: ανατεθειμένος, αλλιώς δημιουργός) | — ο πελάτης **ΔΕΝ** γράφει `assignedTo` (μόνο η πόρτα `…/owner`) |
 *
 * 🔑 **Καθαρός · σύγχρονος · κανένα `server-only`** (πρότυπο `lib/auth/container-access.ts`): ο server τον καλεί μέσα
 *    από `requireOpportunityAccess`, η οθόνη μέσα από `useOpportunityAccess` — **ίδια** απάντηση, ώστε κάρτα που
 *    σέρνεται να μην απορρίπτεται με 403.
 * ⛔ **ΔΕΝ ονομάζει ρόλο** (CHECK 3.68): η ικανότητα κρίνεται **μόνο** από τον `decideCapability` (ADR-801).
 *    Την ισοτιμία «ρόλοι με την ικανότητα ⇔ ρόλος των κανόνων» τη φυλά η CHECK 3.114 (Κ6).
 */

import { decideCapability } from '@/lib/auth/authority';
import type { PermissionId } from '@/lib/auth/types';
import { isGranted, type CapabilitySubject } from '@/types/capability-authority';

/** Η ικανότητα που δίνει πρόσβαση σε **όλες** τις ευκαιρίες της εταιρείας. */
export const OPPORTUNITY_MANAGE_PERMISSION: PermissionId = 'crm:opportunities:update';

export type OpportunityAccessIntent = 'edit' | 'delete' | 'transfer';

/** Ταυτότητα ήδη επαληθευμένη. Την ικανοποιούν **και** το `AuthContext` (server) **και** ο `FirebaseAuthUser` (πελάτης). */
export interface OpportunityAccessSubject extends CapabilitySubject {
  readonly uid: string;
}

/** Τα γεγονότα του πόρου που χρειάζεται η κρίση — περασμένα από τον καλούντα (AuthZEN `resource.properties`). */
export interface OpportunityAccessFacts {
  readonly companyId?: string | null;
  readonly createdBy?: string | null;
  readonly assignedTo?: string | null;
}

export type OpportunityAccessVerdict =
  | 'granted-capability'
  | 'granted-creator'
  | 'granted-assignee'
  | 'granted-owner'
  | 'denied-foreign-tenant'
  | 'denied-not-owner';

export interface OpportunityAccessDecision {
  readonly verdict: OpportunityAccessVerdict;
  readonly intent: OpportunityAccessIntent;
  /** Ποιος **μπορεί** — ο ανατεθειμένος, αλλιώς ο δημιουργός. Η άρνηση τον ονομάζει (ADR-930 §2.4). */
  readonly ownerUid: string | null;
}

/** Ποιες ετυμηγορίες επιτρέπουν. `Record` ⇒ νέα ετυμηγορία δεν μεταγλωττίζεται χωρίς απάντηση. */
const GRANTS: Readonly<Record<OpportunityAccessVerdict, boolean>> = {
  'granted-capability': true,
  'granted-creator': true,
  'granted-assignee': true,
  'granted-owner': true,
  'denied-foreign-tenant': false,
  'denied-not-owner': false,
};

export function isOpportunityAccessGranted(verdict: OpportunityAccessVerdict): boolean {
  return GRANTS[verdict];
}

const textOrNull = (value: string | null | undefined): string | null => (value ? value : null);

/** Ο κάτοχος κατά τη βιομηχανία: ο ανατεθειμένος· αν λείπει, ο δημιουργός. */
export function opportunityOwnerOf(facts: OpportunityAccessFacts): string | null {
  return textOrNull(facts.assignedTo) ?? textOrNull(facts.createdBy);
}

/**
 * Ο ίδιος ο κριτής. Σειρά = ίδια με τους κανόνες: ο υπερδιαχειριστής (bypass) περνά πάντα · ξένο έγγραφο ⇒ άρνηση ·
 * ικανότητα · (μεταβίβαση: μόνο ο κάτοχος) · δημιουργός · ανατεθειμένος (μόνο για `edit`). Έγγραφο χωρίς `companyId`
 * (legacy) δεν είναι ξένο.
 */
export function decideOpportunityAccess(query: {
  readonly subject: OpportunityAccessSubject;
  readonly opportunity: OpportunityAccessFacts;
  readonly intent: OpportunityAccessIntent;
}): OpportunityAccessDecision {
  const { subject, opportunity, intent } = query;
  const decide = (verdict: OpportunityAccessVerdict): OpportunityAccessDecision => ({
    verdict, intent, ownerUid: opportunityOwnerOf(opportunity),
  });
  const capability = decideCapability({ subject, action: OPPORTUNITY_MANAGE_PERMISSION });
  if (capability.verdict === 'granted-by-bypass') return decide('granted-capability');

  const docCompany = textOrNull(opportunity.companyId);
  if (docCompany !== null && docCompany !== textOrNull(subject.companyId)) return decide('denied-foreign-tenant');

  // Η ικανότητα είναι εμβέλειας εταιρείας: σε legacy έγγραφο (χωρίς εταιρεία) δεν σημαίνει τίποτα — όπως το
  // `crmIsCompanyAdmin` των κανόνων, που ζητά `companyId`.
  if (docCompany !== null && isGranted(capability.verdict)) return decide('granted-capability');
  if (intent === 'transfer') {
    return subject.uid && opportunityOwnerOf(opportunity) === subject.uid ? decide('granted-owner') : decide('denied-not-owner');
  }
  if (subject.uid && textOrNull(opportunity.createdBy) === subject.uid) return decide('granted-creator');
  if (intent === 'edit' && subject.uid && textOrNull(opportunity.assignedTo) === subject.uid) return decide('granted-assignee');
  return decide('denied-not-owner');
}

/** Το όνομα του handoff: *«μπορεί να μετακινήσει/επεξεργαστεί;»*. */
export function canEditOpportunity(subject: OpportunityAccessSubject, opportunity: OpportunityAccessFacts): boolean {
  return isOpportunityAccessGranted(decideOpportunityAccess({ subject, opportunity, intent: 'edit' }).verdict);
}

/** *«Μπορεί να τη δώσει σε άλλον;»* — η πρόθεση `transfer` (ADR-930 §3.8). */
export function canTransferOpportunity(subject: OpportunityAccessSubject, opportunity: OpportunityAccessFacts): boolean {
  return isOpportunityAccessGranted(decideOpportunityAccess({ subject, opportunity, intent: 'transfer' }).verdict);
}
