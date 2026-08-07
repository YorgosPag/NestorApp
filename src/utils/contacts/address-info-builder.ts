/**
 * =============================================================================
 * ADDRESS INFO BUILDER — ο ΕΝΑΣ κατασκευαστής του `addresses[]` (ADR-332 D15)
 * =============================================================================
 *
 * ΤΙ ΔΙΟΡΘΩΝΕΙ
 * Το `contact.addresses[]` είναι **παράγωγο**: αυθεντική εγγραφή είναι τα flat
 * πεδία της έδρας και το `customFields.companyAddresses[]`. Η παραγωγή του όμως
 * ήταν γραμμένη **τρεις φορές**, και οι τρεις είχαν αποκλίνει:
 *
 *   A. `EnterpriseContactSaver` (flat πεδία ➜ έδρα)  — πλήρης ιεραρχία
 *   B. `EnterpriseContactSaver.buildAddressesFromCompany` — ΚΑΜΙΑ ιεραρχία
 *   C. `mappers/company.ts buildAddresses`               — ΚΑΜΙΑ ιεραρχία, ούτε `neighborhood`
 *
 * Το σχόλιο πάνω από το B έλεγε κυριολεκτικά «Same logic as mappers/company.ts
 * buildAddresses» — **σχόλιο αντί για κοινή συνάρτηση**, και το C είχε ήδη
 * ξεφύγει. Χειρότερα: το B έγραφε **πάνω** από το A, οπότε ο κλάδος εταιρειών
 * πετούσε την ιεραρχία που το A μόλις είχε φτιάξει σωστά για την έδρα.
 *
 * Κανένα gate δεν το έπιανε: διαφορετικά ονόματα συναρτήσεων ⇒ αόρατο στο
 * name/regex-based `ssot:discover` (CHECK 3.18). Είναι η κατηγορία **ADR-584**
 * που βλέπει μόνο το token-based `jscpd`.
 *
 * ΤΙ ΚΟΣΤΙΖΕ
 * Όποιος διαβάζει `contact.addresses` (λίστα επαφών, κάρτες, `building-update`,
 * `hierarchy-resolver`, αναφορές, λογιστική, branding) έβλεπε διεύθυνση **χωρίς
 * διοικητική ιεραρχία**. Ο `individualMapper`/`serviceMapper` διαβάζουν την
 * ιεραρχία **από το `addresses[0]`**, οπότε εκεί η απώλεια ήταν και round-trip.
 *
 * @module utils/contacts/address-info-builder
 * @see ADR-332 D15 — ΕΝΑΣ κατασκευαστής AddressInfo
 * @see ADR-319 — ταξινομία διευθύνσεων επαφών (`label` = σημασιολογικό slug)
 */

import type { AddressInfo } from '@/types/contacts';
import type { ContactType } from '@/types/contacts';
import type { CompanyAddress, ContactFormData } from '@/types/ContactFormTypes';
import {
  getPrimaryAddressType,
  isValidContactAddressType,
  toAddressInfoType,
  type ContactAddressType,
} from '@/types/contacts/address-types';
import { projectAddressVocabulary } from '@/utils/address/administrative-hierarchy';
import type { FlatAddressFormFields } from '@/utils/address/administrative-hierarchy-vocabulary';

/**
 * ⚠️ **ADR-772**: ο τύπος μετακόμισε δίπλα στον πίνακα που τον τυπώνει (είναι ένα από τα
 * λεξιλόγιά του). Επανεξάγεται εδώ ώστε οι υπάρχοντες καταναλωτές (`individualMapper`,
 * `serviceMapper`) να μην αλλάξουν ούτε μία εισαγωγή.
 */
export type { FlatAddressFormFields };

// =============================================================================
// ΣΤΑΘΕΡΕΣ
// =============================================================================

/**
 * Προεπιλεγμένη χώρα όταν η εγγραφή δεν δηλώνει καμία.
 *
 * ⚠️ Το έργο έχει **τρία** λεξιλόγια χώρας: επαφές `'GR'`, έργα `'Greece'`,
 * `GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY_CODE = 'gr'`. Εδώ διατηρείται η τιμή που
 * ήδη υπάρχει στα δεδομένα των επαφών· η ενοποίηση των τριών είναι ξεχωριστή
 * απόφαση με δική της μετάπτωση και ΔΕΝ γίνεται σιωπηλά από εδώ.
 */
const CONTACT_ADDRESS_DEFAULT_COUNTRY = 'GR';

// =============================================================================
// ΠΡΟΒΟΛΗ ΙΕΡΑΡΧΙΑΣ — καταναλωτής του SSoT
// =============================================================================

