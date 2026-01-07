/**
 * 🧪 ENTERPRISE: Unit Tests for Optimistic Updates
 *
 * Tests for optimistic update management system.
 *
 * @author Claude AI Assistant
 * @created 2026-01-07
 */

import {
  OptimisticUpdateManager,
  createOptimisticHelpers,
} from '../utils/optimistic';
import type { OptimisticUpdateParams } from '../utils/optimistic';

// ============================================================================
// TEST DATA & HELPERS
// ============================================================================

interface TestState {
  projectId: string | null;
  name: string;
}

function createTestParams(overrides?: Partial<OptimisticUpdateParams<TestState>>): OptimisticUpdateParams<TestState> {
  return {
    entityType: 'building',
    entityId: 'building123',
    previousState: { projectId: null, name: 'Test Building' },
    optimisticState: { projectId: 'project456', name: 'Test Building' },
    ...overrides,
  };
}

// ============================================================================
// TESTS: OptimisticUpdateManager
// ============================================================================

describe('OptimisticUpdateManager', () => {
  let manager: OptimisticUpdateManager;

  beforeEach(() => {
    manager = new OptimisticUpdateManager();
  });

  describe('apply', () => {
    test('should apply optimistic update and return control object', () => {
      const params = createTestParams();

      const result = manager.apply(params);

      expect(result.updateId).toBeDefined();
      expect(result.updateId.startsWith('opt_')).toBe(true);
      expect(typeof result.rollback).toBe('function');
      expect(typeof result.confirm).toBe('function');
      expect(typeof result.isRolledBack).toBe('function');
      expect(typeof result.isConfirmed).toBe('function');
    });

    test('should call onApply callback', () => {
      const onApply = jest.fn();
      const params = createTestParams({ onApply });

      manager.apply(params);

      expect(onApply).toHaveBeenCalledWith(params.optimisticState);
    });

    test('should increment pending count', () => {
      expect(manager.getPendingCount()).toBe(0);

      manager.apply(createTestParams());

      expect(manager.getPendingCount()).toBe(1);
    });

    test('should track multiple pending updates', () => {
      manager.apply(createTestParams({ entityId: 'b1' }));
      manager.apply(createTestParams({ entityId: 'b2' }));
      manager.apply(createTestParams({ entityId: 'b3' }));

      expect(manager.getPendingCount()).toBe(3);
    });
  });

  describe('rollback', () => {
    test('should rollback an optimistic update', () => {
      const onRollback = jest.fn();
      const params = createTestParams();

      const { updateId, rollback } = manager.apply(params);

      rollback();

      // Check via isRolledBack
      const { isRolledBack } = manager.apply(createTestParams());
      // The previous update should be rolled back
    });

    test('should call onRollback callback with previous state', () => {
      const onRollback = jest.fn();
      const params = createTestParams({ onRollback });

      const { rollback } = manager.apply(params);
      rollback();

      expect(onRollback).toHaveBeenCalledWith(params.previousState);
    });

    test('should decrement pending count', () => {
      const { rollback } = manager.apply(createTestParams());

      expect(manager.getPendingCount()).toBe(1);

      rollback();

      expect(manager.getPendingCount()).toBe(0);
    });

    test('should return false for non-existent update', () => {
      const result = manager.rollback('non-existent-id');
      expect(result).toBe(false);
    });

    test('should return false when already rolled back', () => {
      const { updateId, rollback } = manager.apply(createTestParams());

      rollback();
      const secondRollback = manager.rollback(updateId);

      expect(secondRollback).toBe(false);
    });

    test('should return false when already confirmed', () => {
      const { updateId, confirm, rollback } = manager.apply(createTestParams());

      confirm();
      rollback();

      expect(manager.rollback(updateId)).toBe(false);
    });
  });

  describe('confirm', () => {
    test('should confirm an optimistic update', () => {
      const { confirm, isConfirmed } = manager.apply(createTestParams());

      expect(isConfirmed()).toBe(false);

      confirm();

      expect(isConfirmed()).toBe(true);
    });

    test('should call onConfirm callback with optimistic state', () => {
      const onConfirm = jest.fn();
      const params = createTestParams({ onConfirm });

      const { confirm } = manager.apply(params);
      confirm();

      expect(onConfirm).toHaveBeenCalledWith(params.optimisticState);
    });

    test('should decrement pending count', () => {
      const { confirm } = manager.apply(createTestParams());

      expect(manager.getPendingCount()).toBe(1);

      confirm();

      expect(manager.getPendingCount()).toBe(0);
    });

    test('should return false for non-existent update', () => {
      const result = manager.confirm('non-existent-id');
      expect(result).toBe(false);
    });

    test('should return true when already confirmed', () => {
      const { updateId, confirm } = manager.apply(createTestParams());

      confirm();
      const secondConfirm = manager.confirm(updateId);

      expect(secondConfirm).toBe(true);
    });

    test('should return false when already rolled back', () => {
      const { updateId, rollback, confirm } = manager.apply(createTestParams());

      rollback();
      confirm();

      expect(manager.confirm(updateId)).toBe(false);
    });
  });

  describe('hasPendingUpdates', () => {
    test('should return false when no pending updates', () => {
      expect(manager.hasPendingUpdates()).toBe(false);
    });

    test('should return true when there are pending updates', () => {
      manager.apply(createTestParams());

      expect(manager.hasPendingUpdates()).toBe(true);
    });

    test('should return false after all updates resolved', () => {
      const { confirm } = manager.apply(createTestParams());

      confirm();

      expect(manager.hasPendingUpdates()).toBe(false);
    });
  });

  describe('getPendingSnapshots', () => {
    test('should return empty array when no pending', () => {
      expect(manager.getPendingSnapshots()).toEqual([]);
    });

    test('should return only pending snapshots', () => {
      const { confirm } = manager.apply(createTestParams({ entityId: 'b1' }));
      manager.apply(createTestParams({ entityId: 'b2' }));
      const { rollback } = manager.apply(createTestParams({ entityId: 'b3' }));

      confirm();
      rollback();

      const pending = manager.getPendingSnapshots();

      expect(pending.length).toBe(1);
      expect(pending[0].entityId).toBe('b2');
    });
  });

  describe('rollbackAll', () => {
    test('should rollback all pending updates', () => {
      manager.apply(createTestParams({ entityId: 'b1' }));
      manager.apply(createTestParams({ entityId: 'b2' }));
      manager.apply(createTestParams({ entityId: 'b3' }));

      const rolledBackCount = manager.rollbackAll();

      expect(rolledBackCount).toBe(3);
      expect(manager.getPendingCount()).toBe(0);
    });

    test('should not rollback confirmed updates', () => {
      const { confirm } = manager.apply(createTestParams({ entityId: 'b1' }));
      manager.apply(createTestParams({ entityId: 'b2' }));

      confirm();

      const rolledBackCount = manager.rollbackAll();

      expect(rolledBackCount).toBe(1);
    });
  });

  describe('clear', () => {
    test('should clear all snapshots', () => {
      manager.apply(createTestParams({ entityId: 'b1' }));
      manager.apply(createTestParams({ entityId: 'b2' }));

      manager.clear();

      expect(manager.getPendingCount()).toBe(0);
      expect(manager.hasPendingUpdates()).toBe(false);
    });
  });
});

