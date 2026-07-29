/**
 * =============================================================================
 * AUDIT UNREADABLE TIMESTAMPS — pre-flight μέτρηση για την ADR-218 §Phase 4
 * =============================================================================
 *
 * Απαντά στο ερώτημα που κρατά πίσω το push: **πόσα πραγματικά έγγραφα έχουν
 * χρονική στιγμή που η παραγωγή δεν διαβάζει;**
 *
 * Μέχρι την Phase 4 τα «δεν ξέρω» ήταν sentinel (`NaN` / `0`) και **κρύβονταν**:
 * κάθε σύγκριση με `NaN` είναι `false`, οπότε οι φύλακες δεν φύλαγαν. Τώρα ο
 * κώδικας λέει `null` και **παραλείπει** — άρα αλλάζει συμπεριφορά σε παραγωγή.
 * Αυτό το script μετρά το μέγεθος της αλλαγής **πριν** ανέβει.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 READ-ONLY. Δεν εισάγει, δεν καλεί και δεν έχει πρόσβαση σε καμία       │
 * │    εγγραφική διαδρομή (`set`/`update`/`delete`/`FieldValue`/batch).       │
 * │ 🔒 Κριτής του «αναγνώσιμο» είναι **αποκλειστικά** ο SSoT                  │
 * │    `normalizeToMillisOrNull` — δες `_shared/timestamp-readability.ts`.    │
 * │ 🔒 Τα φίλτρα πεδίου γίνονται **τοπικά**, όχι με Firestore `where`, ώστε   │
 * │    η μέτρηση να καλύπτει **όλες τις εταιρείες** (multi-tenant) και να     │
 * │    αναφέρει και όσα είναι εκτός εμβέλειας.                                │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE:
 * ```bash
 * npx tsx scripts/audit-unreadable-timestamps.ts
 * npx tsx scripts/audit-unreadable-timestamps.ts --json
 * ```
 *
 * @module scripts/audit-unreadable-timestamps
 * @see docs/centralized-systems/reference/adrs/ADR-218-timestamp-conversion-centralization.md
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, type Firestore, type CollectionReference } from 'firebase-admin/firestore';
import { COLLECTIONS } from '../src/config/firestore-collections';
import {
  readInstantChain,
  changesBehaviour,
  type BehaviourChange,
  type UnreadableShape,
} from './_shared/timestamp-readability';
import { sweepAllCollections, MAX_DOCS_PER_COLLECTION, type SweepResult } from './_shared/timestamp-sweep';
// SSoT φόρτωσης περιβάλλοντος για scripts — `dotenv` ΔΕΝ είναι εξάρτηση αυτού του
// project (pnpm· το `import 'dotenv'` σε παλιότερα scripts είναι νεκρό γράμμα).
import { loadEnvLocal } from './_shared/loadEnvLocal';

// =============================================================================
// INIT
// =============================================================================

const JSON_MODE = process.argv.includes('--json');

function initAdmin(): { db: Firestore; projectId: string } {
  const env: Record<string, string> = loadEnvLocal();
  const raw = env.FIREBASE_SERVICE_ACCOUNT_KEY ?? process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY απών από το .env.local');
  }
  const serviceAccount = JSON.parse(raw) as { project_id: string };
  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount as object) });
  }
  return { db: getFirestore(), projectId: serviceAccount.project_id };
}

// =============================================================================
// ΣΤΟΧΟΙ — καθρέφτης του κώδικα παραγωγής, όχι ελεύθερη ερμηνεία
// =============================================================================

interface AuditTarget {
  key: string;
  collection: string;
  /** Αλυσίδα `??` **ακριβώς** όπως στον καταναλωτή. Ένα στοιχείο = απλό πεδίο. */
  fieldChain: readonly string[];
  /** Ο τύπος όπως τον δηλώνει το TypeScript interface — για ανίχνευση type drift. */
  declaredType: string;
  consumer: string;
  scopeLabel: string;
  inScope: (data: Record<string, unknown>) => boolean;
  behaviourChange: BehaviourChange;
  /** Πεδία ταυτότητας για την αναφορά (ώστε ο Giorgio να αναγνωρίζει την εγγραφή). */
  idFields: readonly string[];
  priority: '🔴' | '🟡' | '🟢';
}

