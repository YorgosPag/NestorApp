/**
 * =============================================================================
 * AUDIT IDENTITY PROVENANCE — read-only συμφιλίωση των ΔΥΟ μητρώων (ADR-822)
 * =============================================================================
 *
 * Απαντά, με απόδειξη, στο ερώτημα του ADR-822:
 *
 *   «Ποιος καθαρίζει το αποτύπωμα μιας βλάβης που έκλεισε — και πώς
 *    αποδεικνύεται ότι δεν έμεινε κανένα;»
 *
 * Κάνει **τρία** πράγματα, και **τίποτα** άλλο:
 *
 *   1. Παίρνει την **ένωση** Firebase Auth ∪ Firestore `users/` και κρίνει κάθε
 *      ταυτότητα με τη ΜΙΑ αυθεντία (`@/lib/auth/identity-provenance`).
 *   2. Για κάθε ταυτότητα με απόκλιση, τυπώνει **τι ΘΑ άλλαζε** — και σταματά.
 *   3. Ψάχνει το **αποτύπωμα** κάθε συνθετικής ταυτότητας σε ΟΛΕΣ τις συλλογές,
 *      δοκιμάζοντας ΟΛΑ τα ονόματα πεδίου δρώντα του δέντρου.
 *
 * 🔴 **ΓΙΑΤΙ ΤΟ #3 ΕΙΝΑΙ ΤΟ ΔΥΣΚΟΛΟ**: το ίδιο ερώτημα ρωτήθηκε χειροκίνητα ως
 *    `entity_audit_trail where userId == 'dev-admin'` και απάντησε **0** — αλλά
 *    το πεδίο λέγεται **`performedBy`**. Ένα «0» που σημαίνει *«ρώτησα λάθος»*
 *    διαβάζεται ίδια με ένα «0» που σημαίνει *«δεν υπάρχουν»*. Γι' αυτό αυτό το
 *    εργαλείο **δηλώνει τον παρονομαστή του**: τυπώνει ποια ονόματα ρώτησε και
 *    ποια βρέθηκαν να **υπάρχουν** στα δείγματα κάθε συλλογής (ADR-822 §4.3).
 *
 * ⛔⛔ **READ-ONLY, ΚΑΙ ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΟΥ**: κανένα `set`, `update`,
 *     `delete`, `setCustomUserClaims`, `deleteUser`, `updateUser`. Δείχνει στην
 *     **ΠΑΡΑΓΩΓΗ**. Η θεραπεία είναι απόφαση ανθρώπου, **ανά πράξη**.
 *
 * @module scripts/audit-identity-provenance
 * @see ADR-822 — δύο μητρώα ταυτότητας, μία θεραπεία
 * @see ADR-657 §3.5 — το πρότυπο σχήμα (CONFIRM_DIAGNOSTICS · masking · exit=πύλη)
 *
 * USAGE:
 * ```bash
 * CONFIRM_DIAGNOSTICS=true npx tsx scripts/audit-identity-provenance.ts
 * ```
 * Έξοδος: `0` καθαρό · `2` βρέθηκαν αποκλίσεις · `1` σφάλμα.
 * =============================================================================
 */

import admin from 'firebase-admin';

import {
  AUTHORITY_BY_QUESTION,
  isSyntheticIdentity,
  reconcileIdentity,
  type IdentityDocumentFacts,
  type IdentityReconciliation,
} from '@/lib/auth/identity-provenance';
// 🔑 ADR-822 §4.5 — η ΜΙΑ γνώση του «τι θα άλλαζε». Το script ΔΕΝ την ξαναγράφει:
//    μέχρι τις 27/08 τύπωνε δικό του κείμενο και έλεγε `status: 'disabled'` —
//    τιμή που ΔΕΝ ΥΠΑΡΧΕΙ. Δεύτερο λεξιλόγιο σημαίνει δεύτερο λάθος (ADR-749).
import { explainNoPlan, planRemediation } from '@/lib/auth/identity-remediation';

import { ACTOR_FIELD_NAMES } from './lib/identity-provenance/actor-fields';

/* eslint-disable @typescript-eslint/no-require-imports -- τα δύο shared helpers των scripts είναι CommonJS */
const { loadEnvLocal } = require('./_shared/loadEnvLocal') as {
  loadEnvLocal: () => Record<string, string>;
};
const { maskEmail } = require('./_shared/mask-email') as {
  maskEmail: (email: string | null | undefined) => string;
};
/* eslint-enable @typescript-eslint/no-require-imports */

const SCRIPT_NAME = 'audit-identity-provenance.ts';

