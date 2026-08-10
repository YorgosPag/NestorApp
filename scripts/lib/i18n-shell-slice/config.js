#!/usr/bin/env node
/**
 * ADR-744 §4 — the reviewed part.
 *
 * Everything else in this folder is derived automatically; this file is where a
 * human states the handful of decisions a parser cannot make. Two of them earn
 * their place:
 *
 *   extraShellRoots     the walk cuts at `next/dynamic`. If evidence ever shows
 *                       a lazily-chunked surface flashing a raw key, name it
 *                       here instead of following every dynamic edge (which
 *                       measured 7.492 files / 2,93 MB — the whole application).
 *
 *   dynamicKeyPolicy    `t(step.titleKey)` cannot be resolved from its own file.
 *                       The generator REFUSES to emit until every such call site
 *                       is listed here with a reason. That refusal is the whole
 *                       design: an unclassified dynamic key is exactly how a raw
 *                       key reaches the screen, and silence would hide it.
 *
 * Defaults live in code, not in the JSON, so a deleted config file degrades to
 * "the documented behaviour" rather than to "no shell at all".
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CONFIG_FILE = '.i18n-shell-slice.json';

const DEFAULTS = Object.freeze({
  /**
   * What renders without a route transition to hide behind.
   *
   * A `**` pattern rather than a list, on purpose: a new nested layout joins the
   * shell the moment it is created, with no config edit. An enumerated list is
   * exactly the rot this ADR exists to remove — it would go stale the same way
   * `CRITICAL_NAMESPACES` did.
   *
   * `src/app/(app)/page.tsx` earns its place as the one PAGE in the set: it is the
   * application's cold-entry route (URL `/`), reached with no prior navigation, so
   * nothing carries a loading state for it. Deeper routes stay out — covering them
   * means per-route slices, which this machinery already supports (ADR-744 §8, Φ4).
   *
   * ⚠️ ADR-777 §8.12 — ΤΟ ΜΟΝΟΠΑΤΙ ΑΛΛΑΞΕ ΜΕ ΤΗ ΜΕΤΑΚΟΜΙΣΗ ΤΟΥ ΚΕΛΥΦΟΥΣ. Το URL
   * παραμένει `/`· ένα route group `(app)` είναι ΦΑΚΕΛΟΣ και δεν εμφανίζεται στο URL.
   * Το πρώτο pattern βρίσκει μόνο του κάθε νέο layout (`(app)`, `(auth)`, `(bare)`)·
   * το δεύτερο είναι ΚΥΡΙΟΛΕΚΤΙΚΟ και έπρεπε να ενημερωθεί με το χέρι — και το
   * `resolveRoots` (plan.js:76) ΠΕΤΑΕΙ «shell root not found» αν δεν υπάρχει, δηλαδή
   * η αστοχία είναι ΘΟΡΥΒΩΔΗΣ, όχι σιωπηλή. Μην αφαιρέσεις αυτόν τον φρουρό.
   */
  shellRoots: ['src/app/**/layout.tsx', 'src/app/(app)/page.tsx'],
  extraShellRoots: [],

  /**
   * Namespaces that ship whole regardless of what the closure derives.
   *
   * A MIGRATION LEDGER, NOT A SECOND LIST. Each entry is a namespace that was
   * synchronous before ADR-744 and that the derived closure does not reach, so
   * emitting the slice without it would trade one class of raw key for another.
   * It differs from the list this ADR deletes in the only way that matters: it
   * is small, it is reasoned, the generator prints its byte cost on every run,
   * and it is meant to reach zero when per-route slices land.
   */
  guaranteedNamespaces: {},

  // el ONLY, deliberately. `getInitialLanguage()` in src/i18n/config.ts returns
  // DEFAULT_LANGUAGE unconditionally (to avoid an SSR/CSR mismatch) and
  // fallbackLng is the same 'el', so the synchronous `en` half of today's
  // bootstrap — 147 KB of the 295 KB — can never be read before the async
  // preload has already replaced it. A language switch goes through
  // changeLanguage() → preloadCriticalNamespaces(), which awaits.
  languages: ['el'],

  localesDir: 'src/i18n/locales',
  outputDir: 'src/i18n/generated',

  // Registered constant trees whose leaves ARE i18n keys, so `t(CONST.a.b)`
  // resolves instead of forcing a whole-namespace fallback.
  keyConstants: [{ file: 'src/config/notification-keys.ts', exportName: 'NOTIFICATION_KEYS' }],

  // The i18n plumbing forwards `t(key, options)`; it is not a consumer, and its
  // doc comments contain example `useTranslation([...])` calls.
  excludeConsumers: ['src/i18n/'],

  dynamicKeyPolicy: {},
});

function readJsonIfPresent(file) {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${CONFIG_FILE} is not valid JSON: ${error.message}`);
  }
}

/** Rejects an unknown top-level field rather than ignoring it — a typo'd key must not read as "no policy". */
function assertKnownFields(raw) {
  const unknown = Object.keys(raw).filter(key => !(key in DEFAULTS) && !key.startsWith('$'));
  if (unknown.length > 0) {
    throw new Error(`${CONFIG_FILE}: unknown field(s) ${unknown.join(', ')}`);
  }
}

function loadConfig(projectRoot) {
  const raw = readJsonIfPresent(path.join(projectRoot, CONFIG_FILE));
  assertKnownFields(raw);
  return { ...DEFAULTS, ...raw };
}

/** `{ns: 'x', key: 'a.b'}` from either `'x:a.b'` or a bare `'a.b'` (which means "every namespace the file declares"). */
function parsePolicyEntry(entry) {
  const cut = entry.indexOf(':');
  return cut === -1 ? { ns: null, key: entry } : { ns: entry.slice(0, cut), key: entry.slice(cut + 1) };
}

/**
 * The policy for one shell file, normalized. A file with unresolved dynamic
 * calls and no entry here yields `null`, which the generator treats as fatal.
 */
function policyFor(config, relFile) {
  const entry = config.dynamicKeyPolicy[relFile];
  if (!entry) return null;
  return {
    wholeNamespaces: entry.wholeNamespaces || [],
    prefixes: (entry.prefixes || []).map(parsePolicyEntry),
    keys: (entry.keys || []).map(parsePolicyEntry),
    reason: entry.reason || '',
  };
}

module.exports = { CONFIG_FILE, DEFAULTS, loadConfig, parsePolicyEntry, policyFor, assertKnownFields };
