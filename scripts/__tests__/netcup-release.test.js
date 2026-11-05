/**
 * ADR-865 §11.11 — «Deploy completato» σημαίνει «η νέα έκδοση ΣΕΡΒΙΡΕΙ».
 *
 * Κρίνει την **ίδια** συνάρτηση που τρέχει το job `release` (`releaseToNetcup`), με ψεύτικο
 * `fetch` (Coolify + `/api/build-info`) και ψεύτικο ρολόι — καμία πραγματική αναμονή, κανένα δίκτυο.
 * Κάθε ✅ έχει **αρνητικό μάρτυρα**: ένας κριτής που λέει «live» για όλα θα κοκκίνιζε εδώ.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { NETCUP, TIMING, VERDICT, COOLIFY_STATUS, formatDuration, judge, releaseToNetcup } = require('../lib/ci/netcup-release');
const { main } = require('../ci/netcup-release');
const { readWorkflowRunSteps } = require('../lib/ci/workflow-meta');

const ROOT = path.resolve(__dirname, '..', '..');
const NEW = 'ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12';
const OLD = 'ce35e9b2f9fdc1e1efccc2e85ac8647496e307dd';
const DEPLOYMENT = 'dpl-uuid-1';

const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, text: async () => (body === undefined ? '' : JSON.stringify(body)) });

/**
 * Ψεύτικος κόσμος: `timeline[i]` = τι βλέπουμε στην i-οστή παρατήρηση (η τελευταία επαναλαμβάνεται).
 * @param {{start?:object, timeline:Array<{coolify?:object|Error, live?:object|Error}>}} world
 */
function fakeWorld({ start = reply(200, { message: 'Deployment request queued.', deployment_uuid: DEPLOYMENT }), timeline }) {
  let clock = 0;
  const seen = { coolify: 0, live: 0, urls: [], headers: [] };
  const pick = (kind) => {
    const step = timeline[Math.min(seen[kind], timeline.length - 1)][kind];
    seen[kind] += 1;
    if (step instanceof Error) throw step;
    return step;
  };
  const fetchImpl = async (url, init) => {
    seen.urls.push(url);
    seen.headers.push(init.headers);
    if (url.endsWith(`/applications/${NETCUP.applicationUuid}/start`)) return start;
    if (url.endsWith(`/deployments/${DEPLOYMENT}`)) return pick('coolify');
    if (url === `${NETCUP.liveOrigin}${NETCUP.buildInfoPath}`) return pick('live');
    throw new Error(`απρόσμενο URL ${url}`);
  };
  const deps = {
    fetchImpl,
    timing: TIMING,
    log: () => {},
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
  };
  return { deps, seen, elapsed: () => clock };
}

const coolify = (status) => reply(200, { status });
const live = (sha) => reply(200, { deploymentId: sha });
const run = (world) => releaseToNetcup({ expectedSha: NEW, token: 't0k' }, world.deps);

