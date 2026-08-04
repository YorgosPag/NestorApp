#!/usr/bin/env node
'use strict';

/**
 * CHECK 3.37 — ADR-757 · Κάλυψη ιεράρχησης πυλών CI. ZERO TOLERANCE, καμία baseline.
 *
 * Ρωτά τρία πράγματα που κανείς δεν ρωτούσε:
 *   1. έχει ΚΑΘΕ workflow tier + αιτιολόγηση;            (αλλιώς: καμία πολιτική ειδοποίησης)
 *   2. συμφωνεί το όνομα στο μητρώο με το αρχείο;         (αλλιώς: ο συγκεντρωτής δεν ταιριάζει ποτέ)
 *   3. παρακολουθεί ο συγκεντρωτής ΑΚΡΙΒΩΣ τα Tier 1;     (αλλιώς: αόρατη αποτυχία παραγωγής)
 *
 * Layer 1 = pre-commit (Phase 1 worker· ~27 μικρά αρχεία, καθαρό in-memory Node).
 * Layer 2 = CI, χωρίς συνθήκη (`.github/workflows/ci-gate-tiers.yml`).
 *
 * Παράκαμψη: SKIP_CI_TIER_COVERAGE=1 git commit …   (δικαιολόγησέ την στον Giorgio)
 */

const { auditGateTiers, STATES } = require('./lib/ci/gate-registry');

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const NC = '\x1b[0m';

function main() {
  let result;
  try {
    result = auditGateTiers();
  } catch (error) {
    console.log(`${RED}  ❌ CHECK 3.37 — δεν διαβάζεται το μητρώο πυλών: ${error.message}${NC}`);
    return 1;
  }

  const { registry, findings } = result;
  if (findings.length === 0) {
    const tier1 = registry.gates.filter((gate) => gate.tier === 1).length;
    console.log(
      `${GREEN}  ✅ CHECK 3.37 — ${registry.gates.length} πύλες με tier (${tier1} × Tier 1 παρακολουθούμενες)${NC}`
    );
    return 0;
  }

  console.log('');
  console.log(`${RED}  🚫 CHECK 3.37 — ιεράρχηση πυλών CI (ADR-757)${NC}`);
  console.log('');

  const byState = new Map();
  for (const item of findings) {
    if (!byState.has(item.state)) byState.set(item.state, []);
    byState.get(item.state).push(item);
  }

  for (const [state, items] of byState) {
    console.log(`${YELLOW}  ${state} — ${STATES[state]}${NC}`);
    for (const item of items) {
      console.log(`    • ${item.subject}${item.detail ? ` — ${item.detail}` : ''}`);
    }
    console.log('');
  }

  console.log(`${YELLOW}  Μητρώο: .ci-gate-tiers.json · Τεκμηρίωση: ADR-757${NC}`);
  console.log(`${YELLOW}  Παράκαμψη (με λόγο): SKIP_CI_TIER_COVERAGE=1 git commit …${NC}`);
  return 1;
}

process.exit(main());
