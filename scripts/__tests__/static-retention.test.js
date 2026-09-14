/**
 * @fileoverview ADR-860 §Ε1 — διατήρηση static assets μεταξύ deploys.
 *
 * Οι υποσχέσεις:
 *   Δ1  ό,τι λείπει από το νέο build και ανήκει σε κρατημένο deployment ⇒ μεταφέρεται·
 *   Δ2  αρχείο ΚΟΙΝΟ σε παλιό (ληγμένο) και νέο deployment ⇒ ΔΕΝ χάνεται·
 *   Δ3  ληγμένο deployment (>7 ημέρες) ⇒ τα ΑΠΟΚΛΕΙΣΤΙΚΑ του αρχεία δεν μεταφέρονται·
 *   Δ4  οροφή 20 deployments, το τρέχον πάντα μέσα·
 *   Δ5  ίδιο όνομα με άλλα bytes ⇒ κρατιέται το νέο, αναφέρεται ως σύγκρουση (ποτέ αντικατάσταση)·
 *   Δ6  πρώτη φορά (χωρίς μανιφέστο) ⇒ τα παλιά παίρνουν περίοδο χάριτος, δεν χάνονται αμέσως·
 *   Δ7  χαλασμένο μανιφέστο ⇒ προειδοποίηση, ποτέ σφάλμα·
 *   Δ8  από άκρη σε άκρη σε πραγματικό δίσκο: το CLI αντιγράφει και γράφει μανιφέστο.
 *
 * @jest-environment node
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { buildCarryForwardPlan, PRE_RETENTION_ID } = require('../lib/static-retention/carry-forward-plan');
const { RETENTION_POLICY, selectRetainedDeployments } = require('../lib/static-retention/retention-policy');
const { parseManifest, serializeManifest, MANIFEST_FILE } = require('../lib/static-retention/retention-manifest');

const NOW = '2026-09-14T12:00:00.000Z';
const daysAgo = (n) => new Date(Date.parse(NOW) - n * 24 * 60 * 60 * 1000).toISOString();
const files = (entries) => new Map(Object.entries(entries));

describe('buildCarryForwardPlan', () => {
  test('Δ1 — τα chunks του προηγούμενου deploy μεταφέρονται στο νέο', () => {
    const plan = buildCarryForwardPlan({
      prevFiles: files({ 'chunks/old-a.js': 'h1', 'chunks/shared.js': 'hs' }),
      prevDeployments: [{ id: 'sha-prev', deployedAt: daysAgo(1), files: ['chunks/old-a.js', 'chunks/shared.js'] }],
      nextFiles: files({ 'chunks/new-b.js': 'h2', 'chunks/shared.js': 'hs' }),
      deploymentId: 'sha-next',
      nowIso: NOW,
    });
    expect(plan.copy).toEqual(['chunks/old-a.js']);
    expect(plan.conflicts).toEqual([]);
    expect(plan.retained.map((d) => d.id)).toEqual(['sha-next', 'sha-prev']);
  });

  test('Δ2+Δ3 — ληγμένο deployment: τα αποκλειστικά του φεύγουν, τα κοινά με κρατημένο μένουν', () => {
    const plan = buildCarryForwardPlan({
      prevFiles: files({ 'chunks/expired-only.js': 'e', 'chunks/kept-by-recent.js': 'k' }),
      prevDeployments: [
        { id: 'sha-old', deployedAt: daysAgo(10), files: ['chunks/expired-only.js', 'chunks/kept-by-recent.js'] },
        { id: 'sha-recent', deployedAt: daysAgo(2), files: ['chunks/kept-by-recent.js'] },
      ],
      nextFiles: files({ 'chunks/new.js': 'n' }),
      deploymentId: 'sha-next',
      nowIso: NOW,
    });
    expect(plan.copy).toEqual(['chunks/kept-by-recent.js']);
    expect(plan.expiredDeploymentIds).toEqual(['sha-old']);
  });

  test('Δ5 — ίδιο όνομα με άλλα bytes ⇒ ΔΕΝ αντιγράφεται, αναφέρεται ως σύγκρουση', () => {
    const plan = buildCarryForwardPlan({
      prevFiles: files({ 'chunks/same-name.js': 'old-bytes' }),
      prevDeployments: [{ id: 'sha-prev', deployedAt: daysAgo(1), files: ['chunks/same-name.js'] }],
      nextFiles: files({ 'chunks/same-name.js': 'new-bytes' }),
      deploymentId: 'sha-next',
      nowIso: NOW,
    });
    expect(plan.copy).toEqual([]);
    expect(plan.conflicts).toEqual(['chunks/same-name.js']);
  });

  test('Δ6 — πρώτη φορά χωρίς μανιφέστο: τα παλιά παίρνουν περίοδο χάριτος', () => {
    const plan = buildCarryForwardPlan({
      prevFiles: files({ 'chunks/legacy.js': 'l' }),
      prevDeployments: [],
      nextFiles: files({ 'chunks/new.js': 'n' }),
      deploymentId: 'sha-next',
      nowIso: NOW,
    });
    expect(plan.copy).toEqual(['chunks/legacy.js']);
    expect(plan.retained.map((d) => d.id)).toEqual(['sha-next', PRE_RETENTION_ID]);
  });

  test('ξανατρέξιμο του ίδιου commit (workflow_dispatch) δεν διπλασιάζει την εγγραφή', () => {
    const plan = buildCarryForwardPlan({
      prevFiles: files({ 'chunks/a.js': 'a' }),
      prevDeployments: [{ id: 'sha-same', deployedAt: daysAgo(0), files: ['chunks/a.js'] }],
      nextFiles: files({ 'chunks/a.js': 'a' }),
      deploymentId: 'sha-same',
      nowIso: NOW,
    });
    expect(plan.retained.map((d) => d.id)).toEqual(['sha-same']);
  });
});

describe('selectRetainedDeployments', () => {
  test('Δ4 — οροφή, το τρέχον πάντα πρώτο, τα υπόλοιπα από το νεότερο', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `sha-${i}`, deployedAt: daysAgo(i / 10), files: [] }));
    const current = { id: 'sha-current', deployedAt: NOW, files: [] };
    const retained = selectRetainedDeployments([...many, current], 'sha-current', Date.parse(NOW));
    expect(retained).toHaveLength(RETENTION_POLICY.maxDeployments);
    expect(retained[0].id).toBe('sha-current');
    expect(retained[1].id).toBe('sha-0');
  });

  test('το τρέχον δεν γίνεται ποτέ να λείπει σιωπηλά', () => {
    expect(() => selectRetainedDeployments([], 'sha-x', Date.parse(NOW))).toThrow(/sha-x/);
  });
});

describe('parseManifest — Δ7 ανεκτικό, ποτέ σφάλμα', () => {
  test('λείπει ⇒ κενό, χωρίς προειδοποίηση', () => {
    expect(parseManifest(null)).toEqual({ deployments: [], warning: null });
  });

  test('χαλασμένο JSON ⇒ κενό + προειδοποίηση', () => {
    const result = parseManifest('{nope');
    expect(result.deployments).toEqual([]);
    expect(result.warning).toMatch(/μη αναγνώσιμο/);
  });

  test('άκυρες εγγραφές αγνοούνται, οι έγκυρες μένουν', () => {
    const text = JSON.stringify({
      version: 1,
      deployments: [{ id: 'ok', deployedAt: NOW, files: ['a.js'] }, { id: 42 }],
    });
    const result = parseManifest(text);
    expect(result.deployments.map((d) => d.id)).toEqual(['ok']);
    expect(result.warning).toMatch(/1 άκυρες/);
  });

  test('στρογγυλή διαδρομή serialize → parse', () => {
    const deployments = [{ id: 'sha', deployedAt: NOW, files: ['a.js'] }];
    expect(parseManifest(serializeManifest(deployments))).toEqual({ deployments, warning: null });
  });
});

describe('Δ8 — CLI σε πραγματικό δίσκο', () => {
  const CLI = path.join(__dirname, '..', 'deploy', 'carry-forward-static-assets.js');

  function write(root, relative, content) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }

  test('αντιγράφει τα παλιά, δεν αγγίζει τα νέα, γράφει μανιφέστο', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'static-retention-'));
    try {
      const prev = path.join(tmp, 'prev');
      const next = path.join(tmp, 'next');
      write(prev, 'chunks/old.js', 'old');
      write(prev, 'chunks/same.js', 'PREVIOUS');
      write(next, 'chunks/new.js', 'new');
      write(next, 'chunks/same.js', 'CURRENT');

      execFileSync(process.execPath, [CLI, '--prev', prev, '--next', next, '--deployment', 'sha-next', '--now', NOW], {
        encoding: 'utf8',
      });

      expect(fs.readFileSync(path.join(next, 'chunks/old.js'), 'utf8')).toBe('old');
      expect(fs.readFileSync(path.join(next, 'chunks/same.js'), 'utf8')).toBe('CURRENT');
      const manifest = parseManifest(fs.readFileSync(path.join(next, MANIFEST_FILE), 'utf8'));
      expect(manifest.deployments.map((d) => d.id)).toEqual(['sha-next', PRE_RETENTION_ID]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('χωρίς --prev (πρώτο deploy / GHCR κάτω) ⇒ επιτυχία με μανιφέστο μόνο του τρέχοντος', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'static-retention-'));
    try {
      const next = path.join(tmp, 'next');
      write(next, 'chunks/new.js', 'new');
      execFileSync(process.execPath, [CLI, '--next', next, '--deployment', 'sha-first', '--now', NOW]);
      const manifest = parseManifest(fs.readFileSync(path.join(next, MANIFEST_FILE), 'utf8'));
      expect(manifest.deployments.map((d) => d.id)).toEqual(['sha-first']);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
