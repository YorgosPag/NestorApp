/**
 * @fileoverview **ΠΟΙΟΣ ΕΝΕΡΓΕΙ ΣΤΗΝ ΚΛΕΙΣΤΗ ΔΙΑΘΕΣΗ — ΚΑΙ ΠΟΙΕΣ ΕΝΤΟΛΕΣ ΒΛΕΠΕΙ.**
 * @related ADR-864 §17.6 · §18.4 Δ2 · services/mandate/private-marketing-consent.service.ts ·
 *   services/mandate/private-marketing-panel.service.ts
 * @module services/mandate/private-marketing-actor
 *
 * 🔑 **Η εύρεση της εντολής ΕΙΝΑΙ η εξουσιοδότηση** — και την ρωτούν **δύο**: ο γραφέας (αίτημα · παροχή ·
 * ανάκληση) και ο αναγνώστης πάνελ (Δ2). Δεύτερη διατύπωση στον αναγνώστη θα άφηνε την οθόνη να δείξει
 * εντολή που ο γραφέας αρνείται — ή, χειρότερα, το αντίστροφο (Α28).
 *
 * | Δρων | Βλέπει |
 * |---|---|
 * | `owner-link` | τη **μία** εντολή της πρόσκλησης (`nonce` + επαφή) |
 * | `owner-account` | **κάθε** δεσμευτική εντολή πάνω σε **δική του** προσωπική καταχώρηση |
 * | `agency` | **μόνο** τη δική του εντολή |
 *
 * **Layering**: καθαρές συναρτήσεις πάνω σε ήδη διαβασμένη καταχώρηση — καμία Firestore.
 */

import { custodyOf, isPersonalCustody, mayAdminister, type ListingActor } from '@/lib/owner-property/listing-custody';
import { consentBearingMandates } from '@/lib/mandate/private-marketing-standing';
import type { OwnerProperty } from '@/types/owner-property';
import type { BrokeredListingMandate } from '@/types/owner-property-mandate';
import type { PrivateMarketingChannel } from '@/types/private-marketing-consent';

export type OwnerLinkActor = { readonly kind: 'owner-link'; readonly nonce: string; readonly clientContactId: string };
export type OwnerAccountActor = { readonly kind: 'owner-account'; readonly actor: ListingActor };
export type AgencyActor = { readonly kind: 'agency'; readonly actor: ListingActor };
export type ConsentActor = OwnerLinkActor | OwnerAccountActor | AgencyActor;

export const CHANNEL_OF: Record<ConsentActor['kind'], PrivateMarketingChannel> = {
  'owner-link': 'link',
  'owner-account': 'account',
  agency: 'form',
};

/** **Όλες** οι εντολές που αυτός ο δρων δικαιούται να αγγίξει — κενό = καμία, ποτέ «υπάρχει αλλά όχι για σένα». */
export function mandatesVisibleTo(
  property: OwnerProperty,
  who: ConsentActor,
  nowISOValue: string,
): readonly BrokeredListingMandate[] {
  const bearing = consentBearingMandates(property.mandates, nowISOValue);
  switch (who.kind) {
    case 'owner-link':
      return bearing.filter((m) => m.consentNonce === who.nonce && m.clientContactId === who.clientContactId);
    case 'owner-account':
      return isPersonalCustody(property) && mayAdminister(custodyOf(property), who.actor) ? bearing : [];
    case 'agency':
      return bearing.filter((m) => who.actor.companyId !== null && m.agencyCompanyId === who.actor.companyId);
  }
}

/**
 * **Η μία εντολή** — `agencyCompanyId` ονομάζει ποια, όταν ο δρων βλέπει πολλές (ιδιοκτήτης)·
 * `null` = «η μοναδική που βλέπω» (σύνδεσμος · γραφείο).
 */
export function locateMandate(
  property: OwnerProperty,
  who: ConsentActor,
  agencyCompanyId: string | null,
  nowISOValue: string,
): BrokeredListingMandate | null {
  const visible = mandatesVisibleTo(property, who, nowISOValue);
  if (agencyCompanyId === null) return visible.length === 1 ? (visible[0] ?? null) : null;
  return visible.find((m) => m.agencyCompanyId === agencyCompanyId) ?? null;
}

/** Ποιος γράφεται στο ίχνος — ο σύνδεσμος δεν έχει λογαριασμό, έχει **επαφή**. */
export function auditActorOf(who: ConsentActor): ListingActor {
  return who.kind === 'owner-link' ? { uid: who.clientContactId, companyId: null } : who.actor;
}

export function actorUserIdOf(who: ConsentActor): string | null {
  return who.kind === 'owner-link' ? null : who.actor.uid;
}
