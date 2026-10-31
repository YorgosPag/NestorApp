/**
 * CHECK 3.108 (ADR-280 §11) — το RATCHET των `order-bearing` κλήσεων, κατά ΤΑΥΤΟΤΗΤΑ.
 *
 * 🔴 ΓΙΑΤΙ RATCHET ΚΑΙ ΟΧΙ ΑΠΛΗ ΑΝΑΦΟΡΑ: μια `order-bearing` λίστα δεν είναι επανάληψη — η σειρά της διαλέγει ποια
 * από δύο ομώνυμες μεταφράσεις φτάνει στην οθόνη. Αυτό όμως είναι **σύγκρουση κλειδιών** ανάμεσα σε namespaces, και
 * χωρίς φράχτη θα γινόταν παραθυράκι: «πρόσθεσε ένα ξένο namespace με κοινό κλειδί και η χειρόγραφη οικογένεια
 * περνά». Οι 5 που μετρήθηκαν (2026-10-30) κλειδώνονται εδώ· κάθε ΝΕΑ μπλοκάρει. Θεραπεία: το επίπεδο (β) —
 * κάθε component ζητά μόνο τα namespaces του, ή ρητό `ns` στο κλειδί που συγκρούεται.
 *
 * Ταυτότητα = `αρχείο::[λίστα]` — όχι αριθμός γραμμής (μετακινείται με κάθε άσχετη αλλαγή).
 *
 * @module scripts/lib/i18n-namespace-family/baseline
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BASELINE_FILE = '.i18n-namespace-family-baseline.json';

const identityOf = (entry) => `${entry.file}::[${entry.items.join(',')}]`;

function countByIdentity(entries) {
  const counts = new Map();
  for (const e of entries) counts.set(identityOf(e), (counts.get(identityOf(e)) || 0) + 1);
  return counts;
}

/** Η baseline από την ΕΙΣΟΔΟ (ADR-924)· λείπει ⇒ κενή (κάθε `order-bearing` είναι νέα). Άκυρη ⇒ σφάλμα με όνομα. */
function readBaseline(input) {
  const text = input.read(BASELINE_FILE);
  if (text === null) return new Map();
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed.sites !== 'object') throw new Error(`CHECK 3.108 — ${BASELINE_FILE}: λείπει το «sites»`);
  return new Map(Object.entries(parsed.sites));
}

/** Νέες (πάνω από τη baseline) ⇒ μπλοκάρουν· μπαγιάτικες (κάτω) ⇒ αναφέρονται για σφίξιμο. */
function compareWithBaseline(entries, baseline) {
  const current = countByIdentity(entries);
  const fresh = entries.filter((e) => current.get(identityOf(e)) > (baseline.get(identityOf(e)) || 0));
  const stale = [...baseline].filter(([id, n]) => (current.get(id) || 0) < n).map(([id]) => id);
  return { fresh, stale };
}

function writeBaseline(root, entries) {
  const sites = Object.fromEntries([...countByIdentity(entries)].sort(([a], [b]) => a.localeCompare(b)));
  const payload = {
    _meta: {
      description: 'CHECK 3.108 — order-bearing λίστες useTranslation (ADR-280 §11): η σειρά διαλέγει μετάφραση. Μόνο μειώνεται.',
      check: 'CHECK 3.108',
      adr: 'ADR-280',
      generatedBy: 'node scripts/check-i18n-namespace-family.js --generate-baseline',
      totalSites: Object.keys(sites).length,
      note: 'Κ1/Κ2/Κ3 ΔΕΝ έχουν baseline — zero-tolerance, το codemod έφερε το δέντρο στο 0.',
    },
    sites,
  };
  fs.writeFileSync(path.join(root, BASELINE_FILE), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

module.exports = { BASELINE_FILE, identityOf, readBaseline, compareWithBaseline, writeBaseline };
