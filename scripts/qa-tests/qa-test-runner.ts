/**
 * =============================================================================
 * QA TEST RUNNER — Lightweight E2E test framework for AI Agent testing
 * =============================================================================
 *
 * Google TAP-inspired test runner that:
 * - Sends simulated Telegram webhooks to localhost:3000
 * - Polls Firestore for AI response (async pipeline via Next.js after())
 * - Asserts Firestore data changes
 * - Prints live, real-time output per test
 *
 * Usage: npx tsx scripts/qa-tests/contact-individual.qa.ts
 * Prerequisite: npm run dev (localhost:3000 must be running)
 *
 * @module scripts/qa-tests/qa-test-runner
 * @see docs/QA_AGENT_FINDINGS.md
 */

import * as admin from 'firebase-admin';

// ── Firebase Admin Init (reuse pattern from qa-reset-collections.ts) ──
if (!admin.apps.length) {
  const keyB64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;
  const keyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (keyB64) {
    const decoded = Buffer.from(keyB64, 'base64').toString('utf-8');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(decoded)) });
  } else if (keyJson) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(keyJson)) });
  } else {
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'pagonis-87766',
    });
  }
}

export const db = admin.firestore();

// ── Constants ────────────────────────────────────────────────────────
const WEBHOOK_URL = 'http://localhost:3000/api/communications/webhooks/telegram';
const SUPER_ADMIN_CHAT_ID = 5618410820;
const SUPER_ADMIN_NAME = 'QA_Test_Agent';
const CHAT_HISTORY_DOC_ID = 'ach_telegram_5618410820';
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 45_000;

// ── Colors (ANSI) ────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

// ── Types ────────────────────────────────────────────────────────────
export interface QATestCase {
  id: string;
  name: string;
  userMessage: string;
  assertions: (ctx: AssertionContext) => Promise<AssertionResult[]>;
  /** Skip this test */
  skip?: boolean;
  /** Delay in ms before this test (for rate limiting) */
  delayBefore?: number;
}

export interface AssertionContext {
  /** The AI agent's text response */
  aiResponse: string;
  /** Tool calls made by the AI agent */
  toolCalls: ToolCallInfo[];
  /** Firestore database reference */
  db: admin.firestore.Firestore;
  /** The contactId found/created in this session */
  contactId: string | null;
  /** Shared state across tests in a suite */
  state: Record<string, unknown>;
}

interface ToolCallInfo {
  name: string;
  args: string;
  result: string;
}

interface AssertionResult {
  label: string;
  passed: boolean;
  expected?: string;
  actual?: string;
}

interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: ToolCallInfo[];
}

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  assertions: AssertionResult[];
  aiResponse: string;
  toolCalls: ToolCallInfo[];
  durationMs: number;
  error?: string;
}

// ── Webhook Sender ───────────────────────────────────────────────────
let msgCounter = 300_000;

async function sendWebhook(text: string): Promise<{ ok: boolean }> {
  msgCounter++;
  const payload = {
    update_id: msgCounter,
    message: {
      message_id: msgCounter,
      from: { id: SUPER_ADMIN_CHAT_ID, first_name: SUPER_ADMIN_NAME, is_bot: false },
      chat: { id: SUPER_ADMIN_CHAT_ID, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text,
    },
  };

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(90_000),
  });

  return res.json() as Promise<{ ok: boolean }>;
}

// ── Poll for AI Response ─────────────────────────────────────────────
async function pollForResponse(messageCountBefore: number): Promise<{
  aiResponse: string;
  toolCalls: ToolCallInfo[];
}> {
  const start = Date.now();

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);

    const docSnap = await db.collection('ai_chat_history').doc(CHAT_HISTORY_DOC_ID).get();
    if (!docSnap.exists) continue;

    const data = docSnap.data() as { messages?: ChatHistoryMessage[] } | undefined;
    const messages = data?.messages ?? [];

    // Wait until we have more messages than before (user + assistant)
    if (messages.length <= messageCountBefore) continue;

    // Find the last assistant message
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant) continue;

    return {
      aiResponse: lastAssistant.content,
      toolCalls: lastAssistant.toolCalls ?? [],
    };
  }

  throw new Error(`Timeout: Δεν ήρθε AI response μέσα σε ${POLL_TIMEOUT_MS / 1000}s`);
}

