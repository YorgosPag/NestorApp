/**
 * @jest-environment node
 */
/**
 * ADR-874 Ε-874.1 — the INDEX side and the QUERY side speak one language.
 *
 * `/api/search` normalizes the query with `src/lib/search/search.ts` and matches
 * `search.prefixes` with `array-contains-any`. Until ADR-874 this builder — the
 * production writer of `search_documents` — used its OWN copy of the normalizer
 * and prefix generator, which (measured 2026-09-22) did not fold the final sigma,
 * did not strip Latin diacritics and did not split `PRJ-001` into `001`. A search
 * for «001» could never find `PRJ-001`. These anchors run the real builder.
 */

// ⚠️ Imports stay INSIDE functions/src: the functions build compiles tests too, and
// one import of `../../../../src/…` would move its inferred rootDir to the repo root —
// `lib/index.js` would become `lib/functions/src/index.js` and the deploy would break.
// The projection IS the app code: CHECK 3.93 Δ3 proves it verbatim.
import { buildSearchDocument, SEARCH_ENTITY_TYPES } from '../indexBuilder';
import { normalizeSearchText, generateSearchPrefixes } from '../../generated/lib/search/search';
import { SEARCH_REQUIRED_PERMISSIONS } from '../../generated/config/search-index-core';

const TENANT = { companyId: 'comp_test' };

function indexed(entityType: Parameters<typeof buildSearchDocument>[0], data: Record<string, unknown>) {
  const doc = buildSearchDocument(entityType, 'e1', { ...TENANT, ...data });
  if (!doc) throw new Error('builder returned null');
  return doc;
}

describe('indexBuilder — parity with the query side (Ε-874.1)', () => {
  it('Ι1: a code segment is findable — «001» finds PRJ-001', () => {
    const doc = indexed(SEARCH_ENTITY_TYPES.PROJECT, { name: 'Πύργος', projectCode: 'PRJ-001' });
    const query = generateSearchPrefixes(normalizeSearchText('001'));
    expect(query.some((p) => doc.search.prefixes.includes(p))).toBe(true);
  });

  it('Ι2: final sigma folds the same on both sides — «νεος» finds «Νέος»', () => {
    const doc = indexed(SEARCH_ENTITY_TYPES.PROJECT, { name: 'Νέος' });
    const query = generateSearchPrefixes(normalizeSearchText('νεος'));
    expect(query.every((p) => doc.search.prefixes.includes(p))).toBe(true);
  });

  it('Ι3: the stored normalized text IS the app normalizer applied to the searchable fields', () => {
    const data = { displayName: 'Ζωή Κώστας-Café', email: 'zoe@example.com' };
    const doc = indexed(SEARCH_ENTITY_TYPES.CONTACT, data);
    expect(doc.search.normalized).toBe(normalizeSearchText('Ζωή Κώστας-Café zoe@example.com'));
    expect(doc.search.prefixes).toEqual(generateSearchPrefixes(doc.search.normalized));
  });
});

describe('indexBuilder — the rules are the app rules (Ε-873.1)', () => {
  it('Ι4: every entity type carries the permission declared by the app core (projected)', () => {
    for (const type of Object.values(SEARCH_ENTITY_TYPES)) {
      const doc = indexed(type, { name: 'x', title: 'x', number: 'x', displayName: 'x', subject: 'x' });
      expect(doc.requiredPermission).toBe(SEARCH_REQUIRED_PERMISSIONS[type]);
    }
  });

  it('Ι5: parking indexes its CODE, not the raw enum `type` (the 4bd107bd fix reaches production)', () => {
    const doc = indexed(SEARCH_ENTITY_TYPES.PARKING, { number: 'P-12', code: 'PK12', type: 'storage' });
    expect(doc.search.normalized).toBe(normalizeSearchText('P-12 PK12'));
  });

  it('Ι6: FLOOR href keeps its parent building from the source document', () => {
    const doc = indexed(SEARCH_ENTITY_TYPES.FLOOR, { name: 'Ισόγειο', buildingId: 'bldg_1' });
    expect(doc.links.href).toBe('/buildings?buildingId=bldg_1&floor=e1');
  });
});
