/**
 * @fileoverview **«Το φέρνει» — ΠΟΙΟΣ, συγκεκριμένα** (ADR-915 §25): από τη γραμμή και την απόκριση στους ανθρώπους
 *   που θα δείξει η οθόνη. Ένας κανόνας για γραμμή εγγράφου **και** κενού.
 * @related lib/document-validity/registry-owners.ts (ποιος είναι ιδιοκτήτης) · lib/document-validity/obligor-lead.ts
 *   (ποιος ο υπεύθυνος) · RegistryIssuerValue.tsx (η απόδοση)
 * @module components/document-registry/registry-obligors
 *
 * Τρεις απαντήσεις, ποτέ συγχωνευμένες:
 *  - `unknown` — δεν ρωτήθηκε ή η ανάγνωση απέτυχε ⇒ μόνο ο ρόλος, **χωρίς** ισχυρισμό·
 *  - `none`    — ρωτήθηκε, κανείς δεν ορίστηκε ⇒ «δεν έχει οριστεί» (ποτέ σιωπηλό κενό)·
 *  - `people`  — οι άνθρωποι, με σύνδεσμο **μόνο** όσοι είναι επαφές του μισθωτή (`people` — ξένη ≡ ανύπαρκτη).
 *
 * 🔑 ADR-915 §26 — έγγραφο **ακινήτου** με **≥ 2** ιδιοκτήτες ⇒ `lead`: ο ΕΝΑΣ υπεύθυνος (πρώτος, ξεχωριστά) και οι
 *    υπόλοιποι ως συνιδιοκτήτες· ή **γιατί** δεν ορίζεται. Γραμμή **προσώπου** (5γ) ή ένας ιδιοκτήτης ⇒ κανένα `lead`
 *    (δεν υπάρχει τίποτα να διαλέξεις).
 *
 * **Layering**: καθαρές συναρτήσεις, μηδέν I/O.
 */

import type { ObligorLead, ObligorLeadBasis, ObligorUndesignatedReason } from '@/lib/document-validity/obligor-lead';
import {
  registryRowPartyOf,
  registryRowPropertyIdOf,
  type RegistryRow,
} from '@/lib/document-validity/document-registry';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';

/** Πόσοι ονομάζονται πάνω στη γραμμή· οι υπόλοιποι μετριούνται («+N ακόμη»). */
export const OBLIGOR_NAMES_SHOWN = 3;

export interface RegistryObligorPerson {
  readonly contactId: string;
  /** `null` = η επαφή υπάρχει αλλά δεν έχει όνομα. */
  readonly name: string | null;
  /** `false` = η επαφή δεν διαβάστηκε (διαγραμμένη · ξένη) — ούτε όνομα ούτε σύνδεσμος. */
  readonly reachable: boolean;
}

/** §26 — ο υπεύθυνος όπως τον λέει η γραμμή, με τον **λόγο** (και την παλιά επιλογή που δεν ισχύει πια). */
export type RegistryObligorLead =
  | {
      readonly kind: 'designated';
      readonly person: RegistryObligorPerson;
      readonly basis: ObligorLeadBasis;
      readonly sharePct: number | null;
      readonly stale: RegistryObligorPerson | null;
    }
  | { readonly kind: 'undesignated'; readonly reason: ObligorUndesignatedReason; readonly stale: RegistryObligorPerson | null };

/** §26 — ό,τι χρειάζεται ο διάλογος «Ορισμός υπευθύνου»: όλοι οι ιδιοκτήτες, τα μερίδια, η τρέχουσα ρητή επιλογή. */
export interface RegistryObligorChoice {
  readonly propertyId: string;
  readonly owners: readonly RegistryObligorPerson[];
  readonly shares: Readonly<Record<string, number>>;
  readonly explicitContactId: string | null;
}

export type RegistryObligors =
  | { readonly kind: 'unknown' }
  | { readonly kind: 'none' }
  | {
      readonly kind: 'people';
      /** Οι ονομαζόμενοι — **χωρίς** τον υπεύθυνο όταν υπάρχει `lead` (εκείνος λέγεται χωριστά, πρώτος). */
      readonly shown: readonly RegistryObligorPerson[];
      readonly more: number;
      readonly lead: RegistryObligorLead | null;
      readonly choice: RegistryObligorChoice | null;
    };

const UNKNOWN: RegistryObligors = { kind: 'unknown' };

type Names = Pick<DocumentRegistryResponse, 'properties' | 'people'>;

function personOf(contactId: string, registry: Names): RegistryObligorPerson {
  const label = registry.people[contactId];
  return { contactId, name: label?.name ?? null, reachable: label !== undefined };
}