const todayISO = (): string => new Date().toISOString().split('T')[0];

const str = (data: Record<string, unknown>, field: string): string =>
  typeof data[field] === 'string' ? (data[field] as string) : '';

const TARGETS: readonly AuditTarget[] = [
  {
    key: 'framework-agreements-validity',
    collection: COLLECTIONS.FRAMEWORK_AGREEMENTS,
    fieldChain: ['validFrom', 'validUntil'] as const, // δύο ΑΝΕΞΑΡΤΗΤΑ πεδία — δες expandTargets()
    declaredType: 'Timestamp',
    consumer: 'resolveActiveFa (framework-agreement-discount.ts)',
    scopeLabel: "status==='active' ΚΑΙ isDeleted!==true",
    inScope: (d) => d.status === 'active' && d.isDeleted !== true,
    behaviourChange: 'always',
    idFields: ['agreementNumber', 'title', 'vendorContactId', 'companyId'],
    priority: '🔴',
  },
  {
    key: 'construction-tasks-overdue',
    collection: COLLECTIONS.CONSTRUCTION_TASKS,
    fieldChain: ['plannedEndDate'],
    declaredType: 'string (ISO 8601)',
    consumer: 'detectTaskOverdue (construction-alert-rules.ts)',
    scopeLabel: "status!=='completed' ΚΑΙ plannedEndDate < σήμερα (λεξικογραφικά, όπως ο κώδικας)",
    inScope: (d) => d.status !== 'completed' && !(str(d, 'plannedEndDate') >= todayISO()),
    behaviourChange: 'always',
    idFields: ['name', 'phaseId', 'buildingId', 'companyId'],
    priority: '🟡',
  },
  {
    key: 'construction-tasks-blocked',
    collection: COLLECTIONS.CONSTRUCTION_TASKS,
    fieldChain: ['updatedAt', 'createdAt'],
    declaredType: 'string (ISO 8601)',
    consumer: 'detectTaskBlocked (construction-alert-rules.ts)',
    scopeLabel: "status==='blocked'",
    inScope: (d) => d.status === 'blocked',
    behaviourChange: 'only-truthy',
    idFields: ['name', 'phaseId', 'buildingId', 'companyId'],
    priority: '🟡',
  },
  {
    key: 'construction-phases-no-progress',
    collection: COLLECTIONS.CONSTRUCTION_PHASES,
    fieldChain: ['updatedAt', 'createdAt'],
    declaredType: 'string (ISO 8601)',
    consumer: 'detectNoProgress (construction-alert-rules.ts)',
    scopeLabel: "status ∉ {completed, planning}",
    inScope: (d) => d.status !== 'completed' && d.status !== 'planning',
    behaviourChange: 'only-truthy',
    idFields: ['name', 'buildingId', 'companyId'],
    priority: '🟡',
  },
  {
    key: 'building-milestones-risk',
    collection: COLLECTIONS.BUILDING_MILESTONES,
    fieldChain: ['date'],
    declaredType: 'string (ISO 8601)',
    consumer: 'detectMilestoneAtRisk (construction-alert-rules.ts)',
    scopeLabel: "status!=='completed'",
    inScope: (d) => d.status !== 'completed',
    behaviourChange: 'always',
    idFields: ['title', 'buildingId', 'companyId'],
    priority: '🟡',
  },
  {
    key: 'files-media-order',
    collection: COLLECTIONS.FILES,
    fieldChain: ['createdAt'],
    declaredType: 'Timestamp',
    consumer: 'listEntityMedia (property-media.service.ts)',
    scopeLabel: "isDeleted!==true ΚΑΙ lifecycleState ∈ {απόν, 'active'} ΚΑΙ υπάρχει storagePath",
    inScope: (d) =>
      d.isDeleted !== true &&
      (d.lifecycleState === undefined || d.lifecycleState === 'active') &&
      typeof d.storagePath === 'string',
    behaviourChange: 'ordering-only',
    idFields: ['displayName', 'originalFilename', 'entityType', 'entityId', 'companyId'],
    priority: '🟢',
  },
  {
    key: 'buildings-backfill-order',
    collection: COLLECTIONS.BUILDINGS,
    fieldChain: ['createdAt'],
    declaredType: 'Timestamp | string',
    consumer: 'planProjectCodes (backfill-planner.ts)',
    scopeLabel: 'όλα τα κτήρια',
    inScope: () => true,
    behaviourChange: 'ordering-only',
    idFields: ['name', 'code', 'projectId', 'companyId'],
    priority: '🟢',
  },
];

