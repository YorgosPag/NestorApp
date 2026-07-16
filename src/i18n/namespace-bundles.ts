/**
 * @fileoverview i18n namespace bundles — SSoT for the common namespace lists
 *               passed to `useTranslation([...])`.
 * @description Many components load the exact same list of `common` + `common-*`
 *              namespaces. Restating that 10-item array in every file is a
 *              duplication smell (jscpd CHECK 3.28 trips when two such files land
 *              in one diff). This module owns each shared bundle once.
 *
 * @enterprise SSoT — a single named array per shared namespace set.
 * @enterprise ADR-584 — jscpd clone ratchet (de-duplication driver).
 *
 * ⚠️ TOOLING CONTRACT: the pre-commit i18n key checks parse `useTranslation(...)`
 * to learn which namespaces a file loads. They resolve a bare bundle identifier
 * (e.g. `useTranslation(COMMON_NAMESPACES)`) by reading THIS file. So:
 *   • every bundle MUST be `export const <NAME> = [ ...string literals ] as const;`
 *   • keep the literals inline (no computed/spread entries) — the checker's
 *     `scripts/lib/i18n-namespace-extract.js` parser reads them statically.
 * See scripts/check-i18n-missing-keys.js (CHECK 3.8) and
 *     scripts/generate-i18n-keys-baseline.js.
 */

/**
 * The shared `common` + `common-*` UI namespace set. Loaded by ~137 components
 * that render generic account / actions / navigation / photos / sales / status /
 * validation strings. This is the byte-identical array those files used to
 * restate inline.
 */
export const COMMON_NAMESPACES = [
  'common',
  'common-account',
  'common-actions',
  'common-empty-states',
  'common-navigation',
  'common-photos',
  'common-sales',
  'common-shared',
  'common-status',
  'common-validation',
] as const;
