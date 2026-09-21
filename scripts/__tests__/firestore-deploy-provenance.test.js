/**
 * ADR-865 §11.10 — άγκυρες της απόδοσης προέλευσης από τα **GitHub Deployments**.
 *
 * Το κενό, μετρημένο 2026-09-21 (`firebase-drift.yml` run 35586911393, **μετά** το Ε2): και οι δύο
 * στόχοι κανόνων έβγαιναν «το τοπικό μητρώο δεν το κατέγραψε (γραμμή παραγωγής ⇒ GitHub
 * Deployments, ή ανάπτυξη εκτός εργαλείου)» — **κανείς** δεν ρωτούσε τα Deployments. Τα δεδομένα
 * εδώ είναι τα **πραγματικά** statuses του `firebase-production` (gh api, 2026-09-21).
 *
 * Κάθε άξονας έχει θετικό **και** αρνητικό μάρτυρα: κριτής που αποδίδει πάντα στη γραμμή θα
 * περνούσε τους θετικούς, κριτής που δεν αποδίδει ποτέ θα περνούσε τους αρνητικούς.
 */

'use strict';

const M = require('../lib/firestore-deploy/model');
const D = require('../lib/firestore-deploy/drift');
const P = require('../lib/firestore-deploy/deployments');
const { loadWorld, loadDesired, gitBytes } = require('../lib/firestore-deploy/world');
const { attributeDeployments, pipelineRecordFromEnv } = require('../firestore-deploy/verify-live');

const REPO = 'YorgosPag/NestorApp';
const ECA0 = 'eca0e1958c3408bb983821f8ce0a353fc21a752f';

/** Τα statuses όπως τα επιστρέφει το GitHub — **νεότερο πρώτο**. */
const statuses = (...pairs) => pairs.map(([state, at]) => ({
  state, created_at: at, log_url: 'https://github.com/x/y/actions/runs/1/job/2',
})).reverse();

/** Deployment 6538927993 (@eca0e195): το T1 run 35432199109 που ανέπτυξε το storage. */
const STORAGE_DEPLOY = statuses(['waiting', '2026-09-19T08:31:34Z'], ['queued', '2026-09-19T08:35:43Z'],
  ['in_progress', '2026-09-19T08:35:47Z'], ['success', '2026-09-19T08:36:58Z']);
/** Deployment 6542247921 (@7057264b): ανέπτυξε τους κανόνες Firestore. */
const RULES_DEPLOY = statuses(['waiting', '2026-09-19T15:00:04Z'], ['queued', '2026-09-19T15:00:25Z'],
  ['in_progress', '2026-09-19T15:00:47Z'], ['success', '2026-09-19T15:02:12Z']);

/** Ψεύτικος πελάτης με το σχήμα του `github-api.js` — καταγράφει κάθε διαδρομή. */
function fakeApi(deployments, statusesById) {
  const routes = [];
  return {
    routes,
    request: async (method, route) => {
      routes.push(`${method} ${route}`);
      const m = route.match(/\/deployments\/(\d+)\/statuses/);
      if (m) return statusesById[m[1]] || [];
      if (route.includes('/deployments?')) return deployments;
      throw new Error(`αναπάντεχη διαδρομή ${route}`);
    },
  };
}

const REAL_LIST = [
  { id: 6542247921, sha: '7057264b', created_at: '2026-09-19T15:00:03Z' },
  { id: 6538927993, sha: ECA0, created_at: '2026-09-19T08:31:34Z' },
];
const REAL_STATUSES = { 6542247921: RULES_DEPLOY, 6538927993: STORAGE_DEPLOY };

