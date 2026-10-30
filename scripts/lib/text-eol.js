/**
 * `text-eol.js` — Η ΜΙΑ απάντηση στο «κείμενο ανεξάρτητο από το `core.autocrlf`» (ADR-744 §30 · ADR-727 #2).
 *
 * ## Γιατί υπάρχει
 * Η ίδια ερώτηση απαντιόταν σε έξι σημεία με τρεις παραλλαγές (`\r\n` vs `\r\n?` vs +BOM/+trailing).
 * Διαφορετική παραλλαγή = διαφορετική απάντηση **στο ίδιο αρχείο**: ένα μοναχικό `\r` περνούσε
 * ακέραιο σε τέσσερα από τα έξι. Εδώ υπάρχει **μία** κανονικοποίηση γραμμών και οι πρόσθετες
 * επεμβάσεις (BOM · τελικά κενά) είναι **ρητές επιλογές**, όχι σιωπηλές διαφορές υλοποίησης.
 *
 * ⚠️ Το `i18n-shell-slice/slice-build.toLf` **δεν** εισάγει από εδώ ακόμη: είναι είσοδος του
 * toolchain digest (§30), οπότε η μετακόμιση θέλει αναγέννηση του manifest στο ίδιο commit.
 * Καταγραφή στο `.claude-rules/pending-ratchet-work.md`. Το `layer-one-checks.normalize` είναι
 * εκτός κλειστότητας `require` του `route-slices.js` ⇒ εισάγει ήδη από εδώ.
 *
 * @module scripts/lib/text-eol
 */

'use strict';

const BOM = /^﻿/;

/** Κάθε τερματισμός γραμμής (CRLF **και** μοναχικό CR) ⇒ LF. */
function toLf(text) {
  return text.replace(/\r\n?/g, '\n');
}

/**
 * LF + προαιρετικά: αφαίρεση BOM · κόψιμο τελικών κενών (`trimEnd`).
 *
 * @param {string} text
 * @param {{ stripBom?: boolean, trimEnd?: boolean }} [options]
 */
function toCanonicalText(text, { stripBom = false, trimEnd = false } = {}) {
  let out = toLf(stripBom ? text.replace(BOM, '') : text);
  if (trimEnd) out = out.trimEnd();
  return out;
}

module.exports = { toLf, toCanonicalText };
