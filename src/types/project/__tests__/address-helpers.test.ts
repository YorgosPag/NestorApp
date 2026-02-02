/**
 * 🏢 ENTERPRISE: Unit Tests για Address Helpers (ADR-167)
 * Tests για migrateLegacyAddress, createProjectAddress, resolveBuildingAddresses, resolveBuildingPrimaryAddress
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  getPrimaryAddress,
  formatAddressLine,
  createProjectAddress,
  migrateLegacyAddress,
  resolveBuildingAddresses,
  getBuildingPrimaryAddress,
  resolveBuildingPrimaryAddress,
} from '../address-helpers';
import type { ProjectAddress, BuildingAddressReference } from '../addresses';

describe('Address Helpers (ADR-167)', () => {
  describe('getPrimaryAddress', () => {
    it('should return primary address from array', () => {
      const addresses: ProjectAddress[] = [
        {
          id: 'addr_1',
          street: 'Street 1',
          city: 'City',
          postalCode: '12345',
          country: 'GR',
          type: 'site',
          isPrimary: false,
        },
        {
          id: 'addr_2',
          street: 'Street 2',
          city: 'City',
          postalCode: '12345',
          country: 'GR',
          type: 'entrance',
          isPrimary: true,
        },
      ];

      const primary = getPrimaryAddress(addresses);
      expect(primary?.id).toBe('addr_2');
      expect(primary?.isPrimary).toBe(true);
    });

    it('should return undefined for empty array', () => {
      expect(getPrimaryAddress([])).toBeUndefined();
    });

    it('should return undefined when no addresses provided', () => {
      expect(getPrimaryAddress(undefined)).toBeUndefined();
    });
  });

  describe('formatAddressLine', () => {
    it('should format address with all fields', () => {
      const address: ProjectAddress = {
        id: 'addr_1',
        street: 'Σαμοθράκης',
        number: '16',
        city: 'Θεσσαλονίκη',
        postalCode: '54636',
        country: 'GR',
        type: 'site',
        isPrimary: true,
      };

      const formatted = formatAddressLine(address);
      expect(formatted).toBe('Σαμοθράκης 16, Θεσσαλονίκη 54636');
    });

    it('should format address without number', () => {
      const address: ProjectAddress = {
        id: 'addr_1',
        street: 'Σαμοθράκης',
        city: 'Θεσσαλονίκη',
        postalCode: '54636',
        country: 'GR',
        type: 'site',
        isPrimary: true,
      };

      const formatted = formatAddressLine(address);
      expect(formatted).toBe('Σαμοθράκης, Θεσσαλονίκη 54636');
    });

    it('should format address without postal code', () => {
      const address: ProjectAddress = {
        id: 'addr_1',
        street: 'Σαμοθράκης',
        number: '16',
        city: 'Θεσσαλονίκη',
        postalCode: '',
        country: 'GR',
        type: 'site',
        isPrimary: true,
      };

      const formatted = formatAddressLine(address);
      expect(formatted).toBe('Σαμοθράκης 16, Θεσσαλονίκη');
    });
  });

  describe('createProjectAddress', () => {
    it('should create address with defaults from config', () => {
      const address = createProjectAddress({
        id: 'test_id',
        street: 'Test Street',
        city: 'Test City',
        postalCode: '12345',
        country: 'GR',
      });

      expect(address.id).toBe('test_id');
      expect(address.street).toBe('Test Street');
      expect(address.type).toBe('site'); // Default from config
      expect(address.isPrimary).toBe(false); // Default from config
      expect(address.sortOrder).toBe(0); // Default from config
    });

    it('should allow overriding defaults', () => {
      const address = createProjectAddress({
        id: 'test_id',
        street: 'Test Street',
        city: 'Test City',
        postalCode: '12345',
        country: 'GR',
        type: 'entrance',
        isPrimary: true,
        sortOrder: 10,
      });

      expect(address.type).toBe('entrance');
      expect(address.isPrimary).toBe(true);
      expect(address.sortOrder).toBe(10);
    });
  });

  describe('migrateLegacyAddress', () => {
    it('should migrate legacy address to new format', () => {
      const legacy = {
        id: 'legacy_proj',
        address: 'Λεωφ. Κηφισίας 100',
        city: 'Αθήνα',
      };

      const addresses = migrateLegacyAddress(legacy);

      expect(addresses).toHaveLength(1);
      expect(addresses[0].street).toBe('Λεωφ. Κηφισίας 100');
      expect(addresses[0].city).toBe('Αθήνα');
      expect(addresses[0].type).toBe('site');
      expect(addresses[0].isPrimary).toBe(true); // Legacy addresses are always primary
      expect(addresses[0].postalCode).toBe(''); // Empty for legacy
      expect(addresses[0].country).toBe('Ελλάδα'); // From geographic config
    });

    it('should return empty array for empty legacy data', () => {
      expect(migrateLegacyAddress({})).toEqual([]);
      expect(migrateLegacyAddress({ address: '', city: '' })).toEqual([]);
    });

    it('should generate enterprise ID (not Date.now())', () => {
      const legacy = {
        address: 'Test Street',
        city: 'Test City',
      };

      const addresses = migrateLegacyAddress(legacy);
      expect(addresses[0].id).toMatch(/^proj_[a-f0-9-]{36}$/); // UUID format
      expect(addresses[0].id).not.toMatch(/^addr_\d+$/); // NOT Date.now()
    });
  });

  describe('resolveBuildingAddresses', () => {
    const projectAddresses: ProjectAddress[] = [
      {
        id: 'addr_1',
        street: 'Σαμοθράκης',
        number: '16',
        city: 'Θεσσαλονίκη',
        postalCode: '54636',
        country: 'GR',
        type: 'site',
        isPrimary: true,
      },
      {
        id: 'addr_2',
        street: 'Καλαμαριάς',
        number: '23',
        city: 'Θεσσαλονίκη',
        postalCode: '54636',
        country: 'GR',
        type: 'entrance',
        isPrimary: false,
      },
    ];

    it('should resolve addresses from references', () => {
      const configs: BuildingAddressReference[] = [
        {
          inheritFromProject: true,
          projectAddressId: 'addr_1',
        },
        {
          inheritFromProject: true,
          projectAddressId: 'addr_2',
        },
      ];

      const resolved = resolveBuildingAddresses(configs, projectAddresses);

      expect(resolved).toHaveLength(2);
      expect(resolved[0].id).toBe('addr_1');
      expect(resolved[1].id).toBe('addr_2');
    });

    it('should apply overrides to resolved addresses', () => {
      const configs: BuildingAddressReference[] = [
        {
          inheritFromProject: true,
          projectAddressId: 'addr_1',
          override: {
            label: 'Custom Label',
          },
        },
      ];

      const resolved = resolveBuildingAddresses(configs, projectAddresses);

      expect(resolved[0].label).toBe('Custom Label');
      expect(resolved[0].street).toBe('Σαμοθράκης'); // Original value
    });

    it('should return all project addresses when no configs', () => {
      const resolved = resolveBuildingAddresses(undefined, projectAddresses);
      expect(resolved).toEqual(projectAddresses);
    });

    it('should skip invalid references', () => {
      const configs: BuildingAddressReference[] = [
        {
          inheritFromProject: true,
          projectAddressId: 'addr_999', // Invalid ID
        },
      ];

      const resolved = resolveBuildingAddresses(configs, projectAddresses);
      expect(resolved).toHaveLength(0); // Skipped invalid reference
    });
  });

  describe('getBuildingPrimaryAddress', () => {
    const projectAddresses: ProjectAddress[] = [
      {
        id: 'addr_1',
        street: 'Street 1',
        city: 'City',
        postalCode: '12345',
        country: 'GR',
        type: 'site',
        isPrimary: true,
      },
      {
        id: 'addr_2',
        street: 'Street 2',
        city: 'City',
        postalCode: '12345',
        country: 'GR',
        type: 'entrance',
        isPrimary: false,
      },
    ];

    it('should return primary address from resolved addresses', () => {
      const configs: BuildingAddressReference[] = [
        { inheritFromProject: true, projectAddressId: 'addr_1' },
        { inheritFromProject: true, projectAddressId: 'addr_2' },
      ];

      const primary = getBuildingPrimaryAddress(configs, projectAddresses);
      expect(primary?.id).toBe('addr_1');
      expect(primary?.isPrimary).toBe(true);
    });

    it('should return first address if no primary', () => {
      const configs: BuildingAddressReference[] = [
        { inheritFromProject: true, projectAddressId: 'addr_2' },
      ];

      const primary = getBuildingPrimaryAddress(configs, projectAddresses);
      expect(primary?.id).toBe('addr_2'); // First (and only) resolved
    });
  });

  describe('resolveBuildingPrimaryAddress', () => {
    const projectAddresses: ProjectAddress[] = [
      {
        id: 'addr_1',
        street: 'Primary Street',
        city: 'City',
        postalCode: '12345',
        country: 'GR',
        type: 'site',
        isPrimary: true,
      },
      {
        id: 'addr_2',
        street: 'Secondary Street',
        city: 'City',
        postalCode: '12345',
        country: 'GR',
        type: 'entrance',
        isPrimary: false,
      },
    ];

    it('should resolve primary address by ID', () => {
      const primary = resolveBuildingPrimaryAddress(
        'addr_1',
        undefined,
        projectAddresses
      );

      expect(primary?.id).toBe('addr_1');
      expect(primary?.street).toBe('Primary Street');
    });

    it('should apply overrides when configs exist', () => {
      const configs: BuildingAddressReference[] = [
        {
          inheritFromProject: true,
          projectAddressId: 'addr_1',
          override: {
            label: 'Building A Main Entrance',
          },
        },
      ];

      const primary = resolveBuildingPrimaryAddress(
        'addr_1',
        configs,
        projectAddresses
      );

      expect(primary?.label).toBe('Building A Main Entrance');
    });

    it('should fallback to legacy behavior when no primaryProjectAddressId', () => {
      const configs: BuildingAddressReference[] = [
        { inheritFromProject: true, projectAddressId: 'addr_1' },
      ];

      const primary = resolveBuildingPrimaryAddress(
        undefined,
        configs,
        projectAddresses
      );

      expect(primary?.id).toBe('addr_1'); // First config
    });

    it('should warn and fallback when invalid primaryProjectAddressId', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const primary = resolveBuildingPrimaryAddress(
        'addr_999',
        undefined,
        projectAddresses
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('addr_999')
      );
      expect(primary?.id).toBe('addr_1'); // Fallback to first primary

      consoleSpy.mockRestore();
    });

    it('should return undefined when no project addresses', () => {
      const primary = resolveBuildingPrimaryAddress('addr_1', undefined, []);
      expect(primary).toBeUndefined();
    });
  });
});
