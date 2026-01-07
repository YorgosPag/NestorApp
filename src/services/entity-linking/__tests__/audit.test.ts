/**
 * 🧪 ENTERPRISE: Unit Tests for Audit Logging
 *
 * Tests for structured audit logging system.
 *
 * @author Claude AI Assistant
 * @created 2026-01-07
 */

import { AuditLogger } from '../utils/audit';
import type { AuditLogEntry, AuditAction } from '../utils/audit';

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

beforeEach(() => {
  // Clear buffer and reset configuration before each test
  AuditLogger.clearBuffer();
  AuditLogger.configure({
    enabled: true,
    consoleOutput: false, // Disable console output during tests
    memoryBuffer: true,
    minSeverity: 'DEBUG',
  });
});

afterEach(() => {
  AuditLogger.clearCorrelationId();
});

// ============================================================================
// TESTS: Basic Logging
// ============================================================================

describe('AuditLogger Basic Logging', () => {
  test('should log a successful operation', () => {
    const entry = AuditLogger.log({
      action: 'LINK_ENTITY',
      entityType: 'building',
      entityId: 'building123',
      success: true,
    });

    expect(entry.id).toBeDefined();
    expect(entry.action).toBe('LINK_ENTITY');
    expect(entry.entityType).toBe('building');
    expect(entry.entityId).toBe('building123');
    expect(entry.success).toBe(true);
    expect(entry.timestamp).toBeDefined();
    expect(entry.timestampMs).toBeGreaterThan(0);
  });

  test('should log a failed operation with error', () => {
    const entry = AuditLogger.log({
      action: 'LINK_ENTITY',
      entityType: 'building',
      entityId: 'building123',
      success: false,
      errorMessage: 'Connection failed',
      errorCode: 'NETWORK_ERROR',
    });

    expect(entry.success).toBe(false);
    expect(entry.errorMessage).toBe('Connection failed');
    expect(entry.errorCode).toBe('NETWORK_ERROR');
    expect(entry.severity).toBe('ERROR');
  });

  test('should include duration when provided', () => {
    const entry = AuditLogger.log({
      action: 'LINK_ENTITY',
      entityType: 'building',
      entityId: 'building123',
      success: true,
      durationMs: 150,
    });

    expect(entry.durationMs).toBe(150);
  });

  test('should include metadata when provided', () => {
    const metadata = { count: 5, source: 'api' };
    const entry = AuditLogger.log({
      action: 'GET_AVAILABLE_ENTITIES',
      entityType: 'building',
      success: true,
      metadata,
    });

    expect(entry.metadata).toEqual(metadata);
  });
});

// ============================================================================
// TESTS: Convenience Methods
// ============================================================================

