/**
 * Functions integration test — env-var wiring (loaded BEFORE test modules).
 *
 * Jest `setupFiles` (not `setupFilesAfterEach`) runs before any test file is
 * imported. We need this for `firebase-admin`: the SDK reads emulator env vars
 * at module-load time, so setting them inside `beforeAll` is too late — the
 * Admin SDK would have already connected to production.
 *
 * Ports MUST match `firebase.json::emulators.*.port`. Keeping them as
 * literals (rather than parsing the JSON) is intentional — a misconfig here
 * crashes the test fast instead of silently hitting prod.
 *
 * @see firebase.json
 * @see jest.config.functions-integration.js
 */

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080';
process.env.STORAGE_EMULATOR_HOST = process.env.STORAGE_EMULATOR_HOST ?? 'http://localhost:9199';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? 'localhost:9099';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT ?? 'demo-nestor-functions-it';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'demo-nestor-functions-it';
process.env.FIREBASE_STORAGE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ?? 'demo-nestor-functions-it.appspot.com';
