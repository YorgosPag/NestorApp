// =============================================================================
// ADR-598 G4 — jsx-a11y accessibility gate (standalone ESLint flat config)
//
// A *ratchet* config, isolated from the repo's main eslint.config.mjs.
// scripts/check-eslint-ratchet.js runs ESLint with ONLY this config
// (`--no-config-lookup -c eslint/gates/jsx-a11y.mjs`) so the count it ratchets is
// this plugin's findings alone. Rules come from eslint-plugin-jsx-a11y's
// `recommended` flat set, downgraded to `warn` (see _severity.mjs): the gate
// blocks on a *rise vs baseline*, never on a single finding.
//
// jsx-a11y is the de-facto React accessibility standard (Airbnb / Next.js ship
// its recommended set). It only touches JSX, so it runs over *.tsx/*.jsx. The TS
// parser handles .tsx (JSX + types); espree with ecmaFeatures.jsx handles .jsx.
// These rules are purely syntactic (no type info → not a `tsc` type-check, N.17).
// =============================================================================

import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import { downgradeToWarn } from "./_severity.mjs";

const A11Y_RULES = downgradeToWarn(jsxA11y.flatConfigs.recommended.rules);

export default defineConfig([
  {
    files: ["**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "jsx-a11y": jsxA11y },
    rules: A11Y_RULES,
  },
  {
    files: ["**/*.jsx"],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "jsx-a11y": jsxA11y },
    rules: A11Y_RULES,
  },
]);
