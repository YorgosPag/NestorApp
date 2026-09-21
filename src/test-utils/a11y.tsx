/**
 * ADR-598 G11 — accessibility test SSoT.
 *
 * Centralises the jest-axe boilerplate (`expect.extend(toHaveNoViolations)` +
 * render + axe pass) so every component a11y test goes through ONE import
 * instead of repeating the wiring. The a11y-coverage ratchet
 * (scripts/check-a11y-test-coverage-ratchet.js) treats a component as covered
 * when a test imports it and runs an axe check — using this helper is the
 * canonical way to get that.
 *
 * Usage:
 *   import { expectNoA11yViolations } from '@/test-utils/a11y';
 *   it('has no a11y violations', async () => {
 *     await expectNoA11yViolations(<MyComponent />);
 *   });
 *
 * jest-axe is MIT; its axe-core engine is MPL-2.0 (weak, file-level copyleft) —
 * a vetted dev/test-only exception (see .license-policy.json → exceptions
 * «axe-core-dev», approved 2026-07-08 for G11). Neither ships in the production bundle.
 */

import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations, type JestAxeConfigureOptions } from 'jest-axe';

// Register the matcher once, at import time, for every test that pulls this in.
expect.extend(toHaveNoViolations);

export { axe };

/**
 * Rules that judge a PAGE, never a component — off for every component scan.
 *
 * `region` asks "is all content inside a landmark (`main`, `nav`, …)?". A component
 * rendered alone is not a page and owns no landmarks, so the rule fires on every node
 * of an open popover the moment `document.body` is scanned — noise, not a finding.
 * Storybook's a11y addon disables it for component stories for the same reason. The
 * landmark question belongs to page-level tests (the shells, the e2e suites).
 */
const PAGE_LEVEL_RULES: NonNullable<JestAxeConfigureOptions['rules']> = {
  region: { enabled: false },
};

/**
 * Opt-in for the document-outline rule. `heading-order` is a `best-practice` rule, so
 * axe does not run it by default — but it is exactly what a shell that computes its own
 * heading level (`surface-context`, `ChartPlot`, `ReportSection`) must be judged by.
 */
export const HEADING_OUTLINE_RULES: JestAxeConfigureOptions = {
  rules: { 'heading-order': { enabled: true } },
};

/**
 * Render (or accept an already-rendered container) and assert zero axe
 * violations. Pass a ReactElement to render+scan it, or an Element to scan an
 * existing container (e.g. `render(<X/>).container`).
 *
 * ⚠️ Popovers, selects, tooltips and dialogs render in a PORTAL on `document.body`,
 * outside the render container. To judge an OPEN state, pass `document.body` —
 * scanning the container would only see the trigger that opened it.
 */
export async function expectNoA11yViolations(
  ui: ReactElement | Element,
  options?: JestAxeConfigureOptions,
): Promise<void> {
  const container = ui instanceof Element ? ui : render(ui).container;
  const results = await axe(container, {
    ...options,
    rules: { ...PAGE_LEVEL_RULES, ...options?.rules },
  });
  expect(results).toHaveNoViolations();
}
