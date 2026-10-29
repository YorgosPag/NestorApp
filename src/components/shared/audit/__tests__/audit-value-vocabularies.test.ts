/**
 * ADR-195 (ζ) · N.11 — Το Ιστορικό μιλά με τις λέξεις του ΛΕΞΙΛΟΓΙΟΥ, όχι με δικές του.
 *
 * Άγκυρα ΚΛΑΣΗΣ πάνω στα **πραγματικά** locale JSON (el + en), όχι σε mock λέξεις:
 *   Λ1 — κάθε τιμή κάθε ρίζας (τύποι επικοινωνίας · πλατφόρμα · ΚΑΔ · διεύθυνση) έχει λέξη, στις δύο γλώσσες·
 *   Λ2 — ίδια τιμή σε πίνακες άλλων κατόχων ⇒ ίδια λέξη (γι' αυτό τα `fallbackPaths` είναι ασφαλή)·
 *   Λ3 — κάθε δηλωμένος κατάλογος κάθε οντότητας υπάρχει, και το namespace του **φορτώνεται** για εκείνη την οντότητα·
 *   Λ4 — ο μορφοποιητής γράφει λέξεις του λεξιλογίου (υπο-πεδίο τύπου τηλεφώνου ≠ τύποι ακινήτου)·
 *   Λ5 — ο helper δεν έχει ούτε έναν ελληνικό χαρακτήρα έξω από σχόλια, ούτε `eslint-disable`.
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
  AUDIT_KAD_TYPE_CATALOG,
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
import { KAD_ACTIVITY_TYPES } from '@/types/ContactFormTypes';
import { CONTACT_ADDRESS_TYPES } from '@/types/contacts/address-types';
import { PROJECT_ADDRESS_TYPES } from '@/types/project/addresses';
import type { TrackedFieldDef } from '@/lib/audit/tracked-field-def';

import { formatCollectionItemLabel, formatFieldAwareValue, type AuditValueFormat } from '../activity-tab-helpers';
import { auditVocabularyNamespaces, vocabularyNamespacesOf } from '../audit-vocabulary-namespaces';
import { auditValueWords } from '../audit-value-words';
import { resolveDeclaredAuditValue, translateCatalogValue } from '../audit-value-resolver';

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
