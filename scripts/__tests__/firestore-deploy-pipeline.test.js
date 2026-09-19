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
      expect(publishedStateOf('storage.rules', 'refs/heads/δεν-υπάρχει', M.readSource)).toBe('unknown');
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

// ============================================================================
// ADR-865 §11.8 — Ε1 «κρίνε ό,τι ΦΕΥΓΕΙ» · Ε2 «ίδια απάντηση σε Windows και CI»
// ============================================================================

/**
 * Καρφωμένο commit που **άλλαξε** το `firestore.rules` (γονέας ≠ παιδί, μετρημένο 2026-09-19:
 * `5c9a5834…` έναντι `6e3d61c0…`) και που **δεν** είναι το HEAD — άρα ο δίσκος διαφέρει από αυτό
 * **όποιες** κι αν είναι οι ακομμίτιστες αλλαγές του κοινού δέντρου.
 */
const RULES_CHANGE = '428a23bb';
const gitShow = (spec) => execFileSync('git', ['show', spec], { cwd: ROOT, encoding: 'utf8' });

describe('ADR-865 §11.8 — Ε1: κρίνεται ό,τι φεύγει, όχι ο δίσκος', () => {
  const { loadWorld, parsePushLines, TREE } = require('../lib/firestore-deploy/world');
  const { worldsFor } = require('../check-firestore-deploy-proof');
  const { judgeFirestoreDeploy, RULES } = require('../lib/firestore-deploy/judge');
  const ZERO = '0'.repeat(40);

  it('stdin του pre-push (githooks(5)): διαγραφή ⇒ εκτός · νέο remote ref ⇒ remoteSha null', () => {
    const a = 'a'.repeat(40);
    const b = 'b'.repeat(40);
    const text = `refs/heads/main ${a} refs/heads/main ${b}\r\n(delete) ${ZERO} refs/heads/old ${b}\nrefs/heads/x ${a} refs/heads/x ${ZERO}\n\n`;
    expect(parsePushLines(text)).toEqual([
      { localRef: 'refs/heads/main', localSha: a, remoteRef: 'refs/heads/main', remoteSha: b },
      { localRef: 'refs/heads/x', localSha: a, remoteRef: 'refs/heads/x', remoteSha: null },
    ]);
    expect(parsePushLines('')).toEqual([]);
  });

  it('⛔ κόσμος χωρίς δηλωμένο δέντρο ⇒ ρίχνει (η σιωπηλή προεπιλογή «δίσκος» ήταν η βλάβη)', () => {
    expect(() => loadWorld()).toThrow(/δέντρο/);
    expect(() => loadWorld({ tree: 'refs/heads/δεν-υπάρχει' })).toThrow(/δεν είναι commit/);
  });

  it('🔴 δέντρο = commit ⇒ τα bytes ΤΟΥ commit, όχι του δίσκου', () => {
    const world = loadWorld({ tree: RULES_CHANGE, published: null });
    const rules = world.targets.find((t) => t.target === 'firestore:rules');
    expect(rules.digest).toBe(M.digestOf(gitShow(`${RULES_CHANGE}:firestore.rules`)));
    expect(world.worktreeDrift).toContain('firestore.rules'); // ΟΡΑΤΗ σημείωση, ποτέ σιωπηλή
    expect(loadWorld({ tree: TREE.WORKTREE, published: null }).worktreeDrift).toEqual([]);
  });

  it('🔴 push που ΑΛΛΑΖΕΙ κανόνα προς το ref της γραμμής ⇒ Κ5 «έγκριση»', () => {
    const line = `refs/heads/main ${RULES_CHANGE} ${M.PIPELINE.ref} ${RULES_CHANGE}^`;
    const [{ label, world }] = worldsFor(['--at-push'], () => line);
    expect(label).toContain(M.PIPELINE.ref);
    expect(world.targets.find((t) => t.target === 'firestore:rules').published).toBe('differs');
    expect(judgeFirestoreDeploy(world).map((f) => f.rule)).toContain(RULES.K5);
  });

  it('✅ θετικός μάρτυρας: push ΙΔΙΟ με τον remote ⇒ κανένας Κ5, ό,τι κι αν λέει ο δίσκος', () => {
    const [{ world }] = worldsFor(['--at-push'], () => `refs/heads/main ${RULES_CHANGE} ${M.PIPELINE.ref} ${RULES_CHANGE}`);
    expect(world.targets.every((t) => t.published === 'same')).toBe(true);
    expect(judgeFirestoreDeploy(world).filter((f) => f.rule === RULES.K5)).toEqual([]);
  });

  it('push σε ref που ΔΕΝ πυροδοτεί τη γραμμή ⇒ off-pipeline, ποτέ ψευδές «θα ζητηθεί έγκριση»', () => {
    const [{ world }] = worldsFor(['--at-push'], () => `refs/heads/main ${RULES_CHANGE} refs/heads/feat ${ZERO}`);
    expect(new Set(world.targets.map((t) => t.published))).toEqual(new Set(['off-pipeline']));
    expect(judgeFirestoreDeploy(world).filter((f) => f.rule === RULES.K5)).toEqual([]);
  });

  it('commit ⇒ index · --report ⇒ δίσκος · push χωρίς stdin ⇒ HEAD — κάθε λειτουργία ΔΗΛΩΝΕΙ το δέντρο της', () => {
    expect(worldsFor([])[0].world.tree).toBe(TREE.INDEX);
    expect(worldsFor(['--report'])[0].world.tree).toBe(TREE.WORKTREE);
    expect(worldsFor(['--at-push'], () => '')[0].world.tree).toBe('HEAD');
  });

  it('firestore:verify κρίνει HEAD εκτός αν ζητηθεί ρητά άλλο · μετά από τοπική ανάπτυξη κρίνει τον ΔΙΣΚΟ που στάλθηκε', () => {
    const { treeOf } = require('../firestore-deploy/verify-live');
    const { verifyArgsAfterDeploy } = require('../firestore-deploy/record-deploy');
    expect(treeOf([])).toBe('HEAD');
    expect(treeOf(['--tree', TREE.WORKTREE])).toBe(TREE.WORKTREE);
    const args = verifyArgsAfterDeploy('p', ['--wait', '--timeout', '60']);
    expect(treeOf(args)).toBe(TREE.WORKTREE);
    expect(args).toEqual(expect.arrayContaining(['--project', 'p', '--wait', '--timeout', '60']));
  });

  it('⚓ το ref της γραμμής είναι ΑΥΤΟ που ξυπνά το workflow (on.push.branches), όχι δεύτερο αντίγραφο', () => {
    const branches = readWorkflowTriggers(WORKFLOW).pushBranches;
    expect(branches.map((b) => `refs/heads/${b}`)).toEqual([M.PIPELINE.ref]);
  });

  it('ο αναγνώστης κλάδων: εν σειρά · λίστα · απουσία (= ΚΑΘΕ κλάδος, όχι «κανένας»)', () => {
    const fs = require('node:fs');
    const os = require('node:os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-'));
    const wf = (body) => {
      const file = path.join(dir, `${Math.random().toString(36).slice(2)}.yml`);
      fs.writeFileSync(file, `name: t\non:\n${body}jobs: {}\n`);
      return readWorkflowTriggers(file).pushBranches;
    };
    try {
      expect(wf("  push:\n    branches: [main, 'rel/*']  # σχόλιο\n")).toEqual(['main', 'rel/*']);
      expect(wf('  push:\n    branches:\n      - main\n      - dev\n')).toEqual(['main', 'dev']);
      expect(wf('  push:\n    paths: [a]\n')).toBeNull();
      expect(wf('  schedule:\n    - cron: "0 5 * * *"\n')).toBeNull();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('ADR-865 §11.8 — Ε2: το ledger κρίνεται modulo CRLF/LF (append-only, καμία επανεγγραφή)', () => {
  const { loadWorld, loadDesired } = require('../lib/firestore-deploy/world');
  const LF = 'service firebase.storage {\n  match /b {}\n}\n';
  const CRLF = LF.replace(/\n/g, '\r\n');

  it('αποτύπωμα Windows (CRLF) ⇐ περιεχόμενο CI (LF), και αντίστροφα', () => {
    expect(M.renderingOf(M.digestOf(CRLF), LF)).toBe(CRLF);
    expect(M.renderingOf(M.digestOf(LF), CRLF)).toBe(LF);
    expect(M.renderingOf(M.digestOf(LF), LF)).toBe(LF);
  });

  it('✅ θετικός μάρτυρας: αλλαγή ΠΕΡΙΕΧΟΜΕΝΟΥ δεν ταιριάζει σε καμία απόδοση', () => {
    expect(M.renderingOf(M.digestOf(CRLF), `${LF}// άλλο\n`)).toBeNull();
    expect(M.renderingOf(M.digestOf(LF), null)).toBeNull();
  });

  it('🌍 ΠΡΑΓΜΑΤΙΚΟ: η γραμμή storage της 2026-09-18 (CRLF, από Windows) αναγνωρίζεται από το blob LF — όπως τη βλέπει το CI', () => {
    const desired = loadDesired(loadWorld({ tree: '38dde0d5', published: null }));
    const { recorded, digest } = desired.storage;
    expect(recorded.digest).not.toBe(digest); // τα bytes ΔΙΑΦΕΡΟΥΝ (CRLF ≠ LF) — αυτό έκρυβε το Ε2
    expect(recorded.matchesTree).toBe(true);
    const live = { release: 'r', rulesetName: 'projects/p/rulesets/x', updateTime: 't', files: [{ content: desired.storage.wire }] };
    expect(D.judgeRules('storage', desired.storage, live).detail).not.toContain('δεν το κατέγραψε');
  });

  it('✅ θετικός μάρτυρας: περιεχόμενο που ΔΕΝ κατέγραψε το μητρώο ⇒ η σημείωση μένει', () => {
    const desired = { kind: 'ruleset', source: 'storage.rules', digest: M.digestOf(LF), wire: LF,
      recorded: { at: 'a', commit: 'c', digest: 'sha256:x', wire: 'x', why: null, matchesTree: false } };
    const live = { release: 'r', rulesetName: 'projects/p/rulesets/x', updateTime: 't', files: [{ content: LF }] };
    expect(D.judgeRules('storage', desired, live).detail).toContain('δεν το κατέγραψε');
  });
});
