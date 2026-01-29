/**
 * 🔒 CI Environment Configuration
 *
 * CENTRALIZED source of truth for CI/CD environment variables.
 * Used by quality-gates.yml and other CI workflows.
 *
 * @module config/ci/env.ci
 * @version 1.0.0
 * @since 2026-01-29 - PR-0 Quality Gates
 *
 * @enterprise Local_Protocol: ZERO hardcoded domain config in YAML
 */

// =============================================================================
// CI ENVIRONMENT VARIABLES
// =============================================================================

/**
 * Firebase configuration for CI builds.
 * These are PUBLIC keys (safe to expose in CI).
 * The actual project is NOT connected - these are dummy values for build validation.
 */
export const CI_FIREBASE_CONFIG = {
  apiKey: 'ci-build-validation-key',
  authDomain: 'ci-validation.firebaseapp.com',
  projectId: 'ci-validation-project',
  storageBucket: 'ci-validation.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:ci-validation',
} as const;

/**
 * Map configuration for CI builds.
 */
export const CI_MAP_CONFIG = {
  styleUrl: 'https://demotiles.maplibre.org/style.json',
} as const;

/**
 * Node.js configuration for CI.
 */
export const CI_NODE_CONFIG = {
  version: '20',
  pnpmVersion: '9.14.0',
} as const;

/**
 * Timeout configuration for CI jobs.
 */
export const CI_TIMEOUT_CONFIG = {
  lint: 10,      // minutes
  typecheck: 10, // minutes
  test: 15,      // minutes
  build: 20,     // minutes
  firestoreRules: 10, // minutes
} as const;

// =============================================================================
// ENVIRONMENT FILE GENERATION (for .env.ci)
// =============================================================================

/**
 * Generate .env.ci content from this config.
 * Run: npx ts-node config/ci/env.ci.ts > .env.ci
 */
export function generateEnvCiContent(): string {
  return `# =============================================================================
# CI ENVIRONMENT VARIABLES
# =============================================================================
# Generated from: config/ci/env.ci.ts
# DO NOT EDIT MANUALLY - run: npx ts-node config/ci/env.ci.ts > .env.ci
# =============================================================================

# Firebase (dummy values for build validation)
NEXT_PUBLIC_FIREBASE_API_KEY=${CI_FIREBASE_CONFIG.apiKey}
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${CI_FIREBASE_CONFIG.authDomain}
NEXT_PUBLIC_FIREBASE_PROJECT_ID=${CI_FIREBASE_CONFIG.projectId}
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${CI_FIREBASE_CONFIG.storageBucket}
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${CI_FIREBASE_CONFIG.messagingSenderId}
NEXT_PUBLIC_FIREBASE_APP_ID=${CI_FIREBASE_CONFIG.appId}

# Map
NEXT_PUBLIC_MAPLIBRE_STYLE_URL=${CI_MAP_CONFIG.styleUrl}
`;
}

// If run directly, output .env.ci content
if (require.main === module) {
  console.log(generateEnvCiContent());
}
