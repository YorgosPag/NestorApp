/**
 * ADR-195 (ζ) · N.11 — Το Ιστορικό μιλά με τις λέξεις του ΛΕΞΙΛΟΓΙΟΥ, όχι με δικές του.
 *
 * Άγκυρα ΚΛΑΣΗΣ πάνω στα **πραγματικά** locale JSON (el + en), όχι σε mock λέξεις:
 *   Λ1 — κάθε τιμή κάθε ρίζας (τύποι επικοινωνίας · πλατφόρμα · ΚΑΔ · διεύθυνση) έχει λέξη, στις δύο γλώσσες·
 *   Λ2 — ίδια τιμή σε πίνακες άλλων κατόχων ⇒ ίδια λέξη (γι' αυτό τα `fallbackPaths` είναι ασφαλή)·
 *   Λ3 — κάθε δηλωμένος κατάλογος κάθε οντότητας υπάρχει, και το namespace του **φορτώνεται** για εκείνη την οντότητα·
 *   Λ4 — ο μορφοποιητής γράφει λέξεις του λεξιλογίου (υπο-πεδίο τύπου τηλεφώνου ≠ τύποι ακινήτου)·
 *   Λ5 — ο helper δεν έχει ούτε έναν ελληνικό χαρακτήρα έξω από σχόλια, ούτε `eslint-disable`.
 *   Λ7 — παλιά ορθογραφία (`main`) = ψευδώνυμο της ρίζας ΚΑΔ, ΙΔΙΑ λέξη· όχι δεύτερο λεξιλόγιο (🏷️′ #2).
 *   Λ8 — αποσυρμένο πεδίο (ΠΕΑ ως ενιαίο αντικείμενο) διαβάζεται με λέξεις, αόρατο στον γραφέα (🏷️′ #3).
 */

import fs from 'fs';
import path from 'path';

import { AUDIT_ENTITIES } from '@/config/audit-entity-registry';
import { getTrackedFieldsForEntityAuditType } from '@/config/audit-tracked-fields';
import { getAuditValueCatalog, type AuditCatalogRef } from '@/config/audit-value-catalogs';
import {
  AUDIT_ADDRESS_TYPE_CATALOG,
  AUDIT_AREA_FIELDS,
  AUDIT_EMAIL_TYPE_CATALOG,
  AUDIT_ENERGY_CERTIFICATE_KEY_CATALOG,
  AUDIT_KAD_TYPE_CATALOG,
  AUDIT_PERSONA_TYPE_CATALOG,
  AUDIT_PHONE_TYPE_CATALOG,
  AUDIT_SOCIAL_MEDIA_TYPE_CATALOG,
  AUDIT_SOCIAL_PLATFORM_CATALOG,
  AUDIT_VALUE_WORDS,
  AUDIT_WEBSITE_TYPE_CATALOG,
} from '@/config/audit-value-vocabularies';
import { PHONE_TYPES } from '@/lib/contact/phone-type-vocabulary';
import { EMAIL_TYPES } from '@/lib/contact/email-type-vocabulary';
import { WEBSITE_TYPES } from '@/lib/contact/website-type-vocabulary';
import { SOCIAL_MEDIA_TYPES, SOCIAL_PLATFORMS } from '@/lib/contact/social-media-type-vocabulary';
import {
  KAD_ACTIVITY_TYPES,
  LEGACY_KAD_ACTIVITY_TYPE_ALIASES,
  toKadActivityType,
  toLegacyKadActivityType,
} from '@/types/ContactFormTypes';
import { ACTIVITY_TYPE_OPTIONS } from '@/config/company-gemi/options/activity-types';
import { getRetiredTrackedFields } from '@/config/audit-retired-fields';
import {
  ENERGY_CERTIFICATE_ABSENCES,
  ENERGY_CERTIFICATE_SCOPES,
  UNDECLARED_ENERGY_CERTIFICATE,
} from '@/lib/energy-certificate/energy-certificate';
import { ENERGY_CERTIFICATE_ABSENCE_KEY, ENERGY_CERTIFICATE_SCOPE_KEY } from '@/lib/energy-certificate/energy-certificate-keys';
import { getExplicitNamespace } from '@/i18n/namespace-compat';
import { resolveFieldLabel, resolveTrackedFieldDef } from '../audit-field-descriptor';
import { CONTACT_ADDRESS_TYPES } from '@/types/contacts/address-types';
import { PROJECT_ADDRESS_TYPES } from '@/types/project/addresses';
import { ALL_PERSONA_TYPES } from '@/types/contacts/personas';
import type { TrackedFieldDef } from '@/lib/audit/tracked-field-def';

