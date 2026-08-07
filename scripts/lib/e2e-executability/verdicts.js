#!/usr/bin/env node
/**
 * **Η ΚΡΙΣΗ του CHECK 3.46** — «μπορεί αυτή η σουίτα e2e να περάσει;» σε **τρεις ανεξάρτητες
 * ομάδες**, ποτέ μία με «ή».
 *
 * ## ΓΙΑΤΙ ΤΡΕΙΣ ΚΑΙ ΟΧΙ ΕΝΑΣ ΚΑΝΟΝΑΣ
 * Υπάρχουν τρεις τρόποι να μην μπορεί να περάσει μια σουίτα, και **κανένας δεν υποκαθιστά τον
 * άλλο**: ο πελάτης μπλοκάρεται πριν φτάσει (Α), το golden με το οποίο συγκρίνεται δεν είναι
 * δικό του (Β), ή η εντολή που θα την έτρεχε δείχνει στο πουθενά (Γ). Ένας κανόνας με «ή» θα
 * έμενε πράσινος πάνω σε δύο από τα τρία — το μάθημα του CHECK 3.41.
 *
 * | | ερώτηση | βλάβη όταν σπάει |
 * |---|---|---|
 * | **Α** ταυτότητα πελάτη | «ο UA μου περνά τον **δικό μας** bot-blocker;» | **403 χωρίς σώμα** |
 * | **Β** ταυτότητα golden | «η εικόνα που συγκρίνω είναι **δική μου**;» | διαφορά που δεν είναι regression |
 * | **Γ** στόχος εντολής | «η εντολή τρέχει **κάτι**;» | «No tests found» = σιωπηλά μηδέν κάλυψη |
 *
 * ## ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ, FAIL-CLOSED
 * Κάθε project κρίνεται από **Α και Β** (όχι «την πρώτη που ταιριάζει»), κάθε εντολή από **Γ**,
 * και τα αθροίσματα **πρέπει** να κλείνουν. Άγνωστη κατάσταση ⇒ `throw` με όνομα. Το πρότυπο
 * είναι το `auditPalette` του CHECK 3.39: εκεί η `Μμ7` απέδειξε ότι κάδος που **δηλώνεται αλλά
 * δεν ασκείται ποτέ** είναι φρουρός χωρίς απόδειξη ζωής, και το «0» του διαβάζεται ως
 * «κοίταξα και δεν υπάρχουν».
 *
 * @module scripts/lib/e2e-executability/verdicts
 */

'use strict';

const { blockingMatches } = require('./bot-patterns');

/** Τα δύο tokens που κάνουν ένα golden **δικό** ενός project σε μια πλατφόρμα. */
const IDENTITY_TOKENS = ['{projectName}', '{platform}'];

/**
 * Κάθε κατάσταση, με τον **λόγο** της. Οι ⛔ μπλοκάρουν· οι ✅ είναι δηλωμένα εντάξει.
 * Καμία σιωπηλή τρίτη επιλογή.
 */
const STATES = {
  // Α — ταυτότητα πελάτη
  'bot-blocked': { blocking: true, why: 'ο UA του project ταιριάζει στα BLOCKED_BOT_PATTERNS ⇒ 403 χωρίς σώμα' },
  'agent-unresolved': { blocking: true, why: 'ο UA δεν λύνεται στατικά — fail-closed, δεν μαντεύουμε' },
  'agent-clear': { blocking: false, why: 'ο UA περνά κάθε pattern του middleware' },
  // Β — ταυτότητα golden
  'ambiguous-golden': { blocking: true, why: 'ρητό snapshotPathTemplate χωρίς {projectName}/{platform}' },
  'golden-distinct': { blocking: false, why: 'το πρότυπο ξεχωρίζει project και πλατφόρμα' },
  'golden-default': { blocking: false, why: 'κανένα ρητό πρότυπο — το default του Playwright τα περιέχει' },
  // Γ — στόχος εντολής
  'phantom-target': { blocking: true, why: 'το φίλτρο δεν ταιριάζει σε κανένα υπαρκτό spec' },
  'target-resolved': { blocking: false, why: 'το φίλτρο ταιριάζει σε τουλάχιστον ένα spec' },
  'whole-suite': { blocking: false, why: 'χωρίς φίλτρο — τρέχει ολόκληρη η σουίτα' },
};

const GROUPS = {
  Α: ['bot-blocked', 'agent-unresolved', 'agent-clear'],
  Β: ['ambiguous-golden', 'golden-distinct', 'golden-default'],
  Γ: ['phantom-target', 'target-resolved', 'whole-suite'],
};

// ── Ομάδα Α ─────────────────────────────────────────────────────────────────────────

/** @returns {{state: string, detail: string}} */
function judgeAgent(project, patterns) {
  if (project.userAgent === null) {
    const why = project.unresolved.length > 0
      ? project.unresolved.join(' · ')
      : 'κανένα userAgent και κανένα device descriptor ⇒ ο headless browser στέλνει τον δικό του';
    return { state: 'agent-unresolved', detail: why };
  }
  const hits = blockingMatches(project.userAgent, patterns);
  if (hits.length > 0) {
    return { state: 'bot-blocked', detail: `ταιριάζει: ${hits.join(', ')} — πηγή UA: ${project.userAgentSource}` };
  }
  return { state: 'agent-clear', detail: project.userAgentSource };
}

