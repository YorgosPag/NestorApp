'use strict';

/**
 * 🔴 Η ΚΡΙΣΗ ΤΗΣ ΕΓΚΥΡΟΤΗΤΑΣ ΒΑΣΕΩΝ — ADR-775 §16 (η μηχανή, όχι το CLI)
 *
 * Ερώτημα: **«απεικονίζει αυτή η βάση αυτό που ισχυρίζεται ότι ελέγχει;»**
 *
 * ΔΥΟ ΚΛΕΙΣΤΑ ΣΥΜΠΑΝΤΑ, ποτέ ένα άθροισμα με «ή»:
 *  Α) κάθε **αρχείο** βάσης  → `blank` · `indistinct` · `orphan` · `valid`
 *  Β) κάθε **προσδοκία** spec → `missing` · `unresolvable` · `never-baselined` · `satisfied`
 *
 * ⚠️ **ΓΙΑΤΙ `indistinct` ΚΑΙ ΟΧΙ «ανίχνευση σελίδας σφάλματος»** (που ζητούσε το handoff):
 * μετρήθηκε στο πραγματικό ιστορικό — από τις 39 άκυρες βάσεις, η **σελίδα σφάλματος** ήταν
 * **16**· οι υπόλοιπες 23 ήταν το **κέλυφος** της εφαρμογής, εξίσου άχρηστες και **εντελώς
 * διαφορετικές οπτικά**. Ένας ανιχνευτής «σελίδας σφάλματος» θα έπιανε 16/39 και θα ήταν
 * **αδρανής** από την επόμενη μέρα (καμία σελίδα σφάλματος δεν θα υπάρχει — ADR-749 §5).
 *
 * Η **ταυτοσημία** πιάνει **35/39** χωρίς καμία ευρετική, και πιάνει τον *μηχανισμό*: όταν ο
 * ζωγράφος δεν προσαρτάται, **κάθε** test φωτογραφίζει το **ίδιο** πράγμα. Δηλαδή η μαζική
 * αποδοχή αφήνει πάντα το ίδιο αποτύπωμα, όποια κι αν είναι η εικόνα που θα δείξει.
 * *Δεν αναγνωρίζουμε το πρόσωπο της βλάβης· αναγνωρίζουμε ότι δεν έχει σήμα.*
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { analyzePng } = require('./png-stats');

/** Οι matchers που καταναλώνουν βάση. **Και οι δύο** — αλλιώς το `toMatchSnapshot` του BIM 3D
 *  θα φαινόταν ορφανό (μετρημένο: 1 βάση). */
const CONSUMING_MATCHERS = ['toHaveScreenshot', 'toMatchSnapshot'];

const STATES = {
  'blank-baseline': { blocking: true, universe: 'file',
    why: 'ένα χρώμα ⇒ μηδενικό σήμα· δεν μπορεί να αποτύχει ποτέ' },
  'indistinct-baselines': { blocking: true, universe: 'file',
    why: 'ταυτόσημη με άλλη βάση του ίδιου spec+project ⇒ δεν ξεχωρίζει τα δύο tests' },
  'orphan-baseline': { blocking: true, universe: 'file',
    why: 'βάση που κανένα assertion δεν ζητά' },
  'valid-baseline': { blocking: false, universe: 'file',
    why: 'βάση με σήμα, μοναδική, ζητούμενη' },
  'missing-baseline': { blocking: true, universe: 'expectation',
    why: 'το spec ζητά βάση που δεν υπάρχει, ενώ το project έχει ήδη βάσεις για αυτό το spec' },
  'unresolvable-arg': { blocking: false, universe: 'expectation',
    why: '🔶 το όνομα δεν είναι κυριολεκτικό ⇒ δεν κρίνεται (δηλωμένο τυφλό σημείο)' },
  'spec-never-baselined': { blocking: false, universe: 'expectation',
    why: '🔶 spec χωρίς καμία βάση πουθενά ⇒ ερώτημα εκτέλεσης (ADR-775 §11), όχι εγκυρότητας' },
  'satisfied-expectation': { blocking: false, universe: 'expectation',
    why: 'η ζητούμενη βάση υπάρχει' },
};

