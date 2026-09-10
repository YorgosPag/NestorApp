#!/usr/bin/env tsx
/**
 * **ΕΠΑΝΑΛΗΨΗ ΕΙΔΟΠΟΙΗΣΗΣ** — ADR-849 Α4: ζωντανό τεστ του email ειδοποιήσεων.
 *
 * Ξαναστέλνει υπάρχουσες ειδοποιήσεις σαν καινούργιες, **μέσα από τον ίδιο αγωγό**:
 * `dispatchNotification` → κουδούνι + ουρά email → `outbound-email-flush` **της παραγωγής**.
 * Η λογική ζει στο `src/server/notifications/notification-replay.ts` (καθαρό, με άγκυρες)·
 * εδώ μένει μόνο το I/O και η εκτύπωση.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ΕΚΤΕΛΕΣΗ
 * ═══════════════════════════════════════════════════════════════════════════
 *   npm run notifications:replay -- --id=<notificationId> [--id=…] --tag=<ετικέτα> \
 *     --expect-email=<διεύθυνση>              # ξηρό: τυπώνει τι ΘΑ γινόταν, δεν γράφει
 *   … --apply                                  # γραφή (κουδούνι + ουρά email)
 *
 * 🔒 **Φρουροί**: ένας παραλήπτης (ο αρχικός) · η διεύθυνσή του **πρέπει** να είναι η
 *    `--expect-email` · υποχρεωτικοί τύποι αρνούνται · ίδια ετικέτα δύο φορές = «διπλότυπο».
 *
 * ⚠️ **Δεν στέλνει email το ίδιο — γράφει στην ουρά.** Το email φεύγει από τον αγωγό της
 *    **παραγωγής** (κοινή Firestore), με το origin και το μυστικό **της**. Ένα τοπικό flush θα
 *    υπέγραφε με το τοπικό μυστικό ⇒ σύνδεσμοι «μη διαθέσιμοι» — και θα έπαιρνε **όλη** την
 *    κοινή ουρά. Γι' αυτό αυτό το εργαλείο **δεν** αγγίζει τον αγωγό.
 *
 * ⚠️ **Η ώρα αποστολής κρίνεται τη στιγμή της ουράς** (`daily` ⇒ 20:00). Το ξηρό τρέξιμο την
 *    τυπώνει ανά ειδοποίηση — κοίτα την **πριν** το `--apply`.
 *
 * 🔴 Το `NODE_OPTIONS=--conditions=react-server` είναι ο δηλωμένος μηχανισμός του πακέτου
 *    `server-only` (βλ. `scripts/migrations/backfill-first-contact-offerer.ts`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-849-notification-preferences-type-by-channel.md §6γ
 */

import type { EmailDeliveryDecision } from '@/server/notifications/email-delivery-window';
import type { ReplayRejection, ReplaySource } from '@/server/notifications/notification-replay';

import { loadEnvLocal } from '../_shared/loadEnvLocal';

// ⚠️ ΠΡΙΝ από κάθε module της εφαρμογής: το `COLLECTIONS` και ο `firebaseAdmin` διαβάζουν το
// `process.env` τη στιγμή της εισαγωγής — γι' αυτό φορτώνονται **δυναμικά** στο `loadApp`.
// Ό,τι έχει ήδη το κέλυφος κερδίζει.
for (const [key, value] of Object.entries<string>(loadEnvLocal())) {
  if (process.env[key] === undefined) process.env[key] = value;
}

interface ReplayArgs {
  readonly ids: readonly string[];
  readonly tag: string;
  readonly expectEmail: string;
  readonly apply: boolean;
}

const REJECTION_TEXT: Readonly<Record<ReplayRejection, string>> = {
  'missing-recipient': 'χωρίς παραλήπτη',
  'unknown-event-type': 'άγνωστος τύπος συμβάντος',
  'mandatory-type': 'υποχρεωτικός τύπος (ασφάλεια) — δεν επαναλαμβάνεται ποτέ',
  'missing-tenant': 'χωρίς μισθωτή',
  'missing-title': 'χωρίς τίτλο',
  'missing-event-id': 'χωρίς ταυτότητα γεγονότος',
  'invalid-source': 'άγνωστη υπηρεσία προέλευσης',
};

function parseArgs(argv: readonly string[]): ReplayArgs {
  const values = (name: string): string[] =>
    argv.filter((arg) => arg.startsWith(`--${name}=`)).map((arg) => arg.slice(name.length + 3));
  const ids = values('id').filter((id) => id.length > 0);
  const [tag = ''] = values('tag');
  const [expectEmail = ''] = values('expect-email');
  if (ids.length === 0) throw new Error('Λείπει τουλάχιστον ένα --id=<notificationId>');
  if (!expectEmail.includes('@')) throw new Error('Λείπει --expect-email=<η διεύθυνση του παραλήπτη>');
  return { ids, tag, expectEmail, apply: argv.includes('--apply') };
}

