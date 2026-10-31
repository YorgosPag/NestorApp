/**
 * Οι δύο πόρτες της σχέσης προμήθειας (ADR-923 §5.12 Σ2): η πρόσκληση από επαφή, ο ανακλητός σύνδεσμος/QR, και οι
 * αρνήσεις που μοιράζονται.
 * @module subapps/catalog/types/supply-invitation
 */

import type { InvitationRecordCore } from '@/types/invitation-core';

import { SUPPLY_RELATIONSHIP_REFUSALS } from './supply-relationship';

/** Πόρτα α: το έγγραφο της μηχανής ADR-853, με τον προμηθευτή και την επαφή του. */
export interface SupplyInvitation extends InvitationRecordCore {
  /** Ο προμηθευτής που προσκαλεί. */
  readonly companyId: string;
  /** Η επαφή από την οποία ξεκίνησε: η σχέση τη δένει με τον χώρο που θα δηλώσει ο άλλος (Σ3 · Σ6). */
  readonly contactId: string;
}

export const SUPPLY_LINK_STATES = ['live', 'revoked'] as const;
export type SupplyLinkState = (typeof SUPPLY_LINK_STATES)[number];

/**
 * Πόρτα β: **ένας** σύνδεσμος ανά χώρο.
 * 🔑 Ο σύνδεσμος είναι το ζεύγος (id, γενιά) υπογεγραμμένο, χωρίς nonce στη βάση: ξαναπαράγεται όποτε τον ζητήσει η οθόνη
 *    ή ο εκδότης (ίδιο QR σε κάθε έντυπο), και κανένα μυστικό δεν ζει στο έγγραφο. Η ανάκληση είναι νέα γενιά.
 * ⚠️ Καμία λήξη στον σύνδεσμο: ο έντυπος κατάλογος ζει χρόνια. Έλεγχος είναι η ανάκληση και η έγκριση κάθε αιτήματος.
 */
export interface SupplyRequestLink {
  readonly id: string;
  readonly companyId: string;
  readonly generation: number;
  readonly state: SupplyLinkState;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedBy: string;
}

/** Αρνήσεις που δίνει η **πράξη του αγοραστή**, και στις δύο πόρτες. */
export const SUPPLY_BUYER_REFUSALS = [
  ...SUPPLY_RELATIONSHIP_REFUSALS,
  /** Σ3: ο προσωπικός χώρος δεν έχει BOQ, άρα ούτε σχέση. Η οθόνη στέλνει τον άνθρωπο να φτιάξει γραφείο. */
  'office-required',
  /** 2+ γραφεία χωρίς επιλογή. */
  'office-choice-required',
  /** Ζήτησε γραφείο όπου δεν ανήκει. */
  'office-refused',
  /** Ο χώρος που δήλωσε είναι ο ίδιος ο προμηθευτής. */
  'same-workspace',
  /** Η επαφή κρατά ήδη άλλον αγοραστή. */
  'contact-bound',
] as const;
export type SupplyBuyerRefusal = (typeof SUPPLY_BUYER_REFUSALS)[number];

/** Ό,τι βλέπει ο αγοραστής **πριν** από κάθε απόφαση. Μόνο το όνομα του προμηθευτή: καμία άλλη πληροφορία στον σύνδεσμο. */
export interface SupplyAccessPreview {
  readonly supplierName: string | null;
}

/** Η όψη πρόσκλησης προσθέτει τη λήξη: ο σύνδεσμος/QR δεν λήγει. */
export interface SupplyInvitationPreview extends SupplyAccessPreview {
  readonly expiresAt: string;
}
