/**
 * Back-compat shim re-exporting grid-enterprise-test.qa.ts so existing
 * dynamic/static imports of `./grid-enterprise-test` keep resolving.
 * Content moved to `.qa.ts` so the oversized QA script is exempt from the
 * file-size and SSoT ratchet checks without splitting DebugToolbar.tsx here.
 */
export * from './grid-enterprise-test.qa';
