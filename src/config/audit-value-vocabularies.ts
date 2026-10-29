/**
 * 📚 Τα λεξιλόγια τιμών του Ιστορικού — ADR-195 (ζ) · N.11
 *
 * 🔑 ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΑΠΑΝΤΑ: *«αυτή η αποθηκευμένη τιμή, **από ποιο λεξιλόγιο** παίρνει τη λέξη της;»*
 *
 * Πρακτική SAP change documents: η γραμμή αλλαγής κρατά την **ωμή** τιμή και το κείμενο λύνεται τη στιγμή της προβολής
 * από το **domain του πεδίου** (DD07T). Η γραμμή ιστορικού **δεν έχει δικές της λέξεις**. Εδώ ζούσε το αντίθετο:
 * πίνακες με ελληνικά μέσα στο `activity-tab-helpers.ts` (`PHONE_TYPE_DISPLAY`, `KAD_TYPE_DISPLAY`, `NESTED_KEY_LABELS`…)
 * — δεύτερη, μονόγλωσση αλήθεια δίπλα στα locale της φόρμας. Ο Άγγλος έβλεπε «Κινητό».
 *
 * ⚠️ Κανένας πίνακας λέξεων εδώ: μόνο **δείκτες** (`ns` + διαδρομή) προς τα locale που ήδη διαβάζει η φόρμα. Οι τύποι
 * επικοινωνίας **παράγουν** τις διαδρομές τους από τους πίνακες ετικετών ανά κάτοχο (`communication-labels.ts`) — μία
 * αλήθεια, δύο αναγνώστες.
 *
 * Ποιος τα δηλώνει σε ποιο πεδίο: ο περιγραφέας (`TrackedFieldDef.itemCatalogs` / `nestedKeyCatalog`,
 * `audit-tracked-fields.ts`). Ποιος φορτώνει τα namespaces τους: `auditVocabularyNamespaces` — **από τις δηλώσεις**.
 *
 * @module config/audit-value-vocabularies
 * @enterprise ADR-195 — Entity Audit Trail · ADR-852 — ο περιγραφέας πεδίου
 */

import type { AuditCatalogRef } from '@/config/audit-value-catalogs';
import {
  COMMUNICATION_LABELS_NS,
  COMPANY_EMAIL_TYPE_LABELS,
  COMPANY_PHONE_TYPE_LABELS,
  COMPANY_SOCIAL_MEDIA_TYPE_LABELS,
  COMPANY_WEBSITE_TYPE_LABELS,
  EMAIL_TYPE_LABELS,
  PHONE_TYPE_LABELS,
  SERVICE_EMAIL_TYPE_LABELS,
  SERVICE_PHONE_TYPE_LABELS,
  SERVICE_SOCIAL_MEDIA_TYPE_LABELS,
  SERVICE_WEBSITE_TYPE_LABELS,
  SOCIAL_MEDIA_TYPE_LABELS,
  SOCIAL_PLATFORM_LABELS,
  WEBSITE_TYPE_LABELS,
} from '@/constants/domains/communication-labels';

/** Μία λέξη που δεν είναι τιμή λεξιλογίου (Ναι/Όχι, μονάδα, «εσωτ.») — `ns` + πλήρες κλειδί. */
export interface AuditWordRef {
  readonly ns: string;
  readonly key: string;
}

/** Η διαδρομή-γονέας ενός κλειδιού ετικέτας: `communication.phoneTypes.mobile` → `communication.phoneTypes`. */
function parentPath(labelKey: string): string {
  return labelKey.slice(0, labelKey.lastIndexOf('.'));
}

/**
 * Κατάλογος από πίνακες ετικετών **ανά κάτοχο**: ο πρώτος πίνακας δίνει το `path`, οι υπόλοιποι τα `fallbackPaths`.
 * Η γραμμή ιστορικού δεν ξέρει τον κάτοχο· η σειρά είναι ασφαλής επειδή η ίδια τιμή έχει την **ίδια** λέξη σε κάθε
 * κάτοχο (άγκυρα Λ2).
 */
function catalogOfLabelTables(
  ns: string,
  tables: readonly [Readonly<Record<string, string>>, ...Readonly<Record<string, string>>[]],
): AuditCatalogRef {
  const [path, ...fallbackPaths] = tables.map((table) => parentPath(Object.values(table)[0]));
  return { ns, path, ...(fallbackPaths.length > 0 ? { fallbackPaths } : {}) };
}

