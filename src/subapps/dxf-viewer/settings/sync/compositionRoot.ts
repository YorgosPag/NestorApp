/**
 * @file Composition Root - Dependency Injection Setup
 * @module settings/sync/compositionRoot
 *
 * ✅ ENTERPRISE: Dependency Injection - Composition Root Pattern
 *
 * **RESPONSIBILITY**: Wire all dependencies together
 *
 * This is the ONLY place where:
 * - Adapters are imported
 * - SyncDependencies object is created
 * - Feature flags are checked
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI) + ChatGPT-5 Architecture
 * @since 2025-10-09
 */

import type { SyncDependencies } from './ports';
import {
  consoleLoggerAdapter,
  toolStyleAdapter,
  textStyleAdapter,
  gripStyleAdapter,
  gridAdapter,
  rulerAdapter
} from './adapters';

/**
 * Create Sync Dependencies (Composition Root)
 *
 * **PURE FACTORY** - No side effects
 *
 * @param options - Configuration options
 * @returns SyncDependencies object ready for injection
 *
 * @example
 * ```tsx
 * const syncDeps = createSyncDependencies({ enableSync: true });
 * <EnterpriseDxfSettingsProvider syncDeps={syncDeps}>
 * ```
 */
export function createSyncDependencies(options?: {
  /** Enable/disable store sync (feature flag) */
  enableSync?: boolean;
  /** Enable/disable specific ports */
  ports?: {
    toolStyle?: boolean;
    textStyle?: boolean;
    gripStyle?: boolean;
    grid?: boolean;
    ruler?: boolean;
  };
}): SyncDependencies | undefined {
  // ===== FEATURE FLAG =====
  if (options?.enableSync === false) {
    return undefined;
  }

  const ports = options?.ports ?? {};

  // ===== WIRE ALL DEPENDENCIES =====
  const deps: SyncDependencies = {
    // Required: Logger
    logger: consoleLoggerAdapter,

    // Optional: Store ports (controlled by feature flags)
    toolStyle: ports.toolStyle !== false ? toolStyleAdapter : undefined,
    textStyle: ports.textStyle !== false ? textStyleAdapter : undefined,
    gripStyle: ports.gripStyle !== false ? gripStyleAdapter : undefined,
    grid: ports.grid !== false ? gridAdapter : undefined,
    ruler: ports.ruler !== false ? rulerAdapter : undefined
  };

  return deps;
}
