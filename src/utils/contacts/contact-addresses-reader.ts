/**
 * =============================================================================
 * CONTACT ADDRESSES READER — η ΜΙΑ ανάγνωση της λίστας διευθύνσεων (ADR-332 D18)
 * =============================================================================
 *
 * ΤΙ ΔΙΟΡΘΩΝΕΙ
 * Η λίστα διευθύνσεων μιας επαφής διαβαζόταν **μόνο** για εταιρείες: ο
 * `companyMapper` είχε ιδιωτική `resolveCompanyAddresses`, ενώ ο
 * `individualMapper` και ο `serviceMapper` διάβαζαν **μόνο** `addresses[0]`.
 * Μαζί με το κάτοπτρό του στην εγγραφή (`EnterpriseContactSaver`, όπου το
 * μπλοκ έτρεχε κάτω από `if (type === 'company')`), το αποτέλεσμα ήταν
 * **σιωπηλή απώλεια δεδομένων**: το UI δέχεται επιπλέον διευθύνσεις και για
 * τους τρεις τύπους (`AddressesSectionWithFullscreen` — ίδιο component,
 * κουμπί «Νέα διεύθυνση» χωρίς έλεγχο τύπου), αλλά ό,τι δεν ήταν στη θέση 0
 * δεν αποθηκευόταν πουθενά και δεν ξαναδιαβαζόταν ποτέ.
 *
 * Ότι επρόκειτο για ελάττωμα και όχι για σχεδιαστική επιλογή το λέει το ίδιο
 * το σχήμα: το `CONTACT_ADDRESS_TYPE_METADATA` (ADR-319) ορίζει ρητά
 * `home`/`office`/`vacation` για φυσικά πρόσωπα και
 * `central_service`/`regional_service`/`annex`/`department` για υπηρεσίες, και
 * ο τύπος `CompanyAddress` το τεκμηριώνει («wider than the legacy
 * headquarters|branch pair **so individuals can pick** home/vacation/office»).
 * Το λεξιλόγιο υπήρχε· η αποθήκευση δεν το ακολούθησε.
 *
 * ΓΙΑΤΙ ΔΕΝ ΜΕΤΟΝΟΜΑΣΤΗΚΕ ΤΟ ΠΕΔΙΟ
 * Το `customFields.companyAddresses` κρατά το όνομά του για **όλους** τους
 * τύπους. Ένα σωστότερο ουδέτερο όνομα θα απαιτούσε μετάπτωση υπαρχόντων
 * εγγράφων εταιρειών· η διόρθωση απώλειας δεδομένων δεν δένεται με
 * μετονομασία σχήματος. Καταγράφεται ως χρέος στο ADR-332 D18.
 *
 * @module utils/contacts/contact-addresses-reader
 * @see ADR-332 D18 — μία λίστα διευθύνσεων για κάθε είδος επαφής
 * @see ADR-319 — ταξινομία διευθύνσεων επαφών
 */

import type { AddressInfo, Contact, ContactType } from '@/types/contacts';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import { isNonEmptyArray } from '@/lib/type-guards';
import {
  getDefaultSecondaryAddressType,
  getPrimaryAddressType,
} from '@/types/contacts/address-types';
import { buildCompanyAddressFromAddressInfo } from './address-info-builder';

/** Επαφή με πρόσβαση στα `customFields` (δεν υπάρχουν στον βασικό τύπο). */
interface ContactWithCustomFields {
  readonly customFields?: Record<string, unknown>;
  readonly addresses?: AddressInfo[];
}

/**
 * Η αποθηκευμένη λίστα διευθύνσεων της επαφής, σε μορφή φόρμας.
 *
 * Τρεις πηγές, με φθίνουσα αξιοπιστία:
 *   1. `customFields.companyAddresses[]` — η **αυθεντική** εγγραφή
 *   2. top-level `companyAddresses[]`    — παλαιά έγγραφα (πριν μπει στα customFields)
 *   3. `addresses[]`                     — το **παράγωγο**, ως έσχατη λύση
 *
 * Η τρίτη πηγή είναι lossy by design (γι' αυτό είναι τρίτη): το `addresses[]`
 * παράγεται από την αυθεντική λίστα, οπότε το να διαβάζεται πίσω αφορά μόνο
 * έγγραφα που δεν πρόλαβαν ποτέ να αποκτήσουν αυθεντική λίστα.
 *
 * @param contactType Καθορίζει τα **σημασιολογικά** slug της τρίτης πηγής. Η
 *   παλιά υλοποίηση έγραφε σταθερά `headquarters`/`branch`, τιμές που το
 *   ADR-319 **δεν επιτρέπει** σε φυσικό πρόσωπο ή υπηρεσία — θα γέμιζε τη
 *   φόρμα με είδη εκτός του επιτρεπτού συνόλου του `AddressTypeSelector`.
 */
export function resolveContactAddresses(
  contact: Contact,
  contactType: ContactType | undefined,
): CompanyAddress[] {
  const record = contact as unknown as ContactWithCustomFields;

  // 1. Αυθεντική εγγραφή
  const stored = record.customFields?.companyAddresses;
  if (isNonEmptyArray(stored)) {
    return stored as CompanyAddress[];
  }

  // 2. Παλαιά top-level θέση
  const rootAddresses = (contact as unknown as Record<string, unknown>).companyAddresses;
  if (isNonEmptyArray(rootAddresses)) {
    return rootAddresses as CompanyAddress[];
  }

  // 3. Ανακατασκευή από το παράγωγο
  const derived = record.addresses;
  if (isNonEmptyArray(derived)) {
    const primaryType = getPrimaryAddressType(contactType);
    const secondaryType = getDefaultSecondaryAddressType(contactType);
    return derived.map((addr, index) =>
      buildCompanyAddressFromAddressInfo(addr, index === 0 ? primaryType : secondaryType),
    );
  }

  return [];
}