describe('ADR-865 §11.10 — το παράθυρο εκτέλεσης ενός Deployment', () => {
  it('από in_progress μέχρι την τερματική κατάσταση — η αναμονή έγκρισης ΔΕΝ μετρά', () => {
    expect(P.executionWindow(STORAGE_DEPLOY))
      .toEqual({ start: '2026-09-19T08:35:47Z', end: '2026-09-19T08:36:58Z', state: 'success' });
  });

  it('τρέχει ακόμη ⇒ ανοιχτό παράθυρο (η επαλήθευση ΜΕΣΑ στο apply)', () => {
    const open = statuses(['waiting', '2026-09-19T08:31:34Z'], ['in_progress', '2026-09-19T08:35:47Z']);
    expect(P.executionWindow(open)).toEqual({ start: '2026-09-19T08:35:47Z', end: null, state: 'in_progress' });
  });

  it('δεν ξεκίνησε ποτέ (ακυρώθηκε στην αναμονή) ⇒ null — δεν μπορεί να εξηγήσει τίποτα', () => {
    expect(P.executionWindow(statuses(['waiting', '2026-09-20T17:56:23Z'], ['inactive', '2026-09-20T17:58:00Z']))).toBeNull();
  });
});

describe('ADR-865 §11.10 — ποιο Deployment έτρεχε όταν άλλαξε το release', () => {
  const records = [
    { id: 1, sha: 'a', ...P.executionWindow(STORAGE_DEPLOY) },
    { id: 2, sha: 'b', ...P.executionWindow(RULES_DEPLOY) },
  ];

  it('🌍 ΠΡΑΓΜΑΤΙΚΑ: release storage 08:36:53Z ⇒ #1 · release κανόνων 15:02:06Z ⇒ #2', () => {
    expect(P.deploymentForRelease(records, '2026-09-19T08:36:53.026609Z').id).toBe(1);
    expect(P.deploymentForRelease(records, '2026-09-19T15:02:06.107989Z').id).toBe(2);
  });

  it('release ΣΤΗΝ ΑΝΑΜΟΝΗ έγκρισης ή μετά το τέλος ⇒ κανένα (δεν το έκανε αυτή η πράξη)', () => {
    expect(P.deploymentForRelease(records, '2026-09-19T08:33:00Z')).toBeNull();
    expect(P.deploymentForRelease(records, '2026-09-19T08:37:30Z')).toBeNull();
    expect(P.deploymentForRelease(records, null)).toBeNull();
  });

  it('επικάλυψη ⇒ το ΝΕΟΤΕΡΟ που είχε ήδη ξεκινήσει', () => {
    const overlap = [{ id: 1, start: '2026-09-19T08:00:00Z', end: null }, { id: 2, start: '2026-09-19T08:10:00Z', end: null }];
    expect(P.deploymentForRelease(overlap, '2026-09-19T08:20:00Z').id).toBe(2);
  });

  it('η λίστα ρωτά ΜΟΝΟ όσα γεννήθηκαν πριν από το release, στο σωστό environment', async () => {
    const api = fakeApi(REAL_LIST, REAL_STATUSES);
    const got = await P.fetchPipelineDeployments(api, REPO, { environment: 'firebase-production', before: '2026-09-19T08:36:53Z' });
    expect(got.map((r) => r.id)).toEqual([6538927993]);
    expect(api.routes[0]).toBe(`GET /repos/${REPO}/deployments?environment=firebase-production&per_page=${P.DEPLOYMENT_LIMIT}`);
    expect(api.routes).not.toContain(`GET /repos/${REPO}/deployments/6542247921/statuses?per_page=100`);
  });
});

