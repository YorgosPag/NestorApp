/**
 * Φρουρός round-trip της φόρμας εταιρείας — «ό,τι βλέπεις είναι ό,τι αποθηκεύεται» (ADR-332 §D30).
 *
 * Εκτελεί ΟΛΟΚΛΗΡΟ τον δρόμο που περνά κάθε αποθήκευση εταιρείας:
 *   φόρμα → `mapFormDataToContact` → `sanitizeContactData` → (JSON = Firestore χωρίς `undefined`)
 *         → `mapCompanyContactToFormData` → φόρμα
 * και απαιτεί ΙΣΟΤΗΤΑ για κάθε πεδίο. Κανένα mock: ό,τι τρέχει στην παραγωγή τρέχει εδώ.
 *
 * Γιατί υπάρχει (μετρημένο στην παραγωγή, `cont_c4d79d09…`, 2026-11-18): η Δ.Ο.Υ. και η
 * «Περιοχή / Συνοικία» της έδρας φαίνονταν στη φόρμα και **δεν** έφταναν στο έγγραφο.
 * Τρεις χειρόγραφες λίστες πεδίων είχαν αποκλίνει και κανένα test δεν έκανε τον κύκλο.
 */

import type { Contact } from '@/types/contacts';
import { initialFormData, type ContactFormData } from '@/types/ContactFormTypes';
import { COMPANY_GEMI_SECTIONS } from '@/config/company-gemi';
import { mapFormDataToContact } from '../modular/orchestrator';
import { mapCompanyContactToFormData } from '../fieldMappers/companyMapper';
import { sanitizeContactData, type ContactDataRecord } from '../utils/data-cleaning';
import {
  COMPANY_FORM_FIELDS_OWNED_ELSEWHERE,
  COMPANY_SCALAR_FIELDS,
  type CompanyScalarBinding,
  type CompanyScalarField,
} from '../schema/company-field-schema';
import { buildFlatFieldsFromAddressInfo } from '@/utils/contacts/address-info-builder';
import {
  applyHqEditorChange,
  hqEntryFromFlatFields,
} from '@/components/contacts/dynamic/addresses-section-form-mapping';

// ─── ο κύκλος ────────────────────────────────────────────────────────────────

interface RoundTrip {
  readonly stored: Record<string, unknown> & { customFields?: Record<string, unknown> };
  readonly reloaded: ContactFormData;
}

