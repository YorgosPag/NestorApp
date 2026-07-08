// =============================================================================
// ADR-598 G7 — Complexity gate (standalone ESLint flat config)
//
// A *ratchet* config, deliberately isolated from the repo's main
// eslint.config.mjs. scripts/check-eslint-ratchet.js runs ESLint with ONLY this
// config (`--no-config-lookup -c eslint/gates/complexity.mjs`) so the count it
// ratchets reflects these three rules alone — none of the repo's `error` rules
// leak in, and the run stays fast.
//
// Rules are `warn` (never `error`): the gate blocks on a *rise vs baseline*, not
// on any single warning. Uses ESLint core rules only → NO new dependency. The TS
// parser is set for .ts/.tsx so ESLint can parse the syntax; these rules are
// purely syntactic (no type information needed → not a `tsc` type-check, N.17).
// =============================================================================

import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

// Single source of the thresholds. Mirrored in the ADR-598 roadmap (§5, ΦΑΣΗ 1).
const COMPLEXITY_RULES = {
  complexity: ["warn", { max: 15 }],
  "max-depth": ["warn", 4],
  "max-params": ["warn", 5],
};

export default defineConfig([
  {
    files: ["**/*.{ts,mts,cts,tsx}"],
    languageOptions: { parser: tseslint.parser },
    rules: COMPLEXITY_RULES,
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    rules: COMPLEXITY_RULES,
  },
]);