/**
 * Το `framework_agreements` έχει **δύο ανεξάρτητα** πεδία, όχι αλυσίδα `??` —
 * ο κώδικας απορρίπτει τη συμφωνία αν **οποιοδήποτε** από τα δύο δεν διαβάζεται.
 * Τα ξεχωρίζουμε σε δύο στόχους ώστε ο πίνακας να δείχνει ποιο άκρο φταίει.
 */
function expandTargets(targets: readonly AuditTarget[]): AuditTarget[] {
  return targets.flatMap((t) =>
    t.key === 'framework-agreements-validity'
      ? t.fieldChain.map((field) => ({ ...t, key: `${t.key}:${field}`, fieldChain: [field] }))
      : [t]
  );
}

// =============================================================================
// ΣΑΡΩΣΗ
// =============================================================================

interface Offender {
  docId: string;
  usedField: string;
  shape: UnreadableShape;
  rawType: string;
  rawPreview: string;
  changesBehaviour: boolean;
  identity: Record<string, string>;
}

interface TargetResult {
  target: AuditTarget;
  collectionExists: boolean;
  totalDocs: number;
  inScopeDocs: number;
  unreadable: number;
  behaviourChanging: number;
  shapes: Record<string, number>;
  typeDrift: Record<string, number>;
  offenders: Offender[];
}

function identityOf(data: Record<string, unknown>, fields: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (data[f] !== undefined && data[f] !== null) out[f] = String(data[f]);
  }
  return out;
}

function emptyResult(target: AuditTarget, totalDocs: number): TargetResult {
  return {
    target,
    collectionExists: totalDocs > 0,
    totalDocs,
    inScopeDocs: 0,
    unreadable: 0,
    behaviourChanging: 0,
    shapes: {},
    typeDrift: {},
    offenders: [],
  };
}

/** Ενσωματώνει ΕΝΑ έγγραφο εντός εμβέλειας στο συγκεντρωτικό αποτέλεσμα. */
function accumulateDoc(
  result: TargetResult,
  docId: string,
  data: Record<string, unknown>
): void {
  const { target } = result;
  result.inScopeDocs += 1;

  const reading = readInstantChain(data, target.fieldChain);
  result.typeDrift[reading.rawType] = (result.typeDrift[reading.rawType] ?? 0) + 1;
  if (reading.readable || reading.shape === null) return;

  const behavioural = changesBehaviour(target.behaviourChange, reading.shape);
  result.unreadable += 1;
  if (behavioural) result.behaviourChanging += 1;
  result.shapes[reading.shape] = (result.shapes[reading.shape] ?? 0) + 1;
  result.offenders.push({
    docId,
    usedField: reading.usedField,
    shape: reading.shape,
    rawType: reading.rawType,
    rawPreview: reading.rawPreview,
    changesBehaviour: behavioural,
    identity: identityOf(data, target.idFields),
  });
}

async function scanTarget(db: Firestore, target: AuditTarget): Promise<TargetResult> {
  const ref: CollectionReference = db.collection(target.collection);
  const totalDocs = (await ref.count().get()).data().count;
  const result = emptyResult(target, totalDocs);

  if (totalDocs === 0) return result;
  if (totalDocs > MAX_DOCS_PER_COLLECTION) {
    throw new Error(
      `Η συλλογή "${target.collection}" έχει ${totalDocs} έγγραφα (> ${MAX_DOCS_PER_COLLECTION}). ` +
        'Σταματώ αντί να διαβάσω τα πάντα — χρειάζεται σελιδοποιημένη στρατηγική.'
    );
  }

  const snap = await ref.get();
  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (target.inScope(data)) accumulateDoc(result, doc.id, data);
  }

  return result;
}

