/**
 * ADR-865 §11.9 — Η ΔΙΑΔΟΧΗ της γραμμής παραγωγής: «μόνο η κορυφή αναπτύσσει και κυκλοφορεί».
 *
 * Το περιστατικό (μετρημένο 2026-09-19, runs 35429150868 / 35431491440): job σε αναμονή έγκρισης
 * ΚΡΑΤΑ το `concurrency: firebase-production`· το νεότερο μένει `pending` με `pending_deployments = 0`
 * ⇒ ΚΑΝΕΝΑ κουμπί, ΚΑΜΙΑ κυκλοφορία στο Netcup μέχρι Reject/Approve (έως 30 μέρες).
 *
 * Κάθε σενάριο τρέχει το ΠΡΑΓΜΑΤΙΚΟ CLI (`succession.js main`) πάνω σε ψεύτικο GitHub που απαντά
 * στις ΙΔΙΕΣ διαδρομές REST — και ρωτά τι ΑΚΥΡΩΘΗΚΕ, όχι τι «θα έπρεπε».
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const M = require('../lib/firestore-deploy/model');
const S = require('../lib/firestore-deploy/succession');
const { main, EXIT, WATCH_INTERVAL_MS, WATCH_DEADLINE_MS, CANCEL_GRACE_MS } = require('../firestore-deploy/succession');
const { createGitHubApi } = require('../lib/ci/github-api');
const { setOutputs } = require('../lib/ci/actions-io');
const { readWorkflowJobs } = require('../lib/ci/workflow-meta');

const ROOT = path.join(__dirname, '..', '..');
const APPLY_NAME = readWorkflowJobs(path.join(ROOT, M.PIPELINE.workflow))[M.PIPELINE.jobs.apply].name;
const ENV_NAME = M.PIPELINE.environment;
const TIP = 'c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00';
const OLD = 'a11ce000a11ce000a11ce000a11ce000a11ce000';
const OLDER = 'b0b00000b0b00000b0b00000b0b00000b0b00000';
const NOW = Date.parse('2026-09-19T12:00:00Z');

const run = (id, sha, { event = 'push', status = 'in_progress', at = '2026-09-19T08:00:00Z' } = {}) => ({
  id, run_number: id, head_sha: sha, event, status, created_at: at, html_url: `https://github.com/o/r/actions/runs/${id}`,
});
const approval = (startedAt = null) => [{ environment: { name: ENV_NAME }, wait_timer_started_at: startedAt }];

/** Ψεύτικο GitHub στις διαδρομές της διαδοχής. Καταγράφει κάθε ακύρωση. */
function fakeGitHub({ tip = TIP, runs = [], pending = {}, jobs = {}, fail = null, conflict = [] }) {
  const world = { cancelled: [], calls: 0 };
  world.request = async (method, route) => {
    world.calls += 1;
    if (fail && fail(method, route, world.calls)) throw new Error(`${method} ${route} → 502 Bad Gateway`);
    if (/\/git\/ref\/heads\//.test(route)) return { object: { sha: typeof tip === 'function' ? tip(world) : tip } };
    if (/\/actions\/workflows\/.+\/runs\?/.test(route)) return { workflow_runs: typeof runs === 'function' ? runs(world) : runs };
    let m = route.match(/\/actions\/runs\/(\d+)\/pending_deployments$/);
    if (m) return (typeof pending === 'function' ? pending(world) : pending)[m[1]] || [];
    m = route.match(/\/actions\/runs\/(\d+)\/jobs/);
    if (m) return { jobs: (typeof jobs === 'function' ? jobs(world) : jobs)[m[1]] || [] };
    m = route.match(/\/actions\/runs\/(\d+)\/cancel$/);
    if (m && method === 'POST') {
      if (conflict.includes(Number(m[1]))) throw new Error(`POST ${route} → 409 Cannot cancel a workflow run that is completed.`);
      world.cancelled.push(Number(m[1]));
      return null;
    }
    throw new Error(`άγνωστη διαδρομή στο ψεύτικο GitHub: ${method} ${route}`);
  };
  return world;
}

function harness(api, { runId, sha, now = () => NOW } = {}) {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'succession-')), 'out');
  const logs = [];
  const sleeps = [];
  const sent = [];
  const deps = {
    api,
    env: { GITHUB_RUN_ID: String(runId), GITHUB_SHA: sha, GITHUB_REPOSITORY: 'o/r', GITHUB_OUTPUT: out },
    log: (line) => logs.push(line),
    sleep: async (ms) => { sleeps.push(ms); },
    now,
    send: async (text) => { sent.push(text); return { sent: true, reason: null }; },
  };
  const outputs = () => (fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '');
  return { deps, logs, sleeps, sent, outputs };
}

