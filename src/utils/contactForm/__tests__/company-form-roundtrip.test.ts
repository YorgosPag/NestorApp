/**
 * Φρουρός round-trip της φόρμας επαφής — «ό,τι βλέπεις είναι ό,τι αποθηκεύεται» (ADR-332 §D30).
 *
 * Εκτελεί ΟΛΟΚΛΗΡΟ τον δρόμο που περνά κάθε αποθήκευση:
 *   φόρμα → `mapFormDataToContact` → `sanitizeContactData` → (JSON = Firestore χωρίς `undefined`)
 *         → `map*ContactToFormData` → φόρμα
 * και απαιτεί ΙΣΟΤΗΤΑ για κάθε πεδίο. Κανένα mock: ό,τι τρέχει στην παραγωγή τρέχει εδώ.
 *
 * Γιατί υπάρχει (μετρημένο στην παραγωγή, `cont_c4d79d09…`, 2026-11-18): η Δ.Ο.Υ. και η
 * «Περιοχή / Συνοικία» της έδρας φαίνονταν στη φόρμα και **δεν** έφταναν στο έγγραφο.
 * Τρεις χειρόγραφες λίστες πεδίων είχαν αποκλίνει και κανένα test δεν έκανε τον κύκλο.
 *
 * Φάση 2: η έδρα ζει σε ΕΝΑ δοχείο (`companyAddresses[0]`) για ΚΑΘΕ είδος επαφής — ο κύκλος
 * τρέχει για εταιρεία, φυσικό πρόσωπο και υπηρεσία, σε create ΚΑΙ σε update.
 */

import type { Contact } from '@/types/contacts';
import { initialFormData, type CompanyAddress, type ContactFormData } from '@/types/ContactFormTypes';
import { COMPANY_GEMI_SECTIONS } from '@/config/company-gemi';
import { mapFormDataToContact } from '../modular/orchestrator';
import { mapCompanyContactToFormData } from '../fieldMappers/companyMapper';
import { mapIndividualContactToFormData } from '../fieldMappers/individualMapper';
import { mapServiceContactToFormData } from '../fieldMappers/serviceMapper';
import { sanitizeContactData, type ContactDataRecord } from '../utils/data-cleaning';
import {
  COMPANY_FORM_FIELDS_OWNED_ELSEWHERE,
  COMPANY_SCALAR_FIELDS,
  type CompanyScalarBinding,
  type CompanyScalarField,
} from '../schema/company-field-schema';
import {
  ADMIN_LEVEL_VOCABULARY,
  HIERARCHY_ADJACENT_VOCABULARY,
  NOT_STORED,
  POSTAL_FIELD_VOCABULARY,
} from '@/utils/address/administrative-hierarchy-vocabulary';
import { buildAddressInfoListFromCompanyAddresses } from '@/utils/contacts/address-info-builder';
import { EnterpriseContactSaver } from '@/utils/contacts/EnterpriseContactSaver';
import { LEGACY_ROOT_ADDRESS_FIELDS } from '@/utils/contacts/contact-hq-legacy-fields';
import { applyHqEditorChange } from '@/components/contacts/dynamic/addresses-section-form-mapping';

// ─── ο κύκλος ────────────────────────────────────────────────────────────────

type ContactKind = ContactFormData['type'];
type StoredDoc = Record<string, unknown> & { customFields?: Record<string, unknown> };

interface RoundTrip {
  readonly stored: StoredDoc;
  readonly reloaded: ContactFormData;
}

const RELOADERS: Record<ContactKind, (contact: Contact) => ContactFormData> = {
  company: mapCompanyContactToFormData,
  individual: mapIndividualContactToFormData,
  service: mapServiceContactToFormData,
};

function reload(stored: StoredDoc, type: ContactKind): ContactFormData {
  return RELOADERS[type]({ ...stored, id: 'cont_roundtrip' } as unknown as Contact);
}

/** Ο δρόμος του **create**: φόρμα → mapper → καθαριστής → Firestore (JSON) → φόρμα. */
function saveAndReload(formData: ContactFormData): RoundTrip {
  const mapping = mapFormDataToContact(formData);
  expect(mapping.warnings).toEqual([]);
  const sanitized = sanitizeContactData(mapping.contactData as unknown as ContactDataRecord);
  const stored = JSON.parse(JSON.stringify(sanitized)) as StoredDoc;
  return { stored, reloaded: reload(stored, formData.type) };
}

