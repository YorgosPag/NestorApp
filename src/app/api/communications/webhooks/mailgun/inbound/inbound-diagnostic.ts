/**
 * 🏢 MAILGUN INBOUND — διαγνωστικό του `GET` (κανόνες δρομολόγησης + κατάσταση ουράς).
 *
 * Εξήχθη από το `route.ts` (CHECK 4: API route ≤300 γραμμές). Συμπεριφορά αμετάβλητη.
 *
 * @module api/communications/webhooks/mailgun/inbound/inbound-diagnostic
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { getErrorMessage } from '@/lib/error-utils';

type Diagnostic = Record<string, unknown>;

async function readRoutingRules(adminDb: Firestore, diagnostic: Diagnostic): Promise<void> {
  const { COLLECTIONS, SYSTEM_DOCS } = await import('@/config/firestore-collections');
  const settingsDoc = await adminDb.collection(COLLECTIONS.SYSTEM).doc(SYSTEM_DOCS.SYSTEM_SETTINGS).get();
  const routingInfo = diagnostic.routing as Record<string, unknown>;
  routingInfo.hasSettings = settingsDoc.exists;
  if (!settingsDoc.exists) return;

  const data = settingsDoc.data();
  routingInfo.hasIntegrations = Boolean(data?.integrations);
  const rules = data?.integrations?.emailInboundRouting;
  if (Array.isArray(rules)) {
    routingInfo.rulesCount = rules.length;
    routingInfo.rules = rules.map((r: Record<string, unknown>) =>
      `${r.pattern} → ${typeof r.companyId === 'string' ? r.companyId.substring(0, 8) + '...' : 'none'} (active: ${r.isActive})`
    );
  }
}

async function readQueueStatus(adminDb: Firestore, diagnostic: Diagnostic): Promise<void> {
  const { COLLECTIONS } = await import('@/config/firestore-collections');
  const { FIELDS } = await import('@/config/firestore-field-constants');
  const queueRef = adminDb.collection(COLLECTIONS.EMAIL_INGESTION_QUEUE);
  const queueInfo = diagnostic.queue as Record<string, unknown>;

  const allItems = await queueRef.orderBy(FIELDS.CREATED_AT, 'desc').limit(10).get();
  queueInfo.total = allItems.size;

  let pending = 0, processing = 0, completed = 0, failed = 0;
  const items: string[] = [];
  allItems.forEach(doc => {
    const d = doc.data();
    const status = d.status as string;
    if (status === 'pending') pending++;
    else if (status === 'processing') processing++;
    else if (status === 'completed') completed++;
    else if (status === 'failed' || status === 'dead_letter') failed++;
    items.push(`${doc.id}: ${status} | ${d.subject || 'no-subject'} | ${d.sender?.email || 'unknown'} | ${d.createdAt?.toDate?.()?.toISOString?.() || 'no-date'}`);
  });
  Object.assign(queueInfo, { pending, processing, completed, failed, items });
}

/** Try to process batch and capture any errors. */
async function tryProcessBatch(diagnostic: Diagnostic): Promise<void> {
  try {
    const { processEmailIngestionBatch } = await import('@/server/comms/workers/email-ingestion-worker');
    const batchResult = await processEmailIngestionBatch({ batchSize: 1 });
    diagnostic.batchProcessResult = {
      processed: batchResult.processed,
      failed: batchResult.failed,
      recovered: batchResult.recovered,
    };
  } catch (batchError) {
    diagnostic.batchProcessError = getErrorMessage(batchError, 'Unknown batch error');
    // Firestore missing index errors include a URL to create the index
    if (batchError instanceof Error && batchError.message.includes('index')) {
      diagnostic.missingIndexUrl = batchError.message;
    }
  }
}

/** Full diagnostic: routing rules + queue status. */
export async function buildInboundDiagnostic(): Promise<Diagnostic> {
  const diagnostic: Diagnostic = {
    routing: { rulesCount: 0, hasIntegrations: false, hasSettings: false, rules: [] as string[] },
    queue: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, latestItem: null as string | null },
  };

  try {
    const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
    const adminDb = getAdminFirestore();
    await readRoutingRules(adminDb, diagnostic);
    await readQueueStatus(adminDb, diagnostic);
    await tryProcessBatch(diagnostic);
  } catch (diagError) {
    diagnostic.error = getErrorMessage(diagError);
  }

  return diagnostic;
}