describe('ADR-865 §11.9 — η διαδοχή: μόνο η κορυφή αναπτύσσει και κυκλοφορεί', () => {
  describe('🔴 το μετρημένο περιστατικό — ξεχασμένη έγκριση κρατά την ουρά', () => {
    it('η κορυφή (claim) ΑΚΥΡΩΝΕΙ το παλαιότερο τρέξιμο που περιμένει έγκριση ⇒ παίρνει δικό της κουμπί', async () => {
      const gh = fakeGitHub({ runs: [run(11, TIP), run(10, OLD)], pending: { 10: approval() } });
      const h = harness(gh, { runId: 11, sha: TIP });
      await expect(main(['claim'], h.deps)).resolves.toBe(EXIT.OK);
      expect(gh.cancelled).toEqual([10]);
      expect(h.outputs()).toContain('fresh=true');
    });

    it('✅ θετικός μάρτυρας: τρέξιμο που ΗΔΗ ΑΝΑΠΤΥΣΣΕΙ (εγκρίθηκε, pending_deployments = 0) ΔΕΝ ακυρώνεται ποτέ', async () => {
      const gh = fakeGitHub({ runs: [run(11, TIP), run(10, OLD)], pending: { 10: [] } });
      await main(['claim'], harness(gh, { runId: 11, sha: TIP }).deps);
      expect(gh.cancelled).toEqual([]);
    });

    it('✅ θετικός μάρτυρας: η ΚΟΡΥΦΗ που περιμένει έγκριση δεν ακυρώνει ποτέ τον εαυτό της (ούτε σε επανάληψη)', async () => {
      const gh = fakeGitHub({ runs: [run(11, TIP)], pending: { 11: approval() } });
      await main(['claim'], harness(gh, { runId: 11, sha: TIP }).deps);
      expect(gh.cancelled).toEqual([]);
    });

    it('η ουρά χωρίς κουμπί (pending, 0 εκκρεμείς εγκρίσεις) δεν είναι «κάτοχος» — δεν αγγίζεται', async () => {
      const gh = fakeGitHub({ runs: [run(12, TIP), run(11, OLD), run(10, OLDER)], pending: { 10: approval(), 11: [] } });
      await main(['claim'], harness(gh, { runId: 12, sha: TIP }).deps);
      expect(gh.cancelled).toEqual([10]);
    });

    it('ολοκληρωμένο τρέξιμο δεν ακυρώνεται, ό,τι κι αν λέει ένα μπαγιάτικο pending', async () => {
      const gh = fakeGitHub({ runs: [run(11, TIP), run(10, OLD, { status: 'completed' })], pending: { 10: approval() } });
      await main(['claim'], harness(gh, { runId: 11, sha: TIP }).deps);
      expect(gh.cancelled).toEqual([]);
    });

    it('409 (τελείωσε ενδιάμεσα) ⇒ ο στόχος επιτεύχθηκε, όχι σφάλμα', async () => {
      const gh = fakeGitHub({ runs: [run(11, TIP), run(10, OLD)], pending: { 10: approval() }, conflict: [10] });
      const h = harness(gh, { runId: 11, sha: TIP });
      await expect(main(['claim'], h.deps)).resolves.toBe(EXIT.OK);
      expect(h.logs.join('\n')).toContain('είχε ήδη τελειώσει');
    });
  });

  describe('⛔ ένα παλαιότερο τρέξιμο ΠΟΤΕ δεν ακυρώνει νεότερο — ούτε αναπτύσσει', () => {
    it('όχι κορυφή ⇒ ΑΥΤΟακύρωση, ΚΑΜΙΑ άλλη ακύρωση, και αν ζει μετά τη χάρη ⇒ 3 (fail-closed)', async () => {
      const gh = fakeGitHub({ runs: [run(12, TIP), run(11, OLD), run(10, OLDER)], pending: { 10: approval() } });
      const h = harness(gh, { runId: 11, sha: OLD });
      await expect(main(['claim'], h.deps)).resolves.toBe(EXIT.NOT_CANCELLED);
      expect(gh.cancelled).toEqual([11]);
      expect(h.sleeps).toEqual([CANCEL_GRACE_MS]);
      expect(h.outputs()).toContain('fresh=false');
    });

    it('guard (apply/release): έγκριση που δόθηκε ΑΦΟΥ ήρθε νεότερο push ⇒ αυτοακύρωση πριν από οτιδήποτε', async () => {
      const gh = fakeGitHub({ runs: [run(11, TIP), run(10, OLD)] });
      await expect(main(['guard'], harness(gh, { runId: 10, sha: OLD }).deps)).resolves.toBe(EXIT.NOT_CANCELLED);
      expect(gh.cancelled).toEqual([10]);
    });

    it('✅ θετικός μάρτυρας: guard στην κορυφή ⇒ 0, καμία ακύρωση', async () => {
      const gh = fakeGitHub({ runs: [run(11, TIP)] });
      const h = harness(gh, { runId: 11, sha: TIP });
      await expect(main(['guard'], h.deps)).resolves.toBe(EXIT.OK);
      expect(gh.cancelled).toEqual([]);
      expect(h.outputs()).toContain('fresh=true');
    });

    it('κορυφή χωρίς τρέξιμο push ακόμη ⇒ κανείς δεν διώχνεται (δεν ξέρεις ποιος κρατά)', async () => {
      const gh = fakeGitHub({ runs: [run(11, TIP, { event: 'workflow_dispatch' }), run(10, OLD)], pending: { 10: approval() } });
      await expect(main(['claim'], harness(gh, { runId: 11, sha: TIP }).deps)).resolves.toBe(EXIT.OK);
      expect(gh.cancelled).toEqual([]);
    });

    it('δοκιμή deployer (workflow_dispatch) σε αναμονή στην κορυφή ⇒ την αντικαθιστά το push (δηλωμένο όριο)', async () => {
      const gh = fakeGitHub({
        runs: [run(12, TIP, { event: 'workflow_dispatch', at: '2026-09-19T09:00:00Z' }), run(11, TIP)],
        pending: { 12: approval() },
      });
      await main(['claim'], harness(gh, { runId: 11, sha: TIP }).deps);
      expect(gh.cancelled).toEqual([12]);
    });
  });

  describe('🛎️ ο φύλακας της ουράς (watch) — κλείνει τον αγώνα μετά τη σκούπα', () => {
    const applyJob = (status) => [{ name: APPLY_NAME, status }];

    it('ο παλιός μπαίνει σε αναμονή ΑΦΟΥ σκούπισε η κορυφή ⇒ ο φύλακας τον βρίσκει στον επόμενο γύρο', async () => {
      const gh = fakeGitHub({
        runs: [run(11, TIP), run(10, OLD)],
        pending: (w) => (w.calls > 4 ? { 10: w.cancelled.includes(10) ? [] : approval() } : {}),
        jobs: (w) => ({ 11: applyJob(w.cancelled.includes(10) ? 'waiting' : 'pending') }),
      });
      const h = harness(gh, { runId: 11, sha: TIP });
      await expect(main(['watch'], h.deps)).resolves.toBe(EXIT.OK);
      expect(gh.cancelled).toEqual([10]);
      expect(h.sleeps).toEqual([WATCH_INTERVAL_MS]);
    });

    it('✅ θετικός μάρτυρας: το δικό μου apply έχει ήδη κουμπί ⇒ τελειώνει στον πρώτο γύρο, χωρίς αναμονή', async () => {
      const gh = fakeGitHub({ runs: [run(11, TIP)], jobs: { 11: applyJob('waiting') } });
      const h = harness(gh, { runId: 11, sha: TIP });
      await expect(main(['watch'], h.deps)).resolves.toBe(EXIT.OK);
      expect(h.sleeps).toEqual([]);
    });

    it('νόμιμη ανάπτυξη άλλου τρεξίματος τρέχει (όχι αναμονή) ⇒ περιμένει, ΔΕΝ την κόβει, και σταματά στο όριο', async () => {
      let clock = NOW;
      const gh = fakeGitHub({ runs: [run(11, TIP), run(10, OLD)], pending: { 10: [] }, jobs: { 11: applyJob('pending') } });
      const h = harness(gh, { runId: 11, sha: TIP, now: () => clock });
      h.deps.sleep = async (ms) => { h.sleeps.push(ms); clock += ms; };
      await expect(main(['watch'], h.deps)).resolves.toBe(EXIT.OK);
      expect(gh.cancelled).toEqual([]);
      expect(h.sleeps.length).toBe(WATCH_DEADLINE_MS / WATCH_INTERVAL_MS);
      expect(h.logs.join('\n')).toContain('::warning::');
    });

    it('νεότερη κορυφή εμφανίστηκε ⇒ ο φύλακας παραδίδει, δεν ακυρώνει τίποτα', async () => {
      const gh = fakeGitHub({ runs: [run(12, TIP), run(11, OLD)], pending: { 11: approval() }, jobs: { 11: applyJob('waiting') } });
      await expect(main(['watch'], harness(gh, { runId: 11, sha: OLD }).deps)).resolves.toBe(EXIT.OK);
      expect(gh.cancelled).toEqual([]);
    });
  });

  describe('📡 όταν το GitHub δεν απαντά', () => {
    const down = () => true;

    it('claim/guard ⇒ 1 (fail-closed: καμία ανάπτυξη, καμία κυκλοφορία)', async () => {
      for (const mode of ['claim', 'guard']) {
        await expect(main([mode], harness(fakeGitHub({ fail: down }), { runId: 11, sha: TIP }).deps)).resolves.toBe(EXIT.GITHUB);
      }
    });

    it('watch ⇒ 0 + προειδοποίηση (δικλίδα — κόκκινο θα έφτανε ως ψευδές Tier 1)', async () => {
      const h = harness(fakeGitHub({ fail: down }), { runId: 11, sha: TIP });
      await expect(main(['watch'], h.deps)).resolves.toBe(EXIT.OK);
      expect(h.logs.join('\n')).toContain('::warning::');
    });

    it('tip ⇒ fresh=unknown: η ειδοποίηση ΜΙΛΑ (καλύτερα περιττή παρά χαμένη)', async () => {
      const h = harness(fakeGitHub({ fail: down }), { runId: 11, sha: TIP });
      await expect(main(['tip'], h.deps)).resolves.toBe(EXIT.OK);
      expect(h.outputs()).toContain('fresh=unknown');
    });

    it('εκτός Actions / άγνωστη λειτουργία ⇒ 64', async () => {
      const h = harness(fakeGitHub({}), { runId: 11, sha: TIP });
      await expect(main(['claim'], { ...h.deps, env: {} })).resolves.toBe(EXIT.USAGE);
      await expect(main(['nope'], h.deps)).resolves.toBe(EXIT.USAGE);
    });
  });

  describe('⏸ πρωινή υπενθύμιση (remind) — ΠΟΤΕ κόκκινο', () => {
    it('έγκριση της κορυφής που περιμένει ≥ όριο ⇒ ΕΝΑ Telegram με σύνδεσμο και «κορυφή»', async () => {
      const since = new Date(NOW - (S.REMINDER_AFTER_HOURS + 1) * 3_600_000).toISOString();
      const gh = fakeGitHub({ runs: [run(11, TIP)], pending: { 11: approval(since) } });
      const h = harness(gh, { runId: 99, sha: TIP });
      await expect(main(['remind'], h.deps)).resolves.toBe(EXIT.OK);
      expect(h.sent).toHaveLength(1);
      expect(h.sent[0]).toContain('κορυφή');
      expect(h.sent[0]).toContain('/actions/runs/11');
      expect(gh.cancelled).toEqual([]);
    });

    it('✅ θετικός μάρτυρας: αναμονή κάτω από το όριο ⇒ σιωπή', async () => {
      const since = new Date(NOW - 3_600_000).toISOString();
      const h = harness(fakeGitHub({ runs: [run(11, TIP)], pending: { 11: approval(since) } }), { runId: 99, sha: TIP });
      await main(['remind'], h.deps);
      expect(h.sent).toEqual([]);
    });

    it('χωρίς wait_timer_started_at ⇒ μετρά από τη δημιουργία του τρεξίματος · το παλαιότερο σημειώνεται για Reject', async () => {
      const gh = fakeGitHub({ runs: [run(11, TIP), run(10, OLD, { at: '2026-09-18T20:00:00Z' })], pending: { 10: approval() } });
      const h = harness(gh, { runId: 99, sha: TIP });
      await main(['remind'], h.deps);
      expect(h.sent[0]).toContain('Reject');
    });

    it('GitHub σιωπηλό ⇒ 0 + προειδοποίηση, κανένα Telegram', async () => {
      const h = harness(fakeGitHub({ fail: () => true }), { runId: 99, sha: TIP });
      await expect(main(['remind'], h.deps)).resolves.toBe(EXIT.OK);
      expect(h.sent).toEqual([]);
      expect(h.logs.join('\n')).toContain('::warning::');
    });
  });

  describe('🧮 καθαρές αποφάσεις', () => {
    it('κορυφή = το ΝΕΟΤΕΡΟ push στο commit της κορυφής — ποτέ dispatch, ποτέ άλλο commit', () => {
      const runs = [
        run(13, TIP, { event: 'workflow_dispatch', at: '2026-09-19T10:00:00Z' }),
        run(12, TIP, { at: '2026-09-19T09:00:00Z' }),
        run(11, TIP, { at: '2026-09-19T08:00:00Z' }),
        run(14, OLD, { at: '2026-09-19T11:00:00Z' }),
      ];
      expect(S.keeperOf(runs, TIP).id).toBe(12);
      expect(S.keeperOf(runs, 'deadbeef')).toBeNull();
    });

    it('κατάσταση του δικού μου apply από το API jobs', () => {
      const of = (status) => S.applyStateOf([{ name: APPLY_NAME, status }], APPLY_NAME);
      expect(['pending', 'queued', 'requested'].map(of)).toEqual(['queued', 'queued', 'queued']);
      expect([of('waiting'), of('in_progress'), of('completed')]).toEqual(['waiting', 'running', 'done']);
      expect(S.applyStateOf([], APPLY_NAME)).toBe('absent');
    });

    it('φρεσκάδα χωρίς sha ⇒ ρίχνει (ποτέ σιωπηλό «φρέσκο»)', () => {
      expect(() => S.freshnessOf(TIP, '')).toThrow();
      expect(S.freshnessOf(OLD, TIP).fresh).toBe(false);
    });

    it('ο πυρήνας ΜΟΝΟΣ του (χωρίς το φίλτρο του CLI): ολοκληρωμένο ή κορυφή ⇒ ποτέ θύμα', () => {
      const keeper = run(11, TIP);
      const runs = [keeper, run(10, OLD, { status: 'completed' }), run(9, OLDER)];
      const pendingByRun = new Map([[11, approval()], [10, approval()], [9, approval()]]);
      expect(S.supersededHolders({ runs, pendingByRun, keeper }).map((r) => r.id)).toEqual([9]);
      expect(S.supersededHolders({ runs, pendingByRun, keeper: null })).toEqual([]);
    });

    it('εκκρεμής έγκριση ΑΛΛΟΥ environment δεν μετρά', () => {
      expect(S.awaitsApproval([{ environment: { name: 'staging' } }])).toBe(false);
      expect(S.awaitsApproval(approval())).toBe(true);
    });
  });
});