/**
 * Ο δρόμος του **update** (`updateContactFromForm`): ο saver μετατρέπει μόνο το dirty diff, και το
 * Firestore το συγχωνεύει — ρίζα κλειδί-κλειδί, `customFields` κλειδί-κλειδί (ADR-332 D27 Φ0).
 */
function updateAndReload(stored: StoredDoc, diff: Partial<ContactFormData>, type: ContactKind) {
  const converted = EnterpriseContactSaver.convertToEnterpriseStructure(diff);
  const written = JSON.parse(JSON.stringify(converted)) as StoredDoc;
  const merged: StoredDoc = {
    ...stored,
    ...written,
    customFields: { ...(stored.customFields ?? {}), ...(written.customFields ?? {}) },
  };
  return { written, merged, reloaded: reload(merged, type) };
}

function companyForm(overrides: Partial<ContactFormData> = {}): ContactFormData {
  return { ...initialFormData, type: 'company', companyName: 'ΑΛΦΑ ΑΕ', ...overrides };
}

/** Τιμή-μάρτυρας ανά πεδίο — μοναδική, ώστε καμία διασταύρωση να μην περάσει για σωστή. */
function sentinel(field: string): string {
  return `rt:${field}`;
}

/** Πεδία με κλειστό λεξιλόγιο: ο μάρτυρας είναι έγκυρη τιμή **διαφορετική** από την προεπιλογή. */
const VOCABULARY_SAMPLES: Partial<Record<CompanyScalarField, string>> = {
  activityType: 'secondary',
};

const SCALAR_ENTRIES = Object.entries(COMPANY_SCALAR_FIELDS) as ReadonlyArray<
  readonly [CompanyScalarField, CompanyScalarBinding]
>;

// ─── 1. Πληρότητα: κάθε πεδίο που ΖΩΓΡΑΦΙΖΕΙ η φόρμα έχει ιδιοκτήτη ─────────────

describe('company field schema — completeness against the rendered form', () => {
  const renderedFieldIds = COMPANY_GEMI_SECTIONS.flatMap((section) => section.fields.map((f) => f.id));

  it('the form renders at least the identity fields (the scan is not empty)', () => {
    expect(renderedFieldIds).toEqual(expect.arrayContaining(['companyName', 'vatNumber', 'taxOffice']));
  });

  it.each(renderedFieldIds)('rendered field "%s" is declared in the schema', (fieldId) => {
    const declared = fieldId in COMPANY_SCALAR_FIELDS || fieldId in COMPANY_FORM_FIELDS_OWNED_ELSEWHERE;
    expect(declared).toBe(true);
  });
});

// ─── 2. Κάθε βαθμωτό πεδίο κάνει τον κύκλο ──────────────────────────────────────

describe('company scalar fields — form → document → form', () => {
  const filled = companyForm(Object.fromEntries(
    SCALAR_ENTRIES.map(([field]) => [field, VOCABULARY_SAMPLES[field] ?? sentinel(field)]),
  ) as Partial<ContactFormData>);
  const { stored, reloaded } = saveAndReload(filled);

  it.each(SCALAR_ENTRIES.map(([field]) => field))('"%s" survives save + reload', (field) => {
    expect(reloaded[field]).toBe(VOCABULARY_SAMPLES[field] ?? sentinel(field));
  });

  it.each(SCALAR_ENTRIES.map(([field, binding]) => [field, binding.store] as const))(
    '"%s" is written where the schema says (%s)',
    (field, store) => {
      const container = store === 'root' ? stored : stored.customFields ?? {};
      expect(container[field]).toBe(filled[field]);
    },
  );

  it('Δ.Ο.Υ. — the production loss — reaches the document', () => {
    const { stored: doc } = saveAndReload(companyForm({ taxOffice: 'ΦΑΕ Θεσσαλονίκης' }));
    expect(doc.taxOffice).toBe('ΦΑΕ Θεσσαλονίκης');
  });
});

