'use strict';

/**
 * =============================================================================
 * CHECK 3.57 (ADR-788) — ΧΤΙΖΟΥΝ ΟΛΟΙ ΤΟΝ **ΙΔΙΟ** SERVER;
 * =============================================================================
 *
 * ΤΟ ΕΡΩΤΗΜΑ: «κάθε production build αυτού του repo παράγει τον server που
 * **στέλνεται**, ή απλώς κάτι που του μοιάζει;»
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ 🔴 ΤΟ ΣΧΟΛΙΟ ΥΠΗΡΧΕ ΚΑΙ ΑΠΕΤΥΧΕ. ΜΕΤΡΗΜΕΝΑ.                              │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Δύο workflows γράφουν, **κατά λέξη**, «Any workflow calling build:ci MUST set
 * NODE_OPTIONS itself». Ένα τρίτο το αγνόησε. Μετρημένο στο ίδιο commit
 * (2026-08-21, run 32458992910):
 *
 *   docker-build.yml   (Tier 1)        **20** μεταβλητές → ✅ build 14′15″
 *   bundle-ratchet.yml                 **20** μεταβλητές → ✅ build
 *   i18n-shell-slice.yml (ο ΧΡΗΣΜΟΣ)    **1** μεταβλητή  → ❌ OOM στα ~4,1 GB
 *
 * Και το σχόλιο **μέσα** στο τρίτο έλεγε ότι το πρόβλημα ήταν «**μία γραμμή
 * env**» που είχε ήδη προστεθεί. Έλειπαν **19 από τις 20**: η περιγραφή της
 * διόρθωσης ήταν **η ίδια η απόκλιση**. Αποτέλεσμα: ο ΧΡΗΣΜΟΣ του CHECK 3.51
 * δεν έτρεξε **ΟΥΤΕ ΜΙΑ ΦΟΡΑ** επί 13 ημέρες, και η baseline του δεν υπήρξε
 * ποτέ. Ίδιο σχήμα με τις δύο λίστες namespace του CHECK 3.34 (απόκλιση **63**)
 * και τη λίστα 18-έναντι-26 του CHECK 3.37: *ένα anchor χωρίς gate είναι
 * σχόλιο* (CHECK 3.36).
 *
 * 🔑 Η ΑΥΘΕΝΤΙΑ ΔΕΝ ΕΙΝΑΙ ΟΝΟΜΑ ΑΡΧΕΙΟΥ — ΕΙΝΑΙ ΡΟΛΟΣ
 * ---------------------------------------------------
 * Κανονική είναι η κλήση που ζει στο **Tier 1** workflow, όπως το δηλώνει το
 * `.ci-gate-tiers.json`. Δηλαδή: *ο ορισμός του «σωστού build» είναι «αυτό που
 * φτάνει στην παραγωγή»*, και τον διαβάζουμε από το υπάρχον μητρώο αντί να τον
 * ξαναγράψουμε. Χειρόγραφο `docker-build.yml` εδώ θα ήταν **τέταρτη** λίστα.
 *
 * 🏆 ΓΙΑΤΙ Η ΠΥΛΗ ΜΕΤΡΑ ΤΗΝ ΙΣΟΤΙΜΙΑ ΑΛΛΑ **ΟΝΟΜΑΖΕΙ** ΤΗΝ ΕΠΑΝΑΛΗΨΗ
 * -------------------------------------------------------------------
 * Η βιομηχανική απάντηση στο πρόβλημα δεν είναι «κράτα τις λίστες
 * συγχρονισμένες» — είναι **«build once, deploy many»**: χτίζεις **μία** φορά
 * και **προάγεις το ίδιο artifact**· το ξαναχτίσιμο ανά pipeline είναι
 * τεκμηριωμένο anti-pattern. Γι' αυτό ο ΧΡΗΣΜΟΣ έπαψε να χτίζει και τραβάει την
 * εικόνα που στάλθηκε. Ό,τι **ακόμη** ξαναχτίζει δεν είναι παράβαση σήμερα —
 * είναι **🔶 μετρημένο υπόλοιπο** με γραμμένη κατεύθυνση. Μια πύλη που έλεγε
 * «όλα καλά» για δύο builds θα θεσμοθετούσε την επανάληψη· μια που τα έλεγε
 * παραβίαση θα ήταν μονίμως κόκκινη ⇒ `SKIP_` ⇒ διακοσμητική (CHECK 3.39).
 *
 * ⚠️ ΤΟ ΚΡΙΤΗΡΙΟ «ΨΑΞΕ ΓΙΑ `npm run build`» ΜΕΤΡΗΘΗΚΕ ΚΑΙ ΑΠΟΡΡΙΦΘΗΚΕ
 * ------------------------------------------------------------------
 * Το `build` (σε αντίθεση με το `build:ci`) καρφώνει
 * `cross-env NODE_OPTIONS=--max-old-space-size=8192`, που **σβήνει** ό,τι έθεσε
 * το workflow — η αιτία του περιστατικού 2026-08-04. Ένας κανόνας «καμία κλήση
 * `npm run build`» όμως έδωσε **1 εύρημα, 1 ψευδώς θετικό = 100%**: το
 * `ssot-discover.yml:466` γράφει `npm run build:tokens` **μέσα σε echo** μιας
 * περίληψης. Κρατήθηκε αρνητική αναζήτηση `build(?!:)` — και το υπόλοιπο
 * (εντολή μέσα σε κείμενο περίληψης) είναι **δηλωμένο όριο**, μετρημένο 0.
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');

const { listWorkflowFiles, readWorkflowRunSteps } = require('../ci/workflow-meta');

/** Ρητές καταστάσεις. Άγνωστη ⇒ `throw` ΜΕ ΟΝΟΜΑ (κλειστή λογιστική). */
const STATES = Object.freeze({
  CANONICAL: 'canonical-build',
  DRIFT: 'env-drift',
  VALUE_DRIFT: 'env-value-drift',
  CROSS_ENV: 'cross-env-build',
  OPAQUE: 'unanalyzable-caller',
  REDUNDANT: 'redundant-parity-build',
});

