/**
 * ADR-344 Phase 7.C — Placeholder scope contract.
 *
 * The resolver is a pure function: caller hands it a `PlaceholderScope`,
 * resolver substitutes every known `{{namespace.key}}`. No Firestore reads
 * happen inside the resolver — the server-only `scope-builder.ts` hydrates
 * the scope from Firestore (admin SDK), the resolver only reads from it.
 *
 * Sub-types intentionally diverge from the full `Project`/`Company`/`User`
 * types in `src/types/` — they declare ONLY the fields the resolver needs
 * so that the scope is cheap to assemble (the builder fetches one doc,
 * picks 3-4 fields, discards the rest) and stable against unrelated schema
 * churn elsewhere in the codebase.
 *
 * Every field is optional: a missing project, a project without an owner,
 * a drawing without a sheet number — all valid. The resolver substitutes
 * the matching `{{x.y}}` with `''` (empty string) when the value is absent.
 */

/** Optional company facts the resolver may render. */
export interface PlaceholderScopeCompany {
  readonly name?: string;
}

/** Optional project facts the resolver may render. */
export interface PlaceholderScopeProject {
  readonly name?: string;
  readonly code?: string;
  readonly owner?: string;
}

/** Optional drawing facts — typically read from the active DXF document. */
export interface PlaceholderScopeDrawing {
  readonly title?: string;
  readonly scale?: string;
  readonly sheetNumber?: string;
  readonly units?: string;
}

/** Optional acting-user facts (the architect inserting the template). */
export interface PlaceholderScopeUser {
  readonly fullName?: string;
  readonly checkerName?: string;
  readonly title?: string;
  readonly licenseNumber?: string;
}

/** Optional revision facts — from the drawing's revision-history record. */
export interface PlaceholderScopeRevision {
  readonly number?: string;
  readonly date?: Date;
  readonly author?: string;
  readonly description?: string;
}

/**
 * Locale-aware preferences the resolver applies to date placeholders.
 *
 * `locale` drives `Intl.DateTimeFormat`:
 *   - `'el'` → dd/mm/yyyy (Greek architects)
 *   - `'en'` → m/d/yyyy   (US-style en-US fallback)
 *
 * `today` is the deterministic clock — supply it from tests to freeze
 * `{{date.today}}` without monkey-patching `Date`. Production callers omit
 * it; the resolver falls back to `new Date()`.
 */
export interface PlaceholderScopeFormatting {
  readonly locale?: 'el' | 'en';
  readonly today?: Date;
}

/**
 * Aggregate scope passed to the resolver.
 *
 * The shape is flat (one slot per namespace) so the resolver dispatches
 * via a single `switch (source)` over the 6 sources declared in
 * `PLACEHOLDER_REGISTRY` — no recursion, no reflection, easy to test.
 */
export interface PlaceholderScope {
  readonly company?: PlaceholderScopeCompany;
  readonly project?: PlaceholderScopeProject;
  readonly drawing?: PlaceholderScopeDrawing;
  readonly user?: PlaceholderScopeUser;
  readonly revision?: PlaceholderScopeRevision;
  readonly formatting?: PlaceholderScopeFormatting;
}

/** Empty scope — convenience for tests and stub call sites. */
export const EMPTY_PLACEHOLDER_SCOPE: PlaceholderScope = Object.freeze({});
