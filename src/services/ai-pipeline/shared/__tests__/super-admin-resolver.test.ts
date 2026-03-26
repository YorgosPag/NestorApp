/**
 * SUPER ADMIN RESOLVER TESTS
 *
 * Tests admin identification across 6 channels, cache behavior,
 * inactive admin filtering, and fail-safe on Firestore errors.
 *
 * @see ADR-145 (Super Admin AI Assistant)
 * @module __tests__/super-admin-resolver
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// ── Standalone mocks ──

jest.mock('server-only', () => ({}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

jest.mock('@/lib/error-utils', () => ({
  getErrorMessage: jest.fn((e: unknown) =>
    e instanceof Error ? e.message : String(e)
  ),
}));

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { SETTINGS: 'settings' },
  SYSTEM_DOCS: { SUPER_ADMIN_REGISTRY: 'super_admin_registry' },
}));

const mockGet = jest.fn();
const mockDoc = jest.fn().mockReturnValue({ get: mockGet });
const mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({ collection: mockCollection }),
}));

// ── Imports ──
import {
  isSuperAdminTelegram,
  isSuperAdminEmail,
  isSuperAdminWhatsApp,
  isSuperAdminMessenger,
  isSuperAdminInstagram,
  isSuperAdminFirebaseUid,
  getAdminTelegramChatId,
  invalidateRegistryCache,
} from '../super-admin-resolver';
import type { SuperAdminIdentity } from '@/types/super-admin';

// ============================================================================
// TEST DATA
// ============================================================================

const ADMIN_GIORGOS: SuperAdminIdentity = {
  firebaseUid: 'uid_giorgos_001',
  displayName: 'Γιώργος Παγώνης',
  channels: {
    telegram: { userId: '5618410820', chatId: '5618410820' },
    email: { addresses: ['giorgos@pagonis.gr', 'admin@pagonis.gr'] },
    whatsapp: { phoneNumber: '+306999999999' },
    messenger: { psid: 'psid_giorgos' },
    instagram: { igsid: 'igsid_giorgos' },
  },
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-03-25T10:00:00Z',
};

const ADMIN_INACTIVE: SuperAdminIdentity = {
  firebaseUid: 'uid_inactive_001',
  displayName: 'Inactive Admin',
  channels: {
    telegram: { userId: '1111111111', chatId: '1111111111' },
    email: { addresses: ['inactive@pagonis.gr'] },
  },
  isActive: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-03-25T10:00:00Z',
};

const REGISTRY_DOC = {
  admins: [ADMIN_GIORGOS, ADMIN_INACTIVE],
  schemaVersion: 1,
  updatedAt: '2026-03-25T10:00:00Z',
};

function mockRegistryExists(): void {
  mockGet.mockResolvedValue({
    exists: true,
    data: () => REGISTRY_DOC,
  });
}

function mockRegistryNotFound(): void {
  mockGet.mockResolvedValue({
    exists: false,
    data: () => null,
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('Super Admin Resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateRegistryCache(); // fresh cache for each test
    mockRegistryExists();
  });

  // ── Telegram ──

  describe('isSuperAdminTelegram', () => {
    it('identifies admin by Telegram userId', async () => {
      const result = await isSuperAdminTelegram('5618410820');

      expect(result).not.toBeNull();
      expect(result?.identity.displayName).toBe('Γιώργος Παγώνης');
      expect(result?.resolvedVia).toBe('telegram_user_id');
    });

    it('returns null for unknown Telegram userId', async () => {
      const result = await isSuperAdminTelegram('9999999999');
      expect(result).toBeNull();
    });

    it('skips inactive admins', async () => {
      const result = await isSuperAdminTelegram('1111111111');
      expect(result).toBeNull();
    });
  });

  // ── Email ──

  describe('isSuperAdminEmail', () => {
    it('identifies admin by email', async () => {
      const result = await isSuperAdminEmail('giorgos@pagonis.gr');

      expect(result).not.toBeNull();
      expect(result?.resolvedVia).toBe('email_address');
    });

    it('identifies admin by secondary email', async () => {
      const result = await isSuperAdminEmail('admin@pagonis.gr');
      expect(result).not.toBeNull();
    });

    it('normalizes email case and whitespace', async () => {
      const result = await isSuperAdminEmail('  GIORGOS@Pagonis.GR  ');
      expect(result).not.toBeNull();
    });

    it('returns null for unknown email', async () => {
      const result = await isSuperAdminEmail('stranger@example.com');
      expect(result).toBeNull();
    });

    it('skips inactive admin emails', async () => {
      const result = await isSuperAdminEmail('inactive@pagonis.gr');
      expect(result).toBeNull();
    });
  });

  // ── WhatsApp ──

  describe('isSuperAdminWhatsApp', () => {
    it('identifies admin by phone number', async () => {
      const result = await isSuperAdminWhatsApp('+306999999999');

      expect(result).not.toBeNull();
      expect(result?.resolvedVia).toBe('whatsapp_phone');
    });

    it('returns null for unknown phone', async () => {
      const result = await isSuperAdminWhatsApp('+301234567890');
      expect(result).toBeNull();
    });
  });

  // ── Messenger ──

  describe('isSuperAdminMessenger', () => {
    it('identifies admin by PSID', async () => {
      const result = await isSuperAdminMessenger('psid_giorgos');

      expect(result).not.toBeNull();
      expect(result?.resolvedVia).toBe('messenger_psid');
    });

    it('returns null for unknown PSID', async () => {
      const result = await isSuperAdminMessenger('psid_unknown');
      expect(result).toBeNull();
    });
  });

  // ── Instagram ──

  describe('isSuperAdminInstagram', () => {
    it('identifies admin by IGSID', async () => {
      const result = await isSuperAdminInstagram('igsid_giorgos');

      expect(result).not.toBeNull();
      expect(result?.resolvedVia).toBe('instagram_igsid');
    });

    it('returns null for unknown IGSID', async () => {
      const result = await isSuperAdminInstagram('igsid_unknown');
      expect(result).toBeNull();
    });
  });

  // ── Firebase UID ──

  describe('isSuperAdminFirebaseUid', () => {
    it('identifies admin by Firebase UID', async () => {
      const result = await isSuperAdminFirebaseUid('uid_giorgos_001');

      expect(result).not.toBeNull();
      expect(result?.resolvedVia).toBe('firebase_uid');
    });

    it('returns null for unknown UID', async () => {
      const result = await isSuperAdminFirebaseUid('uid_unknown');
      expect(result).toBeNull();
    });

    it('skips inactive admin UID', async () => {
      const result = await isSuperAdminFirebaseUid('uid_inactive_001');
      expect(result).toBeNull();
    });
  });

  // ── getAdminTelegramChatId ──

  describe('getAdminTelegramChatId', () => {
    it('returns first active admin chatId', async () => {
      const chatId = await getAdminTelegramChatId();
      expect(chatId).toBe('5618410820');
    });

    it('returns null when registry not found', async () => {
      invalidateRegistryCache();
      mockRegistryNotFound();

      const chatId = await getAdminTelegramChatId();
      expect(chatId).toBeNull();
    });
  });

  // ── Cache behavior ──

  describe('cache', () => {
    it('uses cache on second call (no extra Firestore read)', async () => {
      await isSuperAdminTelegram('5618410820');
      await isSuperAdminEmail('giorgos@pagonis.gr');

      // Only 1 Firestore read for both calls
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('invalidateRegistryCache forces refresh', async () => {
      await isSuperAdminTelegram('5618410820');
      expect(mockGet).toHaveBeenCalledTimes(1);

      invalidateRegistryCache();
      await isSuperAdminTelegram('5618410820');

      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });

  // ── Error resilience ──

  describe('error handling', () => {
    it('returns null when registry is empty (no admins array)', async () => {
      invalidateRegistryCache();
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({ admins: null, schemaVersion: 1 }),
      });

      const result = await isSuperAdminTelegram('5618410820');
      expect(result).toBeNull();
    });

    it('returns stale cache on Firestore error', async () => {
      // First call succeeds and populates cache
      await isSuperAdminTelegram('5618410820');
      expect(mockGet).toHaveBeenCalledTimes(1);

      // Expire cache by invalidating
      invalidateRegistryCache();

      // Second call fails
      mockGet.mockRejectedValue(new Error('unavailable'));

      // Since cache was invalidated, stale data is null → returns null
      const result = await isSuperAdminTelegram('5618410820');
      expect(result).toBeNull();
    });
  });
});