async function loadApp() {
  const [replay, orchestrator, leg, store, delivery, events, admin, collections] = await Promise.all([
    import('@/server/notifications/notification-replay'),
    import('@/server/notifications/notification-orchestrator'),
    import('@/server/notifications/notification-email-leg'),
    import('@/server/notifications/user-notification-settings-store'),
    import('@/server/notifications/email-delivery-window'),
    import('@/config/notification-events'),
    import('@/lib/firebaseAdmin'),
    import('@/config/firestore-collections'),
  ]);
  return { replay, orchestrator, leg, store, delivery, events, admin, collections };
}

type App = Awaited<ReturnType<typeof loadApp>>;

async function loadSources(app: App, ids: readonly string[]): Promise<ReplaySource[]> {
  const notifications = app.admin.getAdminFirestore().collection(app.collections.COLLECTIONS.NOTIFICATIONS);
  const sources: ReplaySource[] = [];
  for (const id of ids) {
    const snapshot = await notifications.doc(id).get();
    if (!snapshot.exists) throw new Error(`Δεν υπάρχει ειδοποίηση: ${id}`);
    const parsed = app.replay.parseReplaySource(id, snapshot.data());
    if (!parsed.ok) throw new Error(`Δεν επαναλαμβάνεται (${REJECTION_TEXT[parsed.reason]}): ${id}`);
    sources.push(parsed.source);
  }
  return sources;
}

async function assertRecipientEmail(app: App, recipientId: string, expected: string): Promise<void> {
  const actual = await app.leg.resolveRecipientEmail(recipientId);
  if (actual === null || actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`Ο παραλήπτης ΔΕΝ είναι ο ${expected} (βρέθηκε: ${actual ?? 'καμία διεύθυνση'}) — αρνούμαι`);
  }
}

function describeDecision(decision: EmailDeliveryDecision, timeZone: string): string {
  if (decision.kind === 'send-now') return 'email: ΤΩΡΑ — φεύγει στο επόμενο πέρασμα της παραγωγής (≤10′)';
  if (decision.kind === 'suppressed') return `email: ΔΕΝ θα σταλεί (${decision.reason})`;
  const at = decision.deliverAt.toLocaleString('el-GR', { timeZone, dateStyle: 'short', timeStyle: 'short' });
  return `email: αναβολή έως ${at} (${decision.reason})`;
}

/** Τι **θα** γίνει — με την ίδια απόφαση που θα πάρει το σκέλος email τη στιγμή της ουράς. */
async function printPlan(app: App, sources: readonly ReplaySource[], tag: string): Promise<void> {
  const settings = await app.store.loadUserNotificationSettings(sources[0].recipientId);
  const timeZone = app.delivery.resolveTimeZone(settings.timezone);
  const now = new Date();
  console.log(`\nΠαραλήπτης: ${sources[0].recipientId} · συχνότητα email: ${settings.emailFrequency}\n`);
  for (const source of sources) {
    const request = app.replay.toReplayRequest(source, tag);
    const mapping = app.events.EVENT_CATEGORY_MAP[request.eventType];
    const decision = app.delivery.decideEmailDelivery(settings, { now, isMandatory: mapping.isMandatory, setting: mapping });
    console.log(`• ${request.title}`);
    console.log(`  από:          ${source.notificationId}`);
    console.log(`  νέο γεγονός:  ${request.eventId}`);
    console.log(`  ${describeDecision(decision, timeZone)}`);
  }
}

async function dispatchAll(app: App, sources: readonly ReplaySource[], tag: string): Promise<void> {
  for (const source of sources) {
    const result = await app.orchestrator.dispatchNotification(app.replay.toReplayRequest(source, tag));
    const outcome = result.skipped ? `ΠΑΡΑΛΕΙΦΘΗΚΕ — ${result.reason ?? 'χωρίς λόγο'}` : `✓ ${result.notificationId}`;
    console.log(`• ${source.request.title}\n  ${outcome}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const app = await loadApp();
  if (!app.replay.isReplayTag(args.tag)) throw new Error('--tag: μικρά λατινικά, ψηφία, παύλες (έως 40)');
  const sources = await loadSources(app, args.ids);
  const recipientId = app.replay.replayRecipientOf(sources);
  if (recipientId === null) throw new Error('Οι ειδοποιήσεις ανήκουν σε ΔΙΑΦΟΡΕΤΙΚΟΥΣ παραλήπτες — αρνούμαι');
  await assertRecipientEmail(app, recipientId, args.expectEmail);
  await printPlan(app, sources, args.tag);
  if (!args.apply) {
    console.log('\nΞΗΡΟ ΤΡΕΞΙΜΟ — τίποτα δεν γράφτηκε. Για αποστολή: ίδια εντολή + --apply');
    return;
  }
  console.log('\nΕΚΤΕΛΕΣΗ (--apply):');
  await dispatchAll(app, sources, args.tag);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(`\n⛔ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
