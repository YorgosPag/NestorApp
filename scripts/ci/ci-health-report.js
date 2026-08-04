#!/usr/bin/env node
'use strict';

/**
 * ADR-757 — Ο συγκεντρωτής κατάστασης πυλών CI (τρέχει ΜΟΝΟ στο GitHub Actions).
 *
 * Ο προκάτοχός του άκουγε `workflow_run` σε 18 χειρόγραφα ονόματα και προσέθετε ένα σχόλιο
 * ανά αποτυχία. Δύο δομικά ελαττώματα: (α) η λίστα είχε αποκλίνει — 7 πύλες, ανάμεσά τους η
 * ΜΟΝΑΔΙΚΗ που φράζει την παραγωγή, δεν παρακολουθούνταν καθόλου· (β) χωρίς κατάσταση, τα 8
 * μόνιμα κόκκινα παρήγαγαν 8 νέα σχόλια σε κάθε push.
 *
 * Εδώ: **προβολή από το API** (δεν αποκλίνει — δεν υπάρχει λίστα να ξεχαστεί) + **σχόλιο μόνο
 * σε μετάβαση** (σταθερό κόκκινο = σιωπή) + **culprit attribution** (ποιο commit την έσπασε).
 *
 * Χρήση:  node scripts/ci/ci-health-report.js
 * Env:    GITHUB_TOKEN (issues: write, actions: read) · GITHUB_REPOSITORY · GITHUB_API_URL
 */

const fs = require('fs');
const path = require('path');

const { parseState, projectGateStatus, diffState, renderBody } = require('../lib/ci/health-state');

const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GITHUB_TOKEN;
const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const BRANCH = process.env.CI_HEALTH_BRANCH || 'main';
const LABEL = 'ci-health';
const TITLE = '🚨 CI Health — κατάσταση πυλών (ADR-757)';

async function api(method, route, body) {
  const response = await fetch(route.startsWith('http') ? route : `${API}${route}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${TOKEN}`,
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    throw new Error(`${method} ${route} → ${response.status} ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

/** Τα τελευταία ολοκληρωμένα τρεξίματα μιας πύλης στο `main`, νεότερο πρώτο. */
async function runsFor(file) {
  const route =
    `/repos/${REPO}/actions/workflows/${encodeURIComponent(file)}/runs` +
    `?branch=${encodeURIComponent(BRANCH)}&status=completed&per_page=30`;
  try {
    const payload = await api('GET', route);
    return payload.workflow_runs || [];
  } catch (error) {
    // Πύλη που δεν έχει τρέξει ποτέ στο main (νέο αρχείο, path filter) — ρητή κατάσταση
    // «άγνωστη», όχι σιωπηλή παράλειψη: μια πύλη που δεν τρέχει ΕΙΝΑΙ εύρημα.
    console.warn(`⚠️  ${file}: ${error.message}`);
    return [];
  }
}

async function projectAll(registry) {
  const gates = {};
  for (const gate of registry.gates) {
    gates[gate.name] = {
      tier: gate.tier,
      file: gate.file,
      ...projectGateStatus(await runsFor(gate.file)),
    };
  }
  return gates;
}

async function ensureLabel() {
  try {
    await api('GET', `/repos/${REPO}/labels/${LABEL}`);
  } catch {
    await api('POST', `/repos/${REPO}/labels`, {
      name: LABEL,
      color: 'b60205',
      description: 'ADR-757 — πίνακας κατάστασης πυλών CI',
    });
  }
}

async function findOrCreateIssue(body) {
  const open = await api('GET', `/repos/${REPO}/issues?labels=${LABEL}&state=open&per_page=1`);
  if (open.length > 0) return open[0];
  return api('POST', `/repos/${REPO}/issues`, { title: TITLE, labels: [LABEL], body });
}

/** Το σχόλιο ΜΕΤΑΒΑΣΗΣ — το μοναδικό πράγμα εδώ που στέλνει ειδοποίηση. */
function transitionComment(broke, fixed) {
  const tier1 = [...broke, ...fixed].some((gate) => gate.tier === 1);
  const lines = [
    tier1
      ? '## 🔴 TIER 1 — ΠΑΡΑΓΩΓΗ'
      : '## 📋 Μεταβολές πυλών (Tier 2)',
    '',
  ];

  for (const gate of broke) {
    lines.push(
      `- ❌ **έσπασε** · ${gate.name} — commit \`${gate.sinceSha || gate.sha}\`` +
        `${gate.actor ? ` (${gate.actor})` : ''} · [τρέξιμο](${gate.sinceRunUrl || gate.runUrl})`
    );
  }
  for (const gate of fixed) {
    lines.push(`- ✅ **αποκαταστάθηκε** · ${gate.name} — \`${gate.sha}\` · [τρέξιμο](${gate.runUrl})`);
  }

  lines.push('', '<sub>Το σώμα του issue έχει τον πλήρη πίνακα. Σταθερό κόκκινο δεν παράγει σχόλιο (ADR-757).</sub>');
  return lines.join('\n');
}

async function main() {
  if (!REPO || !TOKEN) throw new Error('Λείπει GITHUB_REPOSITORY ή GITHUB_TOKEN');

  const registryPath = path.join(__dirname, '..', '..', '.ci-gate-tiers.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

  await ensureLabel();
  const issue = await findOrCreateIssue('_αρχικοποίηση…_');
  const previous = parseState(issue.body || '');

  const next = { version: 1, updatedAt: new Date().toISOString(), gates: await projectAll(registry) };
  const { broke, fixed } = diffState(previous, next);

  await api('PATCH', `/repos/${REPO}/issues/${issue.number}`, {
    title: TITLE,
    body: renderBody(next, registry),
  });

  // Tier 3 = ποτέ ειδοποίηση: μετρικές τάσης δεν ξυπνούν άνθρωπο.
  const notify = { broke: broke.filter((g) => g.tier <= 2), fixed: fixed.filter((g) => g.tier <= 2) };
  if (notify.broke.length > 0 || notify.fixed.length > 0) {
    await api('POST', `/repos/${REPO}/issues/${issue.number}/comments`, {
      body: transitionComment(notify.broke, notify.fixed),
    });
  }

  const failing = Object.values(next.gates).filter((gate) => gate.conclusion === 'failure');
  console.log(
    `🚑 Issue #${issue.number} ενημερώθηκε · ${failing.length}/${registry.gates.length} κόκκινες · ` +
      `μεταβάσεις: ${broke.length} έσπασαν, ${fixed.length} αποκαταστάθηκαν`
  );
}

main().catch((error) => {
  console.error(`❌ ci-health-report: ${error.message}`);
  process.exit(1);
});