// ── Ομάδα Β ─────────────────────────────────────────────────────────────────────────

/** @returns {{state: string, detail: string}} */
function judgeGolden(project) {
  if (project.snapshotTemplate === null) {
    return { state: 'golden-default', detail: 'χωρίς ρητό πρότυπο' };
  }
  const missing = IDENTITY_TOKENS.filter((token) => !project.snapshotTemplate.includes(token));
  if (missing.length > 0) {
    return {
      state: 'ambiguous-golden',
      detail: `λείπουν ${missing.join(' και ')} από «${project.snapshotTemplate}»`,
    };
  }
  return { state: 'golden-distinct', detail: project.snapshotTemplate };
}

// ── Ομάδα Γ ─────────────────────────────────────────────────────────────────────────

/**
 * Τα ορίσματα-φίλτρα μιας εντολής `playwright test`. Το Playwright τα ερμηνεύει ως **regex πάνω
 * στο μονοπάτι** του αρχείου — όχι ως μονοπάτια — γι' αυτό η κρίση ρωτά «ταιριάζει κάπου;» και
 * όχι «υπάρχει το αρχείο;». Ένα κριτήριο ύπαρξης θα έβγαζε ψευδώς θετικά σε κάθε νόμιμο φίλτρο.
 */
function filterArgsOf(command) {
  const tokens = command.trim().split(/\s+/);
  const testIndex = tokens.findIndex((t) => t === 'test');
  if (testIndex === -1 || !tokens.slice(0, testIndex).some((t) => t.endsWith('playwright'))) {
    return null;
  }
  return tokens.slice(testIndex + 1).filter((t) => !t.startsWith('-'));
}

/** @returns {{state: string, detail: string}} */
function judgeTarget(filters, specPaths) {
  if (filters.length === 0) return { state: 'whole-suite', detail: 'χωρίς φίλτρο' };

  const phantoms = filters.filter((filter) => !matchesAnySpec(filter, specPaths));
  if (phantoms.length > 0) {
    return { state: 'phantom-target', detail: `κανένα spec για: ${phantoms.join(', ')}` };
  }
  return { state: 'target-resolved', detail: filters.join(', ') };
}

function matchesAnySpec(filter, specPaths) {
  let pattern;
  try {
    pattern = new RegExp(filter);
  } catch {
    // Μη έγκυρο regex ⇒ σύγκριση ως σκέτο υποσυμβολοσειρά, όπως θα το έβλεπε ο χρήστης.
    return specPaths.some((spec) => spec.includes(filter));
  }
  return specPaths.some((spec) => pattern.test(spec));
}

// ── Συγκέντρωση + κλειστή λογιστική ─────────────────────────────────────────────────

/**
 * Κρίνει τα πάντα και **αποδεικνύει ότι δεν χάθηκε τίποτα**.
 *
 * @returns {{findings: Array<object>, census: object, judged: number}}
 */
function evaluate({ projects, patterns, scripts, specPaths }) {
  const findings = [];
  const census = emptyCensus();

  for (const project of projects) {
    for (const verdict of [judgeAgent(project, patterns), judgeGolden(project)]) {
      record(census, findings, verdict, `project «${project.name}»`);
    }
  }
  for (const { name, command } of scripts) {
    const filters = filterArgsOf(command);
    if (filters === null) continue; // δεν είναι `playwright test` — δεν αφορά την ομάδα Γ
    record(census, findings, judgeTarget(filters, specPaths), `npm script «${name}»`);
  }

  assertBalanced(census, projects.length);
  return { findings, census, judged: totalOf(census) };
}

function emptyCensus() {
  const census = {};
  for (const state of Object.keys(STATES)) census[state] = 0;
  return census;
}

function record(census, findings, verdict, subject) {
  const state = STATES[verdict.state];
  if (state === undefined) {
    throw new Error(`[3.46] άγνωστη κατάσταση «${verdict.state}» για ${subject} — fail-closed.`);
  }
  census[verdict.state] += 1;
  if (state.blocking) {
    findings.push({ subject, state: verdict.state, detail: verdict.detail, why: state.why });
  }
}

/**
 * Η λογιστική **της ίδιας της λογιστικής**: κάθε project πρέπει να έχει κριθεί από **Α ΚΑΙ Β**.
 * Ένα άθροισμα που κλείνει χωρίς να ρωτά «ποιος κρίθηκε» επικυρώνει τον εαυτό του — το ακριβές
 * σφάλμα που το `Κ1` του CHECK 3.39 υπάρχει για να μην ξανασυμβεί.
 */
function assertBalanced(census, projectCount) {
  for (const group of ['Α', 'Β']) {
    const counted = GROUPS[group].reduce((sum, state) => sum + census[state], 0);
    if (counted !== projectCount) {
      throw new Error(
        `[3.46] η ομάδα ${group} έκρινε ${counted} από ${projectCount} projects — `
        + 'κάποιο δεν κρίθηκε καθόλου. Fail-closed.',
      );
    }
  }
}

function totalOf(census) {
  return Object.values(census).reduce((sum, n) => sum + n, 0);
}

module.exports = {
  evaluate,
  judgeAgent,
  judgeGolden,
  judgeTarget,
  filterArgsOf,
  assertBalanced,
  STATES,
  GROUPS,
  IDENTITY_TOKENS,
};