/** ⛔ ΜΠΛΟΚΑΡΟΥΝ. Δεν υπάρχει «λιγότερα builds με λάθος περιβάλλον από χθες». */
const BLOCKING = Object.freeze([STATES.DRIFT, STATES.VALUE_DRIFT, STATES.CROSS_ENV, STATES.OPAQUE]);
/** 🔶 Μετριέται, δεν μπλοκάρει — βλ. «build once, deploy many» στην κεφαλίδα. */
const COUNTED = Object.freeze([STATES.REDUNDANT]);

/** Η εντολή που χτίζει τον server της παραγωγής. */
const CI_BUILD = /\bbuild:ci\b/;
/** Το `build` **χωρίς** `:` — σβήνει το NODE_OPTIONS του workflow μέσω cross-env. */
const CROSS_ENV_BUILD = /\b(?:pnpm|npm|yarn)\s+run\s+build(?![:\w])/;

/**
 * Οι κλήσεις production build σε **όλα** τα workflows και τις τοπικές ενέργειες.
 *
 * ⚠️ Οι τοπικές σύνθετες ενέργειες (`.github/actions/*`) σαρώνονται κι αυτές:
 * μια κλήση κρυμμένη πίσω από `uses: ./.github/actions/x` θα ήταν **αόρατη**
 * στον αναγνώστη workflow, δηλαδή σιωπηλή απουσία. Δεν μπορεί να αποδοθεί
 * περιβάλλον σε αυτήν ⇒ `unanalyzable-caller`, ποτέ «καθαρή».
 *
 * @param {string} projectRoot
 * @returns {Array<{file: string, job: string, env: object, opaque: boolean, crossEnv: boolean}>}
 */
function findBuildCallers(projectRoot) {
  const workflowsDir = path.join(projectRoot, '.github', 'workflows');
  const callers = [];

  for (const file of listWorkflowFiles(workflowsDir)) {
    for (const step of readWorkflowRunSteps(path.join(workflowsDir, file))) {
      if (CI_BUILD.test(step.run)) {
        callers.push({ file, job: step.job, env: step.env || {}, opaque: false, crossEnv: false });
      } else if (CROSS_ENV_BUILD.test(step.run)) {
        callers.push({ file, job: step.job, env: step.env || {}, opaque: false, crossEnv: true });
      }
    }
  }

  const actionsDir = path.join(projectRoot, '.github', 'actions');
  if (fs.existsSync(actionsDir)) {
    for (const name of fs.readdirSync(actionsDir)) {
      const file = path.join(actionsDir, name, 'action.yml');
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (CI_BUILD.test(text) || CROSS_ENV_BUILD.test(text)) {
        callers.push({ file: `actions/${name}/action.yml`, job: '—', env: {}, opaque: true, crossEnv: false });
      }
    }
  }

  return callers;
}