import { formatCollectionItemLabel, formatFieldAwareValue, type AuditValueFormat } from '../activity-tab-helpers';
import { auditVocabularyNamespaces, vocabularyNamespacesOf } from '../audit-vocabulary-namespaces';
import { auditValueWords } from '../audit-value-words';
import { resolveAuditValue, resolveDeclaredAuditValue, translateCatalogValue } from '../audit-value-resolver';

type Lang = 'el' | 'en';
const LANGS: readonly Lang[] = ['el', 'en'];
const LOCALES_DIR = path.join(process.cwd(), 'src', 'i18n', 'locales');
const mockJsonCache = new Map<string, unknown>();
let mockLang: Lang = 'el';

function mockNode(lang: Lang, ns: string, key: string): unknown {
  const file = `${lang}/${ns}`;
  if (!mockJsonCache.has(file)) {
    const full = path.join(LOCALES_DIR, lang, `${ns}.json`);
    mockJsonCache.set(file, fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, 'utf-8')) : undefined);
  }
  let node: unknown = mockJsonCache.get(file);
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function mockLeaf(key: string, ns: string | undefined): string | undefined {
  const value = ns ? mockNode(mockLang, ns, key) : undefined;
  return typeof value === 'string' ? value : undefined;
}

jest.mock('i18next', () => ({
  __esModule: true,
  default: { exists: (key: string, opts?: { ns?: string }) => mockLeaf(key, opts?.ns) !== undefined },
}));

/** Το `t` με ρητό `ns`, όπως το `useAuditVocabulary`· άγνωστο κλειδί ⇒ το ίδιο το κλειδί (συμπεριφορά i18next). */
const t = (key: string, opts?: Record<string, unknown>): string =>
  mockLeaf(key, typeof opts?.ns === 'string' ? opts.ns : undefined) ?? key;

function inLang<T>(lang: Lang, run: () => T): T {
  mockLang = lang;
  try {
    return run();
  } finally {
    mockLang = 'el';
  }
}

function catalogPaths(catalog: AuditCatalogRef): readonly string[] {
  return [catalog.path, ...(catalog.fallbackPaths ?? [])];
}

/** Οι ρίζες και ο κατάλογος που τις μεταφράζει — οι τιμές από τη ΡΙΖΑ, ποτέ χειρόγραφα. */
const ROOTS: ReadonlyArray<readonly [string, readonly string[], AuditCatalogRef]> = [
  ['PhoneType', PHONE_TYPES, AUDIT_PHONE_TYPE_CATALOG],
  ['EmailType', EMAIL_TYPES, AUDIT_EMAIL_TYPE_CATALOG],
  ['WebsiteType', WEBSITE_TYPES, AUDIT_WEBSITE_TYPE_CATALOG],
  ['SocialMediaType', SOCIAL_MEDIA_TYPES, AUDIT_SOCIAL_MEDIA_TYPE_CATALOG],
  ['SocialPlatform', SOCIAL_PLATFORMS, AUDIT_SOCIAL_PLATFORM_CATALOG],
  ['KadActivity.type', KAD_ACTIVITY_TYPES, AUDIT_KAD_TYPE_CATALOG],
  ['ContactAddressType', CONTACT_ADDRESS_TYPES, AUDIT_ADDRESS_TYPE_CATALOG],
  ['ProjectAddressType', PROJECT_ADDRESS_TYPES, AUDIT_ADDRESS_TYPE_CATALOG],
  // ADR-195 (η) — snake_case τιμές (`real_estate_agent`) σε camelCase κλειδιά: η γέφυρα του επιλυτή ΕΚΤΕΛΕΙΤΑΙ εδώ.
  ['PersonaType', ALL_PERSONA_TYPES, AUDIT_PERSONA_TYPE_CATALOG],
];

describe('Λ1 — κάθε τιμή κάθε ρίζας έχει λέξη, σε el ΚΑΙ en', () => {
  it.each(ROOTS.flatMap(([root, values, catalog]) =>
    LANGS.flatMap((lang) => values.map((value) => [root, lang, value, catalog] as const)),
  ))('%s · %s · %s', (_root, lang, value, catalog) => {
    const word = inLang(lang, () => translateCatalogValue(catalog, value, t));
    // `undefined` ⇔ η λέξη λείπει (ο κατάλογος δεν επιστρέφει ποτέ το ωμό κλειδί).
    expect(word).toEqual(expect.any(String));
    expect(word).not.toBe('');
  });
});

