/**
 * CUSTOMER HANDLER TESTS
 *
 * Tests customer-facing tools: complaint triage, file delivery.
 * Verifies RBAC, validation, Firestore writes, admin notifications.
 *
 * @see SPEC-257D (Complaint Triage), SPEC-257F (File Delivery)
 * @module __tests__/handlers/customer-handler
 */

import '../setup';

import { CustomerHandler } from '../../handlers/customer-handler';
import { createCustomerContext } from '../test-utils/context-factory';
import { createMockFirestore } from '../test-utils/mock-firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: {
    TASKS: 'tasks',
    UNITS: 'units',
    FILES: 'files',
    FLOORPLANS: 'floorplans',
  },
}));

jest.mock('@/services/ai-pipeline/shared/super-admin-resolver', () => ({
  getAdminTelegramChatId: jest.fn(async () => '5618410820'),
}));

jest.mock('@/services/ai-pipeline/shared/channel-reply-dispatcher', () => ({
  sendChannelReply: jest.fn(async () => ({ success: true })),
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
  return createCustomerContext({
    ...overrides,
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('CustomerHandler', () => {
  let handler: CustomerHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new CustomerHandler();
  });

  // ==========================================================================
  // ROUTING
  // ==========================================================================

  describe('Routing', () => {
    it('should reject unknown tool', async () => {
      const result = await handler.execute('unknown', {}, customerCtx());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown');
    });
  });

  // ==========================================================================
  // create_complaint_task
  // ==========================================================================

  describe('create_complaint_task', () => {
    it('should reject when no contactMeta (unrecognized user)', async () => {
      const result = await handler.execute(
        'create_complaint_task',
        { title: 'Test', description: 'Desc', severity: 'normal', unitId: 'u1' },
        customerCtx({ contactMeta: null }),
      );
      expect(result.success).toBe(false);
    });

    it('should reject when no linked units', async () => {
      const result = await handler.execute(
        'create_complaint_task',
        { title: 'Test', description: 'Desc', severity: 'normal', unitId: 'u1' },
        customerCtx({
          contactMeta: {
            contactId: 'cont_001',
            displayName: 'Δημήτρης',
            firstName: 'Δημήτρης',
            primaryPersona: null,
            linkedUnitIds: [],
            projectRoles: [],
          },
        }),
      );
      expect(result.success).toBe(false);
    });

    it('should reject missing title or description', async () => {
      const result = await handler.execute(
        'create_complaint_task',
        { title: '', description: 'Desc', severity: 'normal', unitId: 'unit_001' },
        customerCtx(),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('τίτλος');
    });

    it('should reject invalid severity', async () => {
      const result = await handler.execute(
        'create_complaint_task',
        { title: 'Test', description: 'Desc', severity: 'extreme', unitId: 'unit_001' },
        customerCtx(),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('severity');
    });

    it('should reject unit not in linkedUnitIds', async () => {
      const result = await handler.execute(
        'create_complaint_task',
        { title: 'Test', description: 'Desc', severity: 'normal', unitId: 'unit_999' },
        customerCtx(),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('πρόσβαση');
    });

    it('should create task with correct data', async () => {
      const kit = setupFirestore({
        units: { unit_001: { projectId: 'proj_001' } },
        tasks: {},
      });

      const result = await handler.execute(
        'create_complaint_task',
        {
          title: 'Πρόβλημα υδραυλικά',
          description: 'Τρέχει νερό από τον τοίχο',
          severity: 'normal',
          unitId: 'unit_001',
        },
        customerCtx(),
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        priority: 'high',
        severity: 'normal',
      });

      // Verify task was written to Firestore
      const allTasks = kit.getAllDocs('tasks');
      const taskIds = Object.keys(allTasks);
      expect(taskIds.length).toBe(1);

      const task = allTasks[taskIds[0]];
      expect(task.type).toBe('complaint');
      expect(task.title).toContain('Πρόβλημα υδραυλικά');
      expect(task.unitId).toBe('unit_001');
      expect(task.projectId).toBe('proj_001');
    });

    it('should map severity to priority correctly', async () => {
      setupFirestore({
        units: { unit_001: {} },
        tasks: {},
      });

      const urgentResult = await handler.execute(
        'create_complaint_task',
        { title: 'Urgent', description: 'Fire!', severity: 'urgent', unitId: 'unit_001' },
        customerCtx(),
      );
      expect(urgentResult.data?.priority).toBe('urgent');

      const lowResult = await handler.execute(
        'create_complaint_task',
        { title: 'Low', description: 'Minor', severity: 'low', unitId: 'unit_001' },
        customerCtx(),
      );
      expect(lowResult.data?.priority).toBe('low');
    });
  });

  // ==========================================================================
  // deliver_file_to_chat
  // ==========================================================================

  describe('deliver_file_to_chat', () => {
    it('should reject when no contactMeta', async () => {
      const result = await handler.execute(
        'deliver_file_to_chat',
        { sourceType: 'unit_photo', sourceId: 'u1' },
        customerCtx({ contactMeta: null }),
      );
      expect(result.success).toBe(false);
    });

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

    it('should reject unit_photo when unit not in linkedUnitIds', async () => {
      setupFirestore({
        units: { unit_999: { photoURL: 'https://example.com/photo.jpg' } },
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
        units: {
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
      expect(result.data?.sentCount).toBe(2);
      expect(result.data?.totalFiles).toBe(2);
    });

    it('should fail when unit has no photos', async () => {
      setupFirestore({
        units: { unit_001: {} },
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
});
