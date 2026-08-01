/**
 * Service-integration harness — globals installed BEFORE any test module loads.
 *
 * Jest `setupFiles` runs before module registry population, which matters here:
 * both fixes below have to be in place *at import time*, not at `beforeAll`.
 *
 * @module tests/service-integration/_harness/setup-env
 * @see jest.config.service-integration.js
 */

import { TextDecoder, TextEncoder } from 'util';

// jsdom does not expose the WHATWG encoding globals, but the Firestore web SDK
// (and `@firebase/rules-unit-testing` on top of it) uses them to frame
// WebChannel payloads. Missing here they surface as an opaque
// "TextEncoder is not defined" from inside the bundled SDK, several frames away
// from anything a reader would connect to jsdom.
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder as unknown as typeof globalThis.TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;
}

// Firebase config for `src/lib/firebase.ts`. The contact-link suites mock that
// module wholesale (see firestore-seam.ts), so these values are never used to
// reach a network — but any *other* module pulled in transitively may still
// import it, and `initializeApp` throws on an undefined `projectId`. A
// `demo-` prefixed id is the Firebase convention for "emulator only, never
// billable", so a misconfiguration cannot silently reach a real project.
process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??= 'demo-api-key';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??= 'demo-nestor-service-it.firebaseapp.com';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??= 'demo-nestor-service-it';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??= 'demo-nestor-service-it.appspot.com';
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??= '0';
process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??= 'demo-app-id';
