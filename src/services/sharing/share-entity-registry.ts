/**
 * =============================================================================
 * SHARE ENTITY REGISTRY (ADR-315 Phase M1)
 * =============================================================================
 *
 * Plugin registry so adding a new shareable entity type costs exactly one
 * resolver file + one `.register()` call. UnifiedSharingService stays
 * entity-agnostic: policy decisions (canShare, validateCreateInput,
 * safePublicProjection, renderPublic) live per-entity.
 *
 * M1: no resolvers registered yet. Resolvers for file / contact /
 * property_showcase arrive in Phase M3 together with UnifiedShareDialog
 * and the consolidated public route.
 *
 * @module services/sharing/share-entity-registry
 * @see adrs/ADR-315-unified-sharing.md §3.3
 */

import { createModuleLogger } from '@/lib/telemetry';
import type {
  ShareEntityDefinition,
  ShareEntityType,
} from '@/types/sharing';

const logger = createModuleLogger('ShareEntityRegistry');

// ============================================================================
// REGISTRY
// ============================================================================

class ShareEntityRegistryImpl {
  private readonly definitions = new Map<
    ShareEntityType,
    ShareEntityDefinition<unknown>
  >();

  register<T>(
    entityType: ShareEntityType,
    definition: ShareEntityDefinition<T>,
  ): void {
    if (this.definitions.has(entityType)) {
      logger.warn('Share entity definition overridden', { entityType });
    }
    this.definitions.set(
      entityType,
      definition as ShareEntityDefinition<unknown>,
    );
  }

  get(entityType: ShareEntityType): ShareEntityDefinition<unknown> | null {
    return this.definitions.get(entityType) ?? null;
  }

  has(entityType: ShareEntityType): boolean {
    return this.definitions.has(entityType);
  }

  list(): ShareEntityType[] {
    return Array.from(this.definitions.keys());
  }

  /** Test-only. Production code must never call this. */
  clear(): void {
    this.definitions.clear();
  }
}

export const ShareEntityRegistry = new ShareEntityRegistryImpl();
