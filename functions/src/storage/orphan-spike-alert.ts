/**
 * =============================================================================
 * STORAGE: ORPHAN-CLEANUP SPIKE ALERT (scheduled)
 * =============================================================================
 *
 * Layer 3 of the ADR-327 defense-in-depth: observability backstop for
 * orphan-cleanup regressions.
 *
 * The `onStorageFinalize` Cloud Function (`storage/orphan-cleanup.ts`) deletes
 * any file in `companies/...` whose fileId has no claim in `FILES` /
 * `FILE_SHARES`. The 2026-04-27 incident hid for hours because deletions
 * were silent — the UI showed broken images with no audit trail surfacing
 * the cause.
 *
 * This scheduled function runs every hour, counts `ORPHAN_FILE_DELETED`
 * audit entries from the last 60 minutes, and pings the super-admin Telegram
 * chat if the count exceeds the configured threshold. A spike indicates
 * either:
 *   - a new storage consumer was added without `uploadPublicFile()` /
 *     pre-claim (regression — Layer 1 failed),
 *   - the orphan-cleanup logic itself is mis-firing (resolver gap),
 *   - genuine traffic spike (rare).
 *
 * # Idempotency
 *
 * After alerting, writes a doc to `system_orphan_spike_alerts/{yyyy-MM-ddTHH}`
 * with `{firedAt, count}`. If the next run sees the same hour-bucket already
 * alerted, it skips. Prevents alert flapping when the threshold is crossed
 * for several consecutive hours.
 *
 * # Notification channel
 *
 * Telegram via direct HTTPS POST. The Cloud Function runtime cannot reach
 * `src/lib/telemetry/telegram-alert-service.ts` (different package), so
 * this file ships its own minimal client (~10 lines). Token + chat id come
 * from env vars set by the Firebase deploy pipeline:
 *   - `TELEGRAM_BOT_TOKEN`
 *   - `TELEGRAM_ADMIN_CHAT_ID`
 *
 * If `TELEGRAM_BOT_TOKEN` is missing, the function still runs and writes
 * the alert to Firestore + structured log — Stackdriver alert can be wired
 * separately on `severity=ERROR` of `OrphanSpikeAlert` logger name.
 *
 * @module functions/storage/orphan-spike-alert
 * @enterprise ADR-327 §Defense-in-Depth Layer 3
 * @see functions/src/storage/orphan-cleanup.ts (the producer)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { COLLECTIONS } from '../config/firestore-collections';

const SPIKE_ALERTS_COLLECTION = 'system_orphan_spike_alerts';
const DEFAULT_THRESHOLD = 5;
const LOOKBACK_MS = 60 * 60 * 1000;
const SUPER_ADMIN_DEFAULT_CHAT_ID = '5618410820';

interface OrphanAuditEntry {
  storagePath?: string;
  contentType?: string;
}

export const orphanSpikeAlert = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .pubsub.schedule('0 * * * *')
  .timeZone('UTC')
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const since = new Date(now.getTime() - LOOKBACK_MS);
    const hourBucket = bucketKey(now);

    if (await alreadyAlerted(db, hourBucket)) {
      functions.logger.info('OrphanSpikeAlert: already alerted this hour, skipping', {
        hourBucket,
      });
      return null;
    }

    const snap = await db
      .collection(COLLECTIONS.CLOUD_FUNCTION_AUDIT_LOG)
      .where('action', '==', 'ORPHAN_FILE_DELETED')
      .where('performedAt', '>=', admin.firestore.Timestamp.fromDate(since))
      .limit(200)
      .get();

    const count = snap.size;
    const threshold = readThreshold();

    functions.logger.info('OrphanSpikeAlert: poll complete', { count, threshold, hourBucket });

    if (count <= threshold) return null;

    const samples = snap.docs.slice(0, 5).map((d) => {
      const details = (d.data().details ?? {}) as OrphanAuditEntry;
      return details.storagePath ?? '(unknown path)';
    });

    const message = formatMessage({ count, threshold, hourBucket, samples });

    functions.logger.error('OrphanSpikeAlert: spike detected', {
      count,
      threshold,
      hourBucket,
      samples,
    });

    await sendTelegram(message);
    await markAlerted(db, hourBucket, count);

    return null;
  });

function bucketKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function readThreshold(): number {
  const raw = process.env.ORPHAN_SPIKE_THRESHOLD;
  if (!raw) return DEFAULT_THRESHOLD;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_THRESHOLD;
}

async function alreadyAlerted(
  db: admin.firestore.Firestore,
  hourBucket: string,
): Promise<boolean> {
  const doc = await db.collection(SPIKE_ALERTS_COLLECTION).doc(hourBucket).get();
  return doc.exists;
}

async function markAlerted(
  db: admin.firestore.Firestore,
  hourBucket: string,
  count: number,
): Promise<void> {
  await db.collection(SPIKE_ALERTS_COLLECTION).doc(hourBucket).set({
    hourBucket,
    count,
    firedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

function formatMessage(args: {
  count: number;
  threshold: number;
  hourBucket: string;
  samples: string[];
}): string {
  const sampleLines = args.samples.map((s) => `  • \`${s}\``).join('\n');
  return [
    '🚨 *Orphan File Spike Detected*',
    `Hour: \`${args.hourBucket}\` UTC`,
    `Deleted files: *${args.count}* (threshold: ${args.threshold})`,
    'Sample paths:',
    sampleLines || '  (no samples)',
    '',
    'Likely cause: a new storage consumer is calling `bucket.file().save()`',
    'without writing a `FILES/{fileId}` pre-claim. Check recent commits',
    'touching `src/services/storage-admin/` or new uploads outside the SSoT.',
  ].join('\n');
}

async function sendTelegram(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    functions.logger.warn('OrphanSpikeAlert: TELEGRAM_BOT_TOKEN unset, skipping push', {});
    return;
  }
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID ?? SUPER_ADMIN_DEFAULT_CHAT_ID;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
    });
    if (!res.ok) {
      functions.logger.error('OrphanSpikeAlert: Telegram API error', {
        status: res.status,
        body: await res.text(),
      });
    }
  } catch (err) {
    functions.logger.error('OrphanSpikeAlert: Telegram fetch failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
