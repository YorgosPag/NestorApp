/**
 * Contract tests for PHOTOS_TAB_CONFIGS — ADR-293 Phase 5 Batch 29.
 *
 * Validates that every entity tab exposes a canonical write+read contract
 * (canonicalEntityType, domain, category) that matches the FileRecord
 * pipeline and usePropertyMediaCounts / usePhotosTabFetch queries.
 */

import { PHOTOS_TAB_CONFIGS } from '../photos-tab-config';
import {
  ENTITY_TYPES,
  FILE_DOMAINS,
  FILE_CATEGORIES,
} from '@/config/domain-constants';

describe('PHOTOS_TAB_CONFIGS — canonical FileRecord contract', () => {
  it('every entity entry defines canonicalEntityType + domain + category', () => {
    for (const [key, config] of Object.entries(PHOTOS_TAB_CONFIGS)) {
      expect(config.canonicalEntityType).toBeTruthy();
      expect(config.domain).toBeTruthy();
      expect(config.category).toBe(FILE_CATEGORIES.PHOTOS);
      expect(Object.values(ENTITY_TYPES)).toContain(config.canonicalEntityType);
      expect(Object.values(FILE_DOMAINS)).toContain(config.domain);
    }
  });

  it('property photos tag sales/photos to match usePropertyMediaCounts', () => {
    const cfg = PHOTOS_TAB_CONFIGS.property;
    expect(cfg.canonicalEntityType).toBe(ENTITY_TYPES.PROPERTY);
    expect(cfg.domain).toBe(FILE_DOMAINS.SALES);
    expect(cfg.category).toBe(FILE_CATEGORIES.PHOTOS);
  });

  it('building photos tag sales/photos', () => {
    const cfg = PHOTOS_TAB_CONFIGS.building;
    expect(cfg.canonicalEntityType).toBe(ENTITY_TYPES.BUILDING);
    expect(cfg.domain).toBe(FILE_DOMAINS.SALES);
  });

  it('contact photos preserve legacy admin/photos tagging', () => {
    const cfg = PHOTOS_TAB_CONFIGS.contact;
    expect(cfg.canonicalEntityType).toBe(ENTITY_TYPES.CONTACT);
    expect(cfg.domain).toBe(FILE_DOMAINS.ADMIN);
  });

  it('floor photos tag construction domain', () => {
    const cfg = PHOTOS_TAB_CONFIGS.floor;
    expect(cfg.canonicalEntityType).toBe(ENTITY_TYPES.FLOOR);
    expect(cfg.domain).toBe(FILE_DOMAINS.CONSTRUCTION);
  });

  it('parking tab key "parking" maps to canonical ENTITY_TYPES.PARKING_SPOT', () => {
    const cfg = PHOTOS_TAB_CONFIGS.parking;
    expect(cfg.entityType).toBe('parking');
    expect(cfg.canonicalEntityType).toBe(ENTITY_TYPES.PARKING_SPOT);
    expect(cfg.domain).toBe(FILE_DOMAINS.SALES);
  });

  it('storage, project tabs expose canonical entity types', () => {
    expect(PHOTOS_TAB_CONFIGS.storage.canonicalEntityType).toBe(ENTITY_TYPES.STORAGE);
    expect(PHOTOS_TAB_CONFIGS.project.canonicalEntityType).toBe(ENTITY_TYPES.PROJECT);
  });
});