/**
 * 🔴 **ADR-772: ο πίνακας μετακόμισε.**
 *
 * Ο `HIERARCHY_PROJECTION` ζούσε εδώ και κάλυπτε **μόνο** τα τρία λεξιλόγια των επαφών.
 * Η ίδια αντιστοίχιση χρειαζόταν και στα **έργα** και στη **φόρμα ιεραρχίας**, όπου ήταν
 * γραμμένη με το χέρι άλλες τέσσερις φορές με άλλο πλήθος επιπέδων. Ζει πλέον στο
 * ουδέτερο `utils/address/administrative-hierarchy-vocabulary` — η διοικητική ιεραρχία
 * δεν είναι έννοια επαφών.
 *
 * ⚠️ `includePostal: false` **σκόπιμα**: τα ταχυδρομικά πεδία εδώ έχουν δικούς τους
 * κανόνες (προεπιλεγμένη χώρα `'GR'`, `city` πάντα παρόν, `number` ↔ `streetNumber`) που
 * γράφονται ρητά παρακάτω. Χωρίς αυτό, η προαγωγή του πίνακα θα άλλαζε συμπεριφορά στις
 * επαφές — και η δουλειά ήταν να **μην** αλλάξει καμία.
 */
function projectHierarchy(
  source: Readonly<Record<string, unknown>>,
  vocabulary: 'companyAddress' | 'contactFlat',
): Partial<AddressInfo> {
  return projectAddressVocabulary(source, vocabulary, 'addressInfo', {
    includePostal: false,
    // Κατασκευή από την αρχή: δεν υπάρχει παλιά ταυτότητα να σβηστεί, και το `null` θα
    // ήταν σκουπίδι στο Firestore. Δοκιμασμένο συμβόλαιο — βλ. `address-info-builder.test`.
    clearedIdsAsNull: false,
  }) as Partial<AddressInfo>;
}

/** Η **αντίστροφη** διαδρομή: `AddressInfo` ➜ λεξιλόγιο επαφών, ίδιος πίνακας. */
function projectHierarchyFrom(
  addr: Readonly<AddressInfo>,
  vocabulary: 'companyAddress' | 'contactFlat',
): Record<string, string | null> {
  return projectAddressVocabulary(
    addr as Readonly<Record<string, unknown>>,
    'addressInfo',
    vocabulary,
    { includePostal: false, clearedIdsAsNull: false },
  );
}

// =============================================================================
// ΚΟΙΝΑ PRIMITIVES
// =============================================================================

/**
 * ADR-319: το `label` αποθηκεύει **σημασιολογικό slug** (`home`, `headquarters`,
 * …), ποτέ i18n key. Ένα raw key στη βάση σημαίνει ότι μια μετονομασία κλειδιού
 * στα locales σπάει **αποθηκευμένα** δεδομένα — παραβίαση N.11 σε επίπεδο
 * persistence, όχι απλού UI string. Η μετάφραση γίνεται στο render.
 */
function resolveAddressLabel(type: ContactAddressType, customLabel?: string): string {
  return type === 'other' && customLabel?.trim() ? customLabel.trim() : type;
}

/** Ταχυδρομικό είδος για την κύρια (flat) διεύθυνση, ανά είδος επαφής. */
function contactTypeToAddressInfoType(contactType: ContactType | undefined): AddressInfo['type'] {
  switch (contactType) {
    case 'individual':
      return 'home';
    case 'company':
    case 'service':
      return 'work';
    default:
      return 'other';
  }
}

// =============================================================================
// ΚΑΤΑΣΚΕΥΑΣΤΕΣ
// =============================================================================

/**
 * Κύρια διεύθυνση από τα **flat πεδία** της φόρμας (έδρα / κατοικία).
 *
 * Ο καλών ελέγχει πρώτα αν υπάρχει καθόλου δεδομένο διεύθυνσης — η συνάρτηση
 * δεν αποφασίζει «αν», μόνο «πώς».
 */
export function buildAddressInfoFromFlatFields(formData: Partial<ContactFormData>): AddressInfo {
  const addressType = formData.primaryAddressType ?? getPrimaryAddressType(formData.type);

  return {
    street: formData.street || '',
    number: formData.streetNumber || '', // flat: `streetNumber` — array: `number`
    city: formData.city || '',
    postalCode: formData.postalCode || '',
    country: CONTACT_ADDRESS_DEFAULT_COUNTRY,
    type: contactTypeToAddressInfoType(formData.type),
    isPrimary: true,
    label: resolveAddressLabel(addressType, formData.primaryAddressCustomLabel),
    ...projectHierarchy(formData as Readonly<Record<string, unknown>>, 'contactFlat'),
  };
}

/**
 * Το παράγωγο `addresses[]` από την αυθεντική εγγραφή `companyAddresses[]`.
 *
 * Σε σχέση με τις δύο υλοποιήσεις που αντικαθιστά, εδώ **δεν χάνεται τίποτα**:
 * περνά ολόκληρη η διοικητική ιεραρχία, το `neighborhood`, η πραγματική χώρα
 * (αντί για σταθερό `'GR'`) και το ταχυδρομικό είδος παράγεται από το λεξιλόγιο
 * ADR-319 (αντί για σταθερό `'work'`).
 */
