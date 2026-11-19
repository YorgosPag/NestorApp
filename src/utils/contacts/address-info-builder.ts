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
import type { CompanyAddress } from '@/types/ContactFormTypes';
import {
  isValidContactAddressType,
  toAddressInfoType,
  type ContactAddressType,
} from '@/types/contacts/address-types';
import { type AddressFieldBag, projectAddressVocabulary } from '@/utils/address/administrative-hierarchy';
import { DEFAULT_STORED_COUNTRY_CODE, toStoredCountryCode } from '@/utils/address/country-codes';
import { pickStoredAddressPosition } from '@/utils/address/stored-address-position';

// =============================================================================
// ΣΤΑΘΕΡΕΣ
// =============================================================================

/**
 * ✅ **ΤΑ ΤΡΙΑ ΛΕΞΙΛΟΓΙΑ ΕΓΙΝΑΝ ΕΝΑ** (ADR-332 D27 Φάση Α).
 *
 * Εδώ έγραφε σταθερά `'GR'` με σχόλιο ότι *«το έργο έχει τρία λεξιλόγια χώρας — επαφές `'GR'`,
 * έργα `'Greece'`, `DEFAULT_COUNTRY_CODE = 'gr'` — και η ενοποίηση είναι ξεχωριστή απόφαση»*.
 * Η απόφαση πάρθηκε: **αποθηκεύεται ο κωδικός ISO 3166-1 alpha-2, εμφανίζεται παραγόμενο όνομα**
 * (`schema.org/addressCountry`· η πρακτική που το έργο **ήδη** τηρούσε για το `birthCountry`).
 * Η τιμή **δεν άλλαξε** για τις επαφές — άλλαξε ο **ιδιοκτήτης** της.
 */
const CONTACT_ADDRESS_DEFAULT_COUNTRY = DEFAULT_STORED_COUNTRY_CODE;

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
  vocabulary: 'companyAddress',
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
  vocabulary: 'companyAddress',
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

// =============================================================================
// ΚΑΤΑΣΚΕΥΑΣΤΕΣ
// =============================================================================

// ⚠️ ADR-332 §D30 Φάση 2: εδώ ζούσε το `buildAddressInfoFromFlatFields` — δεύτερη πηγή του
// `addresses[]`, από τα επίπεδα πεδία της φόρμας. Η φόρμα δεν έχει πια επίπεδα πεδία· το
// `addresses[]` παράγεται ΜΟΝΟ από τη λίστα, με τον κατασκευαστή που ακολουθεί.

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
    // ADR-332 D27 Β-ΙΙ: ταυτότητα + θέση περνούν στο παράγωγο — αλλιώς η ανακατασκευή από
    // το `addresses[]` (τρίτη πηγή του reader) θα έχανε την πινέζα του ανθρώπου.
    ...(ca.id ? { id: ca.id } : {}),
    ...pickStoredAddressPosition(ca),
    street: ca.street,
    number: ca.number,
    city: ca.city,
    postalCode: ca.postalCode,
    // Η αποθηκευμένη εγγραφή μπορεί να κουβαλά **παλιά ετικέτα** («Ελλάδα»/«Greece») από πριν
    // τη Φάση Α — το παράγωγο τη γράφει **κανονικοποιημένη**, χωρίς να απαιτείται μετάπτωση.
    country: toStoredCountryCode(ca.country) ?? CONTACT_ADDRESS_DEFAULT_COUNTRY,
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
  const country = toStoredCountryCode(addr.country);

  return {
    ...(addr.id ? { id: addr.id } : {}),
    ...pickStoredAddressPosition(addr),
    type: isSemanticSlug ? label : (label ? 'other' : fallbackType),
    ...(label && !isSemanticSlug ? { customLabel: label } : {}),
    street: addr.street || '',
    number: addr.number || '',
    postalCode: addr.postalCode || '',
    city: addr.city || '',
    ...(country ? { country } : {}),
    ...(projectHierarchyFrom(addr, 'companyAddress') as Partial<CompanyAddress>),
  };
}

/** Υπάρχει έστω ένα πεδίο με περιεχόμενο; (`''` και `null` δεν μετρούν ως παρουσία.) */
function hasAnyText(bag: AddressFieldBag): boolean {
  return Object.values(bag).some((value) => typeof value === 'string' && value.trim() !== '');
}

/**
 * Η έδρα ενός **πολύ παλιού** εγγράφου, που κρατά τη διεύθυνση **μόνο** στη ρίζα (χωρίς λίστα και
 * χωρίς `addresses[]`) ➜ εγγραφή της λίστας. Η τέταρτη και τελευταία πηγή του tolerant reader.
 *
 * 🔴 **ADR-332 §D30 Φάση 2 — ολόκληρη εγγραφή, ποτέ ανά πεδίο.** Εδώ ζούσε το
 * `buildFlatFieldsFromCompanyHq`, που ανακάτευε **ανά πεδίο** τρεις πηγές (λίστα → ρίζα →
 * `addresses[0]`, «πρώτο με περιεχόμενο»): πεδίο που ο άνθρωπος **καθάρισε** στη λίστα ανασταινόταν
 * από τη ρίζα. Ο reader πλέον διαλέγει **μία** πηγή ανά έγγραφο, και αυτή είναι η τελευταία.
 *
 * Μόνο-ανάγνωσης: το λεξιλόγιο `contactFlat` (ADR-772) επιβιώνει εδώ και στο σύνορο του saver,
 * και φεύγει όταν το backfill μετρήσει 0 έγγραφα παλαιού σχήματος (contract).
 *
 * @returns `undefined` όταν η ρίζα δεν κρατά καμία διεύθυνση.
 */
export function buildCompanyAddressFromLegacyRoot(
  root: Readonly<Record<string, unknown>>,
  fallbackType: ContactAddressType,
): CompanyAddress | undefined {
  const fields = projectAddressVocabulary(root, 'contactFlat', 'companyAddress', {
    includePostal: true,
    clearedIdsAsNull: false,
  });
  if (!hasAnyText(fields)) return undefined;

  const storedType = root.primaryAddressType;
  const type = typeof storedType === 'string' && isValidContactAddressType(storedType) ? storedType : fallbackType;
  const customLabel = typeof root.primaryAddressCustomLabel === 'string' ? root.primaryAddressCustomLabel.trim() : '';
  const country = toStoredCountryCode(typeof root.hqAddressCountry === 'string' ? root.hqAddressCountry : undefined);

  return {
    street: '',
    number: '',
    postalCode: '',
    city: '',
    ...(fields as Partial<CompanyAddress>),
    type,
    ...(type === 'other' && customLabel ? { customLabel } : {}),
    ...(country ? { country } : {}),
  };
}