// ============================================================================
// ΑΣΦΑΛΕΙΑ — ρητή συγκατάθεση (μαζική ανάγνωση ευαίσθητων δεδομένων)
// ============================================================================

if (process.env.CONFIRM_DIAGNOSTICS !== 'true') {
  console.error(`\n❌ [${SCRIPT_NAME}] ΑΣΦΑΛΕΙΑ: απαιτείται CONFIRM_DIAGNOSTICS=true\n`);
  console.error('   Διαβάζει μαζικά μεταδεδομένα χρηστών ΤΗΣ ΠΑΡΑΓΩΓΗΣ.\n');
  console.error(`   CONFIRM_DIAGNOSTICS=true npx tsx scripts/${SCRIPT_NAME}\n`);
  process.exit(1);
}

// ============================================================================
// ΤΥΠΟΙ ΤΗΣ ΑΝΑΦΟΡΑΣ
// ============================================================================

interface IdentityRow {
  readonly uid: string;
  readonly email: string;
  readonly inAuth: boolean;
  readonly inDocument: boolean;
  readonly synthetic: boolean;
  readonly claimRole: string | null;
  readonly documentRole: string | null;
  readonly disabled: boolean | null;
  readonly mfaEnrolled: boolean | null;
  readonly lastSignIn: string | null;
  readonly outcome: IdentityReconciliation;
  /** Το έγγραφο **όπως διαβάστηκε** — το τροφοδοτεί το `planRemediation()`. */
  readonly document: IdentityDocumentFacts | null;
  /** Η **ταυτότητα της κατάστασης** που είδαμε — γίνεται το CAS της πράξης. */
  readonly updatedAtMs: number | null;
}

interface FootprintHit {
  readonly collection: string;
  readonly field: string;
  readonly count: number;
}

// ============================================================================
// ΣΥΛΛΟΓΗ — ΜΟΝΟ ΑΝΑΓΝΩΣΕΙΣ
// ============================================================================

/** Κάθε λογαριασμός Auth, σελιδοποιημένος. **Μόνο `listUsers`.** */
async function readAuthAccounts(): Promise<Map<string, admin.auth.UserRecord>> {
  const accounts = new Map<string, admin.auth.UserRecord>();
  let pageToken: string | undefined;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    for (const user of page.users) accounts.set(user.uid, user);
    pageToken = page.pageToken;
  } while (pageToken);
  return accounts;
}

/** Κάθε έγγραφο `users/`. **Μόνο `get`.** */
async function readUserDocuments(): Promise<Map<string, admin.firestore.DocumentData>> {
  const documents = new Map<string, admin.firestore.DocumentData>();
  const snapshot = await admin.firestore().collection('users').get();
  snapshot.forEach((doc) => documents.set(doc.id, doc.data()));
  return documents;
}

/** Η κρίση μιας ταυτότητας — η αυθεντία αποφασίζει, το script μόνο μεταφράζει. */
function judge(
  uid: string,
  account: admin.auth.UserRecord | undefined,
  document: admin.firestore.DocumentData | undefined,
): IdentityRow {
  const claims = (account?.customClaims ?? {}) as Record<string, unknown>;
  const claimRole = typeof claims.globalRole === 'string' ? claims.globalRole : null;
  const documentRole = typeof document?.globalRole === 'string' ? document.globalRole : null;

  const facts: IdentityDocumentFacts | null = document
    ? {
        authProvider: typeof document.authProvider === 'string' ? document.authProvider : null,
        status: typeof document.status === 'string' ? document.status : null,
        globalRole: documentRole,
        loginCount: typeof document.loginCount === 'number' ? document.loginCount : null,
      }
    : null;

  const outcome = reconcileIdentity(
    account ? { disabled: account.disabled, globalRoleClaim: claimRole, mfaEnrolled: claims.mfaEnrolled === true } : null,
    facts,
  );

  return {
    uid,
    email: maskEmail(account?.email ?? (document?.email as string | undefined)),
    inAuth: account !== undefined,
    inDocument: document !== undefined,
    synthetic: document !== undefined && isSyntheticIdentity(document),
    claimRole,
    documentRole,
    disabled: account?.disabled ?? null,
    mfaEnrolled: account ? (account.multiFactor?.enrolledFactors?.length ?? 0) > 0 : null,
    lastSignIn: account?.metadata.lastSignInTime ?? null,
    outcome,
    document: facts,
    updatedAtMs: toMillis(document?.updatedAt),
  };
}

/** Το `updatedAt` σε ms. Ό,τι δεν αναγνωρίζεται ⇒ `null` — **ποτέ** μαντεψιά. */
function toMillis(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  const candidate = value as { toMillis?: () => number };
  return typeof candidate.toMillis === 'function' ? candidate.toMillis() : null;
}

