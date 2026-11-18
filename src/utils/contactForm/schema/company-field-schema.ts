/**
 * =============================================================================
 * COMPANY FIELD SCHEMA — «πεδίο φόρμας ⇔ θέση στο έγγραφο» (ADR-332 §D30)
 * =============================================================================
 *
 * 🔑 **ΕΝΑΣ πίνακας, τρεις καταναλωτές.** Ο mapper εγγραφής (`mappers/company.ts`), ο mapper
 * ανάγνωσης (`fieldMappers/companyMapper.ts`) και ο κατάλογος `customFields` του saver
 * (`utils/contacts/enterprise-custom-fields.ts`) **παράγονται** από εδώ. Ήταν τρεις
 * χειρόγραφες λίστες — και η Δ.Ο.Υ. ήταν στη μία (ανάγνωση) αλλά **όχι** στην άλλη (εγγραφή):
 * η φόρμα την έδειχνε, ο φρουρός ταυτότητας τη θεωρούσε κρίσιμη, και **καμία αποθήκευση
 * εταιρείας δεν την έγραψε ποτέ** (μετρημένο στην παραγωγή, `cont_c4d79d09…`, 2026-11-18).
 *
 * 📐 Το πρότυπο είναι το «metadata-driven field mapping» των CRM (κάθε πεδίο δηλώνει **μία**
 * θέση αποθήκευσης) + φρουρός **round-trip** που εκτελεί ολόκληρο τον δρόμο
 * φόρμα → έγγραφο → φόρμα για **κάθε** γραμμή αυτού του πίνακα
 * (`__tests__/company-form-roundtrip.test.ts`). Νέο πεδίο φόρμας χωρίς γραμμή εδώ ⇒ κόκκινο.
 *
 * @module utils/contactForm/schema/company-field-schema
 * @see ADR-332 §D30 · ADR-772 (λεξιλόγιο διευθύνσεων — ο ιδιοκτήτης της έδρας)
 */

import type { ContactFormData } from '@/types/ContactFormTypes';

/** Πού ζει η τιμή στο έγγραφο Firestore. */
export type CompanyFieldStore = 'root' | 'customFields';

export interface CompanyScalarBinding {
  readonly store: CompanyFieldStore;
  /** Επιπλέον κλειδιά του εγγράφου που γράφονται με την **ίδια** τιμή (παλαιά κάτοπτρα). */
  readonly mirrors?: readonly string[];
  /** Κλειδιά που διαβάζονται, με τη σειρά, όταν το κανονικό είναι κενό (παλαιά έγγραφα). */
  readonly readFallbacks?: readonly string[];
  /**
   * Ποιος το **διαβάζει πίσω** στη φόρμα, όταν δεν είναι αυτός ο πίνακας.
   * `'address'` = η προβολή της έδρας (ADR-772): το ίδιο όνομα είναι **και** επίπεδο ιεραρχίας.
   */
  readonly readOwner?: 'address';
}

/**
 * Τα **βαθμωτά** πεδία της εταιρείας. `satisfies` ⇒ κάθε κλειδί είναι πραγματικό πεδίο της
 * φόρμας· ο φρουρός ⇒ κάθε πεδίο που **ζωγραφίζει** η φόρμα έχει γραμμή εδώ ή στο
 * {@link COMPANY_FORM_FIELDS_OWNED_ELSEWHERE}.
 */
export const COMPANY_SCALAR_FIELDS = {
  // ── Ταυτότητα (top-level) ──────────────────────────────────────────────────
  companyName: { store: 'root' },
  tradeName: { store: 'root' },
  legalForm: { store: 'root' },
  vatNumber: { store: 'root' },
  taxOffice: { store: 'root' },
  gemiNumber: { store: 'root', mirrors: ['registrationNumber'], readFallbacks: ['registrationNumber'] },
  notes: { store: 'root' },
  // ── ΓΕΜΗ / δραστηριότητα / κεφάλαιο (customFields) ─────────────────────────
  gemiStatus: { store: 'customFields' },
  gemiStatusDate: { store: 'customFields' },
  activityCodeKAD: { store: 'customFields' },
  activityDescription: { store: 'customFields' },
  activityType: { store: 'customFields' },
  chamber: { store: 'customFields' },
  capitalAmount: { store: 'customFields' },
  currency: { store: 'customFields' },
  extraordinaryCapital: { store: 'customFields' },
  registrationDate: { store: 'customFields' },
  lastUpdateDate: { store: 'customFields' },
  gemiDepartment: { store: 'customFields' },
  prefecture: { store: 'customFields' },
  // ⚠️ Για εταιρείες κρατιέται **και** ως πεδίο ΓΕΜΗ στα `customFields`, αλλά στη φόρμα είναι
  //    επίπεδο της ιεραρχίας της έδρας — την ανάγνωση την κάνει η προβολή διεύθυνσης.
  municipality: { store: 'customFields', readOwner: 'address' },
} as const satisfies Readonly<Partial<Record<keyof ContactFormData, CompanyScalarBinding>>>;