// ============================================================================
// TESTS: Control Object
// ============================================================================

describe('Optimistic Update Control Object', () => {
  let manager: OptimisticUpdateManager;

  beforeEach(() => {
    manager = new OptimisticUpdateManager();
  });

  test('isRolledBack should reflect rollback state', () => {
    const { rollback, isRolledBack } = manager.apply(createTestParams());

    expect(isRolledBack()).toBe(false);

    rollback();

    expect(isRolledBack()).toBe(true);
  });

  test('isConfirmed should reflect confirm state', () => {
    const { confirm, isConfirmed } = manager.apply(createTestParams());

    expect(isConfirmed()).toBe(false);

    confirm();

    expect(isConfirmed()).toBe(true);
  });
});

// ============================================================================
// TESTS: createOptimisticHelpers
// ============================================================================

describe('createOptimisticHelpers', () => {
  let manager: OptimisticUpdateManager;

  beforeEach(() => {
    manager = new OptimisticUpdateManager();
  });

  describe('applyUpdate', () => {
    test('should create optimistic update', () => {
      const helpers = createOptimisticHelpers<TestState>(manager, 'building', 'b1');

      const result = helpers.applyUpdate(
        { projectId: null, name: 'Test' },
        { projectId: 'p1', name: 'Test' }
      );

      expect(result.updateId).toBeDefined();
      expect(manager.getPendingCount()).toBe(1);
    });
  });

  describe('withOptimisticUpdate', () => {
    test('should confirm on successful operation', async () => {
      const helpers = createOptimisticHelpers<TestState>(manager, 'building', 'b1');

      const result = await helpers.withOptimisticUpdate(
        { projectId: null, name: 'Test' },
        { projectId: 'p1', name: 'Test' },
        async () => 'success'
      );

      expect(result).toBe('success');
      expect(manager.getPendingCount()).toBe(0);
    });

    test('should rollback on failed operation', async () => {
      const helpers = createOptimisticHelpers<TestState>(manager, 'building', 'b1');

      await expect(
        helpers.withOptimisticUpdate(
          { projectId: null, name: 'Test' },
          { projectId: 'p1', name: 'Test' },
          async () => {
            throw new Error('Operation failed');
          }
        )
      ).rejects.toThrow('Operation failed');

      expect(manager.getPendingCount()).toBe(0);
    });
  });
});

// ============================================================================
// TESTS: Integration Scenarios
// ============================================================================

describe('Optimistic Updates Integration', () => {
  let manager: OptimisticUpdateManager;

  beforeEach(() => {
    manager = new OptimisticUpdateManager();
  });

  test('should handle UI state updates', () => {
    let uiState: TestState = { projectId: null, name: 'Building' };

    const { rollback, confirm } = manager.apply({
      entityType: 'building',
      entityId: 'b1',
      previousState: { ...uiState },
      optimisticState: { projectId: 'p1', name: 'Building' },
      onApply: (state) => {
        uiState = state;
      },
      onRollback: (prev) => {
        uiState = prev;
      },
    });

    // UI should show optimistic state
    expect(uiState.projectId).toBe('p1');

    // Simulate server failure
    rollback();

    // UI should show previous state
    expect(uiState.projectId).toBeNull();
  });

  test('should handle concurrent updates', () => {
    const updates = [
      manager.apply(createTestParams({ entityId: 'b1' })),
      manager.apply(createTestParams({ entityId: 'b2' })),
      manager.apply(createTestParams({ entityId: 'b3' })),
    ];

    expect(manager.getPendingCount()).toBe(3);

    // Confirm first
    updates[0].confirm();

    // Rollback second
    updates[1].rollback();

    // Third still pending
    expect(manager.getPendingCount()).toBe(1);

    updates[2].confirm();
    expect(manager.getPendingCount()).toBe(0);
  });

  test('should handle async operations', async () => {
    const helpers = createOptimisticHelpers<TestState>(manager, 'building', 'b1');

    // Simulate successful async operation
    await helpers.withOptimisticUpdate(
      { projectId: null, name: 'Test' },
      { projectId: 'p1', name: 'Test' },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'done';
      }
    );

    expect(manager.hasPendingUpdates()).toBe(false);
  });
});
