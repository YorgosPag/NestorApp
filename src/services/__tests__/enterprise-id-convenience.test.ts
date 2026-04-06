import {
  generateCompanyId,
  generateProjectId,
  generateBuildingId,
  generateContactId,
  generateFloorId,
  generateWorkspaceId,
  generateTaskId,
  generateSessionId,
  generateErrorId,
  generatePhotoId,
  validateEnterpriseId,
  parseEnterpriseId,
  getIdType,
  isLegacyId,
  generateChatHistoryDocId,
  generateQueryStrategyDocId
} from '../enterprise-id-convenience';
import { ENTERPRISE_ID_PREFIXES } from '../enterprise-id-prefixes';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('enterprise-id-convenience', () => {
  // ===== CONVENIENCE GENERATORS =====
  describe('convenience generator functions', () => {
    const generators: [string, () => string, string][] = [
      ['generateCompanyId', generateCompanyId, ENTERPRISE_ID_PREFIXES.COMPANY],
      ['generateProjectId', generateProjectId, ENTERPRISE_ID_PREFIXES.PROJECT],
      ['generateBuildingId', generateBuildingId, ENTERPRISE_ID_PREFIXES.BUILDING],
      ['generateContactId', generateContactId, ENTERPRISE_ID_PREFIXES.CONTACT],
      ['generateFloorId', generateFloorId, ENTERPRISE_ID_PREFIXES.FLOOR],
      ['generateWorkspaceId', generateWorkspaceId, ENTERPRISE_ID_PREFIXES.WORKSPACE],
      ['generateTaskId', generateTaskId, ENTERPRISE_ID_PREFIXES.TASK],
      ['generateSessionId', generateSessionId, ENTERPRISE_ID_PREFIXES.SESSION],
      ['generateErrorId', generateErrorId, ENTERPRISE_ID_PREFIXES.ERROR],
      ['generatePhotoId', generatePhotoId, ENTERPRISE_ID_PREFIXES.PHOTO],
    ];

    it.each(generators)('%s returns string with correct prefix', (_name, fn, prefix) => {
      const id = fn();
      expect(typeof id).toBe('string');
      expect(id.startsWith(`${prefix}_`)).toBe(true);
    });

    it.each(generators)('%s contains valid UUID v4', (_name, fn, prefix) => {
      const id = fn();
      const uuid = id.substring(prefix.length + 1);
      expect(uuid).toMatch(UUID_V4_REGEX);
    });

    it('each call generates unique ID', () => {
      const id1 = generateCompanyId();
      const id2 = generateCompanyId();
      expect(id1).not.toBe(id2);
    });
  });

  // ===== VALIDATION DELEGATES =====
  describe('validateEnterpriseId', () => {
    it('returns true for valid ID', () => {
      const id = generateCompanyId();
      expect(validateEnterpriseId(id)).toBe(true);
    });

    it('returns false for invalid ID', () => {
      expect(validateEnterpriseId('not-valid')).toBe(false);
    });
  });

  describe('parseEnterpriseId', () => {
    it('parses valid ID', () => {
      const id = generateProjectId();
      const parsed = parseEnterpriseId(id);
      expect(parsed).not.toBeNull();
      expect(parsed!.prefix).toBe(ENTERPRISE_ID_PREFIXES.PROJECT);
    });

    it('returns null for invalid ID', () => {
      expect(parseEnterpriseId('random')).toBeNull();
    });
  });

  describe('getIdType', () => {
    it('returns prefix for valid ID', () => {
      const id = generateBuildingId();
      expect(getIdType(id)).toBe(ENTERPRISE_ID_PREFIXES.BUILDING);
    });

    it('returns null for invalid', () => {
      expect(getIdType('invalid')).toBeNull();
    });
  });

  describe('isLegacyId', () => {
    it('enterprise ID is not legacy', () => {
      expect(isLegacyId(generateCompanyId())).toBe(false);
    });

    it('random string is legacy', () => {
      expect(isLegacyId('old-id-123')).toBe(true);
    });
  });

  // ===== DETERMINISTIC COMPOSITES =====
  describe('deterministic composite keys', () => {
    it('generateChatHistoryDocId is deterministic', () => {
      const id1 = generateChatHistoryDocId('telegram', 'user1');
      const id2 = generateChatHistoryDocId('telegram', 'user1');
      expect(id1).toBe(id2);
    });

    it('generateChatHistoryDocId varies with params', () => {
      const id1 = generateChatHistoryDocId('telegram', 'user1');
      const id2 = generateChatHistoryDocId('email', 'user1');
      expect(id1).not.toBe(id2);
    });

    it('generateQueryStrategyDocId sorts filters', () => {
      const id1 = generateQueryStrategyDocId('contacts', ['z', 'a', 'm']);
      const id2 = generateQueryStrategyDocId('contacts', ['a', 'm', 'z']);
      expect(id1).toBe(id2);
    });

    it('generateQueryStrategyDocId varies with collection', () => {
      const id1 = generateQueryStrategyDocId('contacts', ['a']);
      const id2 = generateQueryStrategyDocId('projects', ['a']);
      expect(id1).not.toBe(id2);
    });
  });
});
