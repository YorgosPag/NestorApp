/**
 * Integration tests for the shared service-form i18n resolver.
 *
 * Unlike `translate-field-value.test.ts` (which stubs `i18next` with an
 * in-memory Map), these tests initialise a **real** i18next instance loaded
 * with the actual Greek locale JSON files shipped in `src/i18n/locales/el/`.
 *
 * Why a second test file
 * ----------------------
 * The regression on 2026-04-11 (raw `options.serviceCategories.*` keys in the
 * Δημόσια Υπηρεσία → Βασικά Στοιχεία dropdown after ADR-280 namespace
 * splitting) would have been caught by neither:
 *
 *   - CHECK 3.8 / CHECK 3.12 — both verified that keys *existed* somewhere in
 *     the locale tree, but had no awareness of which namespaces the runtime
 *     resolver actually scans.
 *   - The unit tests in translate-field-value.test.ts — they use a mocked
 *     i18next store and therefore cannot distinguish a working namespace
 *     list from a broken one; they only verify the resolver's local logic.
 *
 * This integration test closes the gap: it is a **reachability smoke test**
 * that proves representative keys from the service form config tree
 * (options catalogs, section labels, field labels) resolve end-to-end when
 * `translateFieldValue` is wired to a real i18next with the real JSON files
 * and the real `SERVICE_FORM_NAMESPACES` list.
 *
 * If a future ADR moves keys to a new namespace without also updating
 * `SERVICE_FORM_NAMESPACES`, this test fails loudly — instead of the user
 * discovering it by seeing raw dotted strings in production.
 *
 * @module components/generic/i18n/__tests__/translate-field-value.integration
 * @enterprise ADR-279 — Google-Grade i18n Governance
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import i18next from 'i18next';

import {
  SERVICE_FORM_NAMESPACES,
  translateFieldValue,
} from '../translate-field-value';

// The resolver logs a dev-mode warning through `@/lib/telemetry`. That module
// pulls in Next-runtime and Sentry transports that do not load cleanly under
// jsdom, so we stub it. We assert visibility on the returned string instead
// of the log call — if resolution fails, `translateFieldValue` returns the
// original key and the expect() assertion below will fail loudly.
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const LOCALES_ROOT = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'i18n',
  'locales',
  'el',
);

function loadNamespace(ns: string): Record<string, unknown> {
  const raw = readFileSync(join(LOCALES_ROOT, `${ns}.json`), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

beforeAll(async () => {
  const resources: Record<string, Record<string, unknown>> = {};
  for (const ns of SERVICE_FORM_NAMESPACES) {
    resources[ns] = loadNamespace(ns);
  }

  await i18next.init({
    lng: 'el',
    fallbackLng: 'el',
    ns: [...SERVICE_FORM_NAMESPACES],
    defaultNS: 'contacts',
    resources: {
      el: resources,
    },
    interpolation: { escapeValue: false },
  });
});

const t = (key: string, opts?: Record<string, unknown>): string =>
  i18next.t(key, opts ?? {}) as string;

describe('translateFieldValue — integration with real Greek locale JSONs', () => {
  describe('options.serviceCategories.* (the 2026-04-11 regression pattern)', () => {
    // The exact keys that rendered raw in the Δημόσια Υπηρεσία → Βασικά
    // Στοιχεία → Κατηγορία dropdown before the resolver fix.
    const cases: Array<[string, string]> = [
      ['options.serviceCategories.ministry', 'Υπουργείο'],
      ['options.serviceCategories.region', 'Περιφέρεια'],
      ['options.serviceCategories.municipality', 'Δήμος'],
      ['options.serviceCategories.publicEntity', 'Δημόσιος Φορέας'],
      ['options.serviceCategories.other', 'Άλλο'],
    ];

    it.each(cases)('resolves %s to its Greek label', (key, expectedFragment) => {
      const translated = translateFieldValue(key, t);
      expect(translated).toBeDefined();
      expect(translated).not.toBe(key);
      expect(typeof translated).toBe('string');
      // Use fragment matching to tolerate minor locale wording tweaks while
      // still proving the resolver walked the namespace chain successfully.
      expect(translated!.toLowerCase()).toContain(
        expectedFragment.toLowerCase(),
      );
    });

    it('resolves every key in the serviceCategories catalog without raw fallback', () => {
      const locale = loadNamespace('contacts-form') as {
        options: { serviceCategories: Record<string, string> };
      };
      const keys = Object.keys(locale.options.serviceCategories).map(
        (k) => `options.serviceCategories.${k}`,
      );
      expect(keys.length).toBeGreaterThanOrEqual(19);
      for (const key of keys) {
        const translated = translateFieldValue(key, t);
        // A raw-key fallback would return `key` verbatim.
        expect(translated).not.toBe(key);
      }
    });
  });

  describe('service.sections.* — ADR-280 namespace split survivors', () => {
    // These keys were moved from `contacts` to `contacts-relationships` during
    // the ADR-280 namespace split. The resolver must still reach them via the
    // updated SERVICE_FORM_NAMESPACES list.
    const sectionKeys = [
      'service.sections.basicInfo',
      'service.sections.administrative',
      'service.sections.contact',
      'service.sections.address',
      'service.sections.communication',
    ];

    it.each(sectionKeys)('resolves %s via contacts-relationships namespace', (key) => {
      const translated = translateFieldValue(key, t);
      expect(translated).toBeDefined();
      expect(translated).not.toBe(key);
    });
  });

  describe('service.fields.*.label — deeply nested field labels', () => {
    const fieldLabelKeys = [
      'service.fields.name.label',
      'service.fields.shortName.label',
      'service.fields.category.label',
      'service.fields.supervisionMinistry.label',
      'service.fields.legalStatus.label',
    ];

    it.each(fieldLabelKeys)('resolves %s to a non-empty Greek string', (key) => {
      const translated = translateFieldValue(key, t);
      expect(translated).toBeDefined();
      expect(translated).not.toBe(key);
      expect(translated!.length).toBeGreaterThan(0);
    });
  });

  describe('contacts.service.*.label — legacy prefix fallback', () => {
    // Historical callers pass `contacts.` prefixed keys that were valid
    // before the split. The resolver's `contacts.` strip-fallback keeps
    // them working against the new namespace layout.
    it('resolves contacts.service.sections.basicInfo via prefix strip', () => {
      const translated = translateFieldValue(
        'contacts.service.sections.basicInfo',
        t,
      );
      expect(translated).toBeDefined();
      expect(translated).not.toBe('contacts.service.sections.basicInfo');
    });

    it('resolves contacts.service.fields.name.label via prefix strip', () => {
      const translated = translateFieldValue(
        'contacts.service.fields.name.label',
        t,
      );
      expect(translated).toBeDefined();
      expect(translated).not.toBe('contacts.service.fields.name.label');
    });
  });

  describe('namespace wiring sanity', () => {
    it('SERVICE_FORM_NAMESPACES includes contacts-relationships', () => {
      // Direct guard: the exact piece of configuration that broke on
      // 2026-04-11. If someone removes this entry again, the tests above
      // would also fail, but this assertion fails with a clearer message.
      expect(SERVICE_FORM_NAMESPACES).toContain('contacts-relationships');
    });

    it('every configured namespace has a loaded JSON file', () => {
      for (const ns of SERVICE_FORM_NAMESPACES) {
        const loaded = i18next.getResourceBundle('el', ns) as unknown;
        expect(loaded).toBeDefined();
        expect(typeof loaded).toBe('object');
        expect(loaded).not.toBeNull();
      }
    });
  });
});
