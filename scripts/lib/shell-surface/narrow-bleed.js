'use strict';

/**
 * @fileoverview ADR-797 Κ7 · ADR-912 §12.17 — **ο πέμπτος άξονας: «κενό καθόλου; — ΜΟΝΟ στο στενό»**.
 *
 * Το `bleed` (§3 του `shell-surface.css`) είναι δήλωση **διαδρομής**, σε κάθε πλάτος, και η πύλη τη βρίσκει στο
 * `page.tsx` ή ένα άλμα πιο μέσα. Η λεπτομέρεια ακινήτου με κάτοψη χρειάζεται **άλλο** ερώτημα: στο κινητό η κάτοψη
 * είναι καμβάς που πρέπει να φτάνει τις άκρες (Zillow · Idealista · Apple Maps), ενώ η ίδια διαδρομή σε desktop — και
 * η λίστα της στο κινητό — κρατούν τον διάδρομο. Η δήλωση είναι **υπό συνθήκη** και ζει **βαθιά**, άρα δεν τη βλέπει
 * ο κριτής σελίδας. Γι' αυτό σαρώνεται ΟΛΟ το `src/`: κάθε αρχείο που γράφει `data-shell-bleed` οφείλει γραμμή με
 * λόγο στο μητρώο, και κάθε γραμμή αρχείο που το γράφει (κλειστό σύνολο, ίδιο συμβόλαιο με το `bleed`).
 *
 * ⚠️ ΧΩΡΙΣΤΟ χαρακτηριστικό, ΟΧΙ τιμή του `data-shell-surface`: το `[data-shell-surface]` παίρνει διάδρομο (§2),
 *   άρα ένα `data-shell-surface="bleed-narrow"` θα έδινε στο ίδιο το στοιχείο κενό σε desktop.
 */

const fs = require('fs');
const path = require('path');

const { stripComments } = require('./scan');
const { collectTsx } = require('./measure-gap');

const NARROW_BLEED_ATTRIBUTE = /data-shell-bleed\s*=/;

/** Ένα κείμενο πηγής δηλώνει bleed-στο-στενό; (σχόλια εκτός — ένα σχόλιο που το εξηγεί δεν είναι δήλωση). */
function declaresNarrowBleed(source) {
  return NARROW_BLEED_ATTRIBUTE.test(stripComments(source));
}

/** Σάρωση του `src/`: τα αρχεία (σχετικά με τη ρίζα, `/`) που δηλώνουν bleed-στο-στενό, ταξινομημένα. */
function findNarrowBleedFiles(repoRoot) {
  const found = [];
  for (const file of collectTsx(path.join(repoRoot, 'src'))) {
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes('data-shell-bleed')) continue;
    if (declaresNarrowBleed(source)) found.push(path.relative(repoRoot, file).split(path.sep).join('/'));
  }
  return found.sort();
}

module.exports = { NARROW_BLEED_ATTRIBUTE, declaresNarrowBleed, findNarrowBleedFiles };
