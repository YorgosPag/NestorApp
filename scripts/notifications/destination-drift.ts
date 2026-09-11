#!/usr/bin/env tsx
/**
 * **ΑΝΙΧΝΕΥΤΗΣ ΑΠΟΚΛΙΣΗΣ ΠΡΟΟΡΙΣΜΩΝ** — ADR-849 §6δ Β2.
 *
 * Για κάθε ειδοποίηση **με** σύνδεσμο ρωτά το SSoT του παραγωγού της *«τι προορισμό θα
 * έγραφες σήμερα;»* και τυπώνει ό,τι αποκλίνει: πόρτα (`/offers/prop_*` αντί για
 * `/properties/…`) και χώρο-στόχο (`meta.workspace`, που λείπει από κάθε έγγραφο πριν
 * το Β1). Η λογική ζει στο `src/server/notifications/notification-destination-*.ts`
 * (καθαρό + κανόνες, με άγκυρες)· εδώ μένει μόνο το I/O και η εκτύπωση.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ΕΚΤΕΛΕΣΗ
 * ═══════════════════════════════════════════════════════════════════════════
 *   npm run notifications:destination-drift                          # ξηρό: τυπώνει, δεν γράφει
 *   npm run notifications:destination-drift -- --apply --expect-drift=<N>
 *
 * 🔒 **Φρουροί**: ξηρό εξ ορισμού · το `--apply` απαιτεί `--expect-drift=<N>` και
 *    **αρνείται** αν η βάση άλλαξε από το ξηρό τρέξιμο (άλλος αριθμός αποκλίσεων) — γράφει
 *    **ακριβώς** ό,τι ενέκρινε ο άνθρωπος · ιδεμποτές (δεύτερο πέρασμα ⇒ 0 αποκλίσεις) ·
 *    αγγίζει **μόνο** `actions` και `meta.workspace`.
 *
 * 🔴 Το `NODE_OPTIONS=--conditions=react-server` είναι ο δηλωμένος μηχανισμός του πακέτου
 *    `server-only` (βλ. `scripts/notifications/replay-notification.ts`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-848-notification-permalink.md
 */

import type { WorkspaceRef } from '@/types/workspace-membership';
import type {
  DriftVerdict,
  StoredNotification,
} from '@/server/notifications/notification-destination-drift';

import { loadEnvLocal } from '../_shared/loadEnvLocal';

// ⚠️ ΠΡΙΝ από κάθε module της εφαρμογής (ίδιος λόγος με το `replay-notification.ts`).
for (const [key, value] of Object.entries<string>(loadEnvLocal())) {
  if (process.env[key] === undefined) process.env[key] = value;
}

/** Μέγεθος σελίδας ανάγνωσης και δέσμης εγγραφής (όριο Firestore: 500 πράξεις ανά δέσμη). */
const PAGE_SIZE = 300;

interface DriftArgs {
  readonly apply: boolean;
  readonly expectDrift: number | null;
}

interface Finding {
  readonly notification: StoredNotification;
  readonly verdict: DriftVerdict;
}

function parseArgs(argv: readonly string[]): DriftArgs {
  const raw = argv.find((arg) => arg.startsWith('--expect-drift='))?.slice('--expect-drift='.length);
  const expectDrift = raw === undefined ? null : Number(raw);
  const apply = argv.includes('--apply');
  if (apply && (expectDrift === null || !Number.isInteger(expectDrift) || expectDrift < 0)) {
    throw new Error('Το --apply απαιτεί --expect-drift=<N> — τον αριθμό αποκλίσεων του ξηρού τρεξίματος');
  }
  return { apply, expectDrift };
}

async function loadApp() {
  const [drift, rules, admin, collections, firestore, scope] = await Promise.all([
    import('@/server/notifications/notification-destination-drift'),
    import('@/server/notifications/notification-destination-rules'),
    import('@/lib/firebaseAdmin'),
    import('@/config/firestore-collections'),
    import('firebase-admin/firestore'),
    import('@/lib/workspace/workspace-scope'),
  ]);
  return { drift, rules, admin, collections, firestore, scope };
}

type App = Awaited<ReturnType<typeof loadApp>>;

