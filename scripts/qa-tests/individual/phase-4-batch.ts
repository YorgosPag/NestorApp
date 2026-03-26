/**
 * PHASE 4: BATCH — Μαζικές εγγραφές/ενημερώσεις (πολλά πεδία σε 1 εντολή)
 *
 * Google Test Matrix: Ο AI πρέπει να χειριστεί multi-field εντολές.
 * Ελέγχει ότι ΟΛΑ τα πεδία γράφτηκαν σωστά σε μία μόνο αλληλεπίδραση.
 */

import {
  db,
  assertField,
  assertExists,
  assertArrayLength,
  type QATestCase,
} from '../qa-test-runner';

const FIRST = 'Δημήτριος';
const FULL = `${FIRST} Τεστίδης`;

async function getContact(ctx: { state: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
  const id = ctx.state.contactId as string | undefined;
  if (!id) return null;
  const snap = await db.collection('contacts').doc(id).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}

export const batchTests: QATestCase[] = [
  // ── 3 scalar fields σε 1 εντολή ──────────────────────────────────
  {
    id: 'B-01', name: 'Batch: ΑΦΜ + ΔΟΥ + ΑΜΚΑ (3 πεδία)',
    userMessage: `Για τον ${FIRST}: ΑΦΜ 555666777, ΔΟΥ Α' Θεσσαλονίκης, ΑΜΚΑ 01019912345`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [
        assertField('vatNumber', d.vatNumber, '555666777'),
        assertExists('taxOffice set', d.taxOffice),
        assertField('amka', d.amka, '01019912345'),
      ];
    },
  },

  // ── 2 array appends σε 1 εντολή ──────────────────────────────────
  {
    id: 'B-02', name: 'Batch: κινητό + email (2 arrays)',
    userMessage: `Πρόσθεσε κινητό 6988111222 και email batch@test.gr στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const phones = d.phones as Array<{ number: string }> | undefined;
      const emails = d.emails as Array<{ email: string }> | undefined;
      return [
        { label: 'phone 6988111222', passed: !!phones?.some((p) => p.number?.includes('6988111222')), expected: '6988111222', actual: `${phones?.length} phones` },
        { label: 'email batch@test.gr', passed: !!emails?.some((e) => e.email === 'batch@test.gr'), expected: 'batch@test.gr', actual: `${emails?.length} emails` },
      ];
    },
  },

  // ── Ταυτότητα πλήρης (5 πεδία σε 1 εντολή) ──────────────────────
  {
    id: 'B-03', name: 'Batch: ταυτότητα 5 πεδία μαζί',
    userMessage: `Ο ${FIRST} έχει διαβατήριο AE 1234567, εκδόθηκε Α.Τ. Αθηνών, 01/06/2023, λήξη 01/06/2033`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [
        assertExists('documentType', d.documentType),
        assertExists('documentNumber', d.documentNumber),
        assertExists('documentIssuer', d.documentIssuer),
        assertExists('documentIssueDate', d.documentIssueDate),
        assertExists('documentExpiryDate', d.documentExpiryDate),
      ];
    },
  },

  // ── Εργοδότης + Θέση μαζί ────────────────────────────────────────
  {
    id: 'B-04', name: 'Batch: εργοδότης + θέση',
    userMessage: `Ο ${FIRST} εργάζεται ως Lead Architect στην Lamda Development`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [
        assertExists('employer set', d.employer),
        assertExists('position set', d.position),
      ];
    },
  },

  // ── Πατρώνυμο + Μητρώνυμο + Φύλο + Γέννηση (4 πεδία) ────────────
  {
    id: 'B-05', name: 'Batch: 4 προσωπικά στοιχεία',
    userMessage: `Ο ${FIRST} είναι άνδρας, πατρώνυμο Κωνσταντίνος, μητρώνυμο Ελένη, γεννήθηκε 20/05/1985`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [
        assertField('gender', d.gender, 'male'),
        assertField('fatherName', d.fatherName, 'Κωνσταντίνος'),
        assertField('motherName', d.motherName, 'Ελένη'),
        assertExists('birthDate set', d.birthDate),
      ];
    },
  },

  // ── Πλήρης διεύθυνση (structured parse) ───────────────────────────
  {
    id: 'B-06', name: 'Batch: πλήρης διεύθυνση',
    userMessage: `Βάλε νέα διεύθυνση: Εγνατίας 154, Θεσσαλονίκη 54636 στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const addrs = d.addresses as Array<Record<string, unknown>> | undefined;
      // Should have at least 2 addresses now (original + new)
      return [
        assertArrayLength('addresses 2+', addrs, 2),
      ];
    },
  },
];
