/**
 * 🏢 ENTERPRISE: Unit Tests για Address Schemas (ADR-167)
 * Tests για Zod invariants: exactly-one primary, unique IDs, no duplicates
 */

/* global describe, it, expect */
import {
  projectAddressSchema,
  projectAddressCreateSchema,
  projectAddressesSchema,
  buildingAddressReferenceSchema,
  buildingAddressConfigsSchema,
  buildingBaseSchema,
} from '../schemas';

describe('Address Schemas - Zod Invariants (ADR-167)', () => {
  describe('projectAddressSchema (persisted)', () => {
    it('should allow empty strings for migration compatibility', () => {
      const validAddress = {
        id: 'addr_1',
        street: '', // Empty allowed for migration
        city: '', // Empty allowed for migration
        postalCode: '', // Empty allowed for migration
        country: '', // Empty allowed for migration
        type: 'site',
        isPrimary: true,
      };

      const result = projectAddressSchema.safeParse(validAddress);
      expect(result.success).toBe(true);
    });

    it('should validate required fields are present', () => {
      const invalidAddress = {
        id: 'addr_1',
        // Missing street, city, postalCode, country
        type: 'site',
        isPrimary: true,
      };

      const result = projectAddressSchema.safeParse(invalidAddress);
      expect(result.success).toBe(false);
    });

    it('should validate address type enum', () => {
      const invalidType = {
        id: 'addr_1',
        street: 'Street',
        city: 'City',
        postalCode: '12345',
        country: 'GR',
        type: 'invalid_type',
        isPrimary: true,
      };

      const result = projectAddressSchema.safeParse(invalidType);
      expect(result.success).toBe(false);
    });
  });

  describe('projectAddressCreateSchema (strict)', () => {
    it('should reject empty strings in required fields', () => {
      const invalidAddress = {
        id: 'addr_1',
        street: '', // Empty NOT allowed in create
        city: 'City',
        postalCode: '12345',
        country: 'GR',
        type: 'site',
        isPrimary: true,
      };

      const result = projectAddressCreateSchema.safeParse(invalidAddress);
      expect(result.success).toBe(false);
    });

    it('should accept valid non-empty strings', () => {
      const validAddress = {
        id: 'addr_1',
        street: 'Σαμοθράκης',
        city: 'Θεσσαλονίκη',
        postalCode: '54636',
        country: 'Ελλάδα',
        type: 'site',
        isPrimary: true,
      };

      const result = projectAddressCreateSchema.safeParse(validAddress);
      expect(result.success).toBe(true);
    });
  });

  describe('projectAddressesSchema - Exactly ONE isPrimary=true', () => {
    it('should accept exactly one primary address', () => {
      const addresses = [
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

      const result = projectAddressesSchema.safeParse(addresses);
      expect(result.success).toBe(true);
    });

    it('should reject zero primary addresses', () => {
      const addresses = [
        {
          id: 'addr_1',
          street: 'Street 1',
          city: 'City',
          postalCode: '12345',
          country: 'GR',
          type: 'site',
          isPrimary: false, // NO primary!
        },
        {
          id: 'addr_2',
          street: 'Street 2',
          city: 'City',
          postalCode: '12345',
          country: 'GR',
          type: 'entrance',
          isPrimary: false, // NO primary!
        },
      ];

      const result = projectAddressesSchema.safeParse(addresses);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Exactly one address must be marked as primary');
      }
    });

    it('should reject multiple primary addresses', () => {
      const addresses = [
        {
          id: 'addr_1',
          street: 'Street 1',
          city: 'City',
          postalCode: '12345',
          country: 'GR',
          type: 'site',
          isPrimary: true, // Primary
        },
        {
          id: 'addr_2',
          street: 'Street 2',
          city: 'City',
          postalCode: '12345',
          country: 'GR',
          type: 'entrance',
          isPrimary: true, // ALSO primary (INVALID!)
        },
      ];

      const result = projectAddressesSchema.safeParse(addresses);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Exactly one address must be marked as primary');
      }
    });
  });

  describe('projectAddressesSchema - Unique IDs', () => {
    it('should accept unique IDs', () => {
      const addresses = [
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
          id: 'addr_2', // Different ID
          street: 'Street 2',
          city: 'City',
          postalCode: '12345',
          country: 'GR',
          type: 'entrance',
          isPrimary: false,
        },
      ];

      const result = projectAddressesSchema.safeParse(addresses);
      expect(result.success).toBe(true);
    });

    it('should reject duplicate IDs', () => {
      const addresses = [
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
          id: 'addr_1', // DUPLICATE ID (INVALID!)
          street: 'Street 2',
          city: 'City',
          postalCode: '12345',
          country: 'GR',
          type: 'entrance',
          isPrimary: false,
        },
      ];

      const result = projectAddressesSchema.safeParse(addresses);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Address IDs must be unique');
      }
    });
  });

  describe('buildingAddressReferenceSchema - Invariants', () => {
    it('should require projectAddressId when inheritFromProject=true', () => {
      const invalidConfig = {
        inheritFromProject: true,
        // Missing projectAddressId (INVALID!)
      };

      const result = buildingAddressReferenceSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('projectAddressId is required');
      }
    });

    it('should allow projectAddressId to be optional when inheritFromProject=false', () => {
      const validConfig = {
        inheritFromProject: false,
        // No projectAddressId needed
      };

      const result = buildingAddressReferenceSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should accept valid inheritance config', () => {
      const validConfig = {
        inheritFromProject: true,
        projectAddressId: 'addr_1',
        override: {
          label: 'Custom Label',
        },
      };

      const result = buildingAddressReferenceSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });
  });

  describe('buildingAddressConfigsSchema - No Duplicate References', () => {
    it('should accept unique projectAddressId references', () => {
      const configs = [
        {
          inheritFromProject: true,
          projectAddressId: 'addr_1',
        },
        {
          inheritFromProject: true,
          projectAddressId: 'addr_2', // Different ID
        },
      ];

      const result = buildingAddressConfigsSchema.safeParse(configs);
      expect(result.success).toBe(true);
    });

    it('should reject duplicate projectAddressId references', () => {
      const configs = [
        {
          inheritFromProject: true,
          projectAddressId: 'addr_1',
        },
        {
          inheritFromProject: true,
          projectAddressId: 'addr_1', // DUPLICATE (INVALID!)
        },
      ];

      const result = buildingAddressConfigsSchema.safeParse(configs);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Duplicate address references are not allowed');
      }
    });

    it('should allow same projectAddressId if inheritFromProject=false', () => {
      const configs = [
        {
          inheritFromProject: true,
          projectAddressId: 'addr_1',
        },
        {
          inheritFromProject: false,
          projectAddressId: 'addr_1', // Same ID but NOT inheriting (OK)
        },
      ];

      const result = buildingAddressConfigsSchema.safeParse(configs);
      expect(result.success).toBe(true);
    });
  });

  describe('buildingBaseSchema - primaryProjectAddressId Invariant', () => {
    it('should reject primaryProjectAddressId without addressConfigs', () => {
      const invalidBuilding = {
        name: 'Building A',
        address: 'Legacy Address',
        category: 'residential',
        status: 'active',
        primaryProjectAddressId: 'addr_1',
        // Missing addressConfigs (INVALID!)
      };

      const result = buildingBaseSchema.safeParse(invalidBuilding);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('primaryProjectAddressId requires addressConfigs');
      }
    });

    it('should accept primaryProjectAddressId with addressConfigs', () => {
      const validBuilding = {
        name: 'Building A',
        address: 'Legacy Address',
        category: 'residential',
        status: 'active',
        primaryProjectAddressId: 'addr_1',
        addressConfigs: [
          {
            inheritFromProject: true,
            projectAddressId: 'addr_1',
          },
        ],
      };

      const result = buildingBaseSchema.safeParse(validBuilding);
      expect(result.success).toBe(true);
    });

    it('should allow building without primaryProjectAddressId', () => {
      const validBuilding = {
        name: 'Building A',
        address: 'Legacy Address',
        category: 'residential',
        status: 'active',
        // No primaryProjectAddressId (OK)
      };

      const result = buildingBaseSchema.safeParse(validBuilding);
      expect(result.success).toBe(true);
    });
  });
});
