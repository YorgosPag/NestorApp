import 'server-only';

/**
 * =============================================================================
 * ImpactPreviewPrimitives — Shared SSoT for mutation-impact preview services
 * =============================================================================
 *
 * The per-domain impact services (broker-terminate, engineer-remove,
 * landowners-save, labor-compliance-save, address-mutation, ownership-mutation)
 * all shared the SAME three primitives, copy-pasted byte-identically:
 *
 *   1. the "allow" preview      (nothing to warn about)
 *   2. the "unavailable" preview (the query failed — fail safe = block)
 *   3. the warn/block finalize   (count deps → derive mode → assemble)
 *
 * Big-player pattern (Revit / Figma "shared primitive + per-instance binding"):
 * this module owns those three primitives once; each service keeps ONLY its own
 * query + rule (`buildDependencies`) + logger. No God-shell over the divergent
 * services — the larger address/ownership previews consume only the two builders
 * and keep their bespoke finalize (mutationKinds / changes).
 *
 * @module lib/firestore/impact-preview-primitives
 * @enterprise ADR-591 — Impact-Preview Primitives SSoT
 */

import type {
  ProjectMutationDependency,
  ProjectMutationImpactPreview,
} from '@/types/project-mutation-impact';

// =============================================================================
// TYPES
// =============================================================================

/** Result of a per-service `buildDependencies` rule engine. */
export interface ImpactDependencyResult {
  readonly deps: ProjectMutationDependency[];
  readonly messageKey: string | null;
}

// =============================================================================
// SHARED PREVIEW BUILDERS
// =============================================================================

/** The canonical "allow" preview — no dependencies, mutation is safe. */
export function buildAllowImpactPreview(): ProjectMutationImpactPreview {
  return {
    mode: 'allow',
    mutationKinds: [],
    changes: [],
    dependencies: [],
    companyLinkChange: 'none',
    messageKey: 'impactGuard.messages.allow',
    blockingCount: 0,
    warningCount: 0,
  };
}

/** The canonical "unavailable" preview — the impact query failed; fail safe = block. */
export function buildUnavailableImpactPreview(): ProjectMutationImpactPreview {
  return {
    mode: 'block',
    mutationKinds: [],
    changes: [],
    dependencies: [],
    companyLinkChange: 'none',
    messageKey: 'impactGuard.messages.unavailable',
    blockingCount: 0,
    warningCount: 0,
  };
}

// =============================================================================
// FINALIZE
// =============================================================================

/**
 * Assemble a dependency-only preview: count warn/block deps, derive the overall
 * mode, and build the preview. Used by the simple services whose only signal is
 * a list of dependencies (no field changes / companyLinkChange).
 */
export function finalizeImpactPreview(
  deps: ProjectMutationDependency[],
  messageKey: string | null,
): ProjectMutationImpactPreview {
  const warningCount = deps.filter((d) => d.mode === 'warn').length;
  const blockingCount = deps.filter((d) => d.mode === 'block').length;
  const mode = blockingCount > 0 ? 'block' : 'warn';

  return {
    mode,
    mutationKinds: [],
    changes: [],
    dependencies: deps,
    companyLinkChange: 'none',
    messageKey: messageKey ?? 'impactGuard.messages.warn',
    blockingCount,
    warningCount,
  };
}

// =============================================================================
// RESOLVE (try / catch wrapper)
// =============================================================================

/**
 * Run a dependency-only impact preview end-to-end with the shared fail-safe
 * shape: empty deps → allow, otherwise finalize, and any thrown error →
 * unavailable (logged by the caller via `onError`).
 */
export async function resolveImpactPreview(
  compute: () => Promise<ImpactDependencyResult>,
  onError: (error: unknown) => void,
): Promise<ProjectMutationImpactPreview> {
  try {
    const { deps, messageKey } = await compute();
    if (deps.length === 0) return buildAllowImpactPreview();
    return finalizeImpactPreview(deps, messageKey);
  } catch (error) {
    onError(error);
    return buildUnavailableImpactPreview();
  }
}
