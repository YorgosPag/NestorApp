/**
 * =============================================================================
 * 📨 SEED AI INBOX MESSAGES - ENTERPRISE OPS SCRIPT
 * =============================================================================
 *
 * Creates real Firestore messages for AI Inbox testing.
 * Uses JSON input and reportWriter for audit artifacts.
 *
 * REQUIRED ENV:
 * - FIREBASE_SERVICE_ACCOUNT_KEY
 * - AI_INBOX_SEED_PATH (path to JSON file)
 * - TARGET_COMPANY_ID (default companyId if missing per entry)
 *
 * OPTIONAL ENV:
 * - MESSAGES_COLLECTION (preferred)
 * - NEXT_PUBLIC_MESSAGES_COLLECTION
 *
 * INPUT FILE FORMAT (JSON array):
 * [
 *   {
 *     "from": "Sender Name",
 *     "subject": "Subject",
 *     "content": "Message content",
 *     "type": "telegram",
 *     "direction": "inbound",
 *     "contactId": "contact_123",
 *     "triageStatus": "pending",
 *     "intentAnalysis": {
 *       "kind": "message_intent",
 *       "intentType": "info_update",
 *       "confidence": 0.85,
 *       "needsTriage": false,
 *       "aiModel": "seed",
 *       "analysisTimestamp": "2026-02-03T10:30:01Z",
 *       "rawMessage": "Example raw message",
 *       "extractedEntities": {}
 *     }
 *   }
 * ]
 *
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { loadEnvLocal } = require('./_shared/loadEnvLocal');
const { createReportWriter } = require('./_shared/reportWriter');

function getRequiredEnv(key) {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`[seed-ai-inbox] Missing required env: ${key}`);
  }
  return value.trim();
}

function getMessagesCollection() {
  const explicit = process.env.MESSAGES_COLLECTION;
  const publicEnv = process.env.NEXT_PUBLIC_MESSAGES_COLLECTION;
  const value = explicit || publicEnv;
  if (!value || value.trim() === '') {
    throw new Error('[seed-ai-inbox] Missing messages collection env (MESSAGES_COLLECTION or NEXT_PUBLIC_MESSAGES_COLLECTION)');
  }
  return value.trim();
}

function readInputFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[seed-ai-inbox] Input file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error('[seed-ai-inbox] Input must be a JSON array');
  }
  return data;
}

async function run() {
  loadEnvLocal();

  const serviceAccountRaw = getRequiredEnv('FIREBASE_SERVICE_ACCOUNT_KEY');
  const seedPath = getRequiredEnv('AI_INBOX_SEED_PATH');
  const defaultCompanyId = getRequiredEnv('TARGET_COMPANY_ID');
  const collectionName = getMessagesCollection();

  const absoluteSeedPath = path.isAbsolute(seedPath)
    ? seedPath
    : path.join(process.cwd(), seedPath);

  const entries = readInputFile(absoluteSeedPath);
  const report = createReportWriter('ai-inbox-seed');

  const serviceAccount = JSON.parse(serviceAccountRaw);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  const db = admin.firestore();
  const messagesRef = db.collection(collectionName);

  for (const entry of entries) {
    report.incrementScanned(1);

    if (!entry || typeof entry !== 'object') {
      report.recordSkip({ id: 'unknown', reason: 'invalid_input', details: 'Entry must be object' });
      continue;
    }

    const companyId = entry.companyId || defaultCompanyId;
    if (!companyId) {
      report.recordSkip({ id: entry.id || 'unknown', reason: 'missing_companyId' });
      continue;
    }

    try {
      const payload = {
        ...entry,
        companyId,
        triageStatus: entry.triageStatus || 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await messagesRef.add(payload);
      report.recordUpdate({
        id: docRef.id,
        before: null,
        after: {
          companyId,
          triageStatus: payload.triageStatus,
        },
      });
    } catch (error) {
      report.recordError({
        id: entry.id || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  await report.finalize();
}

run().catch((error) => {
  console.error('[seed-ai-inbox] Fatal:', error.message || error);
  process.exit(1);
});