export function buildAddressInfoListFromCompanyAddresses(
  companyAddresses: readonly CompanyAddress[],
): AddressInfo[] {
  return companyAddresses.map((ca, index) => ({
    street: ca.street,
    number: ca.number,
    city: ca.city,
    postalCode: ca.postalCode,
    country: ca.country?.trim() || CONTACT_ADDRESS_DEFAULT_COUNTRY,
    type: toAddressInfoType(ca.type),
    // Θέση 0 = η έδρα (θετική αναλλοίωτη ADR-319), αλλά ρητός τύπος έδρας/κατοικίας
    // σε άλλη θέση μετράει επίσης — μια εσφαλμένα ταξινομημένη λίστα δεν πρέπει
    // να αφήσει την επαφή χωρίς κύρια διεύθυνση.
    isPrimary: index === 0 || ca.type === 'headquarters' || ca.type === 'home',
    label: resolveAddressLabel(ca.type, ca.customLabel),
    ...projectHierarchy(ca as Readonly<Record<string, unknown>>, 'companyAddress'),
  }));
}

/**
 * Ο **αντίστροφος** δρόμος: μια εγγραφή του παράγωγου `addresses[]` ξαναγίνεται
 * εγγραφή της φόρμας.
 *
 * Χρησιμοποιείται μόνο ως **έσχατη** πηγή ανάγνωσης, για έγγραφα γραμμένα πριν
 * υπάρξει η αυθεντική λίστα. Είναι ακριβώς αντίστροφη της `resolveAddressLabel`:
 * το `label` κουβαλά το σημασιολογικό slug ADR-319, οπότε ένα έγκυρο slug
 * επιστρέφει ως `type`, ενώ ελεύθερο κείμενο επιστρέφει ως `other` +
 * `customLabel` — χωρίς αυτό, ένα «Εξοχικό Πηλίου» θα ξαναγύριζε ως σκέτο
 * `other` και ο χρήστης θα έβλεπε την ετικέτα του να εξαφανίζεται στο reload.
 *
 * @param fallbackType Το slug όταν το `label` λείπει (παλαιά έγγραφα) — ο
 *   καλών ξέρει τη θέση και το είδος επαφής, αυτή η συνάρτηση όχι.
 */
export function buildCompanyAddressFromAddressInfo(
  addr: Readonly<AddressInfo>,
  fallbackType: ContactAddressType,
): CompanyAddress {
  const label = addr.label?.trim();
  const isSemanticSlug = !!label && isValidContactAddressType(label);

  return {
    type: isSemanticSlug ? label : (label ? 'other' : fallbackType),
    ...(label && !isSemanticSlug ? { customLabel: label } : {}),
    street: addr.street || '',
    number: addr.number || '',
    postalCode: addr.postalCode || '',
    city: addr.city || '',
    ...(addr.country?.trim() ? { country: addr.country } : {}),
    ...(projectHierarchyFrom(addr, 'companyAddress') as Partial<CompanyAddress>),
  };
}

/**
 * Η κύρια διεύθυνση του αποθηκευμένου εγγράφου ➜ επίπεδα πεδία φόρμας.
 *
 * Ήταν γραμμένη αυτούσια σε `individualMapper` και `serviceMapper` (18 γραμμές
 * η κάθε μία), με τον δεύτερο να έχει ήδη **ξεχάσει** το `neighborhood` — η
 * «Περιοχή / Συνοικία» μιας υπηρεσίας αποθηκευόταν κανονικά αλλά δεν
 * ξαναδιαβαζόταν ποτέ. Ακριβώς το μοτίβο που περιγράφει το ADR-584: δύο
 * αντίγραφα, το ένα αποκλίνει, κανένα gate ονομάτων δεν το βλέπει.
 */
export function buildFlatFieldsFromAddressInfo(
  addr: Readonly<AddressInfo> | undefined,
): FlatAddressFormFields {
  const empty: FlatAddressFormFields = {
    street: '', streetNumber: '', city: '', postalCode: '',
    settlement: '', settlementId: null, community: '', municipalUnit: '',
    municipality: '', municipalityId: null, regionalUnit: '', region: '',
    decentAdmin: '', majorGeo: '', neighborhood: '',
  };
  if (!addr) return empty;

  return {
    ...empty,
    street: addr.street || '',
    streetNumber: addr.number || '', // array: `number` — flat: `streetNumber`
    city: addr.city || '',
    postalCode: addr.postalCode || '',
    ...projectHierarchyFrom(addr, 'contactFlat'),
    // Οι ταυτότητες είναι `string | null` (ποτέ κενό string) — το `projectHierarchyFrom`
    // παραλείπει τα κενά, οπότε η ρητή προεπιλογή `null` μένει.
    settlementId: addr.settlementId ?? null,
    municipalityId: addr.municipalityId ?? null,
  };
}
