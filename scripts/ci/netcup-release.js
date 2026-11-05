#!/usr/bin/env node
'use strict';

/**
 * ADR-865 §11.11 — Κυκλοφορία στο Netcup **με απόδειξη** (λεπτό CLI πάνω στο
 * `scripts/lib/ci/netcup-release.js`). Τρέχει **μόνο** στο job `release` του `docker-build.yml`.
 *
 * Env: `COOLIFY_TOKEN` · `GITHUB_SHA` (το commit που πρέπει να σερβίρεται).
 * Έξοδοι βήματος: `verdict` (`live` | `not-live` | `not-triggered`) · `summary` (μία γραμμή για
 * το Telegram — «live ce35e9b (2′14″)» ή «δεν ανέβηκε …: τι είδαμε»).
 *
 * Έξοδος 0 **ΜΟΝΟ** όταν το `/api/build-info` σερβίρει το `GITHUB_SHA`· αλλιώς 1 ⇒ το job
 * `release` κοκκινίζει και η ειδοποίηση λέει ❌ — ποτέ ψευδές ✅.
 */

const { releaseToNetcup, TIMING, VERDICT } = require('../lib/ci/netcup-release');
const { setOutputs, appendSummary } = require('../lib/ci/actions-io');

async function main(argv, deps = {}) {
  const d = {
    env: process.env,
    log: console.log,
    fetchImpl: fetch,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: Date.now,
    timing: TIMING,
    ...deps,
  };
  const { verdict, summary } = await releaseToNetcup({ expectedSha: d.env.GITHUB_SHA || '', token: d.env.COOLIFY_TOKEN }, d);
  setOutputs({ verdict, summary }, d.env);
  const live = verdict === VERDICT.LIVE;
  appendSummary(`### ${live ? '✅' : '❌'} Netcup\n\n${summary}`, d.env);
  d.log(live ? `✓ ${summary}` : `::error::${summary}`);
  return live ? 0 : 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}

module.exports = { main };
