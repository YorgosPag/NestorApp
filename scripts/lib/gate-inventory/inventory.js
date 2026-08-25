/**
 * CHECK 3.66 — Η ΑΠΟΓΡΑΦΗ ΤΩΝ ΠΥΛΩΝ (ADR-802). Η **παραγωγή**, χωρίς κρίση.
 *
 * Η κρίση ζει στο `scripts/check-gate-inventory.js`· εδώ μόνο «ποιες πύλες **τρέχουν**» και
 * «τι λέει το CLAUDE.md». Καθαρό: η σουίτα το οδηγεί με συνθετικές εισόδους.
 *
 * 🔴 **Η ΑΥΘΕΝΤΙΑ ΕΙΝΑΙ Η ΕΝΩΣΗ ΤΡΙΩΝ ΠΗΓΩΝ, ΠΟΤΕ ΜΙΑΣ** — και το απέδειξε η μέτρηση:
 *
 *   1. `scripts/run-checks-parallel.js` — ο δρομολογητής της Φάσης 1
 *   2. `scripts/git-hooks/pre-commit`   — οι φάσεις 0/0.5/0.6, που **δεν** περνούν από εκεί
 *   3. `.gate-inventory.json`           — κλειστό σύνολο πυλών **μόνο CI**, με λόγο
 *
 * ⚠️ **ΚΑΙ Η ΜΟΡΦΗ ΤΗΣ ΔΡΟΜΟΛΟΓΗΣΗΣ ΕΙΝΑΙ ΔΥΟ, ΟΧΙ ΜΙΑ.** Ο εκτελεστής έχει `addThread`
 * **και** `addBash`. Ένα κριτήριο καρφωμένο στο `addThread` μετρήθηκε ζωντανά: κατήγγελλε τα
 * **3.9** και **3.10** ως «γραμμές χωρίς εκτέλεση» — **2 ψευδώς θετικά στα 3**, δηλαδή 67%,
 * πάνω από κάθε πήχη. Γι' αυτό το μοτίβο είναι **αγνωστικό ως προς τη μορφή**
 * (`add<Οτιδήποτε>('3.NN'`): μια τρίτη μορφή αύριο καλύπτεται **δωρεάν**, ενώ μια λίστα
 * μορφών θα απέκλινε σιωπηλά — το σχήμα που κόστισε στο 3.34 (63) και στο 3.37 (18 vs 26).
 *
 * @module scripts/lib/gate-inventory/inventory
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** Κάθε μορφή δρομολόγησης του εκτελεστή — δες τη σημείωση παραπάνω. */
const DISPATCH_RE = /add[A-Za-z]+\('(3\.\d+)'/g;
/** Ο hook ονομάζει τις πύλες του σε σχόλιο/έξοδο· δεν έχει δρομολογητή. */
const HOOK_RE = /CHECK (3\.\d+)/g;
/** Γραμμή πίνακα του CLAUDE.md. */
const ROW_RE = /^\| \*\*(3\.\d+)\*\* \|/gm;
/** Οποιαδήποτε αναφορά — μια πύλη τεκμηριωμένη σε κανόνα (N.12/N.18) **είναι** τεκμηριωμένη. */
const MENTION_RE = /\b(3\.\d+)\b/g;
/**
 * 🔴 **ΟΙ ΓΡΑΜΜΕΣ ΤΟΥ ΠΙΝΑΚΑ ΑΦΑΙΡΟΥΝΤΑΙ ΠΡΙΝ ΜΕΤΡΗΘΟΥΝ ΟΙ ΑΝΑΦΟΡΕΣ — ΠΛΗΡΩΘΗΚΕ ΖΩΝΤΑΝΑ.**
 *
 * Οι γραμμές του πίνακα είναι γεμάτες **διασταυρούμενες παραπομπές** («ίδιο σχήμα με το
 * 3.34», «απορρίφθηκε γραπτώς στο 3.39»). Μια τέτοια παραπομπή **δεν τεκμηριώνει** την πύλη
 * που ονομάζει — μιλάει για **άλλη**.
 *
 * ⚠️ Μετρημένο τη στιγμή που γράφτηκε αυτή η πύλη: η **ίδια η γραμμή του 3.66** απαριθμούσε
 * τις εννέα αδήλωτες («εκστρατεία που τελειώνει στο μηδέν: 3.5·3.6·3.11…») και η μέτρηση
 * **κατέρρευσε από 9 σε 0**. Η πύλη θα ήταν πράσινη επειδή **περιέγραψε** το χρέος, όχι
 * επειδή το **έλυσε** — αυτο-ακύρωση, και μάλιστα αόρατη.
 *
 * Είναι η ίδια οικογένεια με το `Κ7β` του CHECK 3.50: *ένα σχόλιο που τεκμηριώνει παλιό
 * λεξιλόγιο δεν επιτρέπεται να μετριέται ως ζωντανό, αλλιώς κάθε κείμενο που περιγράφει τη
 * βλάβη γίνεται το ίδιο βλάβη.*
 */
const TABLE_ROW_LINE_RE = /^\|.*$/gm;

const EXECUTOR = 'scripts/run-checks-parallel.js';
const HOOK = 'scripts/git-hooks/pre-commit';
const GUIDE = 'CLAUDE.md';
const DECLARATIONS_FILE = '.gate-inventory.json';

/** Αριθμητική σειρά «3.5 < 3.11», ποτέ λεξικογραφική. */
function byGateNumber(a, b) {
  return Number(a.slice(2)) - Number(b.slice(2));
}

function matchIds(text, re) {
  return [...text.matchAll(new RegExp(re.source, re.flags))].map((m) => m[1]);
}

/** Fail-closed: αρχείο-αυθεντία που λείπει ⇒ σφάλμα με όνομα, ποτέ σιωπηλό κενό σύνολο. */
function readAuthority(repoRoot, rel) {
  const file = path.join(repoRoot, rel);
  if (!fs.existsSync(file)) {
    throw new Error(`${rel} λείπει — η απογραφή δεν έχει αυθεντία, και «κανένα εύρημα» θα ήταν ψέμα.`);
  }
  return fs.readFileSync(file, 'utf8');
}

/**
 * Οι δηλωμένες **μόνο-CI** πύλες. Κλειστό σύνολο με **υποχρεωτικό λόγο**.
 *
 * ⚠️ Δεν είναι «χειρόγραφη λίστα πυλών»: είναι η **fail-closed κατεύθυνσή** της. Ο κατάλογος
 * όσων **τρέχουν** παράγεται· εδώ δηλώνεται μόνο η **εξαίρεση** — «τεκμηριωμένη αλλά δεν
 * τρέχει σε pre-commit, και να γιατί». Ξεχασμένη εξαίρεση γίνεται ⛔ `ghost-row`.
 */
function readDeclarations(repoRoot) {
  const file = path.join(repoRoot, DECLARATIONS_FILE);
  if (!fs.existsSync(file)) {
    throw new Error(`${DECLARATIONS_FILE} λείπει — το κλειστό σύνολο είναι μέρος της πύλης.`);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!raw || typeof raw.ciOnlyGates !== 'object' || raw.ciOnlyGates === null) {
    throw new Error(`${DECLARATIONS_FILE}: περίμενα αντικείμενο "ciOnlyGates".`);
  }
  return raw.ciOnlyGates;
}

/**
 * Η απογραφή: ποιες πύλες τρέχουν, τι λέει ο οδηγός, τι δηλώθηκε.
 *
 * @param {string} repoRoot
 * @param {{executor?: string, hook?: string, guide?: string, declarations?: object}} [override]
 *        — μόνο για τη σουίτα· η παραγωγή διαβάζει πάντα από τον δίσκο.
 */
function takeInventory(repoRoot, override = {}) {
  const executor = override.executor ?? readAuthority(repoRoot, EXECUTOR);
  const hook = override.hook ?? readAuthority(repoRoot, HOOK);
  const guide = override.guide ?? readAuthority(repoRoot, GUIDE);
  const declarations = override.declarations ?? readDeclarations(repoRoot);

  const dispatched = new Set(matchIds(executor, DISPATCH_RE));
  const hooked = new Set(matchIds(hook, HOOK_RE));
  const runs = new Set([...dispatched, ...hooked]);
  const rows = new Set(matchIds(guide, ROW_RE));
  // ⚠️ ΧΩΡΙΣ τις γραμμές του πίνακα — δες TABLE_ROW_LINE_RE. Μια παραπομπή μέσα σε άλλη
  //    γραμμή είναι διασταύρωση, όχι τεκμηρίωση· μετρημένο ότι αλλιώς η πύλη αυτο-ακυρώνεται.
  const prose = guide.replace(TABLE_ROW_LINE_RE, '');
  const mentions = new Set(matchIds(prose, MENTION_RE));

  return {
    runs, rows, mentions, declarations,
    counts: { dispatched: dispatched.size, hooked: hooked.size, runs: runs.size, rows: rows.size },
  };
}

module.exports = {
  DISPATCH_RE,
  HOOK_RE,
  ROW_RE,
  MENTION_RE,
  TABLE_ROW_LINE_RE,
  EXECUTOR,
  HOOK,
  GUIDE,
  DECLARATIONS_FILE,
  byGateNumber,
  matchIds,
  takeInventory,
};
