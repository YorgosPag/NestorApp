/**
 * ADR-344 Phase 7.C — Resolver barrel (client-safe).
 *
 * Re-exports the pure resolver surface + variable registry + scope types.
 *
 * `scope-builder.ts` is intentionally NOT re-exported here: it carries
 * `import 'server-only'` (admin SDK) and must be imported directly from
 * `./scope-builder` by API routes / server actions, never via this barrel
 * which is reachable from client bundles.
 */

export {
  resolvePlaceholdersInString,
  resolvePlaceholdersInNode,
  resolveTemplate,
  classifyPlaceholders,
} from './resolver';

export {
  PLACEHOLDER_REGISTRY,
  ALL_PLACEHOLDER_PATHS,
  isKnownPlaceholder,
  getPlaceholderMetadata,
} from './variables';

export type { PlaceholderPath, PlaceholderSource, PlaceholderMetadata } from './variables';

export type {
  PlaceholderScope,
  PlaceholderScopeCompany,
  PlaceholderScopeProject,
  PlaceholderScopeDrawing,
  PlaceholderScopeUser,
  PlaceholderScopeRevision,
  PlaceholderScopeFormatting,
} from './scope.types';

export { EMPTY_PLACEHOLDER_SCOPE } from './scope.types';
