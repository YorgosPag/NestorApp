/**
 * ADR-865 §11 — άγκυρες της ΓΡΑΜΜΗΣ ΠΑΡΑΓΩΓΗΣ: η παραγωγή Firebase ελέγχεται (3) και ενημερώνεται
 * (4) από το CI, και ο κώδικας ΔΕΝ κυκλοφορεί πριν τους κανόνες/δείκτες του.
 *
 * Κρίνουν τις **ίδιες** καθαρές συναρτήσεις που τρέχουν τα workflows (`planDeployment`,
 * `withHistory`, `tier1Alert`, `composeMessage`) και —το πιο σημαντικό— **τη δομή** του
 * `docker-build.yml`, μέσα από τον **έναν** αναγνώστη YAML του έργου (`workflow-meta.js`): μια
 * αφαίρεση του `needs` ή του `environment` θα ξανάνοιγε την τρύπα **σιωπηλά** — εδώ κοκκινίζει.
 *
 * Κάθε κανόνας έχει **θετικό μάρτυρα** — αλλιώς ένας κριτής που λέει «apply» για όλα θα περνούσε.
 */

'use strict';

const path = require('node:path');
const { execFileSync } = require('node:child_process');

const M = require('../lib/firestore-deploy/model');
const D = require('../lib/firestore-deploy/drift');
const { ACTION, planDeployment, renderPlanMarkdown } = require('../lib/firestore-deploy/plan');
const { attributeFromHistory, publishedStateOf } = require('../lib/firestore-deploy/world');
const { firebaseArgs, modeOf } = require('../firestore-deploy/record-deploy');
const { readWorkflowJobs, readWorkflowRunSteps, readWorkflowTriggers, readWorkflowName } = require('../lib/ci/workflow-meta');
const { tier1Alert } = require('../lib/ci/health-state');
const { composeMessage, sendTelegram } = require('../lib/ci/telegram');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW = path.join(ROOT, M.PIPELINE.workflow);
const DRIFT_WORKFLOW = path.join(ROOT, '.github', 'workflows', 'firebase-drift.yml');

const v = (target, over = {}) => ({ target, sync: D.SYNC.SYNCED, health: D.HEALTH.HEALTHY, origin: null, detail: 'd', ...over });
const idx = (over = {}) => v('firestore:indexes', { missing: [], extra: [], notReady: [], ...over });
const result = (verdicts, exitCode) => ({ verdicts, exitCode });