const sha = (file) =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/**
 * Ο αναλυτής ονόματος βάσης **παράγεται από το ίδιο το `snapshotPathTemplate`** — τα ονόματα
 * των projects έρχονται από το config, ώστε ένα `{arg}` με παύλες (`fit-to-view`) να μην
 * μπερδεύεται με τον διαχωριστή. Χειρόγραφο regex εδώ θα ήταν δεύτερη ανάγνωση του προτύπου.
 */
function baselineNameParser(template, projectNames) {
  const fileTemplate = template.split('/').pop();
  const alternation = projectNames
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length)
    .join('|');
  const pattern = fileTemplate
    .replace(/\{arg\}/g, '(?<arg>.+)')
    .replace(/\{projectName\}/g, `(?<project>${alternation})`)
    .replace(/\{platform\}/g, '(?<platform>[A-Za-z0-9]+)')
    .replace(/\{ext\}/g, '(?<ext>\\.[A-Za-z0-9]+)');
  return new RegExp(`^${pattern}$`);
}

function classifyFiles(files, expectedArgs) {
  const byHash = new Map();
  for (const f of files) {
    const key = `${f.specDir}|${f.project}|${sha(f.absPath)}`;
    if (!byHash.has(key)) byHash.set(key, []);
    byHash.get(key).push(f);
  }
  return files.map((f) => {
    const stats = analyzePng(f.absPath);
    const twins = byHash.get(`${f.specDir}|${f.project}|${sha(f.absPath)}`)
      .filter((o) => o.absPath !== f.absPath);
    const wanted = expectedArgs.has(`${f.specDir}|${f.arg}`);
    return { ...f, stats, twins: twins.map((t) => t.arg), state: fileState(stats, twins, wanted) };
  });
}

function fileState(stats, twins, wanted) {
  if (stats.ink.count === 0) return 'blank-baseline';
  if (twins.length > 0) return 'indistinct-baselines';
  if (!wanted) return 'orphan-baseline';
  return 'valid-baseline';
}

function classifyExpectations(expectations, filesBySpecArg, specsWithBaselines) {
  return expectations.map((e) => {
    if (!e.resolved) return { ...e, state: 'unresolvable-arg' };
    if (!specsWithBaselines.has(e.specDir)) return { ...e, state: 'spec-never-baselined' };
    const found = filesBySpecArg.get(`${e.specDir}|${e.argFile}`);
    return { ...e, state: found ? 'satisfied-expectation' : 'missing-baseline' };
  });
}

/** Κλειστή λογιστική ανά σύμπαν — άγνωστη κατάσταση ⇒ `throw` **με όνομα**. */
function censusOf(rows, universe) {
  const census = {};
  for (const state of Object.keys(STATES)) {
    if (STATES[state].universe === universe) census[state] = 0;
  }
  for (const row of rows) {
    if (!(row.state in census)) {
      throw new Error(`[golden-validity] άγνωστη κατάσταση «${row.state}» στο σύμπαν ${universe}`);
    }
    census[row.state] += 1;
  }
  const total = Object.values(census).reduce((a, b) => a + b, 0);
  if (total !== rows.length) {
    throw new Error(`[golden-validity] η λογιστική δεν κλείνει: ${total} ≠ ${rows.length}`);
  }
  return census;
}

function evaluate({ files, expectations }) {
  const expectedArgs = new Set(
    expectations.filter((e) => e.resolved).map((e) => `${e.specDir}|${e.argFile}`),
  );
  const classifiedFiles = classifyFiles(files, expectedArgs);
  const filesBySpecArg = new Map(classifiedFiles.map((f) => [`${f.specDir}|${f.arg}`, f]));
  const specsWithBaselines = new Set(classifiedFiles.map((f) => f.specDir));
  const classifiedExpectations =
    classifyExpectations(expectations, filesBySpecArg, specsWithBaselines);

  const rows = [...classifiedFiles, ...classifiedExpectations];
  return {
    files: classifiedFiles,
    expectations: classifiedExpectations,
    census: {
      file: censusOf(classifiedFiles, 'file'),
      expectation: censusOf(classifiedExpectations, 'expectation'),
    },
    findings: rows.filter((r) => STATES[r.state].blocking),
  };
}

module.exports = { evaluate, baselineNameParser, STATES, CONSUMING_MATCHERS };