/** Τύπος τηλεφώνου — ιδιώτης → εταιρεία → υπηρεσία. */
export const AUDIT_PHONE_TYPE_CATALOG = catalogOfLabelTables(COMMUNICATION_LABELS_NS, [
  PHONE_TYPE_LABELS, COMPANY_PHONE_TYPE_LABELS, SERVICE_PHONE_TYPE_LABELS,
]);

/** Τύπος email. */
export const AUDIT_EMAIL_TYPE_CATALOG = catalogOfLabelTables(COMMUNICATION_LABELS_NS, [
  EMAIL_TYPE_LABELS, COMPANY_EMAIL_TYPE_LABELS, SERVICE_EMAIL_TYPE_LABELS,
]);

/** Τύπος ιστοσελίδας. */
export const AUDIT_WEBSITE_TYPE_CATALOG = catalogOfLabelTables(COMMUNICATION_LABELS_NS, [
  WEBSITE_TYPE_LABELS, COMPANY_WEBSITE_TYPE_LABELS, SERVICE_WEBSITE_TYPE_LABELS,
]);

/** Τύπος λογαριασμού social. */
export const AUDIT_SOCIAL_MEDIA_TYPE_CATALOG = catalogOfLabelTables(COMMUNICATION_LABELS_NS, [
  SOCIAL_MEDIA_TYPE_LABELS, COMPANY_SOCIAL_MEDIA_TYPE_LABELS, SERVICE_SOCIAL_MEDIA_TYPE_LABELS,
]);

/** Πλατφόρμα social (`linkedin` → «LinkedIn»). */
export const AUDIT_SOCIAL_PLATFORM_CATALOG = catalogOfLabelTables(COMMUNICATION_LABELS_NS, [SOCIAL_PLATFORM_LABELS]);

/** Τύπος δραστηριότητας ΚΑΔ — ρίζα `KAD_ACTIVITY_TYPES` (`types/ContactFormTypes.ts`). */
export const AUDIT_KAD_TYPE_CATALOG: AuditCatalogRef = { ns: 'forms', path: 'kad.types' };

/** Τύπος διεύθυνσης — έργου **και** επαφής (`ProjectAddressType` · `ContactAddressType`), ένας πίνακας λέξεων. */
export const AUDIT_ADDRESS_TYPE_CATALOG: AuditCatalogRef = { ns: 'addresses', path: 'types' };

/** Τα μέρη της επιφάνειας ακινήτου (`areas.gross` → «Μικτό»). */
export const AUDIT_AREA_PARTS_CATALOG: AuditCatalogRef = { ns: 'properties-detail', path: 'fields.areas' };

/**
 * Τα χαρακτηριστικά ακινήτου ως **ονόματα** (διάταξη · φινιρίσματα · συστήματα): τα κλειδιά των αποθηκευμένων
 * αντικειμένων (`bedrooms`, `windowFrames`, `heatingType`…) είναι **ακριβώς** τα κλειδιά αυτού του πίνακα.
 */
export const AUDIT_PROPERTY_ATTRIBUTE_CATALOG: AuditCatalogRef = { ns: 'listing-detail', path: 'attributes.label' };

/**
 * Τα πεδία των οποίων η τιμή είναι **εμβαδόν** — ο κανόνας «προσθέτω τ.μ.» του μορφοποιητή διαβάζεται από εδώ, και
 * από εδώ μαθαίνει και η φόρτωση ότι χρειάζεται το namespace της μονάδας. Ένας κανόνας, δύο αναγνώστες.
 */
export const AUDIT_AREA_FIELDS: ReadonlySet<string> = new Set(['area', 'areas']);

/** Οι λέξεις του μορφοποιητή που δεν είναι τιμές λεξιλογίου. */
export const AUDIT_VALUE_WORDS = {
  yes: { ns: 'common', key: 'boolean.yes' },
  no: { ns: 'common', key: 'boolean.no' },
  photo: { ns: 'common-photos', key: 'photo.photo' },
  /** Μονάδα εμβαδού — μόνο για τα `AUDIT_AREA_FIELDS`. */
  sqm: { ns: 'properties-enums', key: 'units.sqm' },
  /** «εσωτ.» — ζει στο namespace του τύπου τηλεφώνου, άρα φορτώνεται μαζί του (άγκυρα Λ3). */
  extension: { ns: COMMUNICATION_LABELS_NS, key: 'communication.display.extensionShort' },
} as const satisfies Readonly<Record<string, AuditWordRef>>;

export type AuditValueWord = keyof typeof AUDIT_VALUE_WORDS;