/**
 * Το «0 έγγραφα» είναι αξιόπιστο μόνο αν ξέρουμε ότι δεν κρύβονται δεδομένα σε
 * subcollection με το ίδιο όνομα. Οι καταναλωτές διαβάζουν top-level
 * (`adminDb.collection(...)`), αλλά το επιβεβαιώνουμε αντί να το υποθέσουμε.
 */
async function findNestedCollections(db: Firestore, names: readonly string[]): Promise<string[]> {
  const wanted = new Set(names);
  const hits: string[] = [];
  const roots = await db.listCollections();
  for (const root of roots) {
    const docs = await root.listDocuments();
    for (const docRef of docs) {
      const subs = await docRef.listCollections();
      for (const sub of subs) {
        if (wanted.has(sub.id)) hits.push(`${root.id}/${docRef.id}/${sub.id}`);
      }
    }
  }
  return hits;
}

// =============================================================================
// ΑΝΑΦΟΡΑ
// =============================================================================

const line = (char = '─'): string => char.repeat(78);

function printTargetRow(r: TargetResult): void {
  const t = r.target;
  const shapeText =
    Object.keys(r.shapes).length === 0
      ? '—'
      : Object.entries(r.shapes)
          .map(([shape, n]) => `${shape}:${n}`)
          .join(', ');
  console.log(
    `${t.priority} ${t.collection}.${t.fieldChain.join(' ?? ')}\n` +
      `   καταναλωτής : ${t.consumer}\n` +
      `   εμβέλεια    : ${t.scopeLabel}\n` +
      `   σύνολο ${String(r.totalDocs).padStart(5)} | σε εμβέλεια ${String(r.inScopeDocs).padStart(5)} | ` +
      `μη αναγνώσιμα ${String(r.unreadable).padStart(4)} | αλλάζουν συμπεριφορά ${String(r.behaviourChanging).padStart(4)}\n` +
      `   μορφές      : ${shapeText}\n` +
      `   τύποι       : ${Object.entries(r.typeDrift).map(([k, v]) => `${k}:${v}`).join(', ') || '—'} ` +
      `(δηλωμένος: ${t.declaredType})`
  );
  for (const o of r.offenders) {
    const idText = Object.entries(o.identity).map(([k, v]) => `${k}=${v}`).join(' · ') || '(χωρίς πεδία ταυτότητας)';
    console.log(
      `      ↳ ${o.docId} [${o.usedField}] ${o.shape} (${o.rawType}) ` +
        `${o.changesBehaviour ? '⚠️ ΑΛΛΑΖΕΙ' : 'χωρίς αλλαγή'} — ${idText} — raw: ${o.rawPreview}`
    );
  }
  console.log('');
}

function printSummary(results: readonly TargetResult[], nested: readonly string[]): void {
  const totalUnreadable = results.reduce((s, r) => s + r.unreadable, 0);
  const totalBehavioural = results.reduce((s, r) => s + r.behaviourChanging, 0);
  const scanned = results.reduce((s, r) => s + r.inScopeDocs, 0);

  console.log(line('═'));
  console.log(
    `  ΣΥΝΟΛΟ: σαρώθηκαν ${scanned} έγγραφα σε εμβέλεια · ` +
      `${totalUnreadable} μη αναγνώσιμα · ${totalBehavioural} αλλάζουν συμπεριφορά`
  );
  console.log(line('═'));
  if (nested.length > 0) {
    console.log(`⚠️ Βρέθηκαν subcollections με στοχευμένο όνομα: ${nested.join(', ')}`);
    console.log('   Ο κώδικας διαβάζει top-level — αυτά ΔΕΝ μετρήθηκαν. Χρειάζεται απόφαση.');
  } else {
    console.log('✅ Καμία subcollection με στοχευμένο όνομα — τα top-level counts είναι πλήρη.');
  }
}

