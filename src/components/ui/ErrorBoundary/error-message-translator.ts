// ============================================================================
// 🏢 ENTERPRISE: Error Message Translator — Single Source of Truth
// ============================================================================
// Maps raw V8 / React engine error messages to i18n keys so the ErrorBoundary
// always surfaces user-facing messages in the active locale (Greek / English).
//
// WHY: Browser & React errors are hardcoded English strings thrown by the JS
// engine or React source — they bypass the application i18n pipeline entirely.
// This translator intercepts them at the boundary layer and maps known patterns
// to locale-aware messages. Unknown errors fall back to errors.general.unknown.
//
// ADDING A PATTERN: append to ERROR_PATTERN_MAP in priority order (most
// specific first). Each entry is pure data — zero side effects.
//
// @see errors.json (el/en) — runtime.* section
// @pattern Google — Pattern registry + pure function, zero duplication
// ============================================================================

import type { TFunction } from 'i18next';

// ── Pattern Entry Types ──────────────────────────────────────────────────────

interface ErrorPatternEntry {
  /** Regex tested against `error.message` */
  pattern: RegExp;
  /** i18n key to look up (e.g. "errors:runtime.referenceError") */
  key: string;
  /**
   * Optional extractor — pulls named interpolation values from the regex match.
   * Return value is spread into the t() interpolation object.
   */
  extract?: (match: RegExpMatchArray) => Record<string, string>;
}

// ── Pattern Registry (SSoT) ──────────────────────────────────────────────────
// Order matters: most specific patterns first.

const ERROR_PATTERN_MAP: readonly ErrorPatternEntry[] = [
  // ── React Hooks ─────────────────────────────────────────────────────────────
  {
    pattern: /Should have a queue|Invalid hook call|Hooks conditionally|likely calling Hooks/i,
    key: 'errors:runtime.invalidHookCall',
  },

  // ── React Reconciler ────────────────────────────────────────────────────────
  {
    pattern: /Maximum update depth exceeded/i,
    key: 'errors:runtime.maximumUpdateDepth',
  },
  {
    pattern: /Minified React error #(\d+)/i,
    key: 'errors:runtime.reactMinified',
    extract: (m) => ({ code: m[1] }),
  },

  // ── V8 / SpiderMonkey — ReferenceError ──────────────────────────────────────
  {
    pattern: /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*) is not defined$/i,
    key: 'errors:runtime.referenceError',
    extract: (m) => ({ identifier: m[1] }),
  },
  // Broader fallback for more verbose ReferenceError variants
  {
    pattern: /([A-Za-z_$][\w$]*) is not defined/i,
    key: 'errors:runtime.referenceError',
    extract: (m) => ({ identifier: m[1] }),
  },

  // ── V8 — Stack overflow ──────────────────────────────────────────────────────
  {
    pattern: /Maximum call stack size exceeded/i,
    key: 'errors:runtime.maximumCallStack',
  },

  // ── V8 / JSON parsing ────────────────────────────────────────────────────────
  {
    pattern: /Unexpected end of (?:JSON )?input/i,
    key: 'errors:runtime.unexpectedEndOfInput',
  },
  {
    pattern: /Unexpected token/i,
    key: 'errors:runtime.unexpectedToken',
  },

  // ── V8 — Null / undefined property access ────────────────────────────────────
  {
    pattern: /Cannot read propert(?:y|ies) of (undefined|null)/i,
    key: 'errors:runtime.nullReference',
    extract: (m) => ({ type: m[1] }),
  },
  {
    pattern: /null is not an object/i,
    key: 'errors:runtime.nullReference',
    extract: () => ({ type: 'null' }),
  },

  // ── Webpack / Next.js chunk loading ──────────────────────────────────────────
  {
    pattern: /ChunkLoadError|Loading chunk \d+ failed|Failed to load/i,
    key: 'errors:runtime.chunkLoadError',
  },

  // ── Network ──────────────────────────────────────────────────────────────────
  {
    pattern: /Failed to fetch|NetworkError|net::ERR_/i,
    key: 'errors:network.connectionFailed',
  },
  {
    pattern: /Request timeout|TIMEOUT/i,
    key: 'errors:network.timeout',
  },

  // ── Auth / Firestore ─────────────────────────────────────────────────────────
  {
    pattern: /permission.denied|PERMISSION_DENIED/i,
    key: 'errors:generic.permissionDenied',
  },
  {
    pattern: /unauthenticated|not authenticated/i,
    key: 'errors:auth.accessDenied',
  },
] as const;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Translate a raw JS / React engine error message to the active locale.
 *
 * Falls back to `errors:general.unknown` when no pattern matches.
 * The original English message is never surfaced to end users.
 *
 * @param error  The caught Error object
 * @param t      i18next TFunction from the active locale context
 * @returns      Translated, human-readable error string
 */
export function translateErrorMessage(error: Error, t: TFunction): string {
  const message = error.message;

  for (const entry of ERROR_PATTERN_MAP) {
    const match = message.match(entry.pattern);
    if (match) {
      const interpolation = entry.extract ? entry.extract(match) : {};
      return t(entry.key, interpolation);
    }
  }

  return t('errors:general.unknown');
}

/**
 * Returns the i18n key that would be used for this error (for testing / logging).
 * Does NOT perform translation.
 */
export function getErrorTranslationKey(error: Error): string {
  const message = error.message;

  for (const entry of ERROR_PATTERN_MAP) {
    if (entry.pattern.test(message)) {
      return entry.key;
    }
  }

  return 'errors:general.unknown';
}