describe('Λ2 — ίδια τιμή σε άλλο κάτοχο ⇒ ίδια λέξη', () => {
  it.each(ROOTS.filter(([, , catalog]) => (catalog.fallbackPaths ?? []).length > 0).flatMap(([root, values, catalog]) =>
    LANGS.flatMap((lang) => values.map((value) => [root, lang, value, catalog] as const)),
  ))('%s · %s · %s', (_root, lang, value, catalog) => {
    const words = catalogPaths(catalog)
      .map((p) => mockNode(lang, catalog.ns, `${p}.${value}`))
      .filter((w): w is string => typeof w === 'string');
    expect(new Set(words).size).toBeLessThanOrEqual(1);
  });
});

/** Κάθε κατάλογος που δηλώνει ένα πεδίο — ο ίδιος κανόνας με τον resolver. */
function declaredCatalogs(field: string, def: TrackedFieldDef): readonly AuditCatalogRef[] {
  return [def.enumCatalog ?? getAuditValueCatalog(field), def.nestedKeyCatalog, ...Object.values(def.itemCatalogs ?? {})]
    .filter((ref): ref is AuditCatalogRef => ref !== undefined);
}

const ENTITY_TYPES = Object.keys(AUDIT_ENTITIES);

describe('Λ3 — κάθε δηλωμένος κατάλογος υπάρχει ΚΑΙ φορτώνεται για την οντότητά του', () => {
  const cases = ENTITY_TYPES.flatMap((entityType) =>
    Object.entries(getTrackedFieldsForEntityAuditType(entityType) ?? {}).flatMap(([field, def]) =>
      declaredCatalogs(field, def).map((catalog) => [entityType, field, catalog] as const),
    ),
  );

  it('η άγκυρα βλέπει δηλώσεις (όχι κενό πράσινο)', () => {
    expect(cases.length).toBeGreaterThan(20);
  });

  it.each(cases)('%s.%s', (entityType, _field, catalog) => {
    expect(auditVocabularyNamespaces(entityType)).toContain(catalog.ns);
    for (const lang of LANGS) {
      for (const p of catalogPaths(catalog)) {
        expect(mockNode(lang, catalog.ns, p)).toEqual(expect.any(Object));
      }
    }
  });

  it.each([...AUDIT_AREA_FIELDS])('ο κανόνας εμβαδού ΜΟΝΟΣ του φορτώνει τη μονάδα (%s, χωρίς άλλο κατάλογο)', (field) => {
    expect(vocabularyNamespacesOf({ [field]: { kind: 'scalar', label: field } })).toEqual([AUDIT_VALUE_WORDS.sqm.ns]);
  });

  it('η μονάδα εμβαδού φορτώνεται όπου υπάρχει πεδίο εμβαδού', () => {
    for (const entityType of ENTITY_TYPES) {
      const fields = Object.keys(getTrackedFieldsForEntityAuditType(entityType) ?? {});
      if (fields.some((f) => AUDIT_AREA_FIELDS.has(f))) {
        expect(auditVocabularyNamespaces(entityType)).toContain(AUDIT_VALUE_WORDS.sqm.ns);
      }
    }
  });

  it('το «εσωτ.» ζει στο namespace του τύπου τηλεφώνου (φορτώνεται μαζί του)', () => {
    expect(AUDIT_VALUE_WORDS.extension.ns).toBe(AUDIT_PHONE_TYPE_CATALOG.ns);
  });

  it.each(LANGS.flatMap((lang) => Object.entries(AUDIT_VALUE_WORDS).map(([w, ref]) => [lang, w, ref] as const)))(
    'λέξη %s · %s',
    (lang, _w, ref) => {
      expect(mockNode(lang, ref.ns, ref.key)).toEqual(expect.any(String));
    },
  );
});

function formatFor(entityType: string, field: string): AuditValueFormat {
  const def = getTrackedFieldsForEntityAuditType(entityType)?.[field];
  return { ...auditValueWords(t), itemCatalogs: def?.itemCatalogs, nestedKeyCatalog: def?.nestedKeyCatalog };
}