describe('ADR-865 §11 — η γραμμή παραγωγής', () => {
  describe('🧭 planDeployment — «τι πρέπει να γίνει πριν κυκλοφορήσει ο κώδικας;»', () => {
    it('✅ θετικός μάρτυρας: όλα Synced ⇒ none (καμία έγκριση δεν ζητείται)', () => {
      const plan = planDeployment(result([v('firestore:rules'), idx(), v('storage')], D.EXIT.OK));
      expect(plan.action).toBe(ACTION.NONE);
      expect(plan.targets).toEqual([]);
    });

    it('🔴 κανόνες ≠ δέντρο ⇒ apply ΜΟΝΟ τον στόχο που διαφέρει', () => {
      const plan = planDeployment(result([v('firestore:rules', { sync: D.SYNC.OUT_OF_SYNC }), idx(), v('storage')], D.EXIT.DRIFT));
      expect(plan).toMatchObject({ action: ACTION.APPLY, targets: ['firestore:rules'] });
    });

    it('🔴 δείκτης που ΛΕΙΠΕΙ ⇒ apply (ο κώδικας τον χρειάζεται)', () => {
      const plan = planDeployment(result([v('firestore:rules'), idx({ sync: D.SYNC.OUT_OF_SYNC, missing: ['a: x↑'] })], D.EXIT.DRIFT));
      expect(plan).toMatchObject({ action: ACTION.APPLY, targets: ['firestore:indexes'] });
    });

    it('🔑 ΜΟΝΟ δείκτες εκτός αρχείου ⇒ none + προειδοποίηση — ΠΟΤΕ αυτόματη διαγραφή (Argo CD prune off)', () => {
      const plan = planDeployment(result([idx({ sync: D.SYNC.OUT_OF_SYNC, extra: ['old: y↓'] })], D.EXIT.DRIFT));
      expect(plan.action).toBe(ACTION.NONE);
      expect(plan.warnings.join(' ')).toContain('δεν σβήνονται αυτόματα');
    });

    it('⛔ ο πάροχος δεν απάντησε ⇒ blocked (fail-closed: άγνωστο ≠ εντάξει)', () => {
      const plan = planDeployment(result([v('firestore:rules', { sync: D.SYNC.UNKNOWN, health: D.HEALTH.UNKNOWN })], D.EXIT.ERROR));
      expect(plan.action).toBe(ACTION.BLOCKED);
    });

    it('⛔ δείκτης που χτίζεται ακόμη μετά την αναμονή ⇒ blocked (τα ερωτήματά του αποτυγχάνουν)', () => {
      const plan = planDeployment(result([idx({ health: D.HEALTH.PROGRESSING })], D.EXIT.PROGRESSING));
      expect(plan.action).toBe(ACTION.BLOCKED);
    });

    it('NEEDS_REPAIR ⇒ none + προειδοποίηση (δεν το προκάλεσε η έκδοση, δεν διορθώνεται με deploy)', () => {
      const plan = planDeployment(result([idx({ health: D.HEALTH.DEGRADED })], D.EXIT.DEGRADED));
      expect(plan.action).toBe(ACTION.NONE);
      expect(plan.warnings.join(' ')).toContain('NEEDS_REPAIR');
    });

    it('η σελίδα έγκρισης δείχνει ΤΙ θα αλλάξει — και ο πίνακας δεν σπάει από «|» σε λεπτομέρεια', () => {
      const res = result([idx({ sync: D.SYNC.OUT_OF_SYNC, missing: ['stay_bookings: lifecycle↑'], detail: 'a | b' })], D.EXIT.DRIFT);
      const md = renderPlanMarkdown('p', res, planDeployment(res));
      expect(md).toContain('stay_bookings: lifecycle↑');
      expect(md).toContain('a \\| b');
      expect(md).toContain('**apply**');
    });
  });

  describe('🔤 σύγκριση κανόνων modulo αλλαγές γραμμής (Argo CD diff normalization)', () => {
    const rulesDesired = (wire) => ({ kind: 'ruleset', source: 'storage.rules', digest: M.digestOf(wire), wire, recorded: null });
    const rulesLive = (content) => ({ release: 'r', rulesetName: 'projects/p/rulesets/x', updateTime: 't', files: [{ content }] });

    it('🔴 CI (LF) έναντι ζωντανού CRLF ⇒ Synced, με ΟΡΑΤΗ σημείωση — όχι ψευδής απόκλιση', () => {
      const verdict = D.judgeRules('storage', rulesDesired('service a {}\n'), rulesLive('service a {}\r\n'));
      expect(verdict.sync).toBe(D.SYNC.SYNCED);
      expect(verdict.detail).toContain('CRLF/LF');
    });

    it('✅ θετικός μάρτυρας: πραγματική αλλαγή περιεχομένου μένει OutOfSync', () => {
      const verdict = D.judgeRules('storage', rulesDesired('service a {}\n'), rulesLive('service b {}\r\n'));
      expect(verdict.sync).toBe(D.SYNC.OUT_OF_SYNC);
    });
  });

  describe('📜 προέλευση από το ιστορικό του git (η γραμμή δεν γράφει το τοπικό μητρώο)', () => {
    const foreign = v('firestore:rules', { sync: D.SYNC.OUT_OF_SYNC, origin: D.ORIGIN.FOREIGN, detail: 'release t · x · ≠ δέντρο' });

    it('foreign που βρίσκεται στο ιστορικό ⇒ history @commit — ΔΕΝ είναι ξένο', () => {
      const out = D.withHistory(foreign, { commit: 'abc1234', at: '2026-09-18' });
      expect(out.origin).toBe(D.ORIGIN.HISTORY);
      expect(out.detail).toContain('@abc1234');
      expect(out.sync).toBe(D.SYNC.OUT_OF_SYNC);
    });

    it('✅ δεν βρέθηκε ⇒ μένει foreign· ό,τι δεν είναι foreign δεν αγγίζεται', () => {
      expect(D.withHistory(foreign, null)).toBe(foreign);
      const tree = v('firestore:rules', { origin: D.ORIGIN.TREE });
      expect(D.withHistory(tree, { commit: 'x', at: 'y' })).toBe(tree);
    });

    it('🌍 ΠΡΑΓΜΑΤΙΚΟ ιστορικό: η έκδοση του τελευταίου commit του storage.rules βρίσκεται — και με CRLF', () => {
      const last = execFileSync('git', ['log', '-1', '--format=%h', '--', 'storage.rules'], { cwd: ROOT, encoding: 'utf8' }).trim();
      const blob = execFileSync('git', ['show', `${last}:storage.rules`], { cwd: ROOT, encoding: 'utf8' });
      expect(attributeFromHistory('storage', 'storage.rules', blob.replace(/\r?\n/g, '\r\n'), 5)).toMatchObject({ commit: last });
      expect(attributeFromHistory('storage', 'storage.rules', `${blob}// ξένο`, 3)).toBeNull();
    });

    it('🌍 δημοσιευμένο ref: άγνωστο ref ⇒ unknown (ποτέ ψευδές «ίδιο»)', () => {
      expect(publishedStateOf('storage.rules', 'refs/heads/δεν-υπάρχει')).toBe('unknown');
    });
  });

  describe('🚀 ο deployer (record-deploy.js)', () => {
    it('🔑 καρφωμένη έκδοση firebase-tools — η ΙΔΙΑ με τη σημασιολογία του επαληθευτή', () => {
      const args = firebaseArgs(['firestore:indexes'], 'p', { pipeline: true, dryRun: false });
      expect(args).toContain(`firebase-tools@${M.FIREBASE_TOOLS_VERSION}`);
      expect(args).toContain('--non-interactive');
    });

    it('⛔ ΠΟΤΕ --force (θα έσβηνε ζωντανούς δείκτες) — σε καμία λειτουργία', () => {
      for (const pipeline of [true, false]) {
        for (const dryRun of [true, false]) expect(firebaseArgs(['storage'], 'p', { pipeline, dryRun })).not.toContain('--force');
      }
    });

    it('⛔ --pipeline εκτός GitHub Actions ⇒ άρνηση (θα ήταν ανάπτυξη ΧΩΡΙΣ κανένα αρχείο)', () => {
      expect(() => modeOf(['--pipeline'], {})).toThrow(/GitHub Actions/);
      expect(modeOf(['--pipeline'], { GITHUB_ACTIONS: 'true' })).toEqual({ pipeline: true, dryRun: false });
      expect(modeOf(['--dry-run'], {})).toEqual({ pipeline: false, dryRun: true });
    });
  });

  describe('⚓ Η ΔΟΜΗ ΤΗΣ ΓΡΑΜΜΗΣ — ο κώδικας δεν κυκλοφορεί πριν τους κανόνες του', () => {
    const jobs = readWorkflowJobs(WORKFLOW);
    const { plan, apply, release } = M.PIPELINE.jobs;

    it('η ανάπτυξη ζει πίσω από το environment της έγκρισης — και περιμένει το πλάνο', () => {
      expect(jobs[apply].environment).toBe(M.PIPELINE.environment);
      expect(jobs[apply].needs).toContain(plan);
    });

    it('🔴 η κυκλοφορία περιμένει build, πλάνο ΚΑΙ ανάπτυξη', () => {
      expect(jobs[release].needs).toEqual(expect.arrayContaining(['build-and-push', plan, apply]));
    });

    it('🔴 η κυκλοφορία απαιτεί πλάνο επιτυχές και ανάπτυξη επιτυχή ή παραλειμμένη — ποτέ αποτυχημένη', () => {
      const cond = jobs[release].if.replace(/\s+/g, ' ');
      expect(cond).toContain(`needs.${plan}.result == 'success'`);
      expect(cond).toContain(`needs.${apply}.result == 'success' || needs.${apply}.result == 'skipped'`);
      expect(cond).toContain("needs.build-and-push.result == 'success'");
      expect(cond).toContain('inputs.firebase_dry_run != true');
    });

    it('🔴 ΜΟΝΟ η κυκλοφορία ενεργοποιεί το Netcup (Coolify) — κανένα άλλο job δεν το παρακάμπτει', () => {
      const coolify = readWorkflowRunSteps(WORKFLOW).filter((s) => /applications\/[^/]+\/start/.test(s.run));
      expect(coolify.length).toBeGreaterThan(0);
      expect(new Set(coolify.map((s) => s.job))).toEqual(new Set([release]));
    });

    it('ο καθημερινός έλεγχος υπάρχει, είναι Tier 1 και ξυπνά μόνος του (schedule)', () => {
      expect(readWorkflowName(DRIFT_WORKFLOW)).toMatch(/^T1 /);
      expect(readWorkflowTriggers(DRIFT_WORKFLOW).automatic).toContain('schedule');
    });
  });

  describe('📣 ειδοποίηση', () => {
    const gate = (tier, name) => ({ tier, name, sha: 'abc', sinceSha: 'def' });

    it('Tier 1 μετάβαση ⇒ ξύπνα· Tier 2 ή καμία μετάβαση ⇒ σιωπή', () => {
      expect(tier1Alert([gate(1, 'T1 🔭 Firebase Drift (ADR-865)')], [])).toMatchObject({ status: 'failure' });
      expect(tier1Alert([], [gate(1, 'x')])).toMatchObject({ status: 'success' });
      expect(tier1Alert([gate(2, 'y')], [gate(2, 'z')])).toBeNull();
      expect(tier1Alert([], [])).toBeNull();
    });

    it('🔴 κείμενο με < > & (μήνυμα commit) διαφεύγει — δεν σπάει το HTML του Telegram', () => {
      const text = composeMessage({ status: 'failure', title: 'A <b>', lines: ['x & y'] });
      expect(text).toContain('A &lt;b&gt;');
      expect(text).toContain('x &amp; y');
    });

    it('ο αγγελιοφόρος ΠΟΤΕ δεν ρίχνει τη γραμμή: χωρίς διαπιστευτήρια / HTTP 500 / δίκτυο ⇒ sent:false', async () => {
      const env = { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: 'c' };
      expect((await sendTelegram('x', { env: {} })).sent).toBe(false);
      expect((await sendTelegram('x', { env, fetchImpl: async () => ({ ok: false, status: 500 }) })).sent).toBe(false);
      expect((await sendTelegram('x', { env, fetchImpl: async () => { throw new Error('down'); } })).sent).toBe(false);
      expect((await sendTelegram('x', { env, fetchImpl: async () => ({ ok: true, status: 200 }) })).sent).toBe(true);
    });
  });
});
