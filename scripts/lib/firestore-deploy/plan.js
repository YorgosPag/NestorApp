/**
 * ADR-865 §11 — ΤΟ ΠΛΑΝΟ: «ΤΙ πρέπει να γίνει στην παραγωγή πριν κυκλοφορήσει αυτός ο κώδικας;»
 *
 * **Καθαρή**: δέχεται την ετυμηγορία του ζωντανού (`drift.judgeLive`) και αποφασίζει. Κανένα
 * δίκτυο, κανένας δίσκος — τη γράφει στο GitHub το `verify-live.js --plan`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΠΛΑΝΟ → ΕΓΚΡΙΣΗ → ΕΦΑΡΜΟΓΗ (Terraform) · ΜΟΝΟ ΑΝ ΔΙΑΦΕΡΕΙ (Argo CD)
 * ────────────────────────────────────────────────────────────────────────────
 * Argo CD: *«An automated sync will only be performed if the application is OutOfSync»*. Η
 * έγκριση ζητείται από την **πραγματική διαφορά** — όχι από «ποια αρχεία άλλαξαν». Φίλτρο
 * διαδρομών θα έχανε ακριβώς τη βλάβη που γέννησε το ADR: ο κανόνας άλλαξε, και **21 commits**
 * αργότερα έλειπε ακόμη (§1) — κανένα από αυτά δεν άγγιζε το αρχείο.
 *
 * | Ετυμηγορία | Πλάνο | Γιατί |
 * |---|---|---|
 * | ο πάροχος δεν απάντησε | **blocked** | fail-closed: άγνωστο ≠ «εντάξει» — κανένας κώδικας χωρίς απάντηση |
 * | κανόνες ≠ δέντρο · δείκτης **λείπει** | **apply** (μόνο αυτοί οι στόχοι) | ο κώδικας τα χρειάζεται |
 * | **μόνο** δείκτες εκτός αρχείου | **none** + προειδοποίηση | διαγραφή σπάει ερωτήματα **αμέσως**· Argo CD: prune off by default |
 * | δείκτης χτίζεται (μετά από αναμονή) | **blocked** | τα ερωτήματά του **αποτυγχάνουν** μέχρι READY |
 * | δείκτης `NEEDS_REPAIR` | **none** + προειδοποίηση | δεν τον προκάλεσε η έκδοση· δεν διορθώνεται με deploy |
 *
 * @module scripts/lib/firestore-deploy/plan
 */

'use strict';

const { SYNC, HEALTH, EXIT } = require('./drift');

const ACTION = Object.freeze({ NONE: 'none', APPLY: 'apply', BLOCKED: 'blocked' });

/** Χρειάζεται deploy ο στόχος; Οι δείκτες **μόνο** όταν κάτι λείπει — ποτέ για να σβήσουν. */
function needsApply(verdict) {
  if (verdict.sync !== SYNC.OUT_OF_SYNC) return false;
  return verdict.missing === undefined ? true : verdict.missing.length > 0;
}

function warningsOf(verdicts) {
  const out = [];
  for (const v of verdicts) {
    if (v.extra && v.extra.length > 0) {
      out.push(`${v.target}: ${v.extra.length} ζωντανά ΕΚΤΟΣ αρχείου — δεν σβήνονται αυτόματα (απόφαση ανθρώπου)`);
    }
    if (v.health === HEALTH.DEGRADED) out.push(`${v.target}: δείκτης σε NEEDS_REPAIR — Console → Firestore → Indexes`);
  }
  return out;
}

/**
 * @param {{verdicts: object[], exitCode: number}} result `judgeLive` (μετά από `--wait`)
 * @returns {{action:string, targets:string[], reason:string, warnings:string[]}}
 */
