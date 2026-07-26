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

/**
 * Η **αντίστροφη** διαδρομή: `AddressInfo` ➜ λεξιλόγιο `CompanyAddress`.
 *
 * Χρειάζεται όταν διαβάζουμε παλαιά έγγραφα που έχουν μόνο το παράγωγο
 * `addresses[]` και πρέπει να ξαναστηθεί η λίστα της φόρμας. Ζει **εδώ**, πάνω
 * στον ίδιο `HIERARCHY_PROJECTION`, ώστε η αντιστοίχιση να μη γραφτεί ποτέ
 * δεύτερη φορά με το χέρι — ένα νέο διοικητικό επίπεδο προστίθεται σε μία
 * γραμμή και ισχύει **και στις δύο** κατευθύνσεις (N.18: μια χειρόγραφη
 * αντίστροφη θα ήταν sibling clone αόρατο στο `ssot:discover`).
 *
 * Κανονικός στόχος = το **πρώτο** όνομα της αλυσίδας (π.χ. `region` ➜
 * `regionName`), γιατί εκεί γράφει η ιεραρχία· τα υπόλοιπα είναι αναγνωστικά
 * εναλλακτικά παλαιών εγγραφών.
 */
function projectHierarchyFrom(
  addr: Readonly<AddressInfo>,
  vocabulary: HierarchyVocabulary,
): Record<string, string> {
  const projected: Record<string, string> = {};
  const source = addr as Readonly<Record<string, unknown>>;
  for (const rule of HIERARCHY_PROJECTION) {
    const value = source[rule.target];
    if (typeof value === 'string' && value !== '') projected[rule[vocabulary][0]] = value;
  }
  return projected;
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
    ...(projectHierarchyFrom(addr, 'company') as Partial<CompanyAddress>),
  };
}

/** Τα επίπεδα πεδία διεύθυνσης της φόρμας επαφής, όπως τα περιμένουν οι mappers. */
export interface FlatAddressFormFields {
  street: string;
  streetNumber: string;
  city: string;
  postalCode: string;
  settlement: string;
  settlementId: string | null;
  community: string;
  municipalUnit: string;
  municipality: string;
  municipalityId: string | null;
  regionalUnit: string;
  region: string;
  decentAdmin: string;
  majorGeo: string;
  neighborhood: string;
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
    ...projectHierarchyFrom(addr, 'flat'),
    // Οι ταυτότητες είναι `string | null` (ποτέ κενό string) — το `projectHierarchyFrom`
    // παραλείπει τα κενά, οπότε η ρητή προεπιλογή `null` μένει.
    settlementId: addr.settlementId ?? null,
    municipalityId: addr.municipalityId ?? null,
  };
}
