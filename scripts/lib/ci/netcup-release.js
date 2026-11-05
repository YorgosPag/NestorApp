'use strict';

/**
 * ADR-865 §11.11 — **«Deploy completato» σημαίνει «η νέα έκδοση ΣΕΡΒΙΡΕΙ»**, όχι «ζητήθηκε».
 *
 * Πριν: το βήμα της κυκλοφορίας ήταν ένα `curl -s` στο `…/applications/<uuid>/start` του Coolify.
 * Το Coolify απαντά αμέσως `Deployment request queued.` ⇒ το job τελείωνε ⇒ το Telegram έλεγε ✅.
 * Μετρημένο 2026-11-05: ✅ στις 09:12:14 UTC, το `/api/build-info` έδειχνε το **παλιό** sha 30″
 * μετά, το νέο σε ≤4′. Αν το container δεν ανέβαινε ποτέ (build crash, healthcheck, OOM), το
 * μήνυμα έλεγε **πάλι** ✅. Και το `curl -s` χωρίς `-f` έκανε **σιωπηλό** ακόμη και ένα 401.
 *
 * Τώρα (πρότυπο Vercel `READY` + έλεγχος alias · Argo Rollouts analysis · verify-deployment με
 * αναμενόμενο sha): **ενεργοποίηση** → **παρακολούθηση** της κατάστασης του Coolify deployment
 * (πρώτη, γρήγορη πηγή αποτυχίας) → **κριτής** το `/api/build-info` (ADR-860 §Ε0): ✅ ΜΟΝΟ όταν
 * το sha που σερβίρεται είναι **ίσο** με το commit που κυκλοφορεί. Το «READY» της πλατφόρμας
 * μόνο του δεν αρκεί — το ίδιο παρατηρούν και οι χρήστες του Vercel (READY με 502).
 *
 * 🔑 Κανένα αίτημα δεν πετά: κάθε απάντηση γίνεται **παρατήρηση** (HTTP code · σφάλμα δικτύου),
 * ώστε το ❌ να λέει **τι είδαμε**, όχι «κάτι πήγε στραβά».
 *
 * ⚠️ User-Agent: το `src/middleware.ts` δίνει **403** σε `curl/`, `node-fetch`, `axios/` κ.ά.
 * (μετρημένο: `curl/8.0` → 403 · ρητό UA → 200). Δεν χαλαρώνουμε τον φράχτη· δηλώνουμε ρητό,
 * δικό μας UA — όπως ο χρονοπρογραμματιστής (`nestor-scheduler/…`, ADR-740). Άγκυρα στο test:
 * το UA δεν ταιριάζει σε κανένα `BLOCKED_BOT_PATTERNS`.
 */

const NETCUP = Object.freeze({
  coolifyApi: 'http://159.195.44.221:8000/api/v1',
  applicationUuid: 'f661kuiq901llma0o8unhvpi',
  /** Ίδια με το `NEXT_PUBLIC_APP_URL` του build (άγκυρα στο test). */
  liveOrigin: 'https://nestorconstruct.gr',
  /** Ίδιο με το `BUILD_INFO_PATH` του `src/lib/app-version/build-info-contract.ts` (άγκυρα). */
  buildInfoPath: '/api/build-info',
  userAgent: 'nestor-deploy-verifier/1.0 (+ADR-865)',
});

const TIMING = Object.freeze({
  pollMs: 10_000,
  /** Μετρημένο ≤4′ από την ενεργοποίηση ως το νέο sha· ×3 περιθώριο. Το job έχει 20′. */
  deadlineMs: 12 * 60_000,
  /** Coolify `finished` αλλά άλλο sha ⇒ περιθώριο για την εναλλαγή container, μετά ❌. */
  finishedGraceMs: 90_000,
  requestTimeoutMs: 10_000,
});

/** Οι τιμές του `App\Enums\ApplicationDeploymentStatus` του Coolify (πηγαίος κώδικας v4). */
const COOLIFY_STATUS = Object.freeze({
  queued: 'queued',
  inProgress: 'in_progress',
  finished: 'finished',
  failed: 'failed',
  cancelled: 'cancelled-by-user',
});
const COOLIFY_DEAD = new Set([COOLIFY_STATUS.failed, COOLIFY_STATUS.cancelled]);

const VERDICT = Object.freeze({ LIVE: 'live', NOT_LIVE: 'not-live', NOT_TRIGGERED: 'not-triggered' });

const SHA = /^[0-9a-f]{40}$/;
const clip = (text) => String(text).replace(/\s+/g, ' ').trim().slice(0, 160);
const short = (sha) => (typeof sha === 'string' ? sha.slice(0, 7) : '—');

/** `134000` → `2′14″` · `45000` → `45″`. */
function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes === 0 ? `${seconds}″` : `${minutes}′${String(seconds).padStart(2, '0')}″`;
}

/** Ένα GET που **ποτέ** δεν πετά: `{http, body, error}`. */
async function getJson(url, headers, deps) {
  try {
    const response = await deps.fetchImpl(url, {
      method: 'GET',
      headers: { accept: 'application/json', 'user-agent': NETCUP.userAgent, 'cache-control': 'no-store', ...headers },
      signal: AbortSignal.timeout(deps.timing.requestTimeoutMs),
    });
    const text = await response.text();
    let body = null;
    try {
      body = text === '' ? null : JSON.parse(text);
    } catch {
      body = null;
    }
    return { http: response.status, ok: response.ok, body, error: null };
  } catch (error) {
    return { http: null, ok: false, body: null, error: clip(error.message) };
  }
}

const coolifyHeaders = (token) => ({ authorization: `Bearer ${token}` });

