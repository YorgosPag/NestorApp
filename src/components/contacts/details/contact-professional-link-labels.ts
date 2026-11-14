/**
 * @fileoverview **Οι ετικέτες του λογαριασμού πίσω από την επαφή** (ADR-915 §40) — κλειστοί πίνακες κλειδιών.
 * @module components/contacts/details/contact-professional-link-labels
 *
 * ⚠️ **Μέλη αντικειμένων, ποτέ δυναμικό `${…}`**: ο εξαγωγέας του slice (ADR-744) ακολουθεί μέλη πινάκων ετικετών.
 * 🔑 Ό,τι υπάρχει ήδη **δεν** ξαναγράφεται: έγγραφο = `DOCUMENT_KIND_LABEL_KEYS` · μητρώο =
 *    `REGISTRY_AUTHORITY_PRESENTATION` · ρόλος μεταβίβασης = `CASE_INVITE_ROLE_KEY` · κατάσταση συμμετοχής από τη θέση
 *    του γραφείου = `conveyance:engagement.states.*` (ήδη η φωνή του γραφείου: «Αναμένει αποδοχή», «Έχει πρόσβαση»).
 */

import type { EngagementState } from '@/types/engagement';

export const PROFESSIONAL_LINK_KEYS = {
  region: 'contacts-core:header.professionalLink.region',
  linked: 'contacts-core:header.professionalLink.linked',
  offered: 'contacts-core:header.professionalLink.offered',
  assignmentsLabel: 'contacts-core:header.professionalLink.assignmentsLabel',
  declaredLabel: 'contacts-core:header.professionalLink.declaredLabel',
  declaredValue: 'contacts-core:header.professionalLink.declaredValue',
  actingForOffice: 'contacts-core:header.professionalLink.actingForOffice',
} as const;

/** Η κατάσταση της συμμετοχής, όπως τη διαβάζει το γραφείο — ολικός πάνω στο λεξιλόγιο του πυρήνα. */
export const ENGAGEMENT_STATE_KEYS: Readonly<Record<EngagementState, string>> = {
  offered: 'conveyance:engagement.states.offered',
  active: 'conveyance:engagement.states.active',
  declined: 'conveyance:engagement.states.declined',
  withdrawn: 'conveyance:engagement.states.withdrawn',
  revoked: 'conveyance:engagement.states.revoked',
  expired: 'conveyance:engagement.states.expired',
  completed: 'conveyance:engagement.states.completed',
};