// ── Get current message count ────────────────────────────────────────
async function getMessageCount(): Promise<number> {
  const docSnap = await db.collection('ai_chat_history').doc(CHAT_HISTORY_DOC_ID).get();
  if (!docSnap.exists) return 0;
  const data = docSnap.data() as { messages?: ChatHistoryMessage[] } | undefined;
  return data?.messages?.length ?? 0;
}

// ── Collection Reset ─────────────────────────────────────────────────
const QA_COLLECTIONS = [
  'ai_agent_feedback', 'ai_chat_history', 'ai_pipeline_audit',
  'ai_pipeline_queue', 'ai_usage', 'contacts', 'conversations',
  'external_identities', 'files', 'messages', 'file_links', 'searchDocuments',
] as const;

export async function resetCollections(): Promise<void> {
  console.log(`\n${C.yellow}🧹 Resetting QA collections...${C.reset}`);
  for (const col of QA_COLLECTIONS) {
    const ref = db.collection(col);
    let deleted = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const snap = await ref.limit(500).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deleted += snap.size;
    }
    if (deleted > 0) console.log(`  ${C.dim}🗑️ ${col}: ${deleted} docs${C.reset}`);
  }
  console.log(`${C.green}  ✅ Clean slate${C.reset}\n`);
}

// ── Find Contact ID ──────────────────────────────────────────────────
export async function findContactByName(
  firstName: string,
  lastName: string
): Promise<string | null> {
  const snap = await db.collection('contacts')
    .where('firstName', '==', firstName)
    .where('lastName', '==', lastName)
    .limit(1)
    .get();

  return snap.empty ? null : snap.docs[0].id;
}

export async function findContactByCompanyName(companyName: string): Promise<string | null> {
  const snap = await db.collection('contacts')
    .where('companyName', '==', companyName)
    .limit(1)
    .get();

  return snap.empty ? null : snap.docs[0].id;
}

// ── Assertion Helpers ────────────────────────────────────────────────
export function assertField(
  label: string,
  actual: unknown,
  expected: unknown
): AssertionResult {
  const passed = actual === expected;
  return {
    label,
    passed,
    expected: String(expected),
    actual: String(actual),
  };
}

export function assertExists(label: string, value: unknown): AssertionResult {
  const passed = value !== undefined && value !== null && value !== '';
  return {
    label,
    passed,
    expected: 'exists (non-empty)',
    actual: value === undefined ? 'undefined' : value === null ? 'null' : String(value),
  };
}

export function assertContains(
  label: string,
  text: string,
  substring: string
): AssertionResult {
  const passed = text.toLowerCase().includes(substring.toLowerCase());
  return {
    label,
    passed,
    expected: `contains "${substring}"`,
    actual: text.length > 100 ? text.substring(0, 100) + '...' : text,
  };
}

export function assertArrayLength(
  label: string,
  arr: unknown[] | undefined,
  minLength: number
): AssertionResult {
  const len = arr?.length ?? 0;
  return {
    label,
    passed: len >= minLength,
    expected: `length >= ${minLength}`,
    actual: `length = ${len}`,
  };
}