function printSweep(sweep: SweepResult): void {
  console.log('');
  console.log(line('═'));
  console.log(
    `  🧹 ΣΑΡΩΣΗ ΟΛΩΝ ΤΩΝ ΣΥΛΛΟΓΩΝ — ${sweep.collectionsScanned} συλλογές, ` +
      `${sweep.docsScanned} έγγραφα, κάθε πεδίο που τα δεδομένα αποδεικνύουν χρονικό`
  );
  console.log(line('═'));
  if (sweep.skippedCollections.length > 0) {
    console.log(`⚠️ Παραλείφθηκαν (πολύ μεγάλες): ${sweep.skippedCollections.join(', ')}`);
  }
  if (sweep.findings.length === 0) {
    console.log('✅ Κανένα χρονικό πεδίο με μη αναγνώσιμη τιμή ή ανάμεικτο τύπο.');
    return;
  }
  for (const f of sweep.findings) {
    const types = Object.entries(f.types).map(([k, v]) => `${k}:${v}`).join(', ');
    const shapes = Object.entries(f.shapes).map(([k, v]) => `${k}:${v}`).join(', ') || '—';
    const drift = Object.keys(f.types).length > 1 ? ' ⚠️ ΑΝΑΜΕΙΚΤΟΙ ΤΥΠΟΙ' : '';
    console.log(
      `• [${f.confidence}] ${f.collection}.${f.field} — παρόν ${f.present} | αναγνώσιμα ${f.readable} | ` +
        `μη αναγνώσιμα ${f.unreadable}${drift}\n` +
        `   μορφές: ${shapes} · τύποι: ${types}\n` +
        `   ids: ${f.offenderIds.join(', ') || '—'}`
    );
  }
}

// =============================================================================
// MAIN
// =============================================================================

function printHeader(projectId: string): void {
  console.log('');
  console.log(line('═'));
  console.log('  🔍 AUDIT: μη αναγνώσιμες χρονικές στιγμές (ADR-218 §Phase 4 pre-flight)');
  console.log(`  Firestore project : ${projectId} · database: (default)`);
  console.log('  Κριτής            : normalizeToMillisOrNull (src/lib/date-local.ts)');
  console.log('  Λειτουργία        : READ-ONLY · όλες οι εταιρείες (χωρίς φίλτρο companyId)');
  console.log(line('═'));
  console.log('');
}

function toJsonPayload(
  projectId: string,
  results: readonly TargetResult[],
  nested: readonly string[],
  sweep: SweepResult
): unknown {
  return {
    projectId,
    scannedAt: new Date().toISOString(),
    nestedCollectionHits: nested,
    sweep,
    results: results.map(({ target, ...rest }) => ({
      key: target.key,
      collection: target.collection,
      fieldChain: target.fieldChain,
      consumer: target.consumer,
      ...rest,
    })),
  };
}

async function main(): Promise<void> {
  const { db, projectId } = initAdmin();
  const targets = expandTargets(TARGETS);
  if (!JSON_MODE) printHeader(projectId);

  const results: TargetResult[] = [];
  for (const target of targets) {
    results.push(await scanTarget(db, target));
  }

  const nested = await findNestedCollections(db, [...new Set(targets.map((t) => t.collection))]);

  // Φάση 2 — ό,τι δεν ήξερα να ρωτήσω: σάρωση όλων των συλλογών για χρονικά
  // πεδία που τα ίδια τα δεδομένα αποδεικνύουν ότι κρατούν χρόνο.
  const sweep = await sweepAllCollections(db);

  if (JSON_MODE) {
    console.log(JSON.stringify(toJsonPayload(projectId, results, nested, sweep), null, 2));
    return;
  }

  for (const r of results) printTargetRow(r);
  printSummary(results, nested);
  printSweep(sweep);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('❌ AUDIT ΑΠΕΤΥΧΕ:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
