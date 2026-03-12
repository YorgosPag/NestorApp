/**
 * =============================================================================
 * 🏢 ENTERPRISE: Centralized CompanyId Resolution
 * =============================================================================
 *
 * Single source of truth for companyId resolution across the entire application.
 * Eliminates scattered inline resolution patterns (building?.companyId || user?.companyId || ...)
 * with a deterministic, traceable, priority-based resolver.
 *
 * Priority order:
 * 1. building.companyId  — Firestore source of truth (supports super_admin cross-tenant)
 * 2. user.companyId      — Auth user's tenant (fallback)
 * 3. selectedCompanyId   — UI selection (last resort, e.g. dialog dropdowns)
 *
 * @module services/company-id-resolver
 * @enterprise ADR-200 — Centralized CompanyId Resolution
 * @version 1.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Context object for companyId resolution.
 * All fields are optional — the resolver uses the first non-empty value
 * according to the priority chain.
 */
export interface CompanyIdContext {
  /** Building document (highest priority — Firestore source of truth) */
  building?: { companyId?: string } | null;
  /** Auth user (second priority — user's own tenant) */
  user?: { companyId?: string } | null;
  /** UI-selected companyId (lowest priority — dialog/dropdown selection) */
  selectedCompanyId?: string;
}

/**
 * Result of companyId resolution — always includes the source for traceability.
 */
export interface CompanyIdResult {
  /** Resolved companyId */
  companyId: string;
  /** Which source provided the companyId (useful for debugging mismatch bugs) */
  source: 'building' | 'user' | 'selected';
}

// =============================================================================
// CORE RESOLUTION FUNCTION
// =============================================================================

/**
 * Resolve companyId from context using deterministic priority order.
 *
 * @throws Error if no companyId is available from any source
 *
 * @example
 * ```ts
 * // In a React component:
 * const { companyId } = resolveCompanyId({ building, user });
 *
 * // In SimpleProjectDialog (3-source fallback):
 * const { companyId } = resolveCompanyId({ building: selectedBuilding, user, selectedCompanyId });
 * ```
 */
export function resolveCompanyId(ctx: CompanyIdContext): CompanyIdResult {
  if (ctx.building?.companyId) {
    return { companyId: ctx.building.companyId, source: 'building' };
  }

  if (ctx.user?.companyId) {
    return { companyId: ctx.user.companyId, source: 'user' };
  }

  if (ctx.selectedCompanyId) {
    return { companyId: ctx.selectedCompanyId, source: 'selected' };
  }

  throw new Error(
    '[resolveCompanyId] No companyId available — building, user, and selectedCompanyId are all empty'
  );
}

// =============================================================================
// CONVENIENCE: Resolve with buildings array lookup
// =============================================================================

/**
 * Resolve companyId by looking up a building from an array first.
 *
 * Common pattern in SimpleProjectDialog where buildings are loaded as an array
 * and the caller needs to find the correct building by ID before resolving.
 *
 * @example
 * ```ts
 * const { companyId } = resolveCompanyIdForBuilding({
 *   buildingId: selectedBuildingId,
 *   buildings,
 *   user,
 *   selectedCompanyId,
 * });
 * ```
 */
export function resolveCompanyIdForBuilding(params: {
  buildingId: string;
  buildings: ReadonlyArray<{ id: string; companyId?: string }>;
  user?: { companyId?: string } | null;
  selectedCompanyId?: string;
}): CompanyIdResult {
  const building = params.buildings.find(b => b.id === params.buildingId) ?? null;
  return resolveCompanyId({
    building,
    user: params.user,
    selectedCompanyId: params.selectedCompanyId,
  });
}

// =============================================================================
// SAFE VARIANT (returns undefined instead of throwing)
// =============================================================================

/**
 * Same as resolveCompanyId but returns undefined instead of throwing
 * when no companyId is available. Useful for optional/conditional flows.
 */
export function tryResolveCompanyId(ctx: CompanyIdContext): CompanyIdResult | undefined {
  try {
    return resolveCompanyId(ctx);
  } catch {
    return undefined;
  }
}
