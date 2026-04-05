/**
 * =============================================================================
 * ESLint Rule: no-direct-sonner-import (ADR-219 / SPEC-251C)
 * =============================================================================
 *
 * Forbids direct `import ... from 'sonner'` in application code.
 * Forces use of the centralized NotificationProvider (ADR-219), which wraps
 * sonner with enterprise defaults (position, duration, i18n, stacking,
 * deduplication, rate limiting, accessibility announcements).
 *
 * Blocked:
 *   import { toast } from 'sonner';
 *   import { toast, Toaster } from 'sonner';
 *   import sonner from 'sonner';
 *
 * Allowed:
 *   import { useNotification } from '@/providers/NotificationProvider';
 *
 * Exception:
 *   src/providers/NotificationProvider.tsx — THE centralized wrapper itself.
 *
 * WHY:
 * - Single source of truth for notification styling/behavior
 * - Centralized configuration (position, duration, max visible)
 * - i18n integration via t() calls inside the provider
 * - Rate limiting & deduplication (prevents spam toasts)
 * - Accessibility: screen reader announcements via aria-live
 * - Single point of change — swap sonner for another lib without touching 90+ files
 *
 * @see src/providers/NotificationProvider.tsx — Canonical implementation
 * @see docs/centralized-systems/reference/adrs/ADR-219-notification-toast-consolidation.md
 * @see docs/centralized-systems/reference/adrs/specs/SPEC-251C-toast-notification-consolidation.md
 *
 * @module eslint-rules/no-direct-sonner-import
 */

'use strict';

const path = require('path');

// Relative path (from repo root) of the legitimate sonner consumer.
// Using path.sep-agnostic comparison via normalization.
const ALLOWED_FILE_SUFFIX = path
  .join('src', 'providers', 'NotificationProvider.tsx')
  .split(path.sep)
  .join('/');

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Forbid direct 'sonner' imports — use useNotification() from @/providers/NotificationProvider (ADR-219, SPEC-251C)",
      category: 'Best Practices',
      recommended: true,
    },
    schema: [],
    messages: {
      directSonnerImport:
        "❌ Direct 'sonner' import is forbidden (ADR-219, SPEC-251C). " +
        "Use `import { useNotification } from '@/providers/NotificationProvider'` and call " +
        '`success()`, `error()`, `info()`, `warning()` on the hook. ' +
        'The centralized provider handles i18n, rate limiting, deduplication, and a11y.',
    },
  },

  create(context) {
    const filename = context.getFilename().split(path.sep).join('/');

    // Exception: the canonical wrapper is allowed to import sonner.
    if (filename.endsWith(ALLOWED_FILE_SUFFIX)) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        if (node.source && node.source.value === 'sonner') {
          context.report({
            node: node.source,
            messageId: 'directSonnerImport',
          });
        }
      },
    };
  },
};
