import { EnterpriseIdService } from '../enterprise-id.service';
import { ENTERPRISE_ID_PREFIXES } from '../enterprise-id-prefixes';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('EnterpriseIdService', () => {
  let service: EnterpriseIdService;

  beforeEach(() => {
    service = new EnterpriseIdService({ enableLogging: false, enableCache: true, cacheSize: 100 });
  });

  // ===== ID GENERATION =====
  describe('ID generation', () => {
    it('generateCompanyId returns string with comp_ prefix', () => {
      const id = service.generateCompanyId();
      expect(id).toMatch(/^comp_/);
    });

    it('generateProjectId returns string with proj_ prefix', () => {
      const id = service.generateProjectId();
      expect(id).toMatch(/^proj_/);
    });

    it('generateBuildingId returns string with bldg_ prefix', () => {
      const id = service.generateBuildingId();
      expect(id).toMatch(/^bldg_/);
    });

    it('generated ID contains valid UUID v4', () => {
      const id = service.generateCompanyId();
      const uuid = id.replace(/^comp_/, '');
      expect(uuid).toMatch(UUID_V4_REGEX);
    });

    it('generateFloorplanBackgroundId returns string with rbg_ prefix (ADR-340)', () => {
      const id = service.generateFloorplanBackgroundId();
      expect(id).toMatch(/^rbg_/);
      const uuid = id.replace(/^rbg_/, '');
      expect(uuid).toMatch(UUID_V4_REGEX);
    });

    it('sample of entity types have correct prefixes', () => {
      const tests: [string, string][] = [
        [service.generateContactId(), ENTERPRISE_ID_PREFIXES.CONTACT],
        [service.generateFloorId(), ENTERPRISE_ID_PREFIXES.FLOOR],
        [service.generateWorkspaceId(), ENTERPRISE_ID_PREFIXES.WORKSPACE],
        [service.generateTaskId(), ENTERPRISE_ID_PREFIXES.TASK],
        [service.generateSessionId(), ENTERPRISE_ID_PREFIXES.SESSION],
        [service.generateErrorId(), ENTERPRISE_ID_PREFIXES.ERROR],
        [service.generateFloorplanBackgroundId(), ENTERPRISE_ID_PREFIXES.RASTER_BACKGROUND],
      ];

      for (const [id, expectedPrefix] of tests) {
        expect(id.startsWith(`${expectedPrefix}_`)).toBe(true);
      }
    });
  });

  // ===== UNIQUENESS =====
  describe('uniqueness', () => {
    it('100 generated IDs are all unique', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(service.generateCompanyId());
      }
      expect(ids.size).toBe(100);
    });

    it('IDs from different generators are unique', () => {
      const ids = new Set([
        service.generateCompanyId(),
        service.generateProjectId(),
        service.generateBuildingId(),
        service.generateContactId(),
        service.generateTaskId()
      ]);
      expect(ids.size).toBe(5);
    });
  });

  // ===== DETERMINISTIC COMPOSITES =====
  describe('deterministic composite keys', () => {
    it('generateAiUsageDocId is deterministic', () => {
      const id1 = service.generateAiUsageDocId('telegram', 'user123', '2026-04');
      const id2 = service.generateAiUsageDocId('telegram', 'user123', '2026-04');
      expect(id1).toBe(id2);
    });

    it('generateAiUsageDocId varies with params', () => {
      const id1 = service.generateAiUsageDocId('telegram', 'user123', '2026-04');
      const id2 = service.generateAiUsageDocId('telegram', 'user456', '2026-04');
      expect(id1).not.toBe(id2);
    });

    it('generateQueryStrategyDocId sorts filters', () => {
      const id1 = service.generateQueryStrategyDocId('contacts', ['status', 'name']);
      const id2 = service.generateQueryStrategyDocId('contacts', ['name', 'status']);
      expect(id1).toBe(id2);
    });

    it('generateChatHistoryDocId is deterministic', () => {
      const id1 = service.generateChatHistoryDocId('telegram', '12345');
      const id2 = service.generateChatHistoryDocId('telegram', '12345');
      expect(id1).toBe(id2);
    });
  });

  // ===== VALIDATION =====
  describe('validateId', () => {
    it('returns true for valid enterprise ID', () => {
      const id = service.generateCompanyId();
      expect(service.validateId(id)).toBe(true);
    });

    it('returns false for random string', () => {
      expect(service.validateId('random-string-here')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(service.validateId('')).toBe(false);
    });

    it('returns false for missing prefix', () => {
      expect(service.validateId('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
    });
  });

  // ===== PARSING =====
  describe('parseId', () => {
    it('parses valid ID into components', () => {
      const id = service.generateCompanyId();
      const parsed = service.parseId(id);

      expect(parsed).not.toBeNull();
      expect(parsed!.prefix).toBe(ENTERPRISE_ID_PREFIXES.COMPANY);
      expect(parsed!.uuid).toMatch(UUID_V4_REGEX);
    });

    it('returns null for invalid ID', () => {
      expect(service.parseId('invalid')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(service.parseId('')).toBeNull();
    });
  });

  // ===== getIdType =====
  describe('getIdType', () => {
    it('returns prefix for valid ID', () => {
      const id = service.generateProjectId();
      expect(service.getIdType(id)).toBe(ENTERPRISE_ID_PREFIXES.PROJECT);
    });

    it('returns null for invalid ID', () => {
      expect(service.getIdType('not-an-id')).toBeNull();
    });
  });

  // ===== isLegacyId =====
  describe('isLegacyId', () => {
    it('enterprise ID is not legacy', () => {
      const id = service.generateCompanyId();
      expect(service.isLegacyId(id)).toBe(false);
    });

    it('random string is legacy', () => {
      expect(service.isLegacyId('old-format-id-12345')).toBe(true);
    });

    it('Date.now() style is legacy', () => {
      expect(service.isLegacyId('1700000000000')).toBe(true);
    });
  });

  // ===== STATS & CACHE =====
  describe('stats and cache', () => {
    it('getStats returns counters', () => {
      service.generateCompanyId();
      service.generateProjectId();
      const stats = service.getStats();

      expect(stats.totalGenerated).toBeGreaterThanOrEqual(2);
      expect(stats.config).toBeDefined();
    });

    it('clearCaches resets state', () => {
      service.generateCompanyId();
      service.clearCaches();
      const stats = service.getStats();
      expect(stats.cacheSize).toBe(0);
    });
  });
});
