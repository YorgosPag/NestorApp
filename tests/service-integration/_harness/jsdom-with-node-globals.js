/**
 * Jest test environment — jsdom, plus the Node web globals jsdom omits.
 *
 * ## Why this file exists
 *
 * The suite needs jsdom (the code under test is browser code that touches
 * `window`) **and** a working `fetch`/`Response` (`@firebase/rules-unit-testing`
 * PUTs the rules to the emulator over HTTP, and the Firestore web SDK frames
 * WebChannel payloads with the encoding globals). jsdom ships neither.
 *
 * Measured, not assumed — with plain `testEnvironment: 'jsdom'`:
 *   `ReferenceError: Response is not defined`
 *     at loadFirestoreRules (@firebase/rules-unit-testing/src/impl/rules.ts:50)
 *
 * Node has had all of these as globals since v18. They are missing only
 * because `jest-environment-jsdom` builds a fresh vm context and copies in a
 * curated list that predates them. This module's constructor runs in the
 * **Node** realm, so its `globalThis` is the real one — the values are handed
 * across rather than reimplemented.
 *
 * ## Why not the two obvious alternatives
 *
 *   - *Polyfill in `setupFiles`*: too late for some, and it would mean
 *     shipping a second implementation of `Response` (`undici` is not a
 *     dependency here — only `undici-types` is) purely to satisfy a test.
 *     A hand-rolled `Response` is a fake the suite would then be trusting.
 *   - *Switch to `testEnvironment: 'node'`*: that is what the sibling rules
 *     config does, and it is wrong for this suite. `RealtimeService.dispatch()`
 *     calls `window.dispatchEvent` unguarded; under node it throws inside
 *     `linkContactToEntity`'s try block *after* the write commits, so the
 *     service reports `{ success: false }` for a document that exists. The
 *     suite would be measuring a runtime the browser never has.
 *
 * ## Cross-realm caveat
 *
 * These objects belong to the Node realm, so `instanceof` against a jsdom
 * constructor of the same name is false. Nothing here compares that way — the
 * tests assert on `.status` / parsed bodies. Recorded for the next reader who
 * wonders why a `Response` "isn't" a `Response`.
 *
 * @module tests/service-integration/_harness/jsdom-with-node-globals
 * @see jest.config.service-integration.js
 */

const JSDOMEnvironment = require('jest-environment-jsdom').default;

/**
 * Globals present in Node ≥18 but absent from jsdom's context.
 *
 * Copied only when jsdom left the slot empty, so a future jsdom release that
 * implements one of these wins — the browser-shaped implementation is the more
 * faithful of the two for code that ships to a browser.
 */
const NODE_GLOBALS_TO_BRIDGE = [
  // HTTP — needed by rules-unit-testing's rules upload and by service fetch calls
  'fetch',
  'Headers',
  'Request',
  'Response',
  'FormData',
  // Streams — Response bodies are backed by these
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'Blob',
  // Encoding — Firestore WebChannel framing
  'TextEncoder',
  'TextDecoder',
  // Misc web platform surface the SDK feature-detects
  'structuredClone',
  'AbortController',
  'AbortSignal',
  'MessageChannel',
  'MessagePort',
  'BroadcastChannel',
  // Node-only timers. Not web platform, and deliberately kept last: `@grpc/grpc-js`
  // (pulled in transitively by the emulator client) schedules its transport
  // teardown with `setImmediate`. Without it the suite passes and then the
  // process dies during shutdown — green output, non-zero exit code, which in
  // CI reads as an infrastructure flake rather than a missing global.
  'setImmediate',
  'clearImmediate',
];

class JsdomWithNodeGlobals extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context);

    for (const name of NODE_GLOBALS_TO_BRIDGE) {
      if (this.global[name] === undefined && globalThis[name] !== undefined) {
        this.global[name] = globalThis[name];
      }
    }
  }
}

module.exports = JsdomWithNodeGlobals;
