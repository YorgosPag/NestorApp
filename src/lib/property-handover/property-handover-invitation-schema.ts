/**
 * @fileoverview **Το σχήμα της αποθηκευμένης πρόσκλησης αγοραστή** — η μία μετάφραση δίσκου → τύπου (ADR-916 Φ-Β).
 * @related lib/conveyance/engagement-invitation-schema.ts (το πρότυπο) · CHECK 3.74 (σύνορα ανάγνωσης)
 * @module lib/property-handover/property-handover-invitation-schema
 *
 * Ό,τι δεν διαβάζεται ⇒ `null` ⇒ ο πυρήνας το λέει `invitation-corrupt` — **κανένας** λογαριασμός δεν δένεται και
 * **κανένας** φάκελος δεν γεννιέται από έγγραφο που δεν καταλάβαμε. Η κατάσταση ελέγχεται εδώ **αυστηρά**· τη
 * fail-closed ανάγνωσή της για τις αρνήσεις την κάνει ο πυρήνας. Η ταυτότητα έρχεται **από έξω** και νικά.
 *
 * **Layering**: leaf — καθαρό (το καλούν έκδοση, όψη, εξαργύρωση, δίχτυ και άγκυρες).
 */

import { z } from 'zod';

import { INVITATION_STATES } from '@/types/invitation-core';
import { PROPERTY_HANDOVER_INVITATION_OCCASIONS } from '@/types/property-handover';
import type { PropertyHandoverInvitation } from '@/types/property-handover-invitation';

const nonEmpty = z.string().min(1);

/** Πόσοι σύνδεσμοι το πολύ ανά πρόσκληση — ό,τι πάνω από αυτό δεν το γράφει ποτέ ο γραφέας ⇒ αλλοιωμένο. */
const REISSUED_LINKS_MAX = 16;

const propertyHandoverInvitationSchema = z.object({
  inviteeEmail: nonEmpty,
  invitedByUid: nonEmpty,
  nonceHash: nonEmpty,
  reissuedNonceHashes: z.array(nonEmpty).max(REISSUED_LINKS_MAX).default([]),
  state: z.enum(INVITATION_STATES),
  createdAt: nonEmpty,
  expiresAt: nonEmpty,
  openedAt: nonEmpty.nullable(),
  resolvedAt: nonEmpty.nullable(),
  resolvedByUid: nonEmpty.nullable(),
  mailboxProvenAt: nonEmpty.nullable().default(null),
  companyId: nonEmpty,
  propertyId: nonEmpty,
  handoverId: nonEmpty,
  contactId: nonEmpty,
  occasion: z.enum(PROPERTY_HANDOVER_INVITATION_OCCASIONS),
});

/** Ωμό έγγραφο → `PropertyHandoverInvitation`, ή `null` αν δεν είναι πρόσκληση που καταλαβαίνουμε. */
export function propertyHandoverInvitationFromDocument(raw: unknown, id: string): PropertyHandoverInvitation | null {
  const parsed = propertyHandoverInvitationSchema.safeParse(raw);
  return parsed.success ? { ...parsed.data, id } : null;
}
