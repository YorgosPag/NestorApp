/**
 * =============================================================================
 * QA E2E TESTS — Contact Individual (Φυσικό Πρόσωπο)
 * =============================================================================
 *
 * Automated E2E tests for individual contact management via AI Agent.
 * Based on: docs/QA_AGENT_FINDINGS.md (Sessions 1-3)
 *
 * Prerequisites:
 *   1. npm run dev (localhost:3000 running)
 *   2. Super admin configured (Telegram chatId: 5618410820)
 *
 * Usage:
 *   npx tsx scripts/qa-tests/contact-individual.qa.ts
 *
 * @module scripts/qa-tests/contact-individual.qa
 */

import {
  db,
  resetCollections,
  findContactByName,
  runSuite,
  assertField,
  assertExists,
  assertArrayLength,
  type QATestCase,
} from './qa-test-runner';

// ── Test Contact ─────────────────────────────────────────────────────
const FIRST_NAME = 'Δημήτριος';
const LAST_NAME = 'Τεστίδης';
const FULL_NAME = `${FIRST_NAME} ${LAST_NAME}`;

// ── Helper: Read contact from Firestore ──────────────────────────────
async function getContact(ctx: { state: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
  const contactId = ctx.state.contactId as string | undefined;
  if (!contactId) return null;
  const snap = await db.collection('contacts').doc(contactId).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}

// ── Tests ────────────────────────────────────────────────────────────
const tests: QATestCase[] = [
  // ──────────────────────────────────────────────────────────────────
  // ΦΑΣΗ 1: Δημιουργία επαφής
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'IND-01',
    name: 'Δημιουργία επαφής',
    userMessage: `Δημιούργησε νέα επαφή: ${FULL_NAME}`,
    assertions: async (ctx) => {
      // Wait a bit for Firestore indexing
      await sleep(1000);

      const contactId = await findContactByName(FIRST_NAME, LAST_NAME);
      ctx.state.contactId = contactId;

      if (!contactId) {
        return [{ label: 'Contact created', passed: false, expected: 'contact exists', actual: 'not found' }];
      }

      const snap = await db.collection('contacts').doc(contactId).get();
      const data = snap.data() as Record<string, unknown>;

      return [
        assertExists('contactId exists', contactId),
        assertField('type', data.type, 'individual'),
        assertField('firstName', data.firstName, FIRST_NAME),
        assertField('lastName', data.lastName, LAST_NAME),
        assertExists('companyId set', data.companyId),
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // ΦΑΣΗ 2: Βασικά στοιχεία
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'IND-02',
    name: 'Πατρώνυμο + Μητρώνυμο',
    userMessage: `Βάλε πατρώνυμο Αθανάσιος και μητρώνυμο Νικολέτα στον ${FULL_NAME}`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      return [
        assertField('fatherName', data.fatherName, 'Αθανάσιος'),
        assertField('motherName', data.motherName, 'Νικολέτα'),
      ];
    },
  },
  {
    id: 'IND-03',
    name: 'Φύλο + Ημερομηνία γέννησης',
    userMessage: `Ο ${FIRST_NAME} είναι άνδρας, γεννήθηκε 15 Μαρτίου 1990`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      return [
        assertField('gender', data.gender, 'male'),
        assertExists('birthDate set', data.birthDate),
      ];
    },
  },
  {
    id: 'IND-04',
    name: 'Χώρα γέννησης',
    userMessage: `Ο ${FIRST_NAME} γεννήθηκε στην Ελλάδα`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      // Accept "GR" or "Ελλάδα" or "Greece"
      const country = String(data.birthCountry ?? '');
      const isValid = ['GR', 'Ελλάδα', 'Greece', 'gr'].includes(country);

      return [
        { label: 'birthCountry', passed: isValid, expected: 'GR', actual: country },
      ];
    },
  },
  {
    id: 'IND-05',
    name: 'ΑΜΚΑ σωστό (11 ψηφία)',
    userMessage: `Βάλε ΑΜΚΑ 15039012345 στον ${FIRST_NAME}`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      return [
        assertField('amka', data.amka, '15039012345'),
      ];
    },
  },
  {
    id: 'IND-06',
    name: 'ΑΜΚΑ λάθος (10 ψηφία) → reject',
    userMessage: `Άλλαξε ΑΜΚΑ σε 1234567890 στον ${FIRST_NAME}`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      // amka should remain 15039012345 (rejected)
      return [
        assertField('amka unchanged', data.amka, '15039012345'),
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // ΦΑΣΗ 3: Ταυτότητα + Φορολογικά
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'IND-07',
    name: 'Ταυτότητα (5 πεδία)',
    userMessage: `Ο ${FIRST_NAME} έχει αστυνομική ταυτότητα, αριθμός ΑΚ 582946, εκδόθηκε από Α.Τ. Θεσσαλονίκης, 15/03/2020, λήξη 15/03/2030`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      return [
        assertExists('documentType set', data.documentType),
        assertExists('documentNumber set', data.documentNumber),
        assertExists('documentIssuer set', data.documentIssuer),
        assertExists('documentIssueDate set', data.documentIssueDate),
        assertExists('documentExpiryDate set', data.documentExpiryDate),
      ];
    },
  },
  {
    id: 'IND-08',
    name: 'ΑΦΜ',
    userMessage: `Βάλε ΑΦΜ 123456789 στον ${FIRST_NAME}`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      return [
        assertField('vatNumber', data.vatNumber, '123456789'),
      ];
    },
  },
  {
    id: 'IND-09',
    name: 'ΔΟΥ (lookup)',
    userMessage: `ΔΟΥ Καλαμαριάς για τον ${FIRST_NAME}`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      // taxOffice should be a 4-digit code (e.g. "1312" for Kalamaria)
      const taxOffice = String(data.taxOffice ?? '');
      const is4Digit = /^\d{4}$/.test(taxOffice);

      return [
        { label: 'taxOffice is 4-digit code', passed: is4Digit, expected: '4-digit (e.g. 1312)', actual: taxOffice },
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // ΦΑΣΗ 4: Επαγγελματικά (ESCO)
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'IND-10',
    name: 'Επάγγελμα (unambiguous)',
    userMessage: `Ο ${FIRST_NAME} είναι αρχιτέκτονας τοπίου`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      return [
        assertExists('escoUri set', data.escoUri),
        assertExists('escoLabel set', data.escoLabel),
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // ΦΑΣΗ 5: Επικοινωνία
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'IND-11',
    name: 'Κινητό τηλέφωνο',
    userMessage: `Πρόσθεσε κινητό 6974050026 στον ${FIRST_NAME}`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      const phones = data.phones as Array<{ number: string; type?: string }> | undefined;
      const hasPhone = phones?.some((p) => p.number?.includes('6974050026'));

      return [
        assertArrayLength('phones has entries', phones, 1),
        { label: 'phone 6974050026 exists', passed: !!hasPhone, expected: '6974050026', actual: JSON.stringify(phones?.[0] ?? 'empty') },
      ];
    },
  },
  {
    id: 'IND-12',
    name: 'Email',
    userMessage: `Πρόσθεσε email dimitrios.test@example.com στον ${FIRST_NAME}`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      const emails = data.emails as Array<{ email: string }> | undefined;
      const hasEmail = emails?.some((e) => e.email === 'dimitrios.test@example.com');

      return [
        assertArrayLength('emails has entries', emails, 1),
        { label: 'email exists', passed: !!hasEmail, expected: 'dimitrios.test@example.com', actual: JSON.stringify(emails?.[0] ?? 'empty') },
      ];
    },
  },
  {
    id: 'IND-13',
    name: 'Σταθερό τηλέφωνο',
    userMessage: `Πρόσθεσε σταθερό τηλέφωνο 2310123456 στον ${FIRST_NAME}`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      const phones = data.phones as Array<{ number: string; type?: string }> | undefined;
      const landline = phones?.find((p) => p.number?.includes('2310123456'));

      return [
        assertArrayLength('phones has 2+ entries', phones, 2),
        { label: 'landline 2310123456 exists', passed: !!landline, expected: '2310123456', actual: JSON.stringify(landline ?? 'not found') },
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // ΦΑΣΗ 6: Διεύθυνση
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'IND-14',
    name: 'Διεύθυνση (structured)',
    userMessage: `Βάλε διεύθυνση Τσιμισκή 42, Θεσσαλονίκη 54623 στον ${FIRST_NAME}`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      const addresses = data.addresses as Array<Record<string, unknown>> | undefined;
      const addr = addresses?.[0];

      return [
        assertArrayLength('addresses has entries', addresses, 1),
        assertExists('street set', addr?.street),
        assertExists('city set', addr?.city),
        assertExists('postalCode set', addr?.postalCode),
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // ΦΑΣΗ 7: Τραπεζικά
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'IND-15',
    name: 'IBAN (sub-collection)',
    userMessage: `Πρόσθεσε IBAN GR1601101250000000012300695, Εθνική Τράπεζα στον ${FIRST_NAME}`,
    assertions: async (ctx) => {
      const contactId = ctx.state.contactId as string | undefined;
      if (!contactId) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      // Bank accounts are in sub-collection
      const snap = await db.collection('contacts').doc(contactId).collection('bankAccounts').get();

      const hasIBAN = snap.docs.some((doc) => {
        const d = doc.data();
        return String(d.iban ?? '').includes('GR16');
      });

      return [
        { label: 'bankAccounts sub-collection has entry', passed: !snap.empty, expected: '>= 1 doc', actual: `${snap.size} docs` },
        { label: 'IBAN starts with GR16', passed: hasIBAN, expected: 'GR16...', actual: snap.empty ? 'empty' : JSON.stringify(snap.docs[0].data()) },
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // ΦΑΣΗ 8: Social / Web
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'IND-16',
    name: 'Ιστοσελίδα',
    userMessage: `Πρόσθεσε ιστοσελίδα www.testidis.gr στον ${FIRST_NAME}`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      const websites = data.websites as Array<Record<string, unknown>> | undefined;
      const socialMedia = data.socialMedia as Array<Record<string, unknown>> | undefined;

      // May be stored in websites[] or socialMedia[]
      const hasWebsite = (websites?.length ?? 0) > 0 || socialMedia?.some(
        (s) => String(s.url ?? s.value ?? '').includes('testidis.gr')
      );

      return [
        { label: 'website stored', passed: !!hasWebsite, expected: 'testidis.gr somewhere', actual: JSON.stringify({ websites, socialMedia }) },
      ];
    },
  },
  {
    id: 'IND-17',
    name: 'LinkedIn',
    userMessage: `Πρόσθεσε LinkedIn https://linkedin.com/in/testidis στον ${FIRST_NAME}`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      const socialMedia = data.socialMedia as Array<Record<string, unknown>> | undefined;
      const hasLinkedIn = socialMedia?.some(
        (s) => String(s.platform ?? '').toLowerCase() === 'linkedin'
      );

      return [
        assertArrayLength('socialMedia has entries', socialMedia, 1),
        { label: 'LinkedIn entry', passed: !!hasLinkedIn, expected: 'platform: linkedin', actual: JSON.stringify(socialMedia) },
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // ΦΑΣΗ 9: Εργοδότης + Θέση
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'IND-18',
    name: 'Εργοδότης + Θέση',
    userMessage: `Ο ${FIRST_NAME} δουλεύει ως Senior Engineer στην ΑΕΔΑΚ ΑΕ`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      return [
        assertExists('employer set', data.employer),
        assertExists('position set', data.position),
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // ΦΑΣΗ 10: Σχέσεις (χρειάζεται 2η επαφή)
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'IND-19',
    name: 'Δημιουργία 2ης επαφής',
    userMessage: 'Δημιούργησε νέα επαφή: Μαρία Τεστίδου',
    assertions: async (ctx) => {
      await sleep(1000);
      const contactId = await findContactByName('Μαρία', 'Τεστίδου');
      ctx.state.secondContactId = contactId;

      return [
        assertExists('2nd contact created', contactId),
      ];
    },
  },
  {
    id: 'IND-20',
    name: 'Σχέση σύζυγος',
    userMessage: `Η Μαρία Τεστίδου είναι σύζυγος του ${FULL_NAME}`,
    assertions: async (ctx) => {
      // Check contact_relationships collection
      const snap = await db.collection('contact_relationships')
        .where('type', '==', 'spouse')
        .limit(5)
        .get();

      const hasRelationship = snap.docs.some((doc) => {
        const d = doc.data();
        const ids = [String(d.sourceContactId ?? ''), String(d.targetContactId ?? '')];
        return ids.includes(ctx.state.contactId as string)
          || ids.includes(ctx.state.secondContactId as string);
      });

      return [
        { label: 'spouse relationship created', passed: hasRelationship, expected: 'relationship exists', actual: `${snap.size} relationships found` },
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // ΦΑΣΗ 11: Αλλαγή ταυτότητας σε διαβατήριο
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'IND-21',
    name: 'Αλλαγή τύπου εγγράφου σε διαβατήριο',
    userMessage: `Άλλαξε τον τύπο εγγράφου του ${FIRST_NAME} σε διαβατήριο`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      const docType = String(data.documentType ?? '');
      const isPassport = docType === 'passport' || docType.includes('διαβατ');

      return [
        { label: 'documentType = passport', passed: isPassport, expected: 'passport', actual: docType },
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // ΦΑΣΗ 12: Δεξιότητες ESCO
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'IND-22',
    name: 'Δεξιότητα (ESCO search)',
    userMessage: `Πρόσθεσε δεξιότητα "project management" στον ${FIRST_NAME}`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      const skills = data.escoSkills as Array<{ uri: string; label: string }> | undefined;

      return [
        assertArrayLength('escoSkills has entries', skills, 1),
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // ΦΑΣΗ 13: ΚΑΔ — Κωδικοί Αριθμοί Δραστηριότητας
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'IND-23',
    name: 'ΚΑΔ — Προσθήκη δραστηριότητας',
    userMessage: `Πρόσθεσε ΚΑΔ 41.20 στον ${FIRST_NAME}`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      const activities = data.activities as Array<{ code: string }> | undefined;
      const hasKAD = activities?.some((a) => a.code?.includes('41.20'));

      return [
        assertArrayLength('activities has entries', activities, 1),
        { label: 'ΚΑΔ 41.20 exists', passed: !!hasKAD, expected: '41.20', actual: JSON.stringify(activities) },
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // ΦΑΣΗ 14: Πρόσθετα Social Media
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'IND-24',
    name: 'Facebook',
    userMessage: `Πρόσθεσε Facebook https://facebook.com/testidis στον ${FIRST_NAME}`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      const socialMedia = data.socialMedia as Array<Record<string, unknown>> | undefined;
      const hasFB = socialMedia?.some(
        (s) => String(s.platform ?? '').toLowerCase() === 'facebook'
      );

      return [
        { label: 'Facebook entry', passed: !!hasFB, expected: 'platform: facebook', actual: JSON.stringify(socialMedia) },
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // ΦΑΣΗ 15: 2ο Email (duplicate detection)
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'IND-25',
    name: '2ο Email',
    userMessage: `Πρόσθεσε email work@testidis.gr στον ${FIRST_NAME}`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      const emails = data.emails as Array<{ email: string }> | undefined;
      const hasWork = emails?.some((e) => e.email === 'work@testidis.gr');

      return [
        assertArrayLength('emails has 2+ entries', emails, 2),
        { label: 'work email exists', passed: !!hasWork, expected: 'work@testidis.gr', actual: JSON.stringify(emails) },
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // ΦΑΣΗ 16: Search verification
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'IND-26',
    name: 'Search — βρίσκει τον contact',
    userMessage: `Βρες τον ${FULL_NAME}`,
    assertions: async (ctx) => {
      const toolUsed = ctx.toolCalls.some((tc) => tc.name === 'search_text');
      const mentionsName = ctx.aiResponse.includes(FIRST_NAME) || ctx.aiResponse.includes(LAST_NAME);

      return [
        { label: 'search_text tool used', passed: toolUsed, expected: 'search_text called', actual: ctx.toolCalls.map((t) => t.name).join(', ') },
        { label: 'AI response mentions contact', passed: mentionsName, expected: `mentions ${FIRST_NAME}`, actual: ctx.aiResponse.substring(0, 100) },
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // ΦΑΣΗ 17: Duplicate email detection (ίδιο email → reject)
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'IND-27',
    name: 'Duplicate email → reject',
    userMessage: `Πρόσθεσε email dimitrios.test@example.com στον ${FIRST_NAME}`,
    assertions: async (ctx) => {
      const data = await getContact(ctx);
      if (!data) return [{ label: 'Contact found', passed: false, expected: 'exists', actual: 'null' }];

      const emails = data.emails as Array<{ email: string }> | undefined;
      // Should still have exactly 2 (not 3 — duplicate should be rejected)
      const count = emails?.length ?? 0;

      return [
        { label: 'emails count unchanged (duplicate rejected)', passed: count === 2, expected: '2 (duplicate rejected)', actual: `${count}` },
      ];
    },
  },
];

// ── Utilities ────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main ─────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  QA E2E Tests — Contact Individual (Φυσικό Πρόσωπο)    ║');
  console.log('║  Google TAP Pattern — Real OpenAI + Real Firestore     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // Pre-check: is localhost:3000 running?
  try {
    await fetch('http://localhost:3000/', { signal: AbortSignal.timeout(5000) });
  } catch {
    console.error('\n❌ localhost:3000 δεν απαντάει. Τρέξε πρώτα: npm run dev\n');
    process.exit(1);
  }

  // Reset all QA collections
  await resetCollections();

  // Run test suite
  await runSuite('Contact Individual — Φυσικό Πρόσωπο', tests);
}

main().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
