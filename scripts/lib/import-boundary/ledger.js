/**
 * Ο κοινός πυρήνας των πυλών «**ΕΝΑ σύνορο εισαγωγής**» — η ωμή εισαγωγή ζει ΜΟΝΟ στο module-σύνορο και σε ένα κλειστό
 * σύνολο ιδιοκτητών με λόγο (CHECK 3.61 πλοήγηση · CHECK 3.75 χάρτης).
 *
 * 🧹 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ADR-924 §8.8, jscpd): οι δύο πύλες ήταν δίδυμες σε πέντε σημεία — ίδιος περιπατητής, ίδια κρίση
 * δηλώσεων, ίδιος βρόχος με ίδια κλειστή λογιστική, ίδια μηνύματα με άλλο αριθμό πύλης. Η πύλη κρατά μόνο ό,τι τη
 * διαφοροποιεί: ποιο αρχείο είναι τι (`judgeFile`), τι σημαίνει «αναφέρει ακόμη» (`mentions`), πώς λέγεται το εύρημα.
 *
 * Όλα διαβάζουν από την ΕΙΣΟΔΟ της πύλης (ADR-924): με `--index` η όψη του commit.
 *
 * @module scripts/lib/import-boundary/ledger
 */

'use strict';

const path = require('node:path');

const { openGateInput } = require('../gate-input');
const { isTypeScriptSource } = require('../module-graph/scan-config');

const REPO = path.resolve(__dirname, '..', '..', '..');

/** Ελάχιστο μήκος λόγου — «ok» δεν είναι λόγος (πρότυπο CHECK 3.35/3.50/3.58). */
const MIN_REASON = 40;

/** Ο παρονομαστής: κάθε `.ts`/`.tsx` (όχι `.d.ts`) του φακέλου — πριν το προφίλτρο. */
function boundaryPopulation(dir, input = openGateInput({ root: REPO })) {
  return input.files([dir], { accept: isTypeScriptSource });
}

/**
 * Κρίνει τις **δηλώσεις**, όχι τα αρχεία: *ορφανή* (το αρχείο έφυγε ή δεν αναφέρει πια το ωμό) και *χωρίς λόγο*.
 * 🔑 Χωρίς αυτό το κλειστό σύνολο **σαπίζει σιωπηλά** (πρότυπο CHECK 3.50 · 3.59 `Κ2` · 3.60 `Κ2`).
 * ⚠️ Το κριτήριο ορφανότητας είναι «ΑΝΑΦΕΡΕΙ», όχι «ΕΙΣΑΓΕΙ»: η άγκυρα του συνόρου κάνει `jest.mock(...)` χωρίς να εισάγει.
 */
function judgeOwnerDeclarations({ owners, input, mentions, states, orphanDetail }) {
  const verdicts = [];
  for (const [rel, reason] of Object.entries(owners)) {
    const text = input.read(rel);
    if (text === null || !mentions(text)) {
      verdicts.push({ rel, state: states.ORPHAN_OWNER, detail: orphanDetail });
      continue;
    }
    if (typeof reason !== 'string' || reason.trim().length < MIN_REASON) {
      verdicts.push({ rel, state: states.REASONLESS_OWNER, detail: 'δήλωση χωρίς ουσιαστικό λόγο' });
    }
  }
  return verdicts;
}

/** Μετρά τις ετυμηγορίες σε ΚΛΕΙΣΤΟ κατάστιχο — άγνωστη κατάσταση ⇒ σφάλμα με όνομα, ποτέ σιωπή. */
function countInto(tally, verdicts, check, what, labelOf) {
  for (const v of verdicts) {
    if (!Object.hasOwn(tally, v.state)) {
      throw new Error(`[${check}] ΑΓΝΩΣΤΗ κατάσταση ${what} "${v.state}"${labelOf ? ` για ${labelOf(v)}` : ''}.`);
    }
    tally[v.state] += 1;
  }
}

/** Το άθροισμα του κατάστιχου ΟΦΕΙΛΕΙ να ισούται με τον πληθυσμό — αλλιώς κάτι μετρήθηκε δύο φορές ή καμία. */
function assertClosed(tally, expected, check, what) {
  const counted = Object.values(tally).reduce((a, b) => a + b, 0);
  if (counted !== expected) throw new Error(`[${check}] Η ΛΟΓΙΣΤΙΚΗ ${what} ΔΕΝ ΚΛΕΙΝΕΙ: ${counted} ≠ ${expected}.`);
}

/**
 * Σαρώνει **ΟΛΟ** το δέντρο και κλείνει τα δύο κατάστιχα (αρχεία · δηλώσεις).
 * ⚠️ ΠΑΝΤΑ ΠΛΗΡΗΣ: η αφαίρεση μιας δήλωσης ξανα-ταξινομεί αρχείο που κανείς δεν έστειλε.
 * ⚠️ ΔΥΟ κατάστιχα, ποτέ ένα: ιδιοκτήτης χωρίς λόγο είναι ΚΑΙ αρχείο `owner` ΚΑΙ δήλωση `reasonless-owner`.
 *
 * @param {{check: string, root: string, owners: object, input: object, states: object,
 *          fileStates: string[], ownerStates: string[], judgeFile: (rel: string, text: string) => object,
 *          bypassDetail: (hit: object) => string, judgeOwners: () => object[], relOf: (abs: string) => string}} spec
 */
function sweepBoundary(spec) {
  const { check, root, owners, input, states } = spec;
  const files = boundaryPopulation(path.join(root, 'src'), input);
  const fileTally = Object.fromEntries(spec.fileStates.map((s) => [s, 0]));
  const violations = [];

  for (const full of files) {
    const rel = spec.relOf(full);
    const verdict = spec.judgeFile(rel, input.read(full) ?? '');
    countInto(fileTally, [verdict], check, 'αρχείου', () => rel);
    if (verdict.state !== states.BOUNDARY_BYPASS) continue;
    for (const hit of verdict.hits) violations.push({ rel, state: verdict.state, detail: spec.bypassDetail(hit) });
  }

  const ownerTally = Object.fromEntries(spec.ownerStates.map((s) => [s, 0]));
  const declared = Object.keys(owners);
  const flagged = spec.judgeOwners();
  countInto(ownerTally, flagged, check, 'δήλωσης', (v) => v.rel);
  violations.push(...flagged);
  ownerTally[states.OWNER] = declared.length - flagged.length;

  assertClosed(fileTally, files.length, check, 'ΑΡΧΕΙΩΝ');
  assertClosed(ownerTally, declared.length, check, 'ΔΗΛΩΣΕΩΝ');
  return { fileTally, ownerTally, violations, population: files.length, declared: declared.length };
}

module.exports = { MIN_REASON, boundaryPopulation, judgeOwnerDeclarations, countInto, sweepBoundary };
