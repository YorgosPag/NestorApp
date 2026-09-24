/**
 * ADR-875 §10 — ΤΑ GOLDEN ΔΕΔΟΜΕΝΑ του χρησμού 3.51, μόνο στον emulator.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ΤΙ ΑΠΑΝΤΑ
 *
 * Ο `emulator-seed-personas.ts` σπέρνει **ποιοι** (ταυτότητες, μηδέν δεδομένα). Αυτός
 * σπέρνει **τι** κρίνεται: μία οντότητα ανά δυναμικό τμήμα των `/o/[workspace]/**`,
 * ώστε ο χρησμός να ζητά `projects/proj_…` και όχι `projects/ssr-probe` (ADR-875 §9.2:
 * 46 από τα 67 🔶 ήταν ακριβώς αυτό).
 *
 * 🔑 Η ΒΑΘΜΙΔΑ `api` ΣΠΕΡΝΕΤΑΙ ΑΠΟ ΤΟ API ΤΗΣ **ΣΤΑΛΜΕΝΗΣ ΕΙΚΟΝΑΣ**
 *    Ό,τι διαβάζει ο server (έργο · RFQ · PO · tokens) περνά από την **ίδια** διαδρομή
 *    εγγραφής με τον χρήστη: zod · πολιτική ADR-284 · γέννηση έργου με ομάδα (CHECK 3.88)
 *    · audit · υπογεγραμμένο token. Πρότυπο Playwright/Cypress («seed via API, not the
 *    DB») και ADR-788 («κρίνουμε ό,τι στάλθηκε»). Καμία δεύτερη αλήθεια του σχήματος.
 * 🔑 Η ΒΑΘΜΙΔΑ `witness` γράφεται απευθείας (`lib/emulator/golden-witnesses.ts` — εκεί
 *    και γιατί αυτό ΔΕΝ είναι δεύτερη αλήθεια).
 *
 * ⚠️ ΣΕΙΡΑ: emulators → `emulator:seed-personas` → ΕΙΚΟΝΑ σε λειτουργία → αυτός.
 * ⚠️ Τα tokens (προμηθευτή · QR παρουσίας) κόβονται **ανά run** και λήγουν — σωστά: ο
 *    χρησμός δεν τα βάζει ποτέ στην ταυτότητα (`golden-bindings.js`).
 *
 * Usage: `npm run emulator:seed-golden -- --oracle-manifest=<αρχείο>`
 *        (env: `I18N_SSR_ORACLE_BASE_URL` = η εικόνα, προεπιλογή http://127.0.0.1:3000)
 * ═════════════════════════════════════════════════════════════════════════════
 */

import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';

import { COLLECTIONS } from '@/config/firestore-collections';

import { AUTH_HOST, PROJECT_ID, SEED_CREDENTIAL, runSeeder } from './lib/emulator/identity';
import { COMPANY_ALIAS, COMPANY_ID, ORACLE_REPRESENTATIVES, PERSONAS, oracleClassOf } from './lib/emulator/personas';
import {
  GOLDEN_MARK,
  WITNESS_COLLECTIONS,
  companyContactDocument,
  witnessDocument,
  witnessId,
  type WitnessEntity,
  type WitnessRefs,
} from './lib/emulator/golden-witnesses';
import { GOLDEN_ENTITIES, GOLDEN_VALUES } from './lib/i18n-ssr/golden-catalog';
import { MANIFEST_SCHEMA, emulatorIdToken } from './lib/i18n-ssr/identity';

const ORACLE_MANIFEST_FLAG = '--oracle-manifest=';
const BASE_URL = process.env.I18N_SSR_ORACLE_BASE_URL ?? 'http://127.0.0.1:3000';
const TIMEOUT_MS = 60_000;
const ADMIN_CLASS = 'organization:company_admin';

type GoldenIds = Record<keyof typeof GOLDEN_ENTITIES, string>;

interface ApiSession {
  readonly idToken: string;
}

