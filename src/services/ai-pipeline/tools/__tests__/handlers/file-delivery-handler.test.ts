/**
 * FILE DELIVERY HANDLER TESTS
 *
 * Tests deliver_file_to_chat: customer RBAC, admin bypass, Firestore fetch.
 * Extracted from customer-handler.test.ts (SRP / N.7.1).
 *
 * @see SPEC-257F (File Delivery)
 */

import '../setup';

import { FileDeliveryHandler } from '../../handlers/file-delivery-handler';
import { createCustomerContext, createAdminContext } from '../test-utils/context-factory';
import { createMockFirestore } from '../test-utils/mock-firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: {
    PROPERTIES: 'properties',
    FILES: 'files',
    FLOORPLANS: 'floorplans',
  },
}));

jest.mock('@/services/ai-pipeline/shared/channel-reply-dispatcher', () => ({
  sendChannelMediaReply: jest.fn(async () => ({ success: true })),
}));

// ============================================================================
// HELPERS
// ============================================================================

function setupFirestore(collections: Record<string, Record<string, Record<string, unknown>>>) {
  const kit = createMockFirestore();
  for (const [name, docs] of Object.entries(collections)) {
    kit.seedCollection(name, docs);
  }
  (getAdminFirestore as jest.Mock).mockReturnValue(kit.instance);
  return kit;
}

function customerCtx(overrides?: Partial<Parameters<typeof createCustomerContext>[0]>) {
  return createCustomerContext({ ...overrides });
}

function adminCtx() {
  return createAdminContext();
}

// ============================================================================
// TESTS
// ============================================================================

describe('FileDeliveryHandler', () => {
  let handler: FileDeliveryHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new FileDeliveryHandler();
  });

  // ==========================================================================
  // Validation (shared admin + customer)
  // ==========================================================================

  describe('validation', () => {
    it('should reject invalid sourceType', async () => {
      const result = await handler.execute(
        'deliver_file_to_chat',
        { sourceType: 'invalid', sourceId: 'u1' },
        customerCtx(),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('sourceType');
    });

    it('should reject empty sourceId', async () => {
      const result = await handler.execute(
        'deliver_file_to_chat',
        { sourceType: 'unit_photo', sourceId: '' },
        customerCtx(),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('sourceId');
    });
  });

  // ==========================================================================
  // Customer path (RBAC)
  // ==========================================================================

  describe('customer path', () => {
    it('should reject when no contactMeta', async () => {
      const result = await handler.execute(
        'deliver_file_to_chat',
        { sourceType: 'unit_photo', sourceId: 'u1' },
        customerCtx({ contactMeta: null }),
      );
      expect(result.success).toBe(false);
    });

    it('should reject unit_photo when unit not in linkedUnitIds', async () => {
      setupFirestore({
        properties: { unit_999: { photoURL: 'https://example.com/photo.jpg' } },
      });

      const result = await handler.execute(
        'deliver_file_to_chat',
        { sourceType: 'unit_photo', sourceId: 'unit_999' },
        customerCtx(),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('πρόσβαση');
    });

    it('should deliver unit photos successfully', async () => {
      setupFirestore({
        properties: {
          unit_001: {
            photoURL: 'https://example.com/main.jpg',
            multiplePhotoURLs: ['https://example.com/extra.jpg'],
          },
        },
      });

      const result = await handler.execute(
        'deliver_file_to_chat',
        { sourceType: 'unit_photo', sourceId: 'unit_001' },
        customerCtx(),
      );

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>)?.sentCount).toBe(2);
      expect((result.data as Record<string, unknown>)?.totalFiles).toBe(2);
    });

    it('should fail when unit has no photos', async () => {
      setupFirestore({
        properties: { unit_001: {} },
      });

      const result = await handler.execute(
        'deliver_file_to_chat',
        { sourceType: 'unit_photo', sourceId: 'unit_001' },
        customerCtx(),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('φωτογραφίες');
    });
  });

  // ==========================================================================
  // Admin path (bypass RBAC)
  // ==========================================================================

  describe('admin path', () => {
    it('should deliver unit_photo without contactMeta', async () => {
      setupFirestore({
        properties: {
          unit_999: {
            photoURL: 'https://example.com/admin-photo.jpg',
          },
        },
      });

      const result = await handler.execute(
        'deliver_file_to_chat',
        { sourceType: 'unit_photo', sourceId: 'unit_999' },
        adminCtx(),
      );

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>)?.sentCount).toBe(1);
    });

    it('should deliver file without ownership check', async () => {
      setupFirestore({
        files: {
          file_001: {
            downloadUrl: 'https://example.com/doc.pdf',
            contentType: 'application/pdf',
            ext: 'pdf',
            originalFilename: 'invoice.pdf',
            entityType: 'project',
            entityId: 'proj_999',
            projectId: 'proj_999',
          },
        },
      });

      const result = await handler.execute(
        'deliver_file_to_chat',
        { sourceType: 'file', sourceId: 'file_001' },
        adminCtx(),
      );

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>)?.sentCount).toBe(1);
    });

    it('should deliver floorplan without project role check', async () => {
      setupFirestore({
        floorplans: {
          fp_001: {
            projectId: 'proj_999',
            pdfImageUrl: 'https://example.com/floorplan.png',
            fileName: 'floor1.png',
          },
        },
      });

      const result = await handler.execute(
        'deliver_file_to_chat',
        { sourceType: 'floorplan', sourceId: 'fp_001' },
        adminCtx(),
      );

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>)?.sentCount).toBe(1);
    });
  });
});
