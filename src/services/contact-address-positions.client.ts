/**
 * @fileoverview Ο πελάτης του **ενός γραφέα θέσης** για τις επαφές (ADR-332 D27 Βήμα Β-ΙΙ).
 * @module services/contact-address-positions.client
 *
 * Ο διακομιστής **αποφασίζει** (`/api/contacts/…/address-positions`, resolve-only)· εδώ η
 * απόφαση εφαρμόζεται στην πλήρη εγγραφή του πελάτη και ταξιδεύει στην **ίδια** εγγραφή του
 * εγγράφου — ένα `updateDoc` / `setDoc`, μία γραμμή CDC.
 *
 * ⚠️ **Δύο συμπεριφορές αποτυχίας, σκόπιμα διαφορετικές:**
 * - **Αποθήκευση** (`positionContactPayload`): η διαδρομή δεν απάντησε ⇒ η αποθήκευση
 *   **προχωρά** με τις θέσεις όπως τις κρατά η φόρμα. Είναι η σημασιολογία του
 *   `geocoder-unavailable` («άγνοια ≠ γνώση»): τίποτα δεν σβήνεται, η επόμενη αποθήκευση
 *   ξαναλύνει. Η διαθεσιμότητα μιας επαφής δεν εξαρτάται από τον γεωκωδικοποιητή.
 * - **«Μετακίνησε»** (`relocateContactAddressPayload`): ρητή πράξη του ανθρώπου — η
 *   αποτυχία **φτάνει** σε αυτόν, δεν καταπίνεται.
 */

import type { Contact } from '@/types/contacts';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import {
  EnterpriseContactSaver,
  type EnterpriseContactData,
  type ResolvableContactPayload,
} from '@/utils/contacts/EnterpriseContactSaver';
import {
  authoritativeContactAddresses,
  resolveContactAddresses,
} from '@/utils/contacts/contact-addresses-reader';
import {
  applyContactAddressPosition,
  contactAddressPositionViews,
  type ContactAddressPositionsRequest,
  type ContactAddressPositionsResponse,
} from '@/utils/contacts/contact-address-position-view';
import { publishContactAddressAdvisories } from './contacts/contact-address-advisories';

const logger = createModuleLogger('ContactAddressPositionsClient');

/**
 * Ρωτά τον γραφέα και εφαρμόζει τις αποφάσεις. `null` ⇒ δεν υπάρχει τίποτα να ρωτηθεί.
 * **Πετά** σε αποτυχία — την πολιτική την αποφασίζει ο καλών.
 */
async function requestContactAddressPositions(
  addresses: readonly CompanyAddress[] | undefined,
  contactId: string | null,
  relocateAddressIds: readonly string[] = [],
): Promise<CompanyAddress[] | null> {
  if (!addresses || addresses.length === 0) return null;
  const views = contactAddressPositionViews(addresses);
  if (views.length === 0) return null;

  const body: ContactAddressPositionsRequest = {
    addresses: views,
    ...(relocateAddressIds.length > 0 ? { relocateAddressIds } : {}),
  };
  const url = contactId
    ? API_ROUTES.CONTACTS.ADDRESS_POSITIONS(contactId)
    : API_ROUTES.CONTACTS.NEW_ADDRESS_POSITIONS;
  const response = await apiClient.post<ContactAddressPositionsResponse>(url, body);

  const decisions = new Map(response.positions.map((decision) => [decision.id, decision]));
  if (contactId) publishContactAddressAdvisories(contactId, response.positionAdvisories);
  return addresses.map((address) => {
    const decision = address.id ? decisions.get(address.id) : undefined;
    return decision ? applyContactAddressPosition(address, decision) : address;
  });
}

/**
 * Το payload μιας αποθήκευσης (δημιουργία **ή** ενημέρωση), με τις θέσεις που αποφάσισε ο
 * γραφέας — ή αυτούσιο, αν η αποθήκευση δεν αγγίζει διευθύνσεις ή η διαδρομή δεν απάντησε.
 */
export async function positionContactPayload<P extends ResolvableContactPayload>(
  payload: P,
  contactId: string | null,
): Promise<P> {
  try {
    const resolved = await requestContactAddressPositions(
      authoritativeContactAddresses(payload.customFields),
      contactId,
    );
    return resolved ? EnterpriseContactSaver.withResolvedAddresses(payload, resolved) : payload;
  } catch (error) {
    logger.warn('Θέσεις διευθύνσεων: ο γραφέας δεν απάντησε — αποθήκευση με τις θέσεις της φόρμας', {
      contactId,
      error: getErrorMessage(error),
    });
    return payload;
  }
}

/** «Μετακίνησε στη θέση της διεύθυνσης» (Φ2β) — ρητή δήλωση για **μία** διεύθυνση. */
export async function relocateContactAddressPayload(
  contact: Contact,
  contactId: string,
  addressId: string,
): Promise<EnterpriseContactData> {
  const stored = resolveContactAddresses(contact, contact.type);
  const resolved = await requestContactAddressPositions(stored, contactId, [addressId]);
  if (!resolved) throw new Error(`ADDRESS_NOT_FOUND: ${addressId}`);
  return EnterpriseContactSaver.withResolvedAddresses<EnterpriseContactData>({}, resolved);
}