describe('AuditLogger Convenience Methods', () => {
  describe('logSuccess', () => {
    test('should log a successful operation', () => {
      const entry = AuditLogger.logSuccess(
        'LINK_ENTITY',
        'building',
        'building123',
        { extra: 'data' }
      );

      expect(entry.action).toBe('LINK_ENTITY');
      expect(entry.success).toBe(true);
      expect(entry.severity).toBe('INFO');
      expect(entry.metadata).toEqual({ extra: 'data' });
    });
  });

  describe('logError', () => {
    test('should log an error with Error object', () => {
      const error = new Error('Something went wrong');
      const entry = AuditLogger.logError(
        'LINK_ENTITY',
        'building',
        'building123',
        error,
        'NETWORK_ERROR'
      );

      expect(entry.success).toBe(false);
      expect(entry.errorMessage).toBe('Something went wrong');
      expect(entry.errorCode).toBe('NETWORK_ERROR');
    });

    test('should log an error with string message', () => {
      const entry = AuditLogger.logError(
        'LINK_ENTITY',
        'building',
        'building123',
        'Custom error message'
      );

      expect(entry.errorMessage).toBe('Custom error message');
    });
  });

  describe('logLink', () => {
    test('should log a link operation', () => {
      const entry = AuditLogger.logLink(
        'building',
        'building123',
        'project',
        'project456',
        null,
        true,
        100
      );

      expect(entry.action).toBe('LINK_ENTITY');
      expect(entry.entityType).toBe('building');
      expect(entry.entityId).toBe('building123');
      expect(entry.targetType).toBe('project');
      expect(entry.targetId).toBe('project456');
      expect(entry.previousValue).toBeNull();
      expect(entry.newValue).toBe('project456');
      expect(entry.success).toBe(true);
      expect(entry.durationMs).toBe(100);
    });

    test('should log a failed link operation', () => {
      const entry = AuditLogger.logLink(
        'building',
        'building123',
        'project',
        'project456',
        'oldProject',
        false,
        50,
        'Permission denied'
      );

      expect(entry.success).toBe(false);
      expect(entry.previousValue).toBe('oldProject');
      expect(entry.errorMessage).toBe('Permission denied');
    });
  });

  describe('logUnlink', () => {
    test('should log an unlink operation', () => {
      const entry = AuditLogger.logUnlink(
        'building',
        'building123',
        'project456',
        true,
        75
      );

      expect(entry.action).toBe('UNLINK_ENTITY');
      expect(entry.previousValue).toBe('project456');
      expect(entry.newValue).toBeNull();
      expect(entry.success).toBe(true);
      expect(entry.durationMs).toBe(75);
    });
  });

  describe('logRetry', () => {
    test('should log a retry attempt', () => {
      const entry = AuditLogger.logRetry('LINK_ENTITY', 2, 3, 1000);

      expect(entry.action).toBe('RETRY_ATTEMPT');
      expect(entry.success).toBe(false);
      expect(entry.severity).toBe('WARN');
      expect(entry.metadata).toEqual({
        originalAction: 'LINK_ENTITY',
        attempt: 2,
        maxAttempts: 3,
        delayMs: 1000,
      });
    });
  });
});

// ============================================================================
// TESTS: Buffer Operations
// ============================================================================

describe('AuditLogger Buffer Operations', () => {
  beforeEach(() => {
    // Add some entries to buffer
    AuditLogger.logSuccess('LINK_ENTITY', 'building', 'b1');
    AuditLogger.logSuccess('LINK_ENTITY', 'building', 'b2');
    AuditLogger.logError('UNLINK_ENTITY', 'building', 'b3', 'Error');
    AuditLogger.logSuccess('GET_AVAILABLE_ENTITIES', 'unit', 'u1');
  });

  describe('getRecentLogs', () => {
    test('should return all logs when no count specified', () => {
      const logs = AuditLogger.getRecentLogs();
      expect(logs.length).toBe(4);
    });

    test('should return limited logs when count specified', () => {
      const logs = AuditLogger.getRecentLogs(2);
      expect(logs.length).toBe(2);
    });
  });

  describe('getLogsByAction', () => {
    test('should filter logs by action', () => {
      const logs = AuditLogger.getLogsByAction('LINK_ENTITY');
      expect(logs.length).toBe(2);
      expect(logs.every((l) => l.action === 'LINK_ENTITY')).toBe(true);
    });

    test('should return empty array for non-existent action', () => {
      const logs = AuditLogger.getLogsByAction('CACHE_HIT');
      expect(logs.length).toBe(0);
    });
  });

  describe('getLogsByEntity', () => {
    test('should filter logs by entity', () => {
      const logs = AuditLogger.getLogsByEntity('building', 'b1');
      expect(logs.length).toBe(1);
      expect(logs[0].entityId).toBe('b1');
    });
  });

  describe('getFailedOperations', () => {
    test('should return only failed operations', () => {
      const logs = AuditLogger.getFailedOperations();
      expect(logs.length).toBe(1);
      expect(logs[0].success).toBe(false);
    });
  });

  describe('clearBuffer', () => {
    test('should clear all logs', () => {
      AuditLogger.clearBuffer();
      const logs = AuditLogger.getRecentLogs();
      expect(logs.length).toBe(0);
    });
  });

  describe('exportBuffer', () => {
    test('should export buffer as JSON string', () => {
      const exported = AuditLogger.exportBuffer();
      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(4);
    });
  });
});

