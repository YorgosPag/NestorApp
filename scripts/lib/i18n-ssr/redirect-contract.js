'use strict';
/**
 * =============================================================================
 * Η ΑΝΑΚΑΤΕΥΘΥΝΣΗ ΠΟΥ ΔΕΝ ΜΠΟΡΕΣΕ ΝΑ ΓΙΝΕΙ ΚΩΔΙΚΟΣ (CHECK 3.51 Χ · ADR-781 §14)
 * =============================================================================
 *
 * 🔴 ΤΟ ΕΥΡΗΜΑ: μετά το `redirect: 'manual'` (§13) ο χρησμός έπιασε **2** ανακατευ-
 * θύνσεις, όχι 112. Οι 110 διαδρομές `/o/[workspace]/**` απαντούν **200** — το group
 * `(app)` έχει `loading.tsx` ⇒ Suspense ⇒ streaming ⇒ οι κεφαλίδες έχουν ήδη φύγει
 * όταν το layout ρίχνει `redirect()`. Ίδιος μηχανισμός με το `notFound()` του
 * `withheld-but-answered` («200 για streamed, 404 για μη streamed»).
 *
 * 🔑 ΑΠΟΔΕΙΞΗ ΑΠΟ ΤΗΝ ΙΔΙΑ ΤΗΝ ΑΠΑΝΤΗΣΗ — σχήμα του `backend-contract.js`. Το
 * σφάλμα της ανακατεύθυνσης φτάνει στο πλησιέστερο όριο Suspense, και το React
 * Fizz το γράφει στο DOM ως **δείκτη του ορίου** — μετρημένο 2026-09-23 στην
 * παραγωγή (Next 15.5.22):
 *
 *     <!--$!--><template data-dgst="NEXT_REDIRECT;replace;/login;307;"></template>
 *
 * Αυτό διαβάζει ο client router για να πλοηγηθεί. Είναι το **ίδιο** γεγονός με
 * το 3xx από άλλο κανάλι ⇒ **ίδια** κατάσταση `route-redirected`, **ίδια** ταυτότητα.
 *
 * ⚠️ ΓΙΑΤΙ ΤΟ `<template>` ΚΑΙ ΟΧΙ Η ΓΡΑΜΜΗ `E{…}` ΤΟΥ FLIGHT (αντίθετα από το
 * `backend-contract.js`): το flight φέρει **κάθε** ανακατεύθυνση που ρίχτηκε, και
 * layout και σελίδα αποδίδονται **παράλληλα**. Μετρημένο στο `/o/ssr-probe/account`:
 * το flight έχει **δύο** — `/account/profile` (η σελίδα) **και** `/login` (το layout)
 * — ενώ το DOM έχει **ένα**, το `/login`. Η σελίδα **δεν αποδόθηκε ποτέ**· ο
 * προορισμός της είναι θόρυβος. Το `<template>` είναι αυτό που **ζει** ο browser.
 *
 * ⚠️ ΓΙΑΤΙ Ο ΠΡΩΤΟΣ: η σειρά του εγγράφου είναι ντετερμινιστική (SSR), και ο πρώτος
 * δείκτης είναι το **εξωτερικότερο** όριο που απέτυχε — ό,τι είναι μέσα του
 * αντικαθίσταται μαζί του. Σταθερή επιλογή ⇒ σταθερή ταυτότητα ratchet.
 *
 * ⚠️ ΓΙΑΤΙ ΔΕΝ ΜΑΣ ΞΕΓΕΛΑ ΤΟ URL: ένα `params` της διαδρομής φτάνει στο HTML ως
 * **κείμενο**, άρα με `&lt;` — δεν μπορεί να γεννήσει στοιχείο `<template>`.
 *
 * 🔴 ΓΙΑΤΙ Ο ΑΝΑΛΥΤΗΣ ΕΙΝΑΙ ΔΙΚΟΣ ΜΑΣ ΚΑΙ ΟΧΙ `require('next/…')`: το job του
 * χρησμού (`i18n-ssr-oracle.yml`) **δεν εγκαθιστά εξαρτήσεις, επίτηδες** — «ό,τι
 * δεν εγκαθίσταται δεν μπορεί να αποκλίνει». Ένα `require('next')` εδώ θα έριχνε
 * **ολόκληρο** τον χρησμό στο CI. Η αυθεντία μένει όμως το Next.js: ο κανόνας
 * παρακάτω είναι **αυτολεξεί** ο `isRedirectError` (`redirect-error.js`) και ο
 * `getURLFromRedirectError` (`redirect.js`), και η άγκυρα **Α17** τον εκτελεί
 * **πλάι στο πραγματικό** `isRedirectError` σε σώμα έγκυρων και χαλασμένων digests.
 * Αναβάθμιση του Next που αλλάζει τον κανόνα ⇒ **κόκκινο στο jest** (CHECK 3.54),
 * όχι σιωπηλή απόκλιση στην παραγωγή.
 *
 * ⚠️ fail-closed: `NEXT_REDIRECT` που ο κανόνας **απορρίπτει** ⇒ `{ malformed }` ⇒
 * ⛔ `probe-unproven`, **ποτέ** `clean`: είδαμε ότι ο server ανακατεύθυνε και δεν
 * ξέρουμε πού — ο χρησμός δεν κοίταξε τη σελίδα που ζήτησε.
 * =============================================================================
 */

