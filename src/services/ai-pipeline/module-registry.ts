/**
 * =============================================================================
 * AI PIPELINE MODULE REGISTRY
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Registry for UC modules that plug into the Universal Pipeline.
 * Each UC module registers itself by intent type(s) it handles.
 *
 * @module services/ai-pipeline/module-registry
 * @see ADR-080 (Pipeline Implementation)
 * @see ADR-169 (Modular AI Architecture)
 *
 * USAGE:
 * ```typescript
 * const registry = getModuleRegistry();
 * registry.register(new AppointmentModule());  // UC-001
 * registry.register(new InvoiceModule());      // UC-002
 *
 * const module = registry.getModuleForIntent('appointment_request');
 * ```
 */

import type {
  IUCModule,
  PipelineIntentTypeValue,
} from '@/types/ai-pipeline';

// ============================================================================
// MODULE REGISTRY
// ============================================================================

/**
 * Registry that maps intent types to UC modules
 * @enterprise Modular architecture — plug and play UC modules
 */
export class ModuleRegistry {
  /** Map: moduleId → IUCModule */
  private modules: Map<string, IUCModule> = new Map();

  /** Map: intentType → moduleId */
  private intentToModule: Map<PipelineIntentTypeValue, string> = new Map();

  /**
   * Register a UC module
   *
   * @param module - UC module implementing IUCModule interface
   * @throws Error if intent type is already registered by another module
   */
  register(module: IUCModule): void {
    // Check for intent conflicts
    for (const intent of module.handledIntents) {
      const existingModuleId = this.intentToModule.get(intent);
      if (existingModuleId && existingModuleId !== module.moduleId) {
        throw new Error(
          `Intent '${intent}' is already registered by module '${existingModuleId}'. ` +
          `Cannot register module '${module.moduleId}' for the same intent.`
        );
      }
    }

    // Register module
    this.modules.set(module.moduleId, module);

    // Map intents to module
    for (const intent of module.handledIntents) {
      this.intentToModule.set(intent, module.moduleId);
    }
  }

  /**
   * Unregister a UC module
   *
   * @param moduleId - ID of the module to remove
   */
  unregister(moduleId: string): void {
    const module = this.modules.get(moduleId);
    if (!module) return;

    // Remove intent mappings
    for (const intent of module.handledIntents) {
      if (this.intentToModule.get(intent) === moduleId) {
        this.intentToModule.delete(intent);
      }
    }

    // Remove module
    this.modules.delete(moduleId);
  }

  /**
   * Get the UC module that handles a given intent
   *
   * @param intent - Pipeline intent type
   * @returns UC module or null if no module registered for this intent
   */
  getModuleForIntent(intent: PipelineIntentTypeValue): IUCModule | null {
    const moduleId = this.intentToModule.get(intent);
    if (!moduleId) return null;
    return this.modules.get(moduleId) ?? null;
  }

  /**
   * Get a UC module by its ID
   *
   * @param moduleId - Module identifier (e.g., 'UC-001')
   * @returns UC module or null
   */
  getModule(moduleId: string): IUCModule | null {
    return this.modules.get(moduleId) ?? null;
  }

  /**
   * Check if any module is registered for a given intent
   */
  hasModuleForIntent(intent: PipelineIntentTypeValue): boolean {
    return this.intentToModule.has(intent);
  }

  /**
   * Get all registered modules
   * @returns Read-only map of moduleId → IUCModule
   */
  getRegisteredModules(): ReadonlyMap<string, IUCModule> {
    return this.modules;
  }

  /**
   * Get all registered intent mappings
   * @returns Read-only map of intentType → moduleId
   */
  getIntentMappings(): ReadonlyMap<PipelineIntentTypeValue, string> {
    return this.intentToModule;
  }

  /**
   * Get registry statistics for monitoring
   */
  getStats(): {
    totalModules: number;
    totalIntentMappings: number;
    modules: Array<{ moduleId: string; displayName: string; intents: readonly PipelineIntentTypeValue[] }>;
  } {
    const modules = Array.from(this.modules.values()).map(m => ({
      moduleId: m.moduleId,
      displayName: m.displayName,
      intents: m.handledIntents,
    }));

    return {
      totalModules: this.modules.size,
      totalIntentMappings: this.intentToModule.size,
      modules,
    };
  }
}

// ============================================================================
// SINGLETON FACTORY
// ============================================================================

let registryInstance: ModuleRegistry | null = null;

/**
 * Get or create ModuleRegistry singleton
 */
export function getModuleRegistry(): ModuleRegistry {
  if (!registryInstance) {
    registryInstance = new ModuleRegistry();
  }
  return registryInstance;
}