// ============================================================================
// TESTS: Correlation ID
// ============================================================================

describe('AuditLogger Correlation ID', () => {
  test('should include correlation ID when set', () => {
    AuditLogger.setCorrelationId('req-12345');

    const entry = AuditLogger.logSuccess('LINK_ENTITY', 'building', 'b1');

    expect(entry.correlationId).toBe('req-12345');
  });

  test('should not include correlation ID when cleared', () => {
    AuditLogger.setCorrelationId('req-12345');
    AuditLogger.clearCorrelationId();

    const entry = AuditLogger.logSuccess('LINK_ENTITY', 'building', 'b1');

    expect(entry.correlationId).toBeUndefined();
  });
});

// ============================================================================
// TESTS: Severity Levels
// ============================================================================

describe('AuditLogger Severity', () => {
  test('should set INFO for successful operations', () => {
    const entry = AuditLogger.log({
      action: 'LINK_ENTITY',
      success: true,
    });
    expect(entry.severity).toBe('INFO');
  });

  test('should set ERROR for failed operations', () => {
    const entry = AuditLogger.log({
      action: 'LINK_ENTITY',
      success: false,
    });
    expect(entry.severity).toBe('ERROR');
  });

  test('should set WARN for retry attempts', () => {
    const entry = AuditLogger.log({
      action: 'RETRY_ATTEMPT',
      success: false,
    });
    expect(entry.severity).toBe('WARN');
  });

  test('should set WARN for validation failures', () => {
    const entry = AuditLogger.log({
      action: 'VALIDATION_FAILED',
      success: false,
    });
    expect(entry.severity).toBe('WARN');
  });

  test('should set DEBUG for cache operations', () => {
    const entry = AuditLogger.log({
      action: 'CACHE_HIT',
      success: true,
    });
    expect(entry.severity).toBe('DEBUG');
  });
});

// ============================================================================
// TESTS: Configuration
// ============================================================================

describe('AuditLogger Configuration', () => {
  test('should respect enabled setting', () => {
    AuditLogger.configure({ enabled: false });

    const entry = AuditLogger.log({
      action: 'LINK_ENTITY',
      success: true,
    });

    // When disabled, should return empty entry
    expect(entry.id).toBe('');
    expect(AuditLogger.getRecentLogs().length).toBe(0);
  });

  test('should respect minSeverity setting', () => {
    AuditLogger.configure({ minSeverity: 'WARN' });

    // Log an INFO entry (should be filtered)
    AuditLogger.logSuccess('LINK_ENTITY', 'building', 'b1');

    // Log a WARN entry (should be kept)
    AuditLogger.logRetry('LINK_ENTITY', 1, 3, 1000);

    const logs = AuditLogger.getRecentLogs();
    // Only WARN and above should be in buffer
    expect(logs.every((l) => ['WARN', 'ERROR'].includes(l.severity))).toBe(true);
  });
});

// ============================================================================
// TESTS: Log Entry ID Generation
// ============================================================================

describe('AuditLogger ID Generation', () => {
  test('should generate unique IDs', () => {
    const entry1 = AuditLogger.logSuccess('LINK_ENTITY', 'building', 'b1');
    const entry2 = AuditLogger.logSuccess('LINK_ENTITY', 'building', 'b2');

    expect(entry1.id).not.toBe(entry2.id);
  });

  test('should generate IDs with correct prefix', () => {
    const entry = AuditLogger.logSuccess('LINK_ENTITY', 'building', 'b1');
    expect(entry.id.startsWith('audit_')).toBe(true);
  });
});