/** Ενεργοποίηση: `{deploymentUuid}` ή `{deploymentUuid:null, reason}`. */
async function triggerCoolify(token, deps) {
  if (!token) return { deploymentUuid: null, reason: 'λείπει COOLIFY_TOKEN' };
  const url = `${NETCUP.coolifyApi}/applications/${NETCUP.applicationUuid}/start`;
  const res = await getJson(url, coolifyHeaders(token), deps);
  const uuid = res.body && typeof res.body.deployment_uuid === 'string' ? res.body.deployment_uuid : null;
  if (res.ok && uuid) return { deploymentUuid: uuid, reason: null };
  const said = res.error ?? (res.body && res.body.message ? clip(res.body.message) : 'χωρίς deployment_uuid');
  return { deploymentUuid: null, reason: `Coolify ${res.http === null ? 'απρόσιτο' : `HTTP ${res.http}`}: ${said}` };
}

/** Μία παρατήρηση: κατάσταση Coolify + τι σερβίρεται ζωντανά. */
async function observe(token, deploymentUuid, deps) {
  const [coolify, live] = await Promise.all([
    getJson(`${NETCUP.coolifyApi}/deployments/${deploymentUuid}`, coolifyHeaders(token), deps),
    getJson(`${NETCUP.liveOrigin}${NETCUP.buildInfoPath}`, {}, deps),
  ]);
  const status = coolify.body && typeof coolify.body.status === 'string' ? coolify.body.status : null;
  const sha = live.body && typeof live.body.deploymentId === 'string' ? live.body.deploymentId.toLowerCase() : null;
  return {
    coolify: { status, http: coolify.http, error: coolify.error },
    live: { sha, http: live.http, error: live.error },
  };
}

/**
 * Ο **κριτής** — καθαρή συνάρτηση. ✅ ΜΟΝΟ με ίσο sha· η λήξη χρόνου, το `failed` του Coolify και
 * το «Coolify finished αλλά σερβίρεται άλλο» είναι ❌. Ποτέ ✅ από την πλατφόρμα μόνη της.
 * @returns {{state:'live'|'failed'|'pending', reason:string|null}}
 */
function judge(observation, { expectedSha, startedAt, finishedSince, now, timing }) {
  const expected = String(expectedSha).toLowerCase();
  if (SHA.test(expected) && observation.live.sha === expected) return { state: 'live', reason: null };
  const status = observation.coolify.status;
  if (COOLIFY_DEAD.has(status)) return { state: 'failed', reason: `Coolify: ${status}` };
  if (finishedSince !== null && now - finishedSince >= timing.finishedGraceMs) {
    return { state: 'failed', reason: 'Coolify finished, αλλά σερβίρεται άλλη έκδοση' };
  }
  if (now - startedAt >= timing.deadlineMs) return { state: 'failed', reason: `λήξη χρόνου ${formatDuration(timing.deadlineMs)}` };
  return { state: 'pending', reason: null };
}

/** «Τι είδαμε», σε μία γραμμή: sha που σερβίρεται (ή HTTP/σφάλμα) · κατάσταση Coolify. */
function describeObservation({ coolify, live }) {
  const served = live.sha ? `σερβίρεται ${short(live.sha)}` : `build-info ${live.error ?? `HTTP ${live.http}`}`;
  const platform = coolify.status ? `Coolify ${coolify.status}` : `Coolify ${coolify.error ?? `HTTP ${coolify.http}`}`;
  return `${served} · ${platform}`;
}

/** Παρακολούθηση μέχρι ετυμηγορία (ζωντανό · αποτυχία · λήξη). */
async function awaitLive(token, deploymentUuid, expectedSha, deps) {
  const startedAt = deps.now();
  let finishedSince = null;
  for (let poll = 1; ; poll += 1) {
    const observation = await observe(token, deploymentUuid, deps);
    const now = deps.now();
    if (observation.coolify.status === COOLIFY_STATUS.finished && finishedSince === null) finishedSince = now;
    const verdict = judge(observation, { expectedSha, startedAt, finishedSince, now, timing: deps.timing });
    deps.log(`… ${formatDuration(now - startedAt)} · ${describeObservation(observation)}`);
    if (verdict.state !== 'pending') return { ...verdict, observation, elapsedMs: now - startedAt, polls: poll };
    await deps.sleep(deps.timing.pollMs);
  }
}

/**
 * Ολόκληρη η κυκλοφορία: ενεργοποίηση → παρακολούθηση → ετυμηγορία.
 * @returns {Promise<{verdict:string, summary:string}>}
 */
async function releaseToNetcup({ expectedSha, token }, deps) {
  const trigger = await triggerCoolify(token, deps);
  if (!trigger.deploymentUuid) {
    return { verdict: VERDICT.NOT_TRIGGERED, summary: `δεν ενεργοποιήθηκε: ${trigger.reason}` };
  }
  deps.log(`Coolify deployment ${trigger.deploymentUuid} — αναμένεται ${short(expectedSha)}`);
  const result = await awaitLive(token, trigger.deploymentUuid, expectedSha, deps);
  const took = formatDuration(result.elapsedMs);
  if (result.state === 'live') return { verdict: VERDICT.LIVE, summary: `live ${short(expectedSha)} (${took})` };
  return {
    verdict: VERDICT.NOT_LIVE,
    summary: `δεν ανέβηκε ${short(expectedSha)}: ${result.reason} · ${describeObservation(result.observation)} (${took})`,
  };
}

module.exports = {
  NETCUP,
  TIMING,
  COOLIFY_STATUS,
  VERDICT,
  formatDuration,
  judge,
  describeObservation,
  triggerCoolify,
  releaseToNetcup,
};