// ============================================================================
// ΤΟ ΑΠΟΤΥΠΩΜΑ — ΜΕ ΔΗΛΩΜΕΝΟ ΠΑΡΟΝΟΜΑΣΤΗ
// ============================================================================

/**
 * Ποια από τα γνωστά ονόματα πεδίου δρώντα **υπάρχουν πράγματι** σε αυτή τη
 * συλλογή. Χωρίς αυτό, το «0 ευρήματα» δεν ξεχωρίζει από το «0 ερωτήματα».
 */
async function fieldsPresentIn(collection: string): Promise<string[]> {
  const sample = await admin.firestore().collection(collection).limit(50).get();
  const present = new Set<string>();
  sample.forEach((doc) => {
    const data = doc.data();
    for (const field of ACTOR_FIELD_NAMES) {
      if (data[field] !== undefined) present.add(field);
    }
  });
  return [...present];
}

/** Πού αναφέρεται αυτό το uid — **μόνο** στα πεδία που όντως υπάρχουν. */
async function findFootprint(uid: string, collections: string[]): Promise<{ hits: FootprintHit[]; asked: number }> {
  const hits: FootprintHit[] = [];
  let asked = 0;
  for (const collection of collections) {
    for (const field of await fieldsPresentIn(collection)) {
      asked += 1;
      const result = await admin.firestore().collection(collection).where(field, '==', uid).count().get();
      const count = result.data().count;
      if (count > 0) hits.push({ collection, field, count });
    }
  }
  return { hits, asked };
}

// ============================================================================
// ΠΑΡΟΥΣΙΑΣΗ
// ============================================================================

const RULE = '═'.repeat(78);

function printIdentity(row: IdentityRow): void {
  const mark = row.outcome.severity === 'clean' ? '✅' : row.outcome.severity === 'urgent' ? '🔴' : '🟠';
  console.log(`${mark} ${row.uid}  ${row.email}`);
  console.log(`   ετυμηγορία : ${row.outcome.verdict}  [${row.outcome.severity}]`);
  console.log(`   Auth       : ${row.inAuth ? `υπάρχει · disabled=${row.disabled} · MFA=${row.mfaEnrolled} · globalRole(claim)=${row.claimRole ?? '—'}` : '❌ ΔΕΝ ΥΠΑΡΧΕΙ'}`);
  console.log(`   έγγραφο    : ${row.inDocument ? `υπάρχει · globalRole=${row.documentRole ?? '—'} · συνθετικό=${row.synthetic}` : '❌ ΔΕΝ ΥΠΑΡΧΕΙ'}`);
  console.log(`   τελ. σύνδεση: ${row.lastSignIn ?? '—'}`);
  if (row.outcome.severity !== 'clean') console.log(`   γιατί      : ${row.outcome.reason}`);
  console.log('');
}

/**
 * Τι **ΘΑ** άλλαζε — και τίποτα δεν αλλάζει.
 *
 * ⚠️ **Η ΓΝΩΣΗ ΔΕΝ ΖΕΙ ΕΔΩ.** Το `planRemediation()` παράγει το ζεύγος
 * *(πράξη, αναίρεση)*· εδώ γίνεται μόνο **μορφοποίηση**. Έτσι το script και η
 * διαδρομή λένε **κατά κατασκευήν** το ίδιο πράγμα.
 */
function printProposal(row: IdentityRow): void {
  if (row.outcome.verdict === 'account-without-document') {
    // Ο μόνος που ΔΕΝ έχει αυτόματη πράξη — και είναι ο σοβαρότερος (§4.6).
    const noMfa = row.mfaEnrolled === false ? ' · ⚠️ ΧΩΡΙΣ MFA' : '';
    console.log(`   ➜ ΧΡΕΙΑΖΕΤΑΙ ΑΝΘΡΩΠΟ: ποιος είναι αυτός; claim '${row.claimRole ?? '—'}'${noMfa}`);
    console.log('     νόμιμος ⇒ MFA + έγγραφο · άγνωστος ⇒ disable (ΠΟΤΕ delete πρώτα, Okta)');
    console.log('');
    return;
  }

  const outcome = planRemediation(row.uid, row.outcome.verdict, row.document, row.updatedAtMs);
  if (outcome.kind === 'none') {
    console.log(`   ➜ καμία πράξη: ${explainNoPlan(outcome.reason)}`);
    console.log('');
    return;
  }

  console.log(`   ➜ ΘΑ πρότεινα: ${outcome.plan.forward.summary}`);
  console.log(`     patch    : ${JSON.stringify(outcome.plan.forward.patch)}`);
  console.log(`     αναίρεση : ${JSON.stringify(outcome.plan.inverse.patch)}`);
  console.log(`     CAS      : updatedAt === ${outcome.plan.forward.expectedUpdatedAtMs}`);
  console.log('');
}

