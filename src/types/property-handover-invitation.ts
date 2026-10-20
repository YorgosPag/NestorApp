/**
 * @fileoverview **Η ΠΡΟΣΚΛΗΣΗ ΤΟΥ ΑΓΟΡΑΣΤΗ ΣΤΟΝ ΦΑΚΕΛΟ ΤΟΥ** — ένα ακόμη είδος του κοινού πυρήνα (ADR-916 Φ-Β · ADR-853 §20).
 * @related types/invitation-core.ts (τα κοινά πεδία) · types/property-handover.ts (η παράδοση που την εκδίδει)
 * @module types/property-handover-invitation
 *
 * 🔑 **Τι δίνει η αποδοχή**: τον λογαριασμό του αγοραστή **δένεται** στην παράδοση και γεννιέται ο **φάκελός** του
 * (ADR-866) — στην **ίδια** συναλλαγή με το `pending → accepted`. Καμία ιδιότητα μέλους, κανένα claim: ο αγοραστής
 * **δεν** μπαίνει στο γραφείο, παίρνει το **δικό του** σπίτι.
 *
 * **Layering**: leaf — καθαροί τύποι (τους εισάγουν και οθόνες).
 */

import { CORE_INVITATION_REFUSALS, type InvitationRecordCore } from '@/types/invitation-core';
import type { PropertyHandoverInvitationOccasion } from '@/types/property-handover';

/** Το έγγραφο `property_handover_invitations/{phin_*}`. ⛔ Κανένα πεδίο δεν φτάνει ωμό σε πελάτη (`read: false`). */
export interface PropertyHandoverInvitation extends InvitationRecordCore {
  /** Ο μισθωτής-πωλητής — ο εκδότης. */
  readonly companyId: string;
  readonly propertyId: string;
  /** Η παράδοση που την εξέδωσε — η **μία** ζωντανή πρόσκληση ανά παράδοση (supersede). */
  readonly handoverId: string;
  /** Ο αγοραστής ως επαφή του γραφείου — για τα ίχνη· η δέσμευση γίνεται με το email (ADR-853 §7.5). */
  readonly contactId: string;
  readonly occasion: PropertyHandoverInvitationOccasion;
}

/**
 * Οι αρνήσεις **του είδους**, μετά τις κοινές.
 * `handover-closed` — η πώληση ακυρώθηκε, ή η παράδοση έχει **ήδη** παραλήπτη: η πρόσκληση μένει `pending`, καμία γραφή.
 */
export const PROPERTY_HANDOVER_INVITATION_KIND_REFUSALS = ['handover-closed'] as const;

export type PropertyHandoverInvitationKindRefusal = (typeof PROPERTY_HANDOVER_INVITATION_KIND_REFUSALS)[number];

/** Ό,τι μπορεί να απαντήσει η πόρτα εξαργύρωσης — το κλειστό λεξιλόγιο της σελίδας `/handover-invite/[token]`. */
export const PROPERTY_HANDOVER_INVITATION_REFUSALS = [
  ...CORE_INVITATION_REFUSALS,
  ...PROPERTY_HANDOVER_INVITATION_KIND_REFUSALS,
] as const;

export type PropertyHandoverInvitationRefusal = (typeof PROPERTY_HANDOVER_INVITATION_REFUSALS)[number];

/**
 * **Η όψη πριν την απόφαση** — «ποιος μου δίνει, ποιο σπίτι, ως πότε». 🔒 Καμία ονομασία μέρους, κανένα email: ένα
 * προωθημένο email δεν πρέπει να λέει σε τρίτον ποιος αγοράζει ποιο σπίτι (ADR-742 ελαχιστοποίηση).
 */
export interface PropertyHandoverInvitationPreview {
  /** Η εταιρεία που πουλά — `null` ⇒ η επιφάνεια το ονομάζει από τα λόγια της. */
  readonly issuerName: string | null;
  readonly propertyLabel: string | null;
  readonly occasion: PropertyHandoverInvitationOccasion;
  readonly expiresAt: string;
}