describe('netcup-release — η ετυμηγορία', () => {
  it('✅ live ΜΟΝΟ όταν το build-info σερβίρει το ίδιο sha — και μετρά πόσο πήρε', async () => {
    const world = fakeWorld({
      timeline: [
        { coolify: coolify(COOLIFY_STATUS.queued), live: live(OLD) },
        { coolify: coolify(COOLIFY_STATUS.inProgress), live: live(OLD) },
        { coolify: coolify(COOLIFY_STATUS.finished), live: live(NEW) },
      ],
    });
    await expect(run(world)).resolves.toEqual({ verdict: VERDICT.LIVE, summary: `live ab12cd3 (${formatDuration(2 * TIMING.pollMs)})` });
  });

  it('🔴 μετάλλαξη «✅ χωρίς ίσο sha»: Coolify finished + παλιό sha ⇒ ΟΧΙ live (μετά το περιθώριο εναλλαγής)', async () => {
    const world = fakeWorld({ timeline: [{ coolify: coolify(COOLIFY_STATUS.finished), live: live(OLD) }] });
    const result = await run(world);
    expect(result.verdict).toBe(VERDICT.NOT_LIVE);
    expect(result.summary).toContain('Coolify finished, αλλά σερβίρεται άλλη έκδοση');
    expect(result.summary).toContain('σερβίρεται ce35e9b');
    expect(world.elapsed()).toBeGreaterThanOrEqual(TIMING.finishedGraceMs);
    expect(world.elapsed()).toBeLessThan(TIMING.deadlineMs);
  });

  it('🔴 μετάλλαξη «λήξη χρόνου ⇒ ✅»: το παλιό sha ως το τέλος ⇒ not-live με «λήξη χρόνου»', async () => {
    const world = fakeWorld({ timeline: [{ coolify: coolify(COOLIFY_STATUS.inProgress), live: live(OLD) }] });
    const result = await run(world);
    expect(result.verdict).toBe(VERDICT.NOT_LIVE);
    expect(result.summary).toMatch(/λήξη χρόνου 12′00″/);
    expect(world.elapsed()).toBeGreaterThanOrEqual(TIMING.deadlineMs);
    expect(world.elapsed()).toBeLessThan(TIMING.deadlineMs + 2 * TIMING.pollMs);
  });

  it.each([COOLIFY_STATUS.failed, COOLIFY_STATUS.cancelled])('❌ Coolify «%s» ⇒ αποτυχία ΑΜΕΣΩΣ (όχι αναμονή ως τη λήξη)', async (status) => {
    const world = fakeWorld({ timeline: [{ coolify: coolify(COOLIFY_STATUS.queued), live: live(OLD) }, { coolify: coolify(status), live: live(OLD) }] });
    const result = await run(world);
    expect(result.verdict).toBe(VERDICT.NOT_LIVE);
    expect(result.summary).toContain(`Coolify: ${status}`);
    expect(world.elapsed()).toBe(TIMING.pollMs);
  });

  it('🔴 build-info 403 ως το τέλος ⇒ not-live, και το μήνυμα λέει «HTTP 403» (όχι σιωπή)', async () => {
    const world = fakeWorld({ timeline: [{ coolify: coolify(COOLIFY_STATUS.inProgress), live: reply(403) }] });
    const result = await run(world);
    expect(result.verdict).toBe(VERDICT.NOT_LIVE);
    expect(result.summary).toContain('build-info HTTP 403');
  });

  it('✅ belt-and-suspenders: Coolify απρόσιτο/404 δεν εμποδίζει — ο κριτής είναι το build-info', async () => {
    const world = fakeWorld({
      timeline: [
        { coolify: new Error('ECONNRESET'), live: live(OLD) },
        { coolify: reply(404, { message: 'Not found' }), live: live(NEW) },
      ],
    });
    await expect(run(world)).resolves.toMatchObject({ verdict: VERDICT.LIVE });
  });

  it('✅ ίσο sha κερδίζει ακόμη και «failed» της πλατφόρμας (σερβίρει — αυτό ρωτάμε)', () => {
    const observation = { coolify: { status: COOLIFY_STATUS.failed }, live: { sha: NEW } };
    expect(judge(observation, { expectedSha: NEW, startedAt: 0, finishedSince: null, now: 0, timing: TIMING }).state).toBe('live');
  });

  it.each([
    ['σύντομο sha (πρόθεμα)', NEW.slice(0, 7)],
    ['null (τοπικό build)', null],
    ['άλλο commit', OLD],
  ])('🔴 %s ΔΕΝ είναι live', (_label, sha) => {
    const observation = { coolify: { status: COOLIFY_STATUS.finished }, live: { sha } };
    expect(judge(observation, { expectedSha: NEW, startedAt: 0, finishedSince: 0, now: 0, timing: TIMING }).state).toBe('pending');
  });

  it('🔴 χωρίς έγκυρο αναμενόμενο sha ΔΕΝ υπάρχει ✅ (κενό GITHUB_SHA δεν ταιριάζει με τίποτα)', () => {
    const observation = { coolify: { status: COOLIFY_STATUS.finished }, live: { sha: null } };
    expect(judge(observation, { expectedSha: '', startedAt: 0, finishedSince: null, now: 0, timing: TIMING }).state).toBe('pending');
  });
});

