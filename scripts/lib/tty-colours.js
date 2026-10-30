/**
 * **ΧΡΩΜΑΤΑ ΤΕΡΜΑΤΙΚΟΥ** — ANSI μόνο όταν η έξοδος είναι τερματικός (TTY)· σε pipe / CI / αρχείο ⇒ καθαρό κείμενο.
 *
 * 🧹 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ADR-924 §8.10, jscpd): η ίδια παλέτα `useColour ? \`\x1b[31m…\` : s` ζούσε σε τέσσερις πύλες
 * (3.15 · 3.17 · 3.35 · 3.91), βγήκε στο φως όταν μεταφέρθηκαν μαζί στην όψη του commit.
 *
 * @module scripts/lib/tty-colours
 */

'use strict';

const CODES = Object.freeze({ red: 31, green: 32, yellow: 33, cyan: 36, dim: 2, bold: 1 });

/**
 * @param {{isTTY?: boolean}} [stream] η ροή που θα δεχτεί το κείμενο — προεπιλογή το stdout
 * @returns {Record<keyof typeof CODES, (s: string) => string>}
 */
function ttyColours(stream = process.stdout) {
  const on = Boolean(stream.isTTY);
  return Object.fromEntries(Object.entries(CODES)
    .map(([name, code]) => [name, (s) => (on ? `\x1b[${code}m${s}\x1b[0m` : s)]));
}

module.exports = { ttyColours };