function fail(message: string): never {
  throw new Error(`ADR-875 §10 (σπορά golden): ${message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Η πόρτα προς το API της εικόνας — ΜΙΑ συνάρτηση, fail-closed
// ─────────────────────────────────────────────────────────────────────────────

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * Φρουρός hermetic (ADR-875 §3, αρχή 1): γράφουμε ΜΟΝΟ σε εικόνα της ίδιας μηχανής.
 * Δομικά ένας server παραγωγής θα απέρριπτε το ID token του emulator (401) — αλλά η
 * εγγύηση δεν αφήνεται σε ιδιότητα του απέναντι: αρνούμαστε ΠΡΙΝ από κάθε αίτημα.
 */
function assertLoopbackTarget(): void {
  if (!LOOPBACK_HOSTS.has(new URL(BASE_URL).hostname)) fail(`η εικόνα «${BASE_URL}» ΔΕΝ είναι loopback — καμία εγγραφή εκτός μηχανής`);
}

/** POST στην εικόνα ως `company_admin`· κάθε μη-επιτυχία ⇒ `throw` με όνομα διαδρομής. */
async function post(session: ApiSession, route: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`${BASE_URL}${route}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.idToken}`,
      'content-type': 'application/json',
      'Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !payload || payload.success === false) {
    fail(`${route} → HTTP ${response.status} ${typeof payload?.error === 'string' ? payload.error : ''}`);
  }
  return payload;
}

function field(payload: Record<string, unknown>, route: string, ...path: string[]): string {
  let cursor: unknown = payload;
  for (const key of path) cursor = cursor && typeof cursor === 'object' ? (cursor as Record<string, unknown>)[key] : undefined;
  if (typeof cursor !== 'string' || cursor === '') fail(`${route}: η απάντηση δεν έχει ${path.join('.')}`);
  return cursor;
}

/** Ο `company_admin` του καταλόγου — ΕΝΑΣ: γράφει μέσω API και υπογράφει τους μάρτυρες. */
function adminEmail(): string {
  const admin = PERSONAS.find((person) => person.companyId && oracleClassOf(person) === ADMIN_CLASS);
  if (!admin) fail(`ο κατάλογος persona δεν έχει ${ADMIN_CLASS}`);
  return admin.email;
}

async function adminSession(email: string): Promise<ApiSession> {
  const idToken: string = await emulatorIdToken({ authEmulatorHost: AUTH_HOST }, email, SEED_CREDENTIAL, TIMEOUT_MS);
  return { idToken };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Η βαθμίδα `api` — ό,τι διαβάζει ο server
// ─────────────────────────────────────────────────────────────────────────────

/** Το ίδιο έργο στο ξανατρέξιμο: αναζήτηση με το σημάδι, αλλιώς γέννηση από το API. */
async function ensureProject(db: Firestore, session: ApiSession, contactId: string): Promise<string> {
  const existing = await db.collection(COLLECTIONS.PROJECTS).where('companyId', '==', COMPANY_ID).where('name', '==', GOLDEN_MARK).limit(1).get();
  if (!existing.empty) return existing.docs[0].id;
  const route = '/api/projects/list';
  return field(await post(session, route, { name: GOLDEN_MARK, linkedCompanyId: contactId }), route, 'data', 'projectId');
}

async function createRfq(session: ApiSession, projectId: string): Promise<string> {
  const route = '/api/rfqs';
  return field(await post(session, route, { projectId, title: GOLDEN_MARK }), route, 'data', 'id');
}

async function createPurchaseOrder(session: ApiSession, projectId: string, supplierId: string): Promise<string> {
  const route = '/api/procurement';
  const item = { description: GOLDEN_MARK, quantity: 1, unit: 'τεμ', unitPrice: 100, total: 100, boqItemId: null, categoryCode: 'OIK-2' };
  return field(await post(session, route, { projectId, supplierId, items: [item], taxRate: 24 }), route, 'data', 'id');
}

/** Το QR route απαντά ΧΩΡΙΣ φάκελο `data` (`token` στο πρώτο επίπεδο). */
async function createAttendanceToken(session: ApiSession, projectId: string): Promise<string> {
  const route = '/api/attendance/qr/generate';
  return field(await post(session, route, { projectId }), route, 'token');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Η βαθμίδα `witness` + η σύνθεση
// ─────────────────────────────────────────────────────────────────────────────

async function writeWitness(db: Firestore, entity: WitnessEntity, document: Record<string, unknown>): Promise<string> {
  const prefix = GOLDEN_ENTITIES[entity].prefix;
  if (!prefix) fail(`ο μάρτυρας ${entity} δεν έχει πρόθεμα id`);
  const id = witnessId(prefix);
  const stamp = { createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
  await db.collection(WITNESS_COLLECTIONS[entity]).doc(id).set({ ...document, ...stamp }, { merge: true });
  return id;
}

async function seedGolden(auth: Auth, db: Firestore): Promise<GoldenIds> {
  assertLoopbackTarget();
  const company = await db.collection(COLLECTIONS.COMPANIES).doc(COMPANY_ID).get();
  if (!company.exists) fail(`λείπει ο χώρος ${COMPANY_ID} — τρέξε πρώτα το emulator:seed-personas`);
  const email = adminEmail();
  const session = await adminSession(email);
  const createdBy = (await auth.getUserByEmail(email)).uid;
  const core = { companyId: COMPANY_ID, createdBy };

  const contactId = await writeWitness(db, 'contact', companyContactDocument(core));
  const projectId = await ensureProject(db, session, contactId);
  const rfqId = await createRfq(session, projectId);
  const refs: WitnessRefs = { ...core, contactId, projectId, rfqId };

  const witnesses: Record<string, string> = { contact: contactId };
  for (const entity of Object.keys(WITNESS_COLLECTIONS) as WitnessEntity[]) {
    if (entity !== 'contact') witnesses[entity] = await writeWitness(db, entity, witnessDocument(entity, refs));
  }
  return {
    ...witnesses,
    project: projectId,
    rfq: rfqId,
    purchaseOrder: await createPurchaseOrder(session, projectId, contactId),
    attendanceToken: await createAttendanceToken(session, projectId),
    reportType: GOLDEN_VALUES.reportType,
  } as GoldenIds;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Το manifest του χρησμού (μετακινήθηκε εδώ από το emulator-seed-personas.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔑 Ο σπορέας είναι η **αυθεντία** (ξέρει ποιους και τι έσπειρε)· ο χρησμός μόνο διαβάζει.
 * ⚠️ **ΚΑΝΕΝΑ ΔΙΑΠΙΣΤΕΥΤΗΡΙΟ ΜΕΣΑ**: το password ταξιδεύει μόνο ως env (`DEMO_SEED_PASSWORD`).
 *    Τα tokens εδώ είναι tokens **του emulator**, με εφήμερο μυστικό ανά run.
 */
function writeOracleManifest(file: string, entities: GoldenIds): void {
  const personas = ORACLE_REPRESENTATIVES.map((email) => {
    const person = PERSONAS.find((candidate) => candidate.email === email);
    if (!person?.companyId) fail(`ο εκπρόσωπος ${email} δεν είναι άνθρωπος οργανισμού του καταλόγου`);
    return { class: oracleClassOf(person), email, workspaceSegment: COMPANY_ALIAS };
  });
  const manifest = { schema: MANIFEST_SCHEMA, projectId: PROJECT_ID, authEmulatorHost: AUTH_HOST, personas, golden: { entities } };
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`🔮 manifest χρησμού: ${file} (${personas.map((persona) => persona.class).join(', ')} · ${Object.keys(entities).length} golden)`);
}

async function main(auth: Auth, db: Firestore): Promise<void> {
  const entities = await seedGolden(auth, db);
  // Μόνο το πρόθεμα: τα tokens είναι εφήμερα, αλλά δεν τυπώνονται ολόκληρα ούτε έτσι.
  for (const [entity, id] of Object.entries(entities)) console.log(`   ✚ ${entity.padEnd(16)} ${GOLDEN_ENTITIES[entity as keyof GoldenIds].tier.padEnd(8)} ${id.slice(0, 12)}…`);
  const manifestArg = process.argv.find((arg) => arg.startsWith(ORACLE_MANIFEST_FLAG));
  if (manifestArg) writeOracleManifest(manifestArg.slice(ORACLE_MANIFEST_FLAG.length), entities);
}

runSeeder(main);
