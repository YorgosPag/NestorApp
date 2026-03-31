/**
 * @tests DomainSelector — ADR-268 Report Builder
 * Renders all domains, validates config integrity and accessibility requirements.
 */

import {
  VALID_DOMAIN_IDS,
  DOMAIN_GROUP_ORDER,
  isValidDomainId,
} from '@/config/report-builder/report-builder-types';
import { getDomainDefinition } from '@/config/report-builder/domain-definitions';

describe('DomainSelector — Domain Availability', () => {
  it('all domains have label and description keys', () => {
    for (const id of VALID_DOMAIN_IDS) {
      const def = getDomainDefinition(id);
      expect(def.labelKey).toBeTruthy();
      expect(def.descriptionKey).toBeTruthy();
    }
  });

  it('projects is a valid domain', () => {
    const def = getDomainDefinition('projects');
    expect(def.id).toBe('projects');
    expect(def.collection).toBe('projects');
  });

  it('buildings is a valid domain', () => {
    const def = getDomainDefinition('buildings');
    expect(def.id).toBe('buildings');
  });

  it('floors is a valid domain', () => {
    const def = getDomainDefinition('floors');
    expect(def.id).toBe('floors');
  });

  it('properties is a valid domain', () => {
    const def = getDomainDefinition('properties');
    expect(def.id).toBe('properties');
    expect(def.fields.length).toBeGreaterThan(15);
  });
});

describe('DomainSelector — Accessibility & Field Count Validation', () => {
  it('every domain has unique labelKey (no two domains share same label)', () => {
    const labelKeys = VALID_DOMAIN_IDS.map((id) => getDomainDefinition(id).labelKey);
    const unique = new Set(labelKeys);
    expect(unique.size).toBe(labelKeys.length);
  });

  it('every domain has unique descriptionKey', () => {
    const descKeys = VALID_DOMAIN_IDS.map((id) => getDomainDefinition(id).descriptionKey);
    const unique = new Set(descKeys);
    expect(unique.size).toBe(descKeys.length);
  });

  it('all domain groups referenced by domains exist in DOMAIN_GROUP_ORDER', () => {
    const usedGroups = new Set(
      VALID_DOMAIN_IDS.map((id) => getDomainDefinition(id).group),
    );
    for (const group of usedGroups) {
      expect(DOMAIN_GROUP_ORDER).toContain(group);
    }
  });

  it('every domain has at least 3 fields (minimum viable schema)', () => {
    for (const id of VALID_DOMAIN_IDS) {
      const def = getDomainDefinition(id);
      expect(def.fields.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('isValidDomainId rejects invalid strings', () => {
    expect(isValidDomainId('nonexistent')).toBe(false);
    expect(isValidDomainId('')).toBe(false);
    expect(isValidDomainId(null)).toBe(false);
    expect(isValidDomainId(123)).toBe(false);
  });

  it('isValidDomainId accepts all valid domain IDs', () => {
    for (const id of VALID_DOMAIN_IDS) {
      expect(isValidDomainId(id)).toBe(true);
    }
  });
});
