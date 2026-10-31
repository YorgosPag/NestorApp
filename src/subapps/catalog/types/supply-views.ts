/**
 * Οι **όψεις** της σχέσης προμήθειας (ADR-923 §5.12): ό,τι φεύγει από τον διακομιστή, ανά πλευρά.
 *
 * 🔒 Η πλευρά του αγοραστή **δεν** βλέπει ποια επαφή τον δένει, ποιος ενέκρινε, ούτε τον λόγο τέλους: `ended` είναι και το
 *    `declined` και το `revoked`, από όποια πλευρά (Σ7). Η πλευρά του προμηθευτή βλέπει ό,τι χρειάζεται για να αποφασίσει.
 * @module subapps/catalog/types/supply-views
 */

import type { InvitationState } from '@/types/invitation-core';
import type { ViewFreshness } from '@/types/server-view';

import type { SupplyLinkState } from './supply-invitation';
import type { SupplyRelationshipSide, SupplyRelationshipState } from './supply-relationship';

/** Μία σχέση στη λίστα του προμηθευτή. */
export interface SupplierRelationshipRow {
  readonly id: string;
  readonly buyerCompanyId: string;
  readonly buyerName: string | null;
  readonly state: SupplyRelationshipState;
  readonly origin: 'invitation' | 'link';
  readonly supplierContactId: string | null;
  readonly contactName: string | null;
  readonly customerRef: string | null;
  readonly requestedAt: string | null;
  readonly acceptedAt: string | null;
  readonly endedBySide: SupplyRelationshipSide | null;
  readonly endedAt: string | null;
  readonly revision: number;
}

/** Μία πρόσκληση σε εκκρεμότητα. `expired`: παράγεται, κανείς δεν σκουπίζει τις ληγμένες. */
export interface SupplierInvitationRow {
  readonly id: string;
  readonly contactId: string;
  readonly contactName: string | null;
  readonly inviteeEmail: string;
  readonly state: InvitationState;
  readonly sentAt: string;
  readonly openedAt: string | null;
  readonly expiresAt: string;
}

export interface SupplyRequestLinkWire {
  readonly state: SupplyLinkState | 'none';
  /** Μόνο όσο ο σύνδεσμος ζει. */
  readonly token: string | null;
}

/** `supply` από την πλευρά του προμηθευτή. */
export interface SupplierSupplyView {
  readonly freshness: ViewFreshness;
  readonly relationships: readonly SupplierRelationshipRow[];
  readonly invitations: readonly SupplierInvitationRow[];
  readonly link: SupplyRequestLinkWire;
}

/** Τι βλέπει ο αγοραστής. `ended` καλύπτει απόρριψη και ανάκληση από όποια πλευρά: κανένας λόγος δεν φεύγει. */
export type BuyerRelationshipState = 'requested' | 'active' | 'ended';

export interface BuyerRelationshipRow {
  readonly id: string;
  readonly supplierCompanyId: string;
  readonly supplierName: string | null;
  readonly state: BuyerRelationshipState;
  readonly customerRef: string | null;
  readonly revision: number;
}

/** `supply` από την πλευρά του αγοραστή. */
export interface BuyerSupplyView {
  readonly freshness: ViewFreshness;
  readonly relationships: readonly BuyerRelationshipRow[];
}
