'use strict';
/**
 * =============================================================================
 * Χ — ΑΠΟΚΩΔΙΚΟΠΟΙΗΣΗ ΟΝΤΟΤΗΤΩΝ HTML (CHECK 3.51 Χ · ADR-781 §14)
 * =============================================================================
 *
 * **Φύλλο** — δεν εισάγει τίποτα. Υπάρχει ως χωριστό αρχείο επειδή τη χρειάζονται
 * **δύο** αναγνώστες του ίδιου HTML: ο `probe.js` (κείμενο/attributes) και ο
 * `redirect-contract.js` (τιμή του `data-dgst`). Αν έμενε στον `probe.js`, ο
 * `redirect-contract.js` θα έπρεπε να τον εισάγει ενώ εκείνος εισάγει αυτόν —
 * **κύκλος**, που **κανένα gate δεν φυλάει κάτω από το `scripts/`**. Το δεύτερο
 * αντίγραφο θα ήταν ο sibling clone του N.18.
 * =============================================================================
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'" };

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(ENTITIES, name)) return ENTITIES[name];
    if (/^#\d+$/.test(name)) return String.fromCodePoint(Number(name.slice(1)));
    if (/^#x[0-9a-fA-F]+$/i.test(name)) return String.fromCodePoint(parseInt(name.slice(2), 16));
    return match;
  });
}

module.exports = { decodeEntities };
