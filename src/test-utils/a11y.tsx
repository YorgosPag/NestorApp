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
 * a vetted dev/test-only exception (see .license-allowlist.json, approved
 * 2026-07-08 for G11). Neither ships in the production bundle.
 */

import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations, type JestAxeConfigureOptions } from 'jest-axe';

// Register the matcher once, at import time, for every test that pulls this in.
expect.extend(toHaveNoViolations);

export { axe };

/**
 * Render (or accept an already-rendered container) and assert zero axe
 * violations. Pass a ReactElement to render+scan it, or an Element to scan an
 * existing container (e.g. `render(<X/>).container`).
 */
export async function expectNoA11yViolations(
  ui: ReactElement | Element,
  options?: JestAxeConfigureOptions,
): Promise<void> {
  const container = ui instanceof Element ? ui : render(ui).container;
  const results = await axe(container, options);
  expect(results).toHaveNoViolations();
}
