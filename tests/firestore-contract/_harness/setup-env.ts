/**
 * Verified fake — σύνδεση του Admin SDK με τον emulator **πριν** φορτωθεί οποιοδήποτε module (ADR-742 §7sexdecies).
 *
 * Το `firebase-admin` διαβάζει το `FIRESTORE_EMULATOR_HOST` στην αρχικοποίηση: μέσα σε `beforeAll` θα ήταν αργά — το SDK
 * θα είχε ήδη συνδεθεί στην παραγωγή. Η θύρα ταιριάζει με το `firebase.json::emulators.firestore.port`· το έργο `demo-*`
 * δεν μπορεί ποτέ να αγγίξει πραγματικό έργο.
 *
 * @see tests/functions-integration/_harness/setup-env.ts (το ίδιο σχήμα)
 */

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT ?? 'demo-nestor-firestore-contract';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'demo-nestor-firestore-contract';