describe('Λ4 — ο μορφοποιητής γράφει λέξεις του λεξιλογίου', () => {
  const phoneType = getTrackedFieldsForEntityAuditType('contact')?.phones?.itemCatalogs?.type;

  it.each([['el', 'Κινητό', 'Κεντρικό'], ['en', 'Mobile', 'Main']] as const)(
    'υπο-πεδίο phones.type (%s) — από τους τύπους τηλεφώνου, όχι ακινήτου',
    (lang, mobile, main) => inLang(lang, () => {
      const format: AuditValueFormat = {
        ...auditValueWords(t),
        translateValue: (v) => resolveDeclaredAuditValue(phoneType, v, t),
      };
      expect(formatFieldAwareValue('type', 'mobile', format)).toBe(mobile);
      expect(formatFieldAwareValue('type', 'main', format)).toBe(main);
    }),
  );

  it.each([
    ['el', '+30 6971234567 εσωτ. 12 (Κινητό)', 'Ναι', 'Μικτό: 120 τ.μ.', '01.11 — Καλλιέργεια (Κύρια)'],
    ['en', '+30 6971234567 ext. 12 (Mobile)', 'Yes', 'Gross: 120 sq.m.', '01.11 — Καλλιέργεια (Primary)'],
  ] as const)('ολόκληρη τιμή (%s): τηλέφωνο · ναι/όχι · εμβαδόν · ΚΑΔ', (lang, phone, yes, areas, kad) =>
    inLang(lang, () => {
      const phones = JSON.stringify([{ number: '6971234567', countryCode: '+30', extension: '12', type: 'mobile' }]);
      expect(formatFieldAwareValue('phones', phones, formatFor('contact', 'phones'))).toBe(phone);
      expect(formatFieldAwareValue('isPrimary', true, formatFor('contact', 'phones'))).toBe(yes);
      expect(formatFieldAwareValue('areas', '{"gross":120}', formatFor('property', 'areas'))).toBe(areas);
      const activities = JSON.stringify([{ code: '01.11', description: 'Καλλιέργεια', type: 'primary' }]);
      expect(formatFieldAwareValue('customFields.activities', activities, formatFor('contact', 'customFields.activities')))
        .toBe(kad);
    }),
  );
});

describe('Λ6 — η ετικέτα στοιχείου που γράφει η μηχανή θεραπεύεται στην ανάγνωση (πραγματικές ετικέτες CDC)', () => {
  it.each([
    ['el', 'contact', 'phones', '2310428900 — mobile', '2310428900 — Κινητό'],
    ['en', 'contact', 'phones', '2310428900 — main', '2310428900 — Main'],
    ['el', 'contact', 'emails', 'info@macon.gr — info', 'info@macon.gr — Πληροφορίες'],
    ['el', 'contact', 'addresses', 'headquarters — Απόλλωνος, Λαγκαδά Πυλαίας', 'Έδρα — Απόλλωνος, Λαγκαδά Πυλαίας'],
    ['en', 'contact', 'customFields.activities', 'secondary', 'Secondary'],
  ] as const)('%s · %s.%s · «%s»', (lang, entityType, field, raw, expected) =>
    inLang(lang, () => expect(formatCollectionItemLabel(raw, formatFor(entityType, field))).toBe(expected)),
  );

  it.each([['el', 'Κύρια'], ['en', 'Primary']] as const)('customFields.activityType (%s) — «main» = η λέξη της ρίζας ΚΑΔ', (lang, word) =>
    inLang(lang, () => {
      const def = getTrackedFieldsForEntityAuditType('contact')?.['customFields.activityType'];
      expect(resolveAuditValue('customFields.activityType', 'main', t, def?.enumCatalog)).toBe(word);
    }),
  );

  it('πεδίο χωρίς δηλωμένο λεξιλόγιο ⇒ αυτούσια (καμία μαντεψιά)', () => {
    expect(formatCollectionItemLabel('supplier', formatFor('contact', 'personaTypes'))).toBe('supplier');
  });
});

describe('Λ5 — καμία λέξη μέσα στον κώδικα του Ιστορικού', () => {
  const GREEK = /[Ͱ-Ͽἀ-῿]/;
  const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it.each(['activity-tab-helpers.ts', 'audit-value-words.ts', 'audit-vocabulary-namespaces.ts'])('%s', (file) => {
    const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf-8');
    expect(src).not.toMatch(/(\/\*|\/\/)\s*eslint-disable/);
    expect(stripComments(src)).not.toMatch(GREEK);
  });
});

/**
 * Λ7 — ADR-195 (ζ) 🏷️′ #2: ΕΝΑ λεξιλόγιο τύπου δραστηριότητας. Η παλιά ορθογραφία (`main`) του ενικού κατόπτρου
 * `activityType` είναι ΨΕΥΔΩΝΥΜΟ της ρίζας `KAD_ACTIVITY_TYPES`, όχι δεύτερο λεξιλόγιο με δικές του λέξεις.
 */
