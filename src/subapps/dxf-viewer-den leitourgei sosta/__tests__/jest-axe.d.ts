/**
 * Type declarations for jest-axe custom matchers
 * Extends Jest's Matchers interface to include toHaveNoViolations
 */

import 'jest-axe';

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveNoViolations(): R;
    }
  }
}
