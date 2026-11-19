/**
 * @module components/contacts/dynamic/contact-hq-state
 * @enterprise ADR-332 §D30 Φάση 2 · ADR-319 (θέση 0 = έδρα)
 *
 * **Η έδρα μιας επαφής ΕΙΝΑΙ η θέση 0 της `companyAddresses` — και μόνο αυτή.**
 *
 * 🔴 Ως τη Φάση 2 η έδρα ζούσε σε **δύο** δοχεία της φόρμας: επίπεδα πεδία (`street`,
 * `neighborhood`, 8 επίπεδα ιεραρχίας, `hqAddressCountry`, `primaryAddressType`, …) **και** τη
 * θέση 0. Επτά γραφείς συγχρόνιζαν με το χέρι επτά διαφορετικά υποσύνολα πεδίων — ό,τι ξεχνούσε
 * ο καθένας φαινόταν στην οθόνη και χανόταν στην αποθήκευση (μετρημένο στην `cont_c4d79d09…`).
 *
 * Τώρα (πρακτική Revit Properties panel / Salesforce compound address / Google People API):
 * - **ανάγνωση**: `selectContactHq` — μία εγγραφή, ποτέ αντίγραφο·
 * - **εγγραφή**: `commitHq` — ο **ένας** γραφέας. Κάθε πράξη (editor · ιεραρχία · τύπος ·
 *   σύρσιμο · πινέζα · καθαρισμός) είναι μετασχηματισμός `CompanyAddress → CompanyAddress`.
 *
 * Τα επίπεδα πεδία **δεν υπάρχουν πια** στο `ContactFormData` — άρα δεύτερο δοχείο δεν μπορεί
 * να ξαναγεννηθεί χωρίς να το αρνηθεί ο μεταγλωττιστής.
 */

import type { CompanyAddress, ContactFormData } from '@/types/ContactFormTypes';
import { getPrimaryAddressType } from '@/types/contacts/address-types';
import { DEFAULT_STORED_COUNTRY_CODE } from '@/utils/address/country-codes';

/**
 * Η κενή έδρα για το είδος επαφής: ο σωστός τύπος ADR-319 (εταιρεία → έδρα, φυσικό πρόσωπο →
 * κατοικία, υπηρεσία → κεντρική υπηρεσία) και η δηλωμένη προεπιλογή χώρας. Χωρίς `id` και θέση:
 * κενή εγγραφή κλαδεύεται στην αποθήκευση (D20) και παίρνει ταυτότητα μόνο αν αποκτήσει περιεχόμενο.
 */
export function emptyContactHq(contactType: ContactFormData['type']): CompanyAddress {
  return {
    type: getPrimaryAddressType(contactType),
    street: '',
    number: '',
    postalCode: '',
    city: '',
    country: DEFAULT_STORED_COUNTRY_CODE,
  };
}

/**
 * Η λίστα που βλέπει και γράφει η φόρμα: επαφή χωρίς καμία διεύθυνση δείχνει την κενή έδρα στη
 * θέση 0 (ADR-332 D20) — η οθόνη έχει πάντα κάρτα έδρας, η βάση δεν παίρνει ποτέ κενή εγγραφή.
 */
export function contactAddressList(formData: ContactFormData): CompanyAddress[] {
  const list = formData.companyAddresses ?? [];
  return list.length > 0 ? [...list] : [emptyContactHq(formData.type)];
}

/** Η έδρα της φόρμας — η θέση 0. */
export function selectContactHq(formData: ContactFormData): CompanyAddress {
  return contactAddressList(formData)[0];
}

/**
 * **Ο ΕΝΑΣ γραφέας της έδρας.** Εφαρμόζει τον μετασχηματισμό στη θέση 0 (την υλοποιεί αν λείπει)·
 * τα υπόλοιπα μέλη της λίστας μένουν **αυτούσια**. Καθαρή συνάρτηση — τη χρησιμοποιούν και οι
 * functional ενημερώσεις (`setFormData(prev => commitHq(prev, …))`).
 */
export function commitHq(
  prev: ContactFormData,
  transform: (hq: CompanyAddress) => CompanyAddress,
): ContactFormData {
  const [hq, ...others] = contactAddressList(prev);
  return { ...prev, companyAddresses: [transform(hq), ...others] };
}

/**
 * Αντικαθιστά την εγγραφή `index` της λίστας (σύρσιμο / πινέζα υποκαταστήματος **ή** έδρας).
 * Για τη θέση 0 είναι ακριβώς `commitHq` — δεν υπάρχει δεύτερο δοχείο να συγχρονιστεί.
 */
export function withContactAddressAt(
  formData: ContactFormData,
  index: number,
  next: CompanyAddress,
): ContactFormData {
  const list = contactAddressList(formData);
  if (index < 0 || index >= list.length) return formData;
  list[index] = next;
  return { ...formData, companyAddresses: list };
}