export type CompanyScalarField = keyof typeof COMPANY_SCALAR_FIELDS;

/** Ιδιοκτήτης ενός πεδίου φόρμας που **δεν** είναι βαθμωτό αυτού του πίνακα. */
export type CompanyFieldOwner =
  /** Η έδρα — επίπεδα πεδία ⇄ `customFields.companyAddresses[0]` ⇄ `addresses[0]` (ADR-332/772). */
  | { readonly kind: 'address' }
  /** Συλλογή με δικό της γραφέα στο `EnterpriseContactSaver` / mapper. */
  | { readonly kind: 'collection'; readonly docPath: string };

/**
 * Πεδία που ζωγραφίζει η φόρμα εταιρείας αλλά τα κατέχει **άλλος** γραφέας — δηλωμένα,
 * ώστε η απουσία από τον βαθμωτό πίνακα να είναι **απόφαση**, όχι παράλειψη.
 */
export const COMPANY_FORM_FIELDS_OWNED_ELSEWHERE: Readonly<Record<string, CompanyFieldOwner>> = {
  activities: { kind: 'collection', docPath: 'customFields.activities' },
  communication: { kind: 'collection', docPath: 'phones · emails · websites · socialMedia' },
  addressType: { kind: 'address' },
  street: { kind: 'address' },
  streetNumber: { kind: 'address' },
  postalCode: { kind: 'address' },
  city: { kind: 'address' },
  region: { kind: 'address' },
};

const SCALAR_ENTRIES = Object.entries(COMPANY_SCALAR_FIELDS) as ReadonlyArray<
  readonly [CompanyScalarField, CompanyScalarBinding]
>;

/** Τα κλειδιά που ζουν στα `customFields` — η πηγή του καταλόγου του saver. */
export const COMPANY_CUSTOM_FIELD_KEYS: readonly CompanyScalarField[] = SCALAR_ENTRIES
  .filter(([, binding]) => binding.store === 'customFields')
  .map(([field]) => field);

export interface CompanyScalarWrite {
  readonly root: Record<string, unknown>;
  readonly customFields: Record<string, unknown>;
}

/** Φόρμα ➜ έγγραφο, για **κάθε** γραμμή του πίνακα. */
export function writeCompanyScalarFields(formData: Readonly<ContactFormData>): CompanyScalarWrite {
  const root: Record<string, unknown> = {};
  const customFields: Record<string, unknown> = {};
  for (const [field, binding] of SCALAR_ENTRIES) {
    const value = formData[field];
    const target = binding.store === 'root' ? root : customFields;
    target[field] = value;
    for (const mirror of binding.mirrors ?? []) target[mirror] = value;
  }
  return { root, customFields };
}

/** Τα πεδία που διαβάζει **αυτός** ο πίνακας — όσα έχουν άλλον αναγνώστη εξαιρούνται από τον τύπο. */
export type CompanyScalarRead = {
  readonly [K in CompanyScalarField as (typeof COMPANY_SCALAR_FIELDS)[K] extends { readonly readOwner: 'address' }
    ? never
    : K]: string;
};

type StoredCompanyDocument =Readonly<Record<string, unknown>> & {
  readonly customFields?: Readonly<Record<string, unknown>>;
};

/** Πρώτη μη-κενή τιμή string: top-level πριν από `customFields` (παλαιά έγγραφα έγραφαν και στα δύο). */
function readStoredString(doc: StoredCompanyDocument, key: string): string {
  const rootValue = doc[key];
  if (typeof rootValue === 'string' && rootValue !== '') return rootValue;
  const customValue = doc.customFields?.[key];
  return typeof customValue === 'string' ? customValue : '';
}

/**
 * Έγγραφο ➜ φόρμα. Επιστρέφει **ωμά strings** — τη στενότερη τυποποίηση (π.χ. `activityType`)
 * την κάνει ο mapper ανάγνωσης, που ξέρει το λεξιλόγιο του πεδίου.
 */
export function readCompanyScalarFields(doc: StoredCompanyDocument): CompanyScalarRead {
  const out: Partial<Record<CompanyScalarField, string>> = {};
  for (const [field, binding] of SCALAR_ENTRIES) {
    if (binding.readOwner === 'address') continue;
    let value = readStoredString(doc, field);
    for (const fallback of binding.readFallbacks ?? []) {
      if (value) break;
      value = readStoredString(doc, fallback);
    }
    out[field] = value;
  }
  return out as CompanyScalarRead;
}
