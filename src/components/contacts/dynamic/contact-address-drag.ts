/**
 * @fileoverview Εφαρμογή ενός **επιβεβαιωμένου** συρσίματος στη λίστα διευθύνσεων επαφής.
 * @module components/contacts/dynamic/contact-address-drag
 * @enterprise ADR-332 D27 Βήμα Β-ΙΙ · ADR-319 (θέση 0 = έδρα) · ADR-277 (ιεραρχία μετά από σύρσιμο)
 *
 * Καθαρές συναρτήσεις — ο **ιδιοκτήτης** τους είναι το `use-hq-address-mutations`.
 *
 * 🔴 **Τι διορθώνει (μετρημένο στον κώδικα, 2026-09-11):** το παλιό `applyDragToBranch`
 * (α) μηδένιζε τη διοικητική ιεραρχία **της έδρας** και της έγραφε τη συνοικία του
 * **υποκαταστήματος** σε **κάθε** σύρσιμο υποκαταστήματος, ενώ (β) **δεν** μηδένιζε την ιεραρχία
 * του ίδιου του υποκαταστήματος — μπαγιάτικος δήμος δίπλα σε νέα οδό. Εδώ κάθε εγγραφή
 * καθαρίζει **τη δική της** ιεραρχία, και τα επίπεδα πεδία της έδρας αλλάζουν **μόνο** όταν
 * σύρθηκε η έδρα.
 */

import type { GeoPoint } from '@/types/geo/coordinates';
import type { CompanyAddress, ContactFormData } from '@/types/ContactFormTypes';
import { humanPlacedPatch } from '@/components/shared/addresses/pin-drop';
import { applyContactAddressPosition } from '@/utils/contacts/contact-address-position-view';
import type { DragResolvedAddress } from '@/components/contacts/details/contact-pin-drop';
import { COMPANY_ADDRESS_HIERARCHY_CLEARED, hqEntryFromFlatFields } from './addresses-section-form-mapping';

/**
 * Σημείο που επιβεβαίωσε άνθρωπος → η εγγραφή το **δηλώνει** (`source: 'dragged'`) και χάνει τα
 * μπαγιάτικα μεταδεδομένα της μηχανής. Την αποθηκευμένη προέλευση την αποφασίζει ο διακομιστής.
 */
export function withHumanPoint(address: CompanyAddress, point: GeoPoint): CompanyAddress {
  return applyContactAddressPosition(address, humanPlacedPatch(point));
}

/**
 * «Ναι, ενημέρωσε» — το κείμενο της μηχανής **και** το σημείο, σε **μία** εγγραφή. Η ιεραρχία
 * της εγγραφής καθαρίζεται: η μηχανή δίνει ονόματα, όχι ταυτότητες ΕΛΣΤΑΤ (ADR-277).
 */
export function applyDraggedToContactAddress(
  address: CompanyAddress,
  dragged: DragResolvedAddress,
  point: GeoPoint | null,
): CompanyAddress {
  const pinned = point ? withHumanPoint(address, point) : address;
  return {
    ...pinned,
    ...COMPANY_ADDRESS_HIERARCHY_CLEARED,
    street: dragged.street,
    number: dragged.number,
    postalCode: dragged.postalCode,
    city: dragged.city,
    neighborhood: dragged.neighborhood,
    region: dragged.region,
    country: dragged.country || address.country,
  };
}

/**
 * Η λίστα που γράφει η φόρμα. Επαφή με **μόνο** επίπεδα πεδία υλοποιεί εδώ τη θέση 0 — η θέση
 * χρειάζεται εγγραφή να ζήσει, και τα επίπεδα πεδία δεν έχουν χώρο γι' αυτήν.
 */
export function contactAddressList(formData: ContactFormData): CompanyAddress[] {
  const list = formData.companyAddresses ?? [];
  return list.length > 0 ? [...list] : [hqEntryFromFlatFields(formData)];
}

/** Αντικαθιστά την εγγραφή `index` και ξανασυγχρονίζει τα επίπεδα πεδία από τη θέση 0 (ADR-319). */
export function withContactAddressAt(
  formData: ContactFormData,
  index: number,
  next: CompanyAddress,
): ContactFormData {
  const list = contactAddressList(formData);
  if (index < 0 || index >= list.length) return formData;
  list[index] = next;
  const hq = list[0];
  return {
    ...formData,
    companyAddresses: list,
    street: hq.street,
    streetNumber: hq.number,
    postalCode: hq.postalCode,
    city: hq.city,
  };
}
