/**
 * @fileoverview **«Ζήτησε ο webpack module που ΔΕΝ υπάρχει στον runtime του;»**
 * @related ADR-860 §Ε6 · ADR-858 §5.5
 * @module lib/app-version/chunk-recovery/missing-module-error
 *
 * 🔴 **ΤΟ ΣΗΜΑ ΠΟΥ ΤΟ ADR-860 ΘΕΩΡΟΥΣΕ ΚΑΛΥΜΜΕΝΟ.** Ένα RSC payload **άλλου build** αναφέρει
 * modules με ids του δικού του γράφου. Ο React Flight client τα εκτελεί **κατά την ανάγνωση**
 * του payload — **πριν** ο έλεγχος `buildId` του Next (`fetch-server-response.js:140`) προλάβει
 * να κάνει πλήρη πλοήγηση. Αν το chunk id είναι «ήδη εγκατεστημένο» με το περιεχόμενο του
 * **τρέχοντος** build, το module λείπει και ο `__webpack_require__` σκάει στο
 * `__webpack_modules__[id].call(...)`:
 *
 *   V8       `Cannot read properties of undefined (reading 'call')`
 *   Firefox  `can't access property "call", e[r] is undefined`
 *   Safari   `undefined is not an object (evaluating 'e[r].call')`
 *
 * 🔑 **ΤΑΞΙΝΟΜΗΣΗ ΜΕ ΤΟΠΟ, ΟΧΙ ΜΟΝΟ ΜΕ ΚΕΙΜΕΝΟ.** Το μήνυμα από μόνο του θα έπιανε **κάθε**
 * `undefined.call` της εφαρμογής. Απαιτείται και η **πρώτη** γραμμή της στοίβας να είναι μέσα
 * στο chunk του webpack runtime (`/_next/static/chunks/webpack-*.js`): εκεί η **μόνη** κλήση
 * `.call` σε ό,τι μπορεί να λείπει είναι το εργοστάσιο του module.
 *
 * ⛔ **ADR-858**: ούτε αυτό το σήμα ανανεώνει μόνο του. Οδηγεί **μόνο** σε ερώτηση έκδοσης
 * (`resolveBySkew`)· ίδιο build ⇒ το σφάλμα μένει ορατό, όπως πριν.
 */

const WEBPACK_RUNTIME_CHUNK = '/_next/static/chunks/webpack-';

/** Γραμμή στοίβας: V8 (`    at …`) ή Firefox/Safari (`fn@url`). */
const FRAME_LINE = /^\s*at\s|@/;

function firstFrame(stack: string): string | null {
  return stack.split('\n').find((line) => FRAME_LINE.test(line)) ?? null;
}

/** `true` **μόνο** όταν ο ίδιος ο webpack runtime δεν βρήκε το εργοστάσιο ενός module. */
export function isMissingModuleError(error: unknown): error is TypeError {
  if (!(error instanceof TypeError)) return false;
  if (!/\bcall\b/.test(error.message)) return false;
  const frame = typeof error.stack === 'string' ? firstFrame(error.stack) : null;
  return frame !== null && frame.includes(WEBPACK_RUNTIME_CHUNK);
}