describe('ADR-865 §11.10 — withDeployment: τρεις απαντήσεις, πάντα ορατές, ποτέ αλλαγή ετυμηγορίας', () => {
  const base = { target: 'storage', sync: D.SYNC.SYNCED, health: D.HEALTH.HEALTHY, origin: D.ORIGIN.TREE,
    unrecorded: true, detail: `release x · id · ${D.UNRECORDED_NOTE}` };
  const found = { id: 7, sha: ECA0, state: 'success', start: 's', end: 'e', url: null };

  it('βρέθηκε ⇒ «αναπτύχθηκε από τη γραμμή παραγωγής @sha», με το Deployment', () => {
    const v = D.withDeployment(base, { consulted: true, found });
    expect(v.detail).toContain('γραμμή παραγωγής @eca0e195 (GitHub Deployment #7');
    expect(v.detail).not.toContain('δεν το κατέγραψε');
    expect(v.deployment).toBe(found);
    expect([v.sync, v.health]).toEqual([base.sync, base.health]);
  });

  it('🔴 ρωτήθηκε, δεν βρέθηκε ⇒ «ανάπτυξη ΕΚΤΟΣ εργαλείου» (outOfBand) — ΟΧΙ πια αμφίσημο', () => {
    const v = D.withDeployment(base, { consulted: true, found: null });
    expect(v.outOfBand).toBe(true);
    expect(v.detail).toContain('ΕΚΤΟΣ εργαλείου');
    expect(v.sync).toBe(D.SYNC.SYNCED);
  });

  it('δεν ρωτήθηκε ⇒ λέει ΓΙΑΤΙ — ποτέ ψευδής κατηγορία «εκτός εργαλείου»', () => {
    const v = D.withDeployment(base, { consulted: false, why: 'λείπει GITHUB_TOKEN' });
    expect(v.detail).toContain('δεν ρωτήθηκαν: λείπει GITHUB_TOKEN');
    expect(v.outOfBand).toBeUndefined();
  });

  it('θετικός μάρτυρας: ό,τι εξήγησε ήδη το μητρώο ΔΕΝ αγγίζεται', () => {
    const recorded = { ...base, unrecorded: undefined, detail: 'release x · id' };
    expect(D.withDeployment(recorded, { consulted: true, found: null })).toBe(recorded);
  });

  it('παλαιότερη έκδοση του δέντρου (history) ⇒ προστίθεται ποιος την ανέπτυξε', () => {
    const v = D.withDeployment({ ...base, unrecorded: undefined, origin: D.ORIGIN.HISTORY, detail: 'release x · id · @abc' },
      { consulted: true, found });
    expect(v.detail).toBe(`release x · id · @abc · αναπτύχθηκε από τη γραμμή παραγωγής @eca0e195 (GitHub Deployment #7 · success · s → e)`);
  });
});

describe('🌍 ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΑΠΟΘΕΤΗΡΙΟ — η ανάπτυξη storage του CI (2026-09-19) αποδίδεται', () => {
  const desiredAll = loadDesired(loadWorld({ tree: ECA0 }));
  const desired = { storage: desiredAll.storage };
  const shipped = gitBytes(['show', `${ECA0}:storage.rules`]);
  const liveOf = (content) => ({ storage: { release: 'firebase.storage/b', rulesetName: 'projects/p/rulesets/23bbdcef',
    updateTime: '2026-09-19T08:36:53.026609Z', files: [{ name: 'storage.rules', content }] } });
  const record = () => ({ api: fakeApi(REAL_LIST, REAL_STATUSES), repo: REPO });

  it('προϋπόθεση: το μητρώο @eca0e195 ΔΕΝ το ξέρει (η τελευταία γραμμή storage είναι παλαιότερο περιεχόμενο)', () => {
    const v = D.judgeLive(desired, liveOf(shipped)).verdicts[0];
    expect(v.sync).toBe(D.SYNC.SYNCED);
    expect(v.unrecorded).toBe(true);
  });

  it('χρόνος ∈ παράθυρο ΚΑΙ περιεχόμενο @sha = ζωντανό ⇒ γραμμή παραγωγής @eca0e195', async () => {
    const result = await attributeDeployments(D.judgeLive(desired, liveOf(shipped)), desired, liveOf(shipped), record());
    const v = result.verdicts[0];
    expect(v.deployment.id).toBe(6538927993);
    expect(v.detail).toContain('γραμμή παραγωγής @eca0e195');
  });

  it('🔴 ίδιος χρόνος, ΑΛΛΟ περιεχόμενο (αλλαγή από Console μέσα στο παράθυρο) ⇒ ΕΚΤΟΣ εργαλείου', async () => {
    // Το δέντρο = το ζωντανό (αλλιώς δεν θα ήταν unrecorded)· το Deployment όμως δείχνει ΑΛΛΟ sha.
    const list = [{ ...REAL_LIST[1], sha: '38dde0d5' }];
    const api = fakeApi(list, REAL_STATUSES);
    const result = await attributeDeployments(D.judgeLive(desired, liveOf(shipped)), desired, liveOf(shipped), { api, repo: REPO });
    expect(result.verdicts[0].outOfBand).toBe(true);
    expect(result.verdicts[0].deployment).toBeUndefined();
  });

  it('το GitHub δεν απαντά ⇒ «δεν ρωτήθηκαν», ποτέ «εκτός εργαλείου»', async () => {
    const api = { request: async () => { throw new Error('GET /x → 403 {"message":"Resource not accessible"}\nσώμα'); } };
    const result = await attributeDeployments(D.judgeLive(desired, liveOf(shipped)), desired, liveOf(shipped), { api, repo: REPO });
    expect(result.verdicts[0].detail).toContain('το GitHub δεν απάντησε — GET /x → 403');
    expect(result.verdicts[0].outOfBand).toBeUndefined();
  });

  it('χωρίς διαπιστευτήρια ⇒ ο λόγος, και ΚΑΜΙΑ κλήση δικτύου', () => {
    expect(pipelineRecordFromEnv({})).toEqual({ why: 'λείπει GITHUB_TOKEN ή GITHUB_REPOSITORY' });
    expect(pipelineRecordFromEnv({ GITHUB_TOKEN: 't', GITHUB_REPOSITORY: REPO }).repo).toBe(REPO);
  });

  it('το environment που ρωτιέται είναι ΤΟ ΙΔΙΟ με της γραμμής (M.PIPELINE)', async () => {
    const r = record();
    await attributeDeployments(D.judgeLive(desired, liveOf(shipped)), desired, liveOf(shipped), r);
    expect(r.api.routes[0]).toContain(`environment=${M.PIPELINE.environment}&`);
  });
});