/**
 * Ποιο workflow **στέλνει** στην παραγωγή; Το λέει το μητρώο, όχι εμείς.
 * @param {object} registry το `.ci-gate-tiers.json`
 * @returns {Set<string>} ονόματα αρχείων Tier 1
 */
function tierOneFiles(registry) {
  return new Set((registry.gates || []).filter((gate) => gate.tier === 1).map((gate) => gate.file));
}

/**
 * Η κρίση. **Κάθε** κλήση παίρνει ακριβώς μία κατάσταση.
 *
 * @param {Array} callers
 * @param {Set<string>} tier1
 * @returns {{records: Array, canonical: ?object}}
 */
function judge(callers, tier1) {
  const canonical = callers.find((caller) => tier1.has(caller.file) && !caller.opaque && !caller.crossEnv);
  const records = [];

  for (const caller of callers) {
    if (caller === canonical) {
      records.push({ ...caller, state: STATES.CANONICAL, detail: 'η κλήση που στέλνει στην παραγωγή (Tier 1)' });
      continue;
    }
    if (caller.opaque) {
      records.push({ ...caller, state: STATES.OPAQUE, detail: 'production build μέσα σε σύνθετη ενέργεια — το περιβάλλον του δεν αποδίδεται' });
      continue;
    }
    if (caller.crossEnv) {
      records.push({ ...caller, state: STATES.CROSS_ENV, detail: 'καλεί `run build`, που καρφώνει NODE_OPTIONS=8192 μέσω cross-env και ΣΒΗΝΕΙ ό,τι έθεσε το workflow' });
      continue;
    }
    if (!canonical) {
      records.push({ ...caller, state: STATES.DRIFT, detail: 'δεν υπάρχει κανονική κλήση Tier 1 για σύγκριση' });
      continue;
    }

    const missing = Object.keys(canonical.env).filter((key) => !(key in caller.env));
    if (missing.length > 0) {
      records.push({ ...caller, state: STATES.DRIFT, detail: `λείπουν ${missing.length}/${Object.keys(canonical.env).length}: ${missing.join(', ')}` });
      continue;
    }
    const different = Object.keys(canonical.env).filter((key) => caller.env[key] !== canonical.env[key]);
    if (different.length > 0) {
      records.push({ ...caller, state: STATES.VALUE_DRIFT, detail: `άλλη τιμή σε: ${different.join(', ')}` });
      continue;
    }
    records.push({ ...caller, state: STATES.REDUNDANT, detail: 'ίδιο περιβάλλον, αλλά ΔΕΥΤΕΡΟ build του ίδιου commit — η κατεύθυνση είναι να καταναλώνει την εικόνα' });
  }

  return { records, canonical: canonical || null };
}

/**
 * Κλειστή λογιστική, fail-closed.
 * ⚠️ Τυπώνει **και** τους κάδους που δεν μπλοκάρουν, ακόμα και στο μηδέν: ένα «0»
 * που δεν τυπώνεται διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος» (CHECK 3.48 Κ6).
 */
function census(records) {
  const known = new Set(Object.values(STATES));
  const out = {};
  for (const state of known) out[state] = 0;
  for (const record of records) {
    if (!known.has(record.state)) {
      throw new Error(`CHECK 3.57: άγνωστη κατάσταση "${record.state}" στο ${record.file}`);
    }
    out[record.state] += 1;
  }
  const total = Object.values(out).reduce((sum, count) => sum + count, 0);
  if (total !== records.length) {
    throw new Error(`CHECK 3.57: η λογιστική δεν κλείνει — ${total} ≠ ${records.length}`);
  }
  return out;
}

module.exports = { STATES, BLOCKING, COUNTED, CI_BUILD, CROSS_ENV_BUILD, findBuildCallers, tierOneFiles, judge, census };
