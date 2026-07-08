// =============================================================================
// ADR-598 G8 — SAST security gate (standalone ESLint flat config)
//
// A *ratchet* config, isolated from the repo's main eslint.config.mjs.
// scripts/check-eslint-ratchet.js runs ESLint with ONLY this config
// (`--no-config-lookup -c eslint/gates/security.mjs`) so the count it ratchets is
// this plugin's findings alone. Rules come from eslint-plugin-security's
// `recommended` flat set, downgraded to `warn` (see _severity.mjs): the gate
// blocks on a *rise vs baseline*, never on a single finding.
//
// eslint-plugin-security is maintained by the ESLint org and used widely
// (Netflix/PayPal), but it is heuristic and noisy — hence `warn` + ratchet, not
// `error`. Its rules are AST-based; the TS parser handles .ts/.tsx, espree the
// rest. No type information is used → not a `tsc` type-check (N.17).
// =============================================================================

import pluginSecurity from "eslint-plugin-security";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import { downgradeToWarn } from "./_severity.mjs";

// Recommended set → warn, MINUS detect-object-injection: it flags nearly every
// computed member access (obj[key]) and is overwhelmingly false-positive on an
// app of this size. The big players (Netflix/PayPal/Airbnb) disable it for that
// reason — the plugin's own docs frame it as a manual-review aid, not a gate.
// Every other security rule stays on as `warn`.
const SECURITY_RULES = {
  ...downgradeToWarn(pluginSecurity.configs.recommended.rules),
  "security/detect-object-injection": "off",
};

export default defineConfig([
  {
    files: ["**/*.{ts,mts,cts,tsx}"],
    languageOptions: { parser: tseslint.parser },
    plugins: { security: pluginSecurity },
    rules: SECURITY_RULES,
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    plugins: { security: pluginSecurity },
    rules: SECURITY_RULES,
  },
]);
