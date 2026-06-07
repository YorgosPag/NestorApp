/**
 * Tests for buildSearchResultHref + FLOOR deep-link route template.
 *
 * BUG #5: a floor search result must deep-link to its parent building AND
 * carry `?floor=<floorId>` so the building page can focus/highlight the floor.
 * The href builder must resolve both `{id}` (entity id) and `{buildingId}`
 * (from the source document) — mirroring the Cloud Functions `buildHref`.
 *
 * @see src/config/search-index-config.ts
 * @see functions/src/search/indexBuilder.ts (buildHref — parity target)
 * @see ADR-029 (Global Search System v1)
 */

import {
  SEARCH_INDEX_CONFIG,
  buildSearchResultHref,
} from '@/config/search-index-config';
import { SEARCH_ENTITY_TYPES } from '@/types/search';

describe('buildSearchResultHref', () => {
  it('resolves {id} for a simple entity template (building)', () => {
    const href = buildSearchResultHref(
      SEARCH_INDEX_CONFIG[SEARCH_ENTITY_TYPES.BUILDING],
      'bldg_123',
    );
    expect(href).toBe('/buildings/bldg_123');
  });

  it('resolves {id} for a property template', () => {
    const href = buildSearchResultHref(
      SEARCH_INDEX_CONFIG[SEARCH_ENTITY_TYPES.PROPERTY],
      'prop_456',
    );
    expect(href).toBe('/properties/prop_456');
  });

  describe('FLOOR deep-link (BUG #5)', () => {
    const floorConfig = SEARCH_INDEX_CONFIG[SEARCH_ENTITY_TYPES.FLOOR];

    it('uses the query form so the redirect does not drop ?floor=', () => {
      expect(floorConfig.routeTemplate).toBe(
        '/buildings?buildingId={buildingId}&floor={id}',
      );
    });

    it('resolves both {buildingId} (from data) and {id} (from entity id)', () => {
      const href = buildSearchResultHref(floorConfig, 'flr_789', {
        buildingId: 'bldg_123',
        name: '1ος Όροφος',
      });
      expect(href).toBe('/buildings?buildingId=bldg_123&floor=flr_789');
    });

    it('falls back to the entity id when buildingId is missing from data', () => {
      // Defensive: never emit a literal "{buildingId}" placeholder in the href.
      const href = buildSearchResultHref(floorConfig, 'flr_789');
      expect(href).not.toContain('{buildingId}');
      expect(href).toBe('/buildings?buildingId=flr_789&floor=flr_789');
    });
  });
});
