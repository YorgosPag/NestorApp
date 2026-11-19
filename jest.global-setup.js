'use strict';
/**
 * 🔴 Φράχτης: καμία διεργασία της σουίτας jest δεν κληρονομεί το περιβάλλον git ενός hook.
 *
 * ΓΙΑΤΙ ΕΔΩ (και όχι στο `jest.setup.js`): το `process.env` μέσα στο sandbox ενός test είναι
 * **αντίγραφο** (jest-util `createProcessObject`), ενώ το `child_process` είναι πυρήνας του Node
 * και διαβάζει το **πραγματικό** `process.env`. Το `globalSetup` τρέχει στην κύρια διεργασία
 * **πριν** το `scheduleTests` (@jest/core 30, `runJest`), άρα:
 *   - οι workers, που γεννιούνται στο `scheduleTests`, κληρονομούν το καθαρό περιβάλλον·
 *   - με `--runInBand` τα tests τρέχουν στην ίδια διεργασία, ήδη καθαρή.
 *
 * Καλύπτει ΚΑΘΕ είσοδο στη σουίτα (hook, `run-jest-suite.js`, εκτελεστές αγκυρών), όχι μόνο μία.
 * Λίστα: `scripts/lib/git-hook-env.js` (SSoT). Περιστατικό: εκεί.
 */
const { scrubGitEnv } = require('./scripts/lib/git-hook-env');

/**
 * 🔑 Η ζώνη του προϊόντος (ADR-834 §6.5 · ADR-783). Οι άγκυρες «η ημέρα που συμφωνήθηκε είναι η
 * ημέρα που δείχνεται» (`*-term-day`) **αρνούνται** να περάσουν σε UTC, όπου το ελάττωμα είναι
 * δομικά αόρατο — σωστά. Ο runner του CI είναι UTC ⇒ κόκκινα που δεν λένε τίποτα για τον κώδικα.
 * Εδώ, πριν γεννηθούν οι workers, ώστε να το κληρονομούν (και με `--runInBand`: ο Node σε Linux
 * επανεκτιμά τη ζώνη όταν γραφτεί το `TZ`). Σε Windows ο Node αγνοεί τη μεταβλητή και διαβάζει τη
 * ζώνη του λειτουργικού — που στο μηχάνημα ανάπτυξης είναι ήδη αυτή.
 */
const PRODUCT_TIME_ZONE = 'Europe/Athens';

module.exports = async function jestGlobalSetup() {
  scrubGitEnv(process.env);
  process.env.TZ = PRODUCT_TIME_ZONE;
};
