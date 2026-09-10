/**
 * @fileoverview Η απήχηση `CONTACT_UPDATED` πάνω σε μια επαφή της λίστας — **καθαρή** συνάρτηση.
 * @module components/contacts/page/contact-realtime-updates
 *
 * Εξήχθη από το `useContactsPageState` (N.7.1 — 495 γραμμές) στο ADR-332 D27 Β-ΙΙ, όταν η
 * απήχηση απέκτησε και **τις διευθύνσεις που γράφτηκαν** (πρακτική Β5 των έργων: ο πελάτης
 * υιοθετεί ό,τι αποφάσισε ο γραφέας). Ως τότε μετέφερε μόνο όνομα / αγαπημένο / κατάσταση, και
 * ένα «Μετακίνησε» θα έμενε αόρατο μέχρι την επαναφόρτωση.
 *
 * ⚠️ Η αυθεντική λίστα μπαίνει **μέσα** στο `customFields` χωρίς να αγγίξει τα αδέλφια της
 * (ΚΑΔ / ΓΕΜΗ): ίδιος κανόνας με την εγγραφή (`contact-update-paths`).
 */

import type { Contact } from '@/types/contacts';
import type { ContactUpdatedPayload } from '@/services/realtime';

export function applyContactRealtimeUpdates<T extends Contact>(
  contact: T,
  updates: ContactUpdatedPayload['updates'],
): T {
  const patch: Record<string, unknown> = {};
  if (updates.firstName !== undefined) patch.firstName = updates.firstName;
  if (updates.lastName !== undefined) patch.lastName = updates.lastName;
  if (updates.companyName !== undefined) patch.companyName = updates.companyName;
  if (updates.serviceName !== undefined) patch.serviceName = updates.serviceName;
  if (updates.isFavorite !== undefined) patch.isFavorite = updates.isFavorite;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.addresses !== undefined) patch.addresses = updates.addresses;
  if (updates.companyAddresses !== undefined) {
    patch.customFields = { ...(contact.customFields ?? {}), companyAddresses: updates.companyAddresses };
  }
  return Object.assign({}, contact, patch);
}
