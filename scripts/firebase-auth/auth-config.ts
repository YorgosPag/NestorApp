#!/usr/bin/env tsx
/**
 * **Η ΡΥΘΜΙΣΗ FIREBASE AUTH ΕΝΑΝΤΙ ΤΟΥ GIT** — ADR-851.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ΕΚΤΕΛΕΣΗ
 * ═══════════════════════════════════════════════════════════════════════════
 *   npm run firebase-auth:config:check                              # μόνο ανάγνωση, exit 1 σε απόκλιση
 *   npm run firebase-auth:config:apply -- --expect-drift=<N>        # γράφει ΜΟΝΟ ό,τι απέκλινε
 *
 * 🔒 **Φρουροί**: ξηρό εξ ορισμού · το `--apply` απαιτεί τον αριθμό αποκλίσεων του ελέγχου και
 *    **αρνείται** αν η κονσόλα άλλαξε στο μεταξύ · γράφονται **μόνο** δηλωμένες διαδρομές
 *    (`updateMask`) · τυπώνονται **μόνο** περιγραφές, ποτέ σώματα ή μη δηλωμένα πεδία.
 *
 * 🔴 Το `NODE_OPTIONS=--conditions=react-server` είναι ο δηλωμένος μηχανισμός του πακέτου
 *    `server-only` (βλ. `scripts/notifications/replay-notification.ts`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-851-firebase-auth-config-as-code.md
 */

import { applyEnvLocal } from '../_shared/loadEnvLocal';

// ⚠️ ΠΡΙΝ από κάθε module της εφαρμογής: το `publicOrigin()` διαβάζει το env.
applyEnvLocal();

interface ConfigArgs {
  readonly apply: boolean;
  readonly expectDrift: number | null;
}

function parseArgs(argv: readonly string[]): ConfigArgs {
  const raw = argv.find((arg) => arg.startsWith('--expect-drift='))?.slice('--expect-drift='.length);
  const expectDrift = raw === undefined ? null : Number(raw);
  const apply = argv.includes('--apply');
  if (apply && (expectDrift === null || !Number.isInteger(expectDrift) || expectDrift < 0)) {
    throw new Error('Το --apply απαιτεί --expect-drift=<N> — τον αριθμό αποκλίσεων του --check');
  }
  return { apply, expectDrift };
}

async function check(): Promise<number> {
  const { auditFirebaseAuthConfig } = await import('@/server/firebase-auth-config/auth-config-audit');
  const audit = await auditFirebaseAuthConfig();
  if (audit.kind === 'refused') {
    console.error('❌ ΔΕΝ ΚΡΙΘΗΚΕ: λείπει το NEXT_PUBLIC_APP_URL — χωρίς δημόσια διεύθυνση δεν υπάρχει «σωστό».');
    return 2;
  }
  const { partitionDrifts } = await import('@/server/firebase-auth-config/auth-config-state');
  const { applicable, frozen } = partitionDrifts(audit.drifts);
  console.log(`Project: ${audit.projectId} · αποκλίσεις: ${applicable.length} εγγράψιμες + ${frozen.length} παγωμένες`);
  for (const drift of applicable) {
    console.log(`\n  ✗ ${drift.path}\n    δηλωμένο: ${drift.expected}\n    ζωντανό:  ${drift.actual}`);
  }
  for (const drift of frozen) {
    // 🔴 ΜΕΤΡΗΜΕΝΟ 2026-09-12: η Google αρνείται **με κάθε τρόπο** — service account, ιδιοκτήτης,
    //    ΚΑΙ η ίδια η κονσόλα («non sono al momento disponibili per questo progetto»). Το παλιό
    //    μήνυμα έλεγε «ΜΟΝΟ ΚΟΝΣΟΛΑ … μέσω API» και **έστελνε τον αναγνώστη να κάνει κάτι που
    //    δεν γίνεται**. Μόνη διέξοδος: αίτημα στην υποστήριξη Firebase (ADR-851 §7 #1).
    console.log(`\n  🧊 ${drift.path}  (ΠΑΓΩΜΕΝΟ ΑΠΟ ΤΗΝ GOOGLE — αναμενόμενο· ούτε API ούτε κονσόλα)`
      + `\n    δηλωμένο: ${drift.expected}\n    ζωντανό:  ${drift.actual}`);
  }
  for (const item of audit.notJudged) console.log(`\n  ⚪ ΔΕΝ ΚΡΙΝΕΤΑΙ: ${item}`);
  if (audit.drifts.length === 0) console.log('\n✅ Η κονσόλα συμφωνεί με το git σε κάθε δηλωμένη διαδρομή.');
  if (applicable.length > 0) console.log(`\n→ npm run firebase-auth:config:apply -- --expect-drift=${applicable.length}`);
  return audit.drifts.length === 0 ? 0 : 1;
}

async function apply(expectDrift: number): Promise<number> {
  const { applyFirebaseAuthConfig } = await import('@/server/firebase-auth-config/auth-config-audit');
  const outcome = await applyFirebaseAuthConfig(expectDrift);
  if (outcome.kind === 'refused') {
    console.error('❌ ΑΡΝΗΣΗ: λείπει το NEXT_PUBLIC_APP_URL.');
    return 2;
  }
  if (outcome.kind === 'stale') {
    console.error(`❌ ΑΡΝΗΣΗ: αναμένονταν ${outcome.expected} αποκλίσεις, βρέθηκαν ${outcome.found}. Τρέξε ξανά --check.`);
    return 1;
  }
  console.log(outcome.paths.length === 0 ? '✅ Τίποτα εγγράψιμο.' : `✅ Γράφτηκαν: ${outcome.paths.join(', ')}`);
  for (const drift of outcome.frozen) console.log(`🧊 Παγωμένο από την Google, δεν γράφεται: ${drift.path}`);
  return 0;
}

/**
 * **Γράφει τα πρότυπα προς επικόλληση στην κονσόλα** (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`, ADR-851).
 *
 * ⚠️ **ΜΕΤΡΗΜΕΝΟ 2026-09-12: η επικόλληση ΔΕΝ περνά ούτε αυτή** — η κονσόλα απαντά «*non sono al
 * momento disponibili per questo progetto*». Η εξαγωγή μένει γιατί είναι **η μόνη μορφή** στην
 * οποία μπορεί να ζητηθεί το περιεχόμενο από την υποστήριξη Firebase — όχι επειδή υπάρχει δρόμος.
 */
async function exportTemplates(dir: string): Promise<number> {
  const { mkdirSync, writeFileSync } = await import('fs');
  const { join } = await import('path');
  const { declaredFirebaseTemplates } = await import('@/server/firebase-auth-config/auth-config-audit');
  mkdirSync(dir, { recursive: true });
  for (const [kind, template] of Object.entries(declaredFirebaseTemplates())) {
    writeFileSync(join(dir, `${kind}.subject.txt`), template.subject, 'utf8');
    writeFileSync(join(dir, `${kind}.html`), template.body, 'utf8');
    console.log(`✍️  ${kind}: ${join(dir, `${kind}.subject.txt`)} · ${join(dir, `${kind}.html`)}`);
  }
  return 0;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const exportDir = argv.find((arg) => arg.startsWith('--export-templates='))?.slice('--export-templates='.length);
  if (exportDir) {
    process.exitCode = await exportTemplates(exportDir);
    return;
  }
  const args = parseArgs(argv);
  process.exitCode = args.apply && args.expectDrift !== null ? await apply(args.expectDrift) : await check();
}

main().catch((error: unknown) => {
  console.error('❌', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
