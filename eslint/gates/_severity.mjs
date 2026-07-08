// =============================================================================
// ADR-598 ΦΑΣΗ 1 — shared severity helper for the plugin-based ESLint ratchet
// gates (G4 jsx-a11y, G8 security).
//
// Both plugin gates take their plugin's `recommended` flat-config rule map and
// run it as `warn` only: the ratchet (scripts/check-eslint-ratchet.js) blocks on
// a *rise vs baseline*, never on a single finding — identical intent to the G7
// core-rule config (eslint/gates/complexity.mjs). This downgrade is the ONE bit
// of logic the two gates would otherwise each re-implement, so it lives here once
// (N.0.2 centralization / avoids a CHECK 3.28 jscpd clone between the gates).
// =============================================================================

// Map every rule id in a recommended rule set to `warn`, discarding the plugin's
// own severities/options. (Options are dropped deliberately: the gate only counts
// occurrences, so the default rule behaviour is what we ratchet.)
export function downgradeToWarn(rules) {
  return Object.fromEntries(Object.keys(rules || {}).map((ruleId) => [ruleId, "warn"]));
}