function saveAndReload(formData: ContactFormData): RoundTrip {
  const mapping = mapFormDataToContact(formData);
  expect(mapping.warnings).toEqual([]);
  const sanitized = sanitizeContactData(mapping.contactData as unknown as ContactDataRecord);
  const stored = JSON.parse(JSON.stringify(sanitized)) as RoundTrip['stored'];
  const reloaded = mapCompanyContactToFormData({ ...stored, id: 'cont_roundtrip' } as unknown as Contact);
  return { stored, reloaded };
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
  // ΚΑΘΕ γραμμή γεμίζει — και όσες διαβάζει άλλος ιδιοκτήτης (`readOwner`): ο κύκλος πρέπει να
  // κλείνει και μέσα από εκείνον, αλλιώς η δήλωση `readOwner` θα ήταν τρόπος να κρυφτεί απώλεια.
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

// ─── 3. Η έδρα κάνει τον κύκλο — κάθε πεδίο του λεξιλογίου, και οι δύο δρόμοι ───

/** Το σύνολο των επίπεδων πεδίων διεύθυνσης — από το ΙΔΙΟ κενό πρότυπο που χρησιμοποιούν οι mappers. */
const FLAT_ADDRESS_KEYS = Object.keys(buildFlatFieldsFromAddressInfo(undefined)) as ReadonlyArray<
  keyof ReturnType<typeof buildFlatFieldsFromAddressInfo>
>;

function filledHqFlatFields(): Partial<ContactFormData> {
  const fields: Record<string, string> = Object.fromEntries(FLAT_ADDRESS_KEYS.map((key) => [key, sentinel(key)]));
  // Ο «Οικισμός / Πόλη» είναι ΕΝΑ ορατό πεδίο με δύο ονόματα στη φόρμα (`settlement || city`)
  // και ένα στη λίστα (`city`): στην οθόνη είναι πάντα το ίδιο κείμενο.
  fields.settlement = fields.city;
  return { ...fields, hqAddressCountry: 'CY' } as Partial<ContactFormData>;
}

function expectHqRoundTrip(reloaded: ContactFormData, expected: Partial<ContactFormData>): void {
  for (const key of [...FLAT_ADDRESS_KEYS, 'hqAddressCountry'] as const) {
    expect({ key, value: reloaded[key] }).toEqual({ key, value: expected[key] });
  }
}

describe('company HQ address — every vocabulary field survives save + reload', () => {
  it('flat fields only (no list yet — synthetic HQ)', () => {
    const form = companyForm(filledHqFlatFields());
    expectHqRoundTrip(saveAndReload(form).reloaded, form);
  });

  it('list already exists (hierarchy was picked) — the list is the authority', () => {
    const flat = filledHqFlatFields();
    const base = companyForm(flat);
    const form = { ...base, companyAddresses: [hqEntryFromFlatFields(base)] };
    expectHqRoundTrip(saveAndReload(form).reloaded, form);
  });
});

describe('company HQ address — editor change after the list exists (the production sequence)', () => {
  const NEIGHBORHOOD = 'ΒΙ.ΠΕ. Ωραιοκάστρου';

  function afterHierarchyPicked(): ContactFormData {
    const base = companyForm({
      street: '6,5 χλμ Θεσσαλονίκης - Ωραιοκάστρου',
      postalCode: '57013',
      city: 'Ωραιόκαστρον',
      settlement: 'Ωραιόκαστρον',
      municipality: 'Δήμος Ωραιοκάστρου',
      hqAddressCountry: 'GR',
    });
    return { ...base, companyAddresses: [hqEntryFromFlatFields(base)] };
  }

  it('«Περιοχή / Συνοικία» typed in the editor reaches BOTH stored containers and comes back', () => {
    const form = applyHqEditorChange(afterHierarchyPicked(), { neighborhood: NEIGHBORHOOD });
    const { stored, reloaded } = saveAndReload(form);

    const storedList = stored.customFields?.companyAddresses as ReadonlyArray<Record<string, unknown>>;
    const storedDerived = stored.addresses as ReadonlyArray<Record<string, unknown>>;
    expect(storedList[0].neighborhood).toBe(NEIGHBORHOOD);
    expect(storedDerived[0].neighborhood).toBe(NEIGHBORHOOD);
    expect(reloaded.neighborhood).toBe(NEIGHBORHOOD);
  });

  it('every postal correction from the editor reaches the list (no hand-picked subset)', () => {
    const form = applyHqEditorChange(afterHierarchyPicked(), {
      street: 'Νέα Οδός', number: '7', postalCode: '57014', city: 'Νέα Πόλη', neighborhood: NEIGHBORHOOD,
    });
    const { reloaded } = saveAndReload(form);
    expect({
      street: reloaded.street, streetNumber: reloaded.streetNumber, postalCode: reloaded.postalCode,
      city: reloaded.city, neighborhood: reloaded.neighborhood,
    }).toEqual({
      street: 'Νέα Οδός', streetNumber: '7', postalCode: '57014', city: 'Νέα Πόλη', neighborhood: NEIGHBORHOOD,
    });
  });

  it('clearing the neighborhood in the editor clears it in the document (mirror, not merge)', () => {
    const typed = applyHqEditorChange(afterHierarchyPicked(), { neighborhood: NEIGHBORHOOD });
    const cleared = applyHqEditorChange(typed, { neighborhood: '' });
    expect(saveAndReload(cleared).reloaded.neighborhood).toBe('');
  });
});