function printAuthorityTable(): void {
  console.log('🏆 ΠΟΙΟ ΜΗΤΡΩΟ ΑΠΑΝΤΑ ΤΙ (ADR-822 §4.2) — η ασυμμετρία που λείπει από τους μεγάλους:');
  for (const [question, registry] of Object.entries(AUTHORITY_BY_QUESTION)) {
    console.log(`   ${question.padEnd(26)} → ${registry}`);
  }
  console.log('   ⚠️ Ερώτηση στο ΑΛΛΟ μητρώο δίνει απάντηση που ΜΟΙΑΖΕΙ σωστή.\n');
}

// ============================================================================
// ΚΥΡΙΩΣ
// ============================================================================

async function main(): Promise<never> {
  console.log(`\n${RULE}\n  🔍 ΣΥΜΦΙΛΙΩΣΗ ΜΗΤΡΩΩΝ ΤΑΥΤΟΤΗΤΑΣ — READ-ONLY (ADR-822)\n${RULE}\n`);
  printAuthorityTable();

  const [accounts, documents] = await Promise.all([readAuthAccounts(), readUserDocuments()]);
  const union = [...new Set([...accounts.keys(), ...documents.keys()])].sort();

  console.log(`Auth: ${accounts.size} · έγγραφα: ${documents.size} · ένωση: ${union.length}\n${'─'.repeat(78)}\n`);

  const rows = union.map((uid) => judge(uid, accounts.get(uid), documents.get(uid)));
  rows.forEach(printIdentity);

  const divergent = rows.filter((row) => row.outcome.severity !== 'clean');
  if (divergent.length > 0) {
    console.log(`${RULE}\n  ΤΙ ΘΑ ΑΛΛΑΖΕ — ΚΑΙ ΤΙΠΟΤΑ ΔΕΝ ΑΛΛΑΖΕΙ\n${RULE}\n`);
    for (const row of divergent) {
      console.log(`🔸 ${row.uid} — ${row.outcome.verdict}`);
      printProposal(row);
    }
  }

  await printFootprints(rows);

  console.log(RULE);
  if (divergent.length === 0) {
    console.log('✅ ΚΑΘΑΡΟ — τα δύο μητρώα συμφωνούν για κάθε ταυτότητα.');
    console.log(RULE);
    process.exit(0);
  }
  console.log(`⚠️  ${divergent.length} ΑΠΟΚΛΙΣΕΙΣ. Καμία θεραπεία δεν εκτελέστηκε — απόφαση ανθρώπου, ανά πράξη.`);
  console.log(RULE);
  process.exit(2);
}

/** Το αποτύπωμα κάθε συνθετικής / ορφανής ταυτότητας, με δηλωμένο παρονομαστή. */
async function printFootprints(rows: IdentityRow[]): Promise<void> {
  const suspects = rows.filter((row) => row.synthetic || row.outcome.verdict === 'document-without-account');
  if (suspects.length === 0) return;

  const collections = (await admin.firestore().listCollections()).map((ref) => ref.id).sort();
  console.log(`${RULE}\n  ΤΟ ΑΠΟΤΥΠΩΜΑ — ${collections.length} συλλογές × ${ACTOR_FIELD_NAMES.length} ονόματα δρώντα\n${RULE}\n`);

  for (const suspect of suspects) {
    const { hits, asked } = await findFootprint(suspect.uid, collections);
    console.log(`🔸 ${suspect.uid}: ${hits.length} αναφορές σε ${asked} ερωτήματα που ΟΝΤΩΣ είχαν το πεδίο.`);
    if (hits.length === 0) {
      console.log('   ✅ Κανένα αποτύπωμα — και ο παρονομαστής είναι δηλωμένος, άρα το «0» ΔΕΝ σημαίνει «ρώτησα λάθος».\n');
      continue;
    }
    for (const hit of hits) console.log(`   • ${hit.collection}.${hit.field} → ${hit.count}`);
    console.log('');
  }
}

// ============================================================================
// ΕΚΚΙΝΗΣΗ
// ============================================================================

try {
  const env = loadEnvLocal();
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY)) });
} catch (error) {
  console.error(`❌ [${SCRIPT_NAME}] Αποτυχία αρχικοποίησης:`, error instanceof Error ? error.message : error);
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error(`\n❌ [${SCRIPT_NAME}] ΣΦΑΛΜΑ:`, error instanceof Error ? error.message : error);
  process.exit(1);
});