// ─── 3. Η έδρα κάνει τον κύκλο — κάθε πεδίο του λεξιλογίου, κάθε είδος, κάθε δρόμος ───

/** Το πρώτο (κανονικό) όνομα μιας θέσης του λεξιλογίου — εκεί γράφει ο πίνακας (ADR-772). */
function canonical(slot: readonly string[] | typeof NOT_STORED): string[] {
  return slot === NOT_STORED ? [] : [slot[0]];
}

/** Κάθε πεδίο που κρατά το δοχείο `companyAddress` — από τον ΠΙΝΑΚΑ, όχι από χειρόγραφη λίστα. */
const HQ_VOCABULARY_KEYS: readonly string[] = [
  ...Object.values(ADMIN_LEVEL_VOCABULARY).flatMap((binding) => [
    ...canonical(binding.companyAddress.name),
    ...canonical(binding.companyAddress.id),
  ]),
  ...Object.values(POSTAL_FIELD_VOCABULARY).flatMap((binding) => canonical(binding.companyAddress)),
  ...Object.values(HIERARCHY_ADJACENT_VOCABULARY).flatMap((binding) => canonical(binding.companyAddress)),
];

const KIND_BASE: Record<ContactKind, Partial<ContactFormData>> = {
  company: { type: 'company', companyName: 'ΑΛΦΑ ΑΕ' },
  individual: { type: 'individual', firstName: 'Νέστωρ', lastName: 'Παγώνης' },
  service: { type: 'service', serviceName: 'ΔΟΥ Α Θεσσαλονίκης' },
};
const KINDS = Object.keys(KIND_BASE) as ContactKind[];

function kindForm(type: ContactKind, overrides: Partial<ContactFormData> = {}): ContactFormData {
  return { ...initialFormData, ...KIND_BASE[type], ...overrides };
}

/** Έδρα με μάρτυρα σε ΚΑΘΕ πεδίο του λεξιλογίου (η χώρα: έγκυρος κωδικός ≠ προεπιλογή). */
function filledHq(): CompanyAddress {
  const fields = Object.fromEntries(HQ_VOCABULARY_KEYS.map((key) => [key, sentinel(key)]));
  return { ...fields, country: 'CY', type: 'other', customLabel: 'rt:customLabel' } as unknown as CompanyAddress;
}

const BRANCH: CompanyAddress = {
  type: 'other', customLabel: 'Β', street: 'Μοναστηρίου', number: '10', postalCode: '56121', city: 'Εύοσμος',
};

function expectHq(reloaded: ContactFormData, expected: CompanyAddress): void {
  const hq = (reloaded.companyAddresses ?? [])[0] as unknown as Record<string, unknown> | undefined;
  const want = expected as unknown as Record<string, unknown>;
  for (const key of [...HQ_VOCABULARY_KEYS, 'type', 'customLabel']) {
    expect({ key, value: hq?.[key] }).toEqual({ key, value: want[key] });
  }
}

function legacyKeysAtRoot(doc: Readonly<Record<string, unknown>>): string[] {
  return LEGACY_ROOT_ADDRESS_FIELDS.filter((key) => key in doc);
}

function withLeakedRootFields(form: ContactFormData): ContactFormData {
  const leaked: Record<string, unknown> = { ...form };
  for (const key of LEGACY_ROOT_ADDRESS_FIELDS) leaked[key] = sentinel(key);
  return leaked as unknown as ContactFormData;
}

