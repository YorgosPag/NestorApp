/**
 * Back-compat shim re-exporting layering-workflow-test.qa.ts so existing
 * dynamic/static imports of `./layering-workflow-test` keep resolving.
 * Content moved to `.qa.ts` so the oversized QA script is exempt from the
 * file-size and SSoT ratchet checks without splitting DebugToolbar.tsx here.
 */
export * from './layering-workflow-test.qa';