describe('netcup-release — η ενεργοποίηση', () => {
  it.each([
    ['401 (λάθος token — το παλιό curl -s το έκρυβε)', reply(401, { message: 'Unauthenticated.' }), 'Coolify HTTP 401: Unauthenticated.'],
    ['200 χωρίς deployment_uuid', reply(200, { message: 'weird' }), 'Coolify HTTP 200: weird'],
  ])('❌ %s ⇒ not-triggered, χωρίς παρακολούθηση', async (_label, start, said) => {
    const world = fakeWorld({ start, timeline: [{ coolify: coolify('queued'), live: live(NEW) }] });
    const result = await run(world);
    expect(result).toEqual({ verdict: VERDICT.NOT_TRIGGERED, summary: `δεν ενεργοποιήθηκε: ${said}` });
    expect(world.seen.live).toBe(0);
  });

  it('❌ λείπει το COOLIFY_TOKEN ⇒ κανένα αίτημα', async () => {
    const world = fakeWorld({ timeline: [{ coolify: coolify('queued'), live: live(NEW) }] });
    const result = await releaseToNetcup({ expectedSha: NEW, token: '' }, world.deps);
    expect(result.verdict).toBe(VERDICT.NOT_TRIGGERED);
    expect(world.seen.urls).toEqual([]);
  });

  it('🔑 το token πάει ΜΟΝΟ στο Coolify — ποτέ στο δημόσιο build-info', async () => {
    const world = fakeWorld({ timeline: [{ coolify: coolify('finished'), live: live(NEW) }] });
    await run(world);
    world.seen.urls.forEach((url, i) => {
      const auth = world.seen.headers[i].authorization;
      if (url.startsWith(NETCUP.liveOrigin)) expect(auth).toBeUndefined();
      else expect(auth).toBe('Bearer t0k');
    });
  });
});

describe('netcup-release — CLI (έξοδοι για το Telegram)', () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'netcup-'));

  it.each([
    [[{ coolify: coolify('finished'), live: live(NEW) }], 0, 'verdict=live'],
    [[{ coolify: coolify('failed'), live: live(OLD) }], 1, 'verdict=not-live'],
  ])('έξοδος %#: κωδικός %s και έξοδος βήματος', async (timeline, code, line) => {
    const dir = tmp();
    const env = { GITHUB_SHA: NEW, COOLIFY_TOKEN: 't0k', GITHUB_OUTPUT: path.join(dir, 'out'), GITHUB_STEP_SUMMARY: path.join(dir, 'sum') };
    const world = fakeWorld({ timeline });
    await expect(main([], { ...world.deps, env })).resolves.toBe(code);
    const out = fs.readFileSync(env.GITHUB_OUTPUT, 'utf8');
    expect(out).toContain(line);
    expect(out).toMatch(/^summary=.+$/m);
  });
});

describe('netcup-release — άγκυρες προς τις άλλες πηγές αλήθειας', () => {
  it('το UA ΔΕΝ ταιριάζει σε κανένα BLOCKED_BOT_PATTERNS του middleware (αλλιώς 403, όπως το curl)', () => {
    const middleware = fs.readFileSync(path.join(ROOT, 'src/middleware.ts'), 'utf8');
    const block = /const BLOCKED_BOT_PATTERNS[^=]*=\s*\[([\s\S]*?)\];/.exec(middleware);
    const patterns = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(patterns).toEqual(expect.arrayContaining(['curl/', 'node-fetch'])); // θετικός μάρτυρας: διαβάστηκε η λίστα
    const ua = NETCUP.userAgent.toLowerCase();
    expect(patterns.filter((p) => ua.includes(p.toLowerCase()))).toEqual([]);
  });

  it('η διαδρομή είναι το BUILD_INFO_PATH του συμβολαίου (ADR-860 §Ε0)', () => {
    const contract = fs.readFileSync(path.join(ROOT, 'src/lib/app-version/build-info-contract.ts'), 'utf8');
    expect(contract).toContain(`export const BUILD_INFO_PATH = '${NETCUP.buildInfoPath}';`);
  });

  it('η προέλευση είναι το NEXT_PUBLIC_APP_URL του build παραγωγής', () => {
    const build = readWorkflowRunSteps(path.join(ROOT, '.github/workflows/docker-build.yml')).find((s) => s.env && s.env.NEXT_PUBLIC_APP_URL);
    expect(build.env.NEXT_PUBLIC_APP_URL).toBe(NETCUP.liveOrigin);
  });
});
