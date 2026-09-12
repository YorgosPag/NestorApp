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
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
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
import {
  publishContactAddressAdvisories,
  publishContactAddressPending,
} from './contacts/contact-address-advisories';

const logger = createModuleLogger('ContactAddressPositionsClient');
const { GEOCODING } = GEOGRAPHIC_CONFIG;

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
  // ADR-332 D27 Ζ5 — **όριο πελάτη = προθεσμία διακομιστή + περιθώριο**, ίδιο σχήμα με το Β13.
  //
  // ⚠️ **`retry: false` και δεν είναι λεπτομέρεια**: ο πελάτης επαναλαμβάνει **3 φορές** από προεπιλογή,
  // άρα σκέτο `timeout` θα **τριπλασίαζε** την αναμονή που μόλις φράξαμε — και θα ξαναέστελνε
  // **ταυτόσημο** ερώτημα, ακριβώς ό,τι η πολιτική του Nominatim χαρακτηρίζει *faulty*. Η επανάληψη
  // εδώ δεν έχει και νόημα: η επόμενη αποθήκευση ξαναλύνει ούτως ή άλλως.
  const response = await apiClient.post<ContactAddressPositionsResponse>(url, body, {
    timeout: GEOCODING.RESOLVER_TIMEOUT_MS + GEOCODING.RESOLVER_CLIENT_GRACE_MS,
    retry: false,
  });

  const decisions = new Map(response.positions.map((decision) => [decision.id, decision]));
  if (contactId) {
    publishContactAddressAdvisories(contactId, response.positionAdvisories);
    // ADR-332 D27 Ζ5 — δημοσιεύεται **πάντα**, ακόμη και κενό: έτσι η ένδειξη της προηγούμενης
    // αποθήκευσης σβήνει μόνη της όταν η επόμενη προλάβει να λύσει τη θέση.
    publishContactAddressPending(contactId, response.positionsPending ?? []);
  }
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