describe('ADR-865 §11.9 — ο ΕΝΑΣ πελάτης GitHub REST και ο ΕΝΑΣ συγγραφέας εξόδων Actions', () => {
  const response = (status, text) => ({ ok: status < 400, status, text: async () => text });

  it('σφάλμα HTTP ⇒ πετά με μέθοδο, διαδρομή, κωδικό και σώμα — ποτέ σιωπηλό «τίποτα»', async () => {
    const api = createGitHubApi({ token: 't', fetchImpl: async () => response(403, 'Resource not accessible by integration') });
    await expect(api.request('POST', '/repos/o/r/actions/runs/1/cancel')).rejects.toThrow(
      'POST /repos/o/r/actions/runs/1/cancel → 403 Resource not accessible by integration',
    );
  });

  it('202 χωρίς σώμα (cancel) / 204 ⇒ null · JSON ⇒ αντικείμενο · κεφαλίδες έκδοσης API', async () => {
    const seen = [];
    const fetchImpl = async (url, init) => { seen.push(init.headers); return response(Number(url.slice(-3)), url.endsWith('200') ? '{"a":1}' : ''); };
    const api = createGitHubApi({ token: 't', apiUrl: 'https://x', fetchImpl });
    await expect(api.request('POST', '/202')).resolves.toBeNull();
    await expect(api.request('GET', '/204')).resolves.toBeNull();
    await expect(api.request('GET', '/200')).resolves.toEqual({ a: 1 });
    expect(seen[0]['x-github-api-version']).toBe('2022-11-28');
    expect(seen[0].authorization).toBe('Bearer t');
  });

  it('χωρίς token ⇒ ρίχνει αμέσως', () => {
    expect(() => createGitHubApi({ token: '' })).toThrow('GITHUB_TOKEN');
  });

  it('έξοδος με αλλαγή γραμμής ⇒ ρίχνει (θα γεννούσε δεύτερο, πλαστό κλειδί) · εκτός Actions ⇒ τίποτα', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'io-')), 'o');
    expect(() => setOutputs({ a: 'x\nfresh=true' }, { GITHUB_OUTPUT: file })).toThrow('αλλαγή γραμμής');
    expect(setOutputs({ a: 1, b: true }, { GITHUB_OUTPUT: file })).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toBe('a=1\nb=true\n');
    expect(setOutputs({ a: 1 }, {})).toBe(false);
  });
});
