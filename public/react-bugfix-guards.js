/**
 * Browser-side React bug guards.
 *
 * Loaded via <Script src="/react-bugfix-guards.js" strategy="beforeInteractive">
 * in src/app/layout.tsx. Server-side counterpart lives in instrumentation.ts.
 *
 * Replaces public/suppress-console.js (deprecated 2026-05-09, ADR-036).
 * Console filtering moved to Logger SSoT (src/lib/telemetry/Logger.ts) gated
 * by NEXT_PUBLIC_LOG_LEVEL — no global console monkey-patch.
 */

(function () {
  'use strict';

  // React 19.2.1 dev-mode describeNode bug:
  // indent-- → -1 → ''.repeat(-1) → RangeError. Clamp negative counts to 0.
  var origRepeat = String.prototype.repeat;
  String.prototype.repeat = function (count) {
    if (typeof count === 'number' && count < 0) return '';
    return origRepeat.call(this, count);
  };
})();
