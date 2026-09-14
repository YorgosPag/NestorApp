#!/usr/bin/env node
/**
 * @fileoverview **Μεταφέρει τα static assets προηγούμενων deploys στο νέο build** — ώστε μια
 * ανοιχτή καρτέλα να βρίσκει τον κώδικά της και μετά από deploy.
 * @related ADR-860 §Ε1 · `.github/workflows/docker-build.yml` · ADR-788
 *
 * Χρήση (CI, μετά το `build:ci`, πριν το `docker build`):
 *   node scripts/deploy/carry-forward-static-assets.js \
 *     --prev .prev-static --next .next/static --deployment <git sha>
 *
 * 🔴 **ΓΙΑΤΙ**: η εικόνα Docker περιείχε **μόνο** το `.next/static` του τρέχοντος build. Κάθε
 * deploy έσβηνε τον κώδικα της προηγούμενης έκδοσης, και κάθε ανοιχτή καρτέλα που ζητούσε chunk
 * μετά το deploy έπεφτε σε οθόνη σφάλματος (ADR-858 §5.5 · ADR-860).
 *
 * 🔑 **ΔΕΝ ΞΑΝΑΧΤΙΖΕΙ** (CHECK 3.57 / ADR-788): τα παλιά assets έρχονται από την **ήδη
 * δημοσιευμένη** εικόνα, που το workflow έχει κάνει `docker cp` στο `--prev`.
 *
 * 🔑 **ΠΟΤΕ ΔΕΝ ΣΤΑΜΑΤΑ ΤΟ DEPLOY για λόγους διατήρησης**: χωρίς `--prev` (πρώτη φορά, GHCR κάτω)
 * γράφει μανιφέστο μόνο με το τρέχον deployment. Οι συγκρούσεις είναι `::warning::`.
 * Exit ≠ 0 **μόνο** για λάθος χρήσης (λείπει `--next`/`--deployment`).
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { buildCarryForwardPlan } = require('../lib/static-retention/carry-forward-plan');
const { MANIFEST_FILE, parseManifest, serializeManifest } = require('../lib/static-retention/retention-manifest');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1];
  if (!args.next || !args.deployment) {
    throw new Error('Χρήση: --next <dir> --deployment <id> [--prev <dir>] [--now <iso>]');
  }
  return { prev: args.prev ?? null, next: args.next, deployment: args.deployment, now: args.now ?? new Date().toISOString() };
}

/** Όλα τα αρχεία (σχετικά, με `/`) → sha256. Το μανιφέστο εξαιρείται. Λείπει ο φάκελος ⇒ κενό. */
function hashTree(root) {
  const files = new Map();
  if (!root || !fs.existsSync(root)) return files;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) {
        const relative = path.relative(root, absolute).split(path.sep).join('/');
        if (relative === MANIFEST_FILE) continue;
        files.set(relative, crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex'));
      }
    }
  };
  walk(root);
  return files;
}

function readManifest(root) {
  const file = root ? path.join(root, MANIFEST_FILE) : null;
  return parseManifest(file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
}

function copyFiles(files, from, to) {
  let bytes = 0;
  for (const file of files) {
    const target = path.join(to, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(from, file), target, fs.constants.COPYFILE_EXCL);
    bytes += fs.statSync(target).size;
  }
  return bytes;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = readManifest(args.prev);
  if (manifest.warning) console.log(`::warning::ADR-860 §Ε1 — ${manifest.warning}`);

  const plan = buildCarryForwardPlan({
    prevFiles: hashTree(args.prev),
    prevDeployments: manifest.deployments,
    nextFiles: hashTree(args.next),
    deploymentId: args.deployment,
    nowIso: args.now,
  });

  const bytes = copyFiles(plan.copy, args.prev, args.next);
  fs.writeFileSync(path.join(args.next, MANIFEST_FILE), serializeManifest(plan.retained));

  for (const file of plan.conflicts) {
    console.log(`::warning::ADR-860 §Ε1 — ίδιο όνομα, άλλα bytes (κρατήθηκε το νέο): ${file}`);
  }
  console.log(
    `ADR-860 §Ε1 — μεταφέρθηκαν ${plan.copy.length} αρχεία (${(bytes / 1048576).toFixed(1)} MB) · ` +
      `κρατούνται ${plan.retained.length} deployments · έληξαν: ${plan.expiredDeploymentIds.join(', ') || '—'}`,
  );
}

if (require.main === module) main();

module.exports = { hashTree, parseArgs };