describe.each(KINDS)('HQ address (%s) — one container, every vocabulary field', (type) => {
  it('the scan is not empty (the vocabulary feeds the guard)', () => {
    expect(HQ_VOCABULARY_KEYS).toEqual(
      expect.arrayContaining(['street', 'number', 'city', 'neighborhood', 'municipalityId', 'settlementId']),
    );
  });

  it('create: every field survives save + reload; branches too', () => {
    const hq = filledHq();
    const { reloaded } = saveAndReload(kindForm(type, { companyAddresses: [hq, BRANCH] }));
    expectHq(reloaded, hq);
    expect(reloaded.companyAddresses?.[1]).toMatchObject(BRANCH);
  });

  it('create: the derived `addresses[]` is built ONLY from the stored list', () => {
    const { stored } = saveAndReload(kindForm(type, { companyAddresses: [filledHq(), BRANCH] }));
    const list = stored.customFields?.companyAddresses as CompanyAddress[];
    const expected: unknown = JSON.parse(JSON.stringify(buildAddressInfoListFromCompanyAddresses(list)));
    expect(stored.addresses).toEqual(expected);
  });

  it('update: every field of an edited HQ survives the diff write + reload', () => {
    const { stored } = saveAndReload(kindForm(type, { companyAddresses: [BRANCH] }));
    const hq = filledHq();
    const { reloaded } = updateAndReload(stored, { type, companyAddresses: [hq, BRANCH] }, type);
    expectHq(reloaded, hq);
  });

  it('boundary: no legacy root address key reaches the document — create AND update', () => {
    const leaked = withLeakedRootFields(kindForm(type, { companyAddresses: [filledHq()] }));
    const { stored } = saveAndReload(leaked);
    expect(legacyKeysAtRoot(stored)).toEqual([]);
    const { written } = updateAndReload(stored, leaked, type);
    expect(legacyKeysAtRoot(written)).toEqual([]);
  });

  it('a field cleared in the list stays cleared after reload (no resurrection from the root)', () => {
    const { stored } = saveAndReload(kindForm(type, { companyAddresses: [{ ...filledHq(), neighborhood: 'Κέντρο' }] }));
    const legacy: StoredDoc = { ...stored, neighborhood: 'Μπαγιάτικη' };
    const cleared = { ...filledHq(), neighborhood: '' };
    const { reloaded } = updateAndReload(legacy, { type, companyAddresses: [cleared] }, type);
    expect(reloaded.companyAddresses?.[0].neighborhood ?? '').toBe('');
  });
});

describe('company HQ address — editor change after the list exists (the production sequence)', () => {
  const NEIGHBORHOOD = 'ΒΙ.ΠΕ. Ωραιοκάστρου';

  function afterHierarchyPicked(): ContactFormData {
    return companyForm({
      companyAddresses: [{
        type: 'headquarters', street: '6,5 χλμ Θεσσαλονίκης - Ωραιοκάστρου', number: '', postalCode: '57013',
        city: 'Ωραιόκαστρον', municipalityName: 'Δήμος Ωραιοκάστρου', country: 'GR',
      }],
    });
  }

  it('«Περιοχή / Συνοικία» typed in the editor reaches BOTH stored containers and comes back', () => {
    const form = applyHqEditorChange(afterHierarchyPicked(), { neighborhood: NEIGHBORHOOD });
    const { stored, reloaded } = saveAndReload(form);

    const storedList = stored.customFields?.companyAddresses as ReadonlyArray<Record<string, unknown>>;
    const storedDerived = stored.addresses as ReadonlyArray<Record<string, unknown>>;
    expect(storedList[0].neighborhood).toBe(NEIGHBORHOOD);
    expect(storedDerived[0].neighborhood).toBe(NEIGHBORHOOD);
    expect(reloaded.companyAddresses?.[0].neighborhood).toBe(NEIGHBORHOOD);
  });

  it('every postal correction from the editor reaches the list (no hand-picked subset)', () => {
    const form = applyHqEditorChange(afterHierarchyPicked(), {
      street: 'Νέα Οδός', number: '7', postalCode: '57014', city: 'Νέα Πόλη', neighborhood: NEIGHBORHOOD,
    });
    expect(saveAndReload(form).reloaded.companyAddresses?.[0]).toMatchObject({
      street: 'Νέα Οδός', number: '7', postalCode: '57014', city: 'Νέα Πόλη', neighborhood: NEIGHBORHOOD,
    });
  });

  it('clearing the neighborhood in the editor clears it in the document (one container, nothing to merge)', () => {
    const typed = applyHqEditorChange(afterHierarchyPicked(), { neighborhood: NEIGHBORHOOD });
    const cleared = applyHqEditorChange(typed, { neighborhood: '' });
    expect(saveAndReload(cleared).reloaded.companyAddresses?.[0].neighborhood ?? '').toBe('');
  });
});
