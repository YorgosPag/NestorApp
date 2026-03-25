/**
 * MODULE REGISTRY TESTS
 *
 * Tests UC module registration, intent mapping, conflict detection,
 * and multi-intent lookups.
 *
 * @see ADR-080 (Pipeline), ADR-169 (Modular AI Architecture)
 * @module __tests__/module-registry
 */

import { ModuleRegistry } from '../module-registry';
import type { IUCModule, PipelineIntentTypeValue } from '@/types/ai-pipeline';

// ============================================================================
// HELPERS
// ============================================================================

function createMockModule(
  moduleId: string,
  intents: readonly PipelineIntentTypeValue[],
  displayName?: string
): IUCModule {
  return {
    moduleId,
    displayName: displayName ?? `Module ${moduleId}`,
    handledIntents: intents,
    requiredRoles: [],
    lookup: jest.fn(),
    propose: jest.fn(),
    execute: jest.fn(),
    acknowledge: jest.fn(),
  } as unknown as IUCModule;
}

// ============================================================================
// TESTS
// ============================================================================

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  describe('register', () => {
    it('registers a module and maps its intents', () => {
      const mod = createMockModule('UC-001', ['appointment_request' as PipelineIntentTypeValue]);
      registry.register(mod);

      expect(registry.getModule('UC-001')).toBe(mod);
      expect(registry.hasModuleForIntent('appointment_request' as PipelineIntentTypeValue)).toBe(true);
    });

    it('registers module with multiple intents', () => {
      const mod = createMockModule('UC-005', [
        'general_inquiry' as PipelineIntentTypeValue,
        'faq' as PipelineIntentTypeValue,
      ]);
      registry.register(mod);

      expect(registry.getModuleForIntent('general_inquiry' as PipelineIntentTypeValue)).toBe(mod);
      expect(registry.getModuleForIntent('faq' as PipelineIntentTypeValue)).toBe(mod);
    });

    it('throws on intent conflict between different modules', () => {
      const mod1 = createMockModule('UC-001', ['appointment_request' as PipelineIntentTypeValue]);
      const mod2 = createMockModule('UC-002', ['appointment_request' as PipelineIntentTypeValue]);

      registry.register(mod1);

      expect(() => registry.register(mod2)).toThrow(
        /already registered by module 'UC-001'/
      );
    });

    it('allows re-registering same module (idempotent)', () => {
      const mod = createMockModule('UC-001', ['appointment_request' as PipelineIntentTypeValue]);
      registry.register(mod);
      registry.register(mod); // no throw

      expect(registry.getModule('UC-001')).toBe(mod);
    });
  });

  describe('unregister', () => {
    it('removes module and its intent mappings', () => {
      const mod = createMockModule('UC-001', ['appointment_request' as PipelineIntentTypeValue]);
      registry.register(mod);
      registry.unregister('UC-001');

      expect(registry.getModule('UC-001')).toBeNull();
      expect(registry.hasModuleForIntent('appointment_request' as PipelineIntentTypeValue)).toBe(false);
    });

    it('is a no-op for unknown moduleId', () => {
      // Should not throw
      registry.unregister('UC-UNKNOWN');
      expect(registry.getRegisteredModules().size).toBe(0);
    });
  });

  describe('getModuleForIntent', () => {
    it('returns null for unregistered intent', () => {
      expect(registry.getModuleForIntent('unknown_intent' as PipelineIntentTypeValue)).toBeNull();
    });

    it('returns the correct module', () => {
      const mod1 = createMockModule('UC-001', ['appointment_request' as PipelineIntentTypeValue]);
      const mod2 = createMockModule('UC-004', ['complaint' as PipelineIntentTypeValue]);
      registry.register(mod1);
      registry.register(mod2);

      expect(registry.getModuleForIntent('complaint' as PipelineIntentTypeValue)?.moduleId).toBe('UC-004');
    });
  });

  describe('getModulesForIntents', () => {
    it('returns modules for multiple intents in order', () => {
      const mod1 = createMockModule('UC-001', ['appointment_request' as PipelineIntentTypeValue]);
      const mod2 = createMockModule('UC-004', ['complaint' as PipelineIntentTypeValue]);
      registry.register(mod1);
      registry.register(mod2);

      const modules = registry.getModulesForIntents([
        'complaint' as PipelineIntentTypeValue,
        'appointment_request' as PipelineIntentTypeValue,
      ]);

      expect(modules).toHaveLength(2);
      expect(modules[0].moduleId).toBe('UC-004'); // first in input
      expect(modules[1].moduleId).toBe('UC-001');
    });

    it('deduplicates modules', () => {
      const mod = createMockModule('UC-MULTI', [
        'intent_a' as PipelineIntentTypeValue,
        'intent_b' as PipelineIntentTypeValue,
      ]);
      registry.register(mod);

      const modules = registry.getModulesForIntents([
        'intent_a' as PipelineIntentTypeValue,
        'intent_b' as PipelineIntentTypeValue,
      ]);

      expect(modules).toHaveLength(1);
    });

    it('skips unknown intents', () => {
      const mod = createMockModule('UC-001', ['appointment_request' as PipelineIntentTypeValue]);
      registry.register(mod);

      const modules = registry.getModulesForIntents([
        'unknown' as PipelineIntentTypeValue,
        'appointment_request' as PipelineIntentTypeValue,
      ]);

      expect(modules).toHaveLength(1);
    });

    it('returns empty array for all unknown intents', () => {
      const modules = registry.getModulesForIntents([
        'unknown_1' as PipelineIntentTypeValue,
        'unknown_2' as PipelineIntentTypeValue,
      ]);
      expect(modules).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('returns correct statistics', () => {
      const mod1 = createMockModule('UC-001', ['appointment_request' as PipelineIntentTypeValue], 'Appointments');
      const mod2 = createMockModule('UC-004', [
        'complaint' as PipelineIntentTypeValue,
        'feedback' as PipelineIntentTypeValue,
      ], 'Complaints');
      registry.register(mod1);
      registry.register(mod2);

      const stats = registry.getStats();

      expect(stats.totalModules).toBe(2);
      expect(stats.totalIntentMappings).toBe(3); // 1 + 2
      expect(stats.modules).toHaveLength(2);
      expect(stats.modules[0].displayName).toBe('Appointments');
    });
  });
});
