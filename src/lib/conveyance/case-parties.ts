/**
 * Conveyance — ένα πρόσωπο της υπόθεσης (ADR-915 §22 · §23): η ΜΙΑ κατασκευή του.
 *
 * Η ταυτότητα (`key`) ενός πωλητή είναι η επαφή του: η ίδια επαφή δύο φορές είναι **ένα** πρόσωπο (ιδεμπότητα), και οι
 * γραμμές του (`itemId@key`) δεν εξαρτώνται από τη θέση του στη λίστα. Πωλητής χωρίς γνωστή επαφή (έργο χωρίς
 * `linkedCompanyId`) παίρνει το σταθερό `UNIDENTIFIED_SELLER_KEY` — ποτέ τυχαίο κλειδί που θα άλλαζε σε κάθε ανάγνωση.
 *
 * §23 — **ποιος μπορεί να γίνει πωλητής** και **με ποια ιδιότητα** κρίνεται εδώ, μία φορά: ο server το ρωτά για την
 * επαφή που διάβασε ο ίδιος, ο client για την επαφή του επιλογέα (optimistic) — ίδια απάντηση, ίδιος κώδικας.
 *
 * **Layering**: leaf.
 *
 * @module lib/conveyance/case-parties
 */

import type {
  ConveyancePartyKind,
  ConveyanceSellerCapacity,
  ConveyanceSellerParty,
} from '@/types/conveyance-case';

/** Το κλειδί του πωλητή που δεν έχει (ακόμη) επαφή. */
export const UNIDENTIFIED_SELLER_KEY = 'seller';

/** Πόσοι μεταβιβάζοντες χωρούν σε μία υπόθεση — όριο αντοχής, όχι νόμου (κανένα συμβόλαιο δεν έχει εκατό). */
export const MAX_CASE_SELLERS = 30;

/** Η ταυτότητα του πωλητή μέσα στην υπόθεση — από την επαφή του. */
export function sellerKeyOf(contactId: string | null): string {
  return contactId ?? UNIDENTIFIED_SELLER_KEY;
}

export function sellerParty(
  contactId: string | null,
  kind: ConveyancePartyKind,
  capacity: ConveyanceSellerCapacity,
): ConveyanceSellerParty {
  return { key: sellerKeyOf(contactId), contactId, kind, capacity };
}

/** Ό,τι χρειάζεται η κρίση για μια επαφή — από ωμό έγγραφο (server) ή από τον επιλογέα (client). */
export interface SellerContactFacts {
  readonly type: unknown;
  readonly status?: unknown;
}

/**
 * Φυσικό ή νομικό πρόσωπο **από τον τύπο της επαφής** — `null` ⇒ η επαφή δεν μπορεί να μεταβιβάσει: υπηρεσία
 * (`service`), ή επαφή που αρχειοθετήθηκε/διαγράφηκε (`archived` · `deleted`). Ποτέ από δήλωση του client.
 */
export function sellerKindOfContact(contact: SellerContactFacts): ConveyancePartyKind | null {
  if (contact.status === 'archived' || contact.status === 'deleted') return null;
  if (contact.type === 'company') return 'legal_entity';
  if (contact.type === 'individual') return 'person';
  return null;
}

/** Τι ξέρει ο server για το έργο της υπόθεσης — αρκεί για να παραχθεί η ιδιότητα. */
export interface SellerCapacitySources {
  readonly principalContactId: string | null;
  readonly landownerContactIds: readonly string[];
}

/** Η ιδιότητα **παράγεται** από το έργο: η εταιρεία του · οικοπεδούχος του · κάθε άλλος. */
export function sellerCapacityOf(contactId: string, sources: SellerCapacitySources): ConveyanceSellerCapacity {
  if (contactId === sources.principalContactId) return 'principal';
  if (sources.landownerContactIds.includes(contactId)) return 'landowner';
  return 'other';
}

/** Ένας υποψήφιος πωλητής, όπως τον έκρινε όποιος διάβασε την επαφή. */
export type SellerCandidate = Pick<ConveyanceSellerParty, 'kind' | 'capacity'>;

/** Ο κριτής «μπορεί αυτή η επαφή να γίνει πωλητής, και πώς;» — `null` ⇒ όχι (ή άγνωστη/ξένη, ADR-742). */
export function sellerCandidateOf(
  contactId: string,
  contact: SellerContactFacts | null,
  sources: SellerCapacitySources,
): SellerCandidate | null {
  if (contact === null) return null;
  const kind = sellerKindOfContact(contact);
  return kind === null ? null : { kind, capacity: sellerCapacityOf(contactId, sources) };
}

/** Υπάρχει ο εργολάβος/κύριος της πώλησης ανάμεσα στους μεταβιβάζοντες; */
export function hasPrincipalSeller(sellers: readonly Pick<ConveyanceSellerParty, 'capacity'>[]): boolean {
  return sellers.some((party) => party.capacity === 'principal');
}