function planDeployment(result) {
  const warnings = warningsOf(result.verdicts);
  if (result.exitCode === EXIT.ERROR) {
    const failed = result.verdicts.filter((v) => v.sync === SYNC.UNKNOWN).map((v) => v.target);
    return { action: ACTION.BLOCKED, targets: [], warnings,
      reason: `ο πάροχος δεν απάντησε για: ${failed.join(', ')} — καμία κυκλοφορία χωρίς ετυμηγορία` };
  }
  const targets = result.verdicts.filter(needsApply).map((v) => v.target);
  if (targets.length > 0) {
    return { action: ACTION.APPLY, targets, warnings,
      reason: `η παραγωγή διαφέρει στο: ${targets.join(', ')} — ανάπτυξη με έγκριση, πριν τον κώδικα` };
  }
  const building = result.verdicts.filter((v) => v.health === HEALTH.PROGRESSING).map((v) => v.target);
  if (building.length > 0) {
    return { action: ACTION.BLOCKED, targets: [], warnings,
      reason: `δείκτης χτίζεται ακόμη μετά την αναμονή (${building.join(', ')}) — τα ερωτήματά του αποτυγχάνουν` };
  }
  return { action: ACTION.NONE, targets: [], warnings,
    reason: 'η παραγωγή = το δέντρο σε ό,τι χρειάζεται ο κώδικας' };
}

// ============================================================================
// ΑΠΟΔΟΣΗ — η σελίδα έγκρισης δείχνει ΤΙ θα αλλάξει (Terraform plan)
// ============================================================================

const ICON = Object.freeze({ [ACTION.NONE]: '✅', [ACTION.APPLY]: '⏸️', [ACTION.BLOCKED]: '⛔' });
const LIST_LIMIT = 50;

/** Κελί πίνακα markdown — χωρίς `|` και αλλαγές γραμμής που θα έσπαγαν τη γραμμή. */
const cell = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

function listBlock(title, items, format = (x) => x) {
  if (!items || items.length === 0) return [];
  const shown = items.slice(0, LIST_LIMIT).map((item) => `- \`${cell(format(item))}\``);
  const more = items.length > LIST_LIMIT ? [`- … και ${items.length - LIST_LIMIT} ακόμη`] : [];
  return ['', `**${title}** (${items.length})`, '', ...shown, ...more];
}

function verdictDetails(v) {
  return [
    ...listBlock(`${v.target} — λείπουν ζωντανά`, v.missing),
    ...listBlock(`${v.target} — ζωντανά ΕΚΤΟΣ αρχείου (δεν σβήνονται)`, v.extra),
    ...listBlock(`${v.target} — δεν είναι διαθέσιμα`, v.notReady, (n) => `${n.label} · ${n.state}`),
  ];
}

/** @returns {string} markdown για το `$GITHUB_STEP_SUMMARY` */
function renderPlanMarkdown(project, result, plan) {
  const rows = result.verdicts.map((v) =>
    `| \`${v.target}\` | ${v.sync} | ${v.health} | ${v.origin ?? '—'} | ${cell(v.detail)} |`);
  return [
    `## ${ICON[plan.action]} Firebase · ${project} · πλάνο: **${plan.action}**`,
    '',
    plan.reason,
    ...(plan.targets.length > 0 ? ['', `Στόχοι ανάπτυξης: ${plan.targets.map((t) => `\`${t}\``).join(', ')}`] : []),
    '',
    '| Στόχος | Sync | Health | Προέλευση | Λεπτομέρεια |',
    '|---|---|---|---|---|',
    ...rows,
    ...result.verdicts.flatMap(verdictDetails),
    ...(plan.warnings.length > 0 ? ['', '**⚠️ Προειδοποιήσεις**', '', ...plan.warnings.map((w) => `- ${w}`)] : []),
    '',
    '<sub>ADR-865 §11 — ρωτήθηκε ο πάροχος, όχι το μητρώο.</sub>',
    '',
  ].join('\n');
}

module.exports = { ACTION, planDeployment, renderPlanMarkdown, needsApply };