/** Όλες οι ειδοποιήσεις **με** σύνδεσμο, σε σελίδες (ποτέ μία ανάγνωση χωρίς όριο). */
async function loadNotifications(app: App): Promise<StoredNotification[]> {
  const collection = app.admin
    .getAdminFirestore()
    .collection(app.collections.COLLECTIONS.NOTIFICATIONS);
  const found: StoredNotification[] = [];
  let cursor: string | null = null;

  for (;;) {
    let query = collection.orderBy(app.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
    if (cursor !== null) query = query.startAfter(cursor);
    const page = await query.get();
    for (const doc of page.docs) {
      const stored = app.drift.storedNotificationOf(doc.id, doc.data());
      if (stored !== null) found.push(stored);
    }
    if (page.size < PAGE_SIZE) return found;
    cursor = page.docs[page.docs.length - 1].id;
  }
}

async function judgeAll(app: App, notifications: readonly StoredNotification[]): Promise<Finding[]> {
  const db = app.admin.getAdminFirestore();
  const findings: Finding[] = [];
  for (const notification of notifications) {
    const expected = await app.rules.expectedDestinationOf(db, notification);
    findings.push({ notification, verdict: app.drift.destinationDrift(notification, expected) });
  }
  return findings;
}

function describeWorkspace(ref: WorkspaceRef | null): string {
  if (ref === null) return '— (κανένας)';
  return ref.kind === 'org' ? `γραφείο ${ref.companyId}` : `ιδιωτικός ${ref.userId}`;
}

function printDrift(finding: Finding): void {
  const { notification, verdict } = finding;
  if (verdict.kind !== 'drift') return;
  console.log(`• ${notification.id}`);
  if (verdict.url) console.log(`    πόρτα: ${verdict.url.stored}  →  ${verdict.url.expected}`);
  if (verdict.workspace) {
    console.log(
      `    χώρος: ${describeWorkspace(verdict.workspace.stored)}  →  ${describeWorkspace(verdict.workspace.expected)}`,
    );
  }
}

/**
 * **Ό,τι δεν έχει κανόνα, ονομαστικά** — ανά τύπο και πρώτο τμήμα διαδρομής, με τη μία
 * ερώτηση που μετράει: *«ανοίγει μέσα σε χώρο;»*. Αυτά μένουν στην παλιά συμπεριφορά (ο
 * χώρος του θεατή) και **δεν** διορθώνονται με μαντεψιά.
 */
function printUnruled(app: App, findings: readonly Finding[]): void {
  const counts = new Map<string, number>();
  for (const { notification, verdict } of findings) {
    if (verdict.kind !== 'unresolvable' || verdict.reason !== 'no-rule') continue;
    const segment = notification.url.split(/[?#]/, 1)[0].split('/').filter(Boolean)[0] ?? '';
    const world = app.scope.isInsideWorkspace(notification.url) ? 'ΕΝΤΟΣ χώρου' : 'εκτός χώρου';
    const key = `${notification.eventType || '(χωρίς τύπο)'} · /${segment} · ${world}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return;
  console.log('\nΧΩΡΙΣ ΚΑΝΟΝΑ (μένουν ως έχουν· όσα είναι ΕΝΤΟΣ χώρου ανοίγουν στον χώρο του θεατή):');
  for (const [key, count] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`  ${count} × ${key}`);
}

/** Σύνοψη ανά τύπο — **κλειστή λογιστική**: κάθε ειδοποίηση σε ακριβώς έναν κάδο. */
function printSummary(findings: readonly Finding[]): void {
  const buckets = new Map<string, Map<string, number>>();
  for (const { notification, verdict } of findings) {
    const bucket = verdict.kind === 'unresolvable' ? `χωρίς κανόνα/οντότητα (${verdict.reason})` : verdict.kind;
    const perType = buckets.get(notification.eventType) ?? new Map<string, number>();
    perType.set(bucket, (perType.get(bucket) ?? 0) + 1);
    buckets.set(notification.eventType, perType);
  }
  console.log('\nΣΥΝΟΨΗ (ειδοποιήσεις με σύνδεσμο):');
  for (const [eventType, perType] of buckets) {
    const parts = [...perType].map(([bucket, count]) => `${bucket}: ${count}`).join(' · ');
    console.log(`  ${eventType || '(χωρίς τύπο)'} — ${parts}`);
  }
  console.log(`  ΣΥΝΟΛΟ: ${findings.length}`);
}

async function applyPatches(app: App, drifts: readonly Finding[]): Promise<void> {
  const db = app.admin.getAdminFirestore();
  const collection = db.collection(app.collections.COLLECTIONS.NOTIFICATIONS);
  for (let start = 0; start < drifts.length; start += PAGE_SIZE) {
    const batch = db.batch();
    for (const { notification, verdict } of drifts.slice(start, start + PAGE_SIZE)) {
      if (verdict.kind === 'drift') batch.update(collection.doc(notification.id), { ...verdict.patch });
    }
    await batch.commit();
  }
  console.log(`\n✓ Γράφτηκαν ${drifts.length} ειδοποιήσεις. Ξανατρέξε χωρίς --apply: πρέπει να δείξει 0 αποκλίσεις.`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const app = await loadApp();
  const findings = await judgeAll(app, await loadNotifications(app));
  const drifts = findings.filter((finding) => finding.verdict.kind === 'drift');

  console.log(`\nΑΠΟΚΛΙΣΕΙΣ: ${drifts.length}\n`);
  drifts.forEach(printDrift);
  printUnruled(app, findings);
  printSummary(findings);

  if (!args.apply) {
    console.log(`\nΞΗΡΟ ΤΡΕΞΙΜΟ — τίποτα δεν γράφτηκε. Για εγγραφή: --apply --expect-drift=${drifts.length}`);
    return;
  }
  if (args.expectDrift !== drifts.length) {
    throw new Error(
      `Η βάση άλλαξε από το ξηρό τρέξιμο: ${drifts.length} αποκλίσεις, εγκρίθηκαν ${args.expectDrift} — αρνούμαι`,
    );
  }
  await applyPatches(app, drifts);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(`\n⛔ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
