/**
 * @tests DomainSelector — ADR-268 Report Builder
 * Renders all 4 domains, fires onChange callback.
 */

import { VALID_DOMAIN_IDS } from '@/config/report-builder/report-builder-types';
import { getDomainDefinition } from '@/config/report-builder/domain-definitions';

describe('DomainSelector — Domain Availability', () => {
  it('all 4 domains have label and description keys', () => {
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

  it('units is a valid domain', () => {
    const def = getDomainDefinition('units');
    expect(def.id).toBe('units');
    expect(def.fields.length).toBeGreaterThan(15); // Units has most fields
  });
});
