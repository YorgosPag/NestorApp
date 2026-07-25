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
  toAddressInfoType,
  type ContactAddressType,
} from '@/types/contacts/address-types';

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
// ΠΙΝΑΚΑΣ ΠΡΟΒΟΛΗΣ ΙΕΡΑΡΧΙΑΣ — SSoT ονομάτων
// =============================================================================

/**
 * Η ίδια διοικητική ιεραρχία λέγεται αλλιώς σε κάθε σχήμα:
 *   - `AddressInfo`   → `municipality`, `region`, `settlement`, …
 *   - `CompanyAddress`→ `municipalityName`, `regionName`, `city`, …
 *   - flat form       → `municipality`, `region`, `settlement`, … (ίδια με AddressInfo)
 *
 * Η αντιστοίχιση ήταν γραμμένη με το χέρι σε τρία σημεία· κάθε νέο επίπεδο
 * έπρεπε να προστεθεί παντού και μια ξεχασμένη προσθήκη περνούσε αθόρυβα.
 * Εδώ ζει **μία γραμμή ανά επίπεδο**, με αλυσίδα εναλλακτικών ονομάτων.
 */
const HIERARCHY_PROJECTION: ReadonlyArray<{
  readonly target: keyof AddressInfo;
  readonly company: readonly string[];
  readonly flat: readonly string[];
}> = [
  // Ο οικισμός στο CompanyAddress ζει στο `city` — δεν υπάρχει ξεχωριστό πεδίο.
  { target: 'settlement', company: ['city'], flat: ['settlement'] },
  { target: 'settlementId', company: ['settlementId'], flat: ['settlementId'] },
  { target: 'community', company: ['communityName'], flat: ['community'] },
  { target: 'municipalUnit', company: ['municipalUnitName'], flat: ['municipalUnit'] },
  { target: 'municipality', company: ['municipalityName'], flat: ['municipality'] },
  { target: 'municipalityId', company: ['municipalityId'], flat: ['municipalityId'] },
  { target: 'regionalUnit', company: ['regionalUnitName'], flat: ['regionalUnit'] },
  // Το CompanyAddress κουβαλά ΚΑΙ `regionName` (από την ιεραρχία) ΚΑΙ `region`
  // (ελεύθερο ταχυδρομικό πεδίο). Ο αναγνώστης προτιμά το πρώτο· ίδια σειρά εδώ.
  { target: 'region', company: ['regionName', 'region'], flat: ['region'] },
  { target: 'decentAdmin', company: ['decentAdminName'], flat: ['decentAdmin'] },
  { target: 'majorGeo', company: ['majorGeoName'], flat: ['majorGeo'] },
  // Περιοχή / Συνοικία — εκτός διοικητικής ιεραρχίας, αλλά ίδιο μονοπάτι.
  { target: 'neighborhood', company: ['neighborhood'], flat: ['neighborhood'] },
];

type HierarchyVocabulary = 'company' | 'flat';

/** Πρώτη μη-κενή τιμή από την αλυσίδα ονομάτων. */
function pickFirst(
  source: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value !== '') return value;
  }
  return undefined;
}

/**
 * Προβάλλει την ιεραρχία της πηγής στα ονόματα του `AddressInfo`.
 *
 * Τα κενά **παραλείπονται** (δεν γράφονται κενά strings στο Firestore) — ίδια
 * σημασιολογία με τα conditional spreads που αντικαθιστά.
 */
function projectHierarchy(
  source: Readonly<Record<string, unknown>>,
  vocabulary: HierarchyVocabulary,
): Partial<AddressInfo> {
  const projected: Record<string, string> = {};
  for (const rule of HIERARCHY_PROJECTION) {
    const value = pickFirst(source, rule[vocabulary]);
    if (value !== undefined) projected[rule.target] = value;
  }
  return projected as Partial<AddressInfo>;
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
    ...projectHierarchy(formData as Readonly<Record<string, unknown>>, 'flat'),
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
    ...projectHierarchy(ca as Readonly<Record<string, unknown>>, 'company'),
  }));
}