describe('Λ7 — παλιά ορθογραφία = ψευδώνυμο της ρίζας, όχι δεύτερο λεξιλόγιο', () => {
  const def = (): TrackedFieldDef | undefined => getTrackedFieldsForEntityAuditType('contact')?.['customFields.activityType'];

  it('ο κατάλογος του κατόπτρου ΕΙΝΑΙ ο κατάλογος της ρίζας (ίδιο ns + διαδρομή) με δηλωμένα ψευδώνυμα', () => {
    const catalog = def()?.enumCatalog;
    expect(catalog?.ns).toBe(AUDIT_KAD_TYPE_CATALOG.ns);
    expect(catalog?.path).toBe(AUDIT_KAD_TYPE_CATALOG.path);
    expect(catalog?.valueAliases).toBe(LEGACY_KAD_ACTIVITY_TYPE_ALIASES);
  });

  it.each(LANGS.flatMap((lang) => Object.entries(LEGACY_KAD_ACTIVITY_TYPE_ALIASES).map(([legacy, root]) => [lang, legacy, root] as const)))(
    '%s · «%s» λέει την ίδια λέξη με «%s»', (lang, legacy, root) => inLang(lang, () => {
      expect(KAD_ACTIVITY_TYPES).toContain(root);
      const word = resolveDeclaredAuditValue(def()?.enumCatalog, legacy, t);
      expect(word).toBe(translateCatalogValue(AUDIT_KAD_TYPE_CATALOG, root, t));
      expect(word).not.toBe(legacy);
    }),
  );

  it('ψευδώνυμο ΜΟΝΟ από own-property (`constructor` δεν «λύνεται»)', () => {
    expect(translateCatalogValue(def()?.enumCatalog, 'constructor', t)).toBeUndefined();
  });

  it('οι κανονικοποιητές της ρίζας', () => {
    expect(toKadActivityType('main', 'secondary')).toBe('primary');
    expect(toKadActivityType('primary', 'secondary')).toBe('primary');
    expect(toKadActivityType('κάτι', 'secondary')).toBe('secondary');
    expect(toKadActivityType('constructor', 'secondary')).toBe('secondary');
    expect(toLegacyKadActivityType('secondary')).toBe('secondary');
    expect(toLegacyKadActivityType('')).toBe('main');
    expect(toLegacyKadActivityType('toString')).toBe('main');
  });

  it('οι επιλογές τύπου δραστηριότητας ΠΑΡΑΓΟΝΤΑΙ από τη ρίζα και λύνονται σε el+en', () => {
    expect(ACTIVITY_TYPE_OPTIONS.map((o) => o.value)).toEqual([...KAD_ACTIVITY_TYPES]);
    for (const lang of LANGS) {
      for (const option of ACTIVITY_TYPE_OPTIONS) expect(typeof mockNode(lang, AUDIT_KAD_TYPE_CATALOG.ns, option.label)).toBe('string');
    }
  });
});

/**
 * Λ8 — ADR-195 (κ): η παλιά γραμμή του ΠΕΑ ως ΕΝΙΑΙΟ αντικείμενο (`energy: — → {"class":"A"}`, πριν το ADR-777 §8.94)
 * διαβάζεται με λέξεις, από περιγραφέα που ο ΓΡΑΦΕΑΣ δεν βλέπει.
 */