// Χωρίς token ή δικαίωμα η απόδοση δεν σπάει — ΣΒΗΝΕΙ σε «δεν ρωτήθηκαν»: πράσινο που σημαίνει
// «δεν κοίταξα». Γι' αυτό η γραμμή ρωτιέται αν το ΦΟΡΑΕΙ, όχι μόνο αν ο κώδικας το ξέρει.
describe('⚓ ADR-865 §11.10 — κάθε βήμα επαλήθευσης του CI φτάνει τα GitHub Deployments', () => {
  const path = require('node:path');
  const { readWorkflowRunSteps, readWorkflowJobs, readWorkflowPermissions } = require('../lib/ci/workflow-meta');
  const ROOT = path.join(__dirname, '..', '..');
  const WORKFLOWS = [M.PIPELINE.workflow, '.github/workflows/firebase-drift.yml'].map((f) => path.join(ROOT, f));
  const VERIFIES = /node scripts\/firestore-deploy\/(verify-live\.js|record-deploy\.js --pipeline)/;

  const verifySteps = WORKFLOWS.flatMap((file) => {
    const jobs = readWorkflowJobs(file);
    const top = readWorkflowPermissions(file);
    return readWorkflowRunSteps(file).filter((s) => VERIFIES.test(s.run))
      .map((s) => ({ ...s, file: path.basename(file), permissions: jobs[s.job].permissions || top }));
  });

  it('υπάρχουν — πλάνο, ανάπτυξη και πρωινός έλεγχος (0 βήματα = κανείς δεν κοίταξε)', () => {
    expect(new Set(verifySteps.map((s) => `${s.file}:${s.job}`))).toEqual(new Set([
      `docker-build.yml:${M.PIPELINE.jobs.plan}`, `docker-build.yml:${M.PIPELINE.jobs.apply}`, 'firebase-drift.yml:drift',
    ]));
  });

  it.each(['GITHUB_TOKEN'])('κάθε βήμα έχει %s στο env του', (name) => {
    for (const s of verifySteps) expect([s.job, s.env[name]]).toEqual([s.job, '${{ github.token }}']);
  });

  it('κάθε job έχει `deployments: read` (ελάχιστο δικαίωμα — ποτέ write)', () => {
    for (const s of verifySteps) expect([s.job, s.permissions.deployments]).toEqual([s.job, 'read']);
  });
});