function listed(people: readonly RegistryObligorPerson[]): Pick<Extract<RegistryObligors, { kind: 'people' }>, 'shown' | 'more'> {
  return { shown: people.slice(0, OBLIGOR_NAMES_SHOWN), more: Math.max(0, people.length - OBLIGOR_NAMES_SHOWN) };
}

function peopleOf(contactIds: readonly string[], registry: Names): RegistryObligors {
  if (contactIds.length === 0) return { kind: 'none' };
  return { kind: 'people', ...listed(contactIds.map((id) => personOf(id, registry))), lead: null, choice: null };
}

function leadOf(lead: ObligorLead, registry: Names): RegistryObligorLead {
  const stale = lead.staleContactId === null ? null : personOf(lead.staleContactId, registry);
  if (lead.kind === 'undesignated') return { kind: 'undesignated', reason: lead.reason, stale };
  return { kind: 'designated', person: personOf(lead.contactId, registry), basis: lead.basis, sharePct: lead.sharePct, stale };
}

/** Πολλοί ιδιοκτήτες ⇒ ο υπεύθυνος πρώτος, ξεχωριστά· οι υπόλοιποι ως συνιδιοκτήτες. */
function coOwnedOf(propertyId: string, owners: readonly string[], lead: ObligorLead, registry: Names): RegistryObligors {
  const view = leadOf(lead, registry);
  const leadId = view.kind === 'designated' ? view.person.contactId : null;
  const choice: RegistryObligorChoice = {
    propertyId,
    owners: owners.map((id) => personOf(id, registry)),
    shares: registry.properties[propertyId]?.ownerShares ?? {},
    explicitContactId: lead.kind === 'designated' && lead.basis === 'explicit' ? lead.contactId : null,
  };
  return { kind: 'people', ...listed(choice.owners.filter((person) => person.contactId !== leadId)), lead: view, choice };
}

/**
 * Οι άνθρωποι πίσω από το «Το φέρνει» μιας γραμμής. **Το πρόσωπο της γραμμής νικά** (5γ): η ενημερότητα του Α λέει «Α»,
 * ποτέ «Α, Β» — αλλιώς δύο γραμμές συμπωλητών θα έγραφαν τα ίδια ονόματα και η διάκριση θα χανόταν. Χωρίς πρόσωπο ⇒ οι
 * ιδιοκτήτες του ακινήτου (και, με πολλούς, ο υπεύθυνος — §26). Πρόσωπο **χωρίς** επαφή ⇒ «δεν έχει οριστεί».
 */
export function registryObligorsOf(row: RegistryRow, registry: Names): RegistryObligors {
  const party = registryRowPartyOf(row);
  if (party !== null) return peopleOf(party.contactId === null ? [] : [party.contactId], registry);
  const propertyId = registryRowPropertyIdOf(row);
  const label = propertyId === null ? undefined : registry.properties[propertyId];
  const owners = label?.ownerContactIds ?? null;
  if (propertyId === null || owners === null) return UNKNOWN;
  const lead = label?.obligorLead ?? null;
  return owners.length > 1 && lead !== null ? coOwnedOf(propertyId, owners, lead, registry) : peopleOf(owners, registry);
}

/**
 * §26 — **αισιόδοξη** εμφάνιση: ο ορισμός που μόλις έγινε φαίνεται **αμέσως**, πριν απαντήσει ο διακομιστής. Ασφαλές
 * μόνο για **επαφή** (η ρητή επιλογή ιδιοκτήτη νικά πάντα — ίδιο αποτέλεσμα με τον κριτή)· η **επαναφορά** (`null`)
 * θέλει τον διακομιστή (μερίδια · κύριος πωλητής), άρα δείχνει την τρέχουσα τιμή ώσπου να έρθει η νέα.
 */
export function withPendingDesignations(
  registry: DocumentRegistryResponse,
  pending: ReadonlyMap<string, string | null>,
): DocumentRegistryResponse {
  const overrides = [...pending].flatMap(([propertyId, contactId]) => {
    const label = registry.properties[propertyId];
    if (contactId === null || label === undefined || !(label.ownerContactIds ?? []).includes(contactId)) return [];
    const obligorLead: ObligorLead = {
      kind: 'designated', contactId, basis: 'explicit', sharePct: label.ownerShares[contactId] ?? null, staleContactId: null,
    };
    return [[propertyId, { ...label, obligorLead }] as const];
  });
  return overrides.length === 0 ? registry : { ...registry, properties: { ...registry.properties, ...Object.fromEntries(overrides) } };
}