describe('Λ8 — αποσυρμένα πεδία: λέξεις για τις παλιές γραμμές, αόρατα στον γραφέα', () => {
  const RETIRED = (['property', 'owner_property'] as const).flatMap((entityType) =>
    Object.entries(getRetiredTrackedFields(entityType)).map(([field, entry]) => [entityType, field, entry] as const));
  const translate = (key: string): string => {
    const { namespace, bareKey } = getExplicitNamespace(key);
    return t(bareKey, namespace ? { ns: namespace } : { ns: 'common-audit' });
  };

  it('ο πληθυσμός δεν είναι κενός (το ΠΕΑ ως ενιαίο αντικείμενο, σε ιδιώτη ΚΑΙ εταιρεία)', () => {
    expect(RETIRED.map(([entityType, field]) => `${entityType}.${field}`)).toEqual(['property.energy', 'owner_property.energy']);
  });

  it.each(RETIRED)('%s.%s — ΛΕΙΠΕΙ από το ενεργό μητρώο και λέει από πού αποσύρθηκε', (entityType, field, entry) => {
    expect(Object.prototype.hasOwnProperty.call(getTrackedFieldsForEntityAuditType(entityType) ?? {}, field)).toBe(false);
    expect(entry.retiredBy).toMatch(/ADR-\d+/);
    expect(resolveTrackedFieldDef(entityType, field)).toBe(entry.def);
  });

  it.each(LANGS.flatMap((lang) => RETIRED.map(([entityType, field]) => [lang, entityType, field] as const)))(
    '%s · %s.%s — ζωντανή ετικέτα, όχι στιγμιότυπο', (lang, entityType, field) => inLang(lang, () => {
      const label = resolveFieldLabel({ entityType, field, def: resolveTrackedFieldDef(entityType, field), storedLabel: field, translate });
      expect(label.isSnapshot).toBe(false);
      expect(label.text).not.toBe(field);
    }),
  );

  it.each(LANGS.flatMap((lang) => Object.keys(UNDECLARED_ENERGY_CERTIFICATE).map((key) => [lang, key] as const)))(
    '%s · κλειδί ΠΕΑ «%s» έχει λέξη', (lang, key) => inLang(lang, () => {
      expect(typeof translateCatalogValue(AUDIT_ENERGY_CERTIFICATE_KEY_CATALOG, key, t)).toBe('string');
    }),
  );

  it.each([['el', 'Ενεργειακή κλάση'], ['en', 'Energy class']] as const)(
    '%s · η ΠΡΑΓΜΑΤΙΚΗ παλιά γραμμή (Στούντιο 35 τ.μ.) δείχνει λέξη, όχι «class»', (lang, word) => inLang(lang, () => {
      const def = resolveTrackedFieldDef('property', 'energy');
      const format: AuditValueFormat = { ...auditValueWords(t), nestedKeyCatalog: def?.nestedKeyCatalog };
      const text = formatFieldAwareValue('energy', '{"class":"A"}', format);
      expect(text).toContain(word);
      expect(text).not.toMatch(/class/);
    }),
  );

  it.each(LANGS.flatMap((lang) => [
    ...ENERGY_CERTIFICATE_SCOPES.map((value) => [lang, 'energy.scope', value, ENERGY_CERTIFICATE_SCOPE_KEY[value]] as const),
    ...ENERGY_CERTIFICATE_ABSENCES.map((value) => [lang, 'energy.absence', value, ENERGY_CERTIFICATE_ABSENCE_KEY[value]] as const),
  ]))('%s · %s «%s» = η λέξη της φόρμας του ΠΕΑ', (lang, field, value, formKey) => inLang(lang, () => {
    const { namespace, bareKey } = getExplicitNamespace(formKey);
    const formWord = mockNode(lang, namespace ?? '', bareKey);
    expect(typeof formWord).toBe('string');
    for (const entityType of ['property', 'owner_property'] as const) {
      const def = resolveTrackedFieldDef(entityType, field);
      expect(resolveAuditValue(field, value, t, def?.enumCatalog)).toBe(formWord);
    }
  }));

  it('τα λεξιλόγια των αποσυρμένων πεδίων ΦΟΡΤΩΝΟΝΤΑΙ (διακριτικό: namespace που δεν ζητά κανείς άλλος)', () => {
    jest.isolateModules(() => {
      jest.doMock('@/config/audit-retired-fields', () => ({
        getRetiredTrackedFields: (entityType: string | null) => (entityType === 'property'
          ? { legacy: { retiredBy: 'ADR-000', def: { kind: 'scalar', label: 'legacy', nestedKeyCatalog: { ns: 'zz-retired-only', path: 'x' } } } }
          : {}),
        getRetiredFieldDef: () => undefined,
      }));
      const fresh = jest.requireActual<typeof import('../audit-vocabulary-namespaces')>('../audit-vocabulary-namespaces');
      expect(fresh.auditVocabularyNamespaces('property')).toContain('zz-retired-only');
      expect(fresh.auditVocabularyNamespaces('contact')).not.toContain('zz-retired-only');
    });
  });

  it('το namespace της ΕΤΙΚΕΤΑΣ (`labelKey: ns:…`) φορτώνεται κι αυτό', () => {
    expect(vocabularyNamespacesOf({ x: { kind: 'scalar', label: 'x', labelKey: 'zz-label-only:audit.fields.x' } })).toContain('zz-label-only');
    expect(vocabularyNamespacesOf({ x: { kind: 'scalar', label: 'x', labelKey: 'audit.fields.x' } })).toEqual([]);
  });
});
