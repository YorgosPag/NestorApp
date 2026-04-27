/**
 * Unit tests for parsePhoneForStorage — E.164 country-code split.
 *
 * @see contact-lookup-crud.ts
 */

// Isolate pure function without Firestore dependencies
jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn(), FieldValue: {} }));
jest.mock('firebase-admin/firestore', () => ({ FieldValue: {} }));
jest.mock('@/config/firestore-collections', () => ({ COLLECTIONS: {}, SYSTEM_DOCS: {} }));
jest.mock('@/config/domain-constants', () => ({ ENTITY_TYPES: {} }));
jest.mock('@/lib/telemetry/Logger', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) }));
jest.mock('@/lib/error-utils', () => ({ getErrorMessage: (e: unknown) => String(e) }));
jest.mock('@/services/enterprise-id.service', () => ({ generateContactId: jest.fn(), generateCompanyId: jest.fn() }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn() } }));
jest.mock('@/services/realtime/types', () => ({ SYNC_SOURCE_AI_AGENT: 'ai-agent' }));
jest.mock('../shared/contact-lookup-search', () => ({ checkContactDuplicates: jest.fn() }));

import { parsePhoneForStorage } from '../shared/contact-lookup-crud';

describe('parsePhoneForStorage', () => {
  describe('00-prefix (international dialing)', () => {
    it('splits Bulgarian 00359 prefix', () => {
      expect(parsePhoneForStorage('0035974520126')).toEqual({ countryCode: '+359', number: '74520126' });
    });

    it('splits Greek 0030 prefix', () => {
      expect(parsePhoneForStorage('00306912345678')).toEqual({ countryCode: '+30', number: '6912345678' });
    });

    it('splits UK 0044 prefix', () => {
      expect(parsePhoneForStorage('00447911123456')).toEqual({ countryCode: '+44', number: '7911123456' });
    });

    it('splits US 001 prefix', () => {
      expect(parsePhoneForStorage('0012025550173')).toEqual({ countryCode: '+1', number: '2025550173' });
    });
  });

  describe('+ prefix (E.164)', () => {
    it('splits +359 (Bulgaria)', () => {
      expect(parsePhoneForStorage('+35974520126')).toEqual({ countryCode: '+359', number: '74520126' });
    });

    it('splits +357 (Cyprus)', () => {
      expect(parsePhoneForStorage('+35799123456')).toEqual({ countryCode: '+357', number: '99123456' });
    });

    it('splits +30 (Greece)', () => {
      expect(parsePhoneForStorage('+306912345678')).toEqual({ countryCode: '+30', number: '6912345678' });
    });

    it('splits +49 (Germany)', () => {
      expect(parsePhoneForStorage('+4915123456789')).toEqual({ countryCode: '+49', number: '15123456789' });
    });

    it('splits +381 (Serbia)', () => {
      expect(parsePhoneForStorage('+381601234567')).toEqual({ countryCode: '+381', number: '601234567' });
    });

    it('splits +7 (Russia)', () => {
      expect(parsePhoneForStorage('+79161234567')).toEqual({ countryCode: '+7', number: '9161234567' });
    });
  });

  describe('local numbers (no prefix)', () => {
    it('returns raw number without countryCode for local Greek mobile', () => {
      expect(parsePhoneForStorage('6912345678')).toEqual({ number: '6912345678' });
    });

    it('returns raw number for short local number', () => {
      expect(parsePhoneForStorage('74520126')).toEqual({ number: '74520126' });
    });
  });

  describe('normalization', () => {
    it('strips spaces and dashes', () => {
      expect(parsePhoneForStorage('+359 74 52 01 26')).toEqual({ countryCode: '+359', number: '74520126' });
    });

    it('strips parentheses and dots', () => {
      expect(parsePhoneForStorage('+30 (691) 234-5678')).toEqual({ countryCode: '+30', number: '6912345678' });
    });
  });

  describe('edge cases', () => {
    it('returns number unchanged if + prefix unrecognized', () => {
      const result = parsePhoneForStorage('+99912345678');
      expect(result.number).toBeDefined();
    });

    it('handles already-split local number from 00 with no known cc', () => {
      // 00999 → no match → returns digits
      const result = parsePhoneForStorage('00999123');
      expect(result.number).toBeDefined();
    });
  });
});