// ── Suite Runner ─────────────────────────────────────────────────────
export async function runSuite(
  suiteName: string,
  tests: QATestCase[]
): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`${C.bold}${C.cyan}  🧪 QA Suite: ${suiteName}${C.reset}`);
  console.log(`${'═'.repeat(60)}\n`);

  const results: TestResult[] = [];
  const state: Record<string, unknown> = {};
  let contactId: string | null = null;

  for (const test of tests) {
    if (test.skip) {
      console.log(`${C.yellow}  ⏭️  ${test.id}: ${test.name} — SKIPPED${C.reset}\n`);
      continue;
    }

    if (test.delayBefore) {
      await sleep(test.delayBefore);
    }

    const result = await runSingleTest(test, contactId, state);
    results.push(result);

    // Update contactId from state if set by test
    if (state.contactId) {
      contactId = state.contactId as string;
    }
  }

  // ── Summary ──────────────────────────────────────────────────────
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const skipped = tests.filter((t) => t.skip).length;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`${C.bold}  📊 Summary: ${suiteName}${C.reset}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  ${C.green}✅ Passed: ${passed}${C.reset}`);
  if (failed > 0) console.log(`  ${C.red}❌ Failed: ${failed}${C.reset}`);
  if (skipped > 0) console.log(`  ${C.yellow}⏭️  Skipped: ${skipped}${C.reset}`);
  console.log(`  📋 Total:  ${passed + failed} / ${tests.length}`);
  console.log(`${'═'.repeat(60)}\n`);

  // Print failed test details
  const failedTests = results.filter((r) => !r.passed);
  if (failedTests.length > 0) {
    console.log(`${C.red}${C.bold}  ❌ Failed Tests:${C.reset}\n`);
    for (const ft of failedTests) {
      console.log(`  ${C.red}${ft.id}: ${ft.name}${C.reset}`);
      for (const a of ft.assertions.filter((x) => !x.passed)) {
        console.log(`    ${C.red}• ${a.label}: expected ${a.expected}, got ${a.actual}${C.reset}`);
      }
      if (ft.error) console.log(`    ${C.red}• Error: ${ft.error}${C.reset}`);
      console.log('');
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

// ── Single Test Runner ───────────────────────────────────────────────
async function runSingleTest(
  test: QATestCase,
  contactId: string | null,
  state: Record<string, unknown>
): Promise<TestResult> {
  const start = Date.now();
  console.log(`${C.bold}  🧪 ${test.id}: ${test.name}${C.reset}`);
  console.log(`  ${C.dim}📨 "${test.userMessage}"${C.reset}`);

  try {
    // 1. Get message count before
    const countBefore = await getMessageCount();

    // 2. Send webhook
    const webhookRes = await sendWebhook(test.userMessage);
    if (!webhookRes.ok) {
      throw new Error(`Webhook returned ok=false`);
    }

    // 3. Poll for AI response
    const { aiResponse, toolCalls } = await pollForResponse(countBefore);

    // Print live info
    const toolNames = toolCalls.map((tc) => tc.name).join(' → ');
    if (toolNames) {
      console.log(`  ${C.blue}🤖 Tools: ${toolNames}${C.reset}`);
    }
    const truncatedResponse = aiResponse.length > 120
      ? aiResponse.substring(0, 120) + '...'
      : aiResponse;
    console.log(`  ${C.dim}📝 AI: "${truncatedResponse}"${C.reset}`);

    // 4. Run assertions
    const assertionCtx: AssertionContext = {
      aiResponse,
      toolCalls,
      db,
      contactId,
      state,
    };
    const assertions = await test.assertions(assertionCtx);

    // Print assertion results
    let allPassed = true;
    for (const a of assertions) {
      if (a.passed) {
        console.log(`  ${C.green}  ✅ ${a.label}${C.reset}`);
      } else {
        allPassed = false;
        console.log(`  ${C.red}  ❌ ${a.label}: expected ${a.expected}, got ${a.actual}${C.reset}`);
      }
    }

    const durationMs = Date.now() - start;
    const statusIcon = allPassed ? `${C.green}✅ PASS` : `${C.red}❌ FAIL`;
    console.log(`  ${statusIcon} ${C.dim}(${(durationMs / 1000).toFixed(1)}s)${C.reset}\n`);

    return {
      id: test.id,
      name: test.name,
      passed: allPassed,
      assertions,
      aiResponse,
      toolCalls,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(`  ${C.red}  💥 Error: ${errorMsg}${C.reset}`);
    console.log(`  ${C.red}❌ FAIL ${C.dim}(${(durationMs / 1000).toFixed(1)}s)${C.reset}\n`);

    return {
      id: test.id,
      name: test.name,
      passed: false,
      assertions: [],
      aiResponse: '',
      toolCalls: [],
      durationMs,
      error: errorMsg,
    };
  }
}

// ── Utilities ────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