const { decodeEntities } = require('./html-entities');

/** `REDIRECT_ERROR_CODE` του Next.js. */
const REDIRECT_ERROR_CODE = 'NEXT_REDIRECT';
/** `RedirectStatusCode` του Next.js — SeeOther · TemporaryRedirect · PermanentRedirect. */
const REDIRECT_STATUS_CODES = Object.freeze(new Set([303, 307, 308]));
const REDIRECT_TYPES = Object.freeze(new Set(['replace', 'push']));

/** Το `data-dgst` ενός δείκτη ορίου Suspense. `[^>]*?` ⇒ ανεξάρτητο από τη σειρά attributes. */
const BOUNDARY_DIGEST = /<template\b[^>]*?\sdata-dgst="([^"]*)"/gi;

/**
 * `NEXT_REDIRECT;<είδος>;<προορισμός>;<κωδικός>;` — ο προορισμός **μπορεί** να
 * περιέχει `;`, γι' αυτό (όπως το Next) κόβονται τα άκρα και ενώνεται η μέση.
 *
 * @returns {null | {target: string, status: number}} `null` = το Next **δεν** θα το αναγνώριζε.
 */
function parseRedirectDigest(digest) {
  const parts = String(digest).split(';');
  const [code, type] = parts;
  const status = Number(parts.at(-2));
  if (code !== REDIRECT_ERROR_CODE || !REDIRECT_TYPES.has(type)) return null;
  if (Number.isNaN(status) || !REDIRECT_STATUS_CODES.has(status)) return null;
  return { target: parts.slice(2, -2).join(';'), status };
}

/**
 * Η ανακατεύθυνση που **δήλωσε** το DOM αυτής της απάντησης.
 *
 * @returns {null | {target: string, status: number} | {malformed: string}}
 *   `null` = κανένας δείκτης ανακατεύθυνσης (άλλα digests, π.χ. του `notFound()`, αγνοούνται).
 */
function declaredSoftRedirect(html) {
  const pattern = new RegExp(BOUNDARY_DIGEST.source, BOUNDARY_DIGEST.flags);
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const digest = decodeEntities(match[1]);
    if (digest.split(';')[0] !== REDIRECT_ERROR_CODE) continue;
    return parseRedirectDigest(digest) || { malformed: digest };
  }
  return null;
}

module.exports = { REDIRECT_ERROR_CODE, REDIRECT_STATUS_CODES, parseRedirectDigest, declaredSoftRedirect };
