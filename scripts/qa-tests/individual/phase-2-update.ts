/**
 * PHASE 2: UPDATE — Αλλαγή υπαρχόντων πεδίων (ένα-ένα)
 *
 * Google Test Matrix: Κάθε πεδίο αλλάζεται σε νέα τιμή.
 * Ελέγχει ότι η παλιά τιμή αντικαταστάθηκε σωστά.
 */

import {
  db,
  assertField,
  assertExists,
  assertNotEqual,
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

export const updateTests: QATestCase[] = [
  // ── Scalar field updates ──────────────────────────────────────────
  {
    id: 'U-01', name: 'Update πατρώνυμο',
    userMessage: `Άλλαξε το πατρώνυμο του ${FIRST} σε Γεώργιος`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [
        assertField('fatherName', d.fatherName, 'Γεώργιος'),
        assertNotEqual('fatherName changed', d.fatherName, 'Αθανάσιος'),
      ];
    },
  },
  {
    id: 'U-02', name: 'Update ΑΦΜ',
    userMessage: `Άλλαξε το ΑΦΜ του ${FIRST} σε 987654321`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [
        assertField('vatNumber', d.vatNumber, '987654321'),
        assertNotEqual('vatNumber changed', d.vatNumber, '123456789'),
      ];
    },
  },
  {
    id: 'U-03', name: 'Update φύλο',
    userMessage: `Ο ${FIRST} είναι γυναίκα`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [assertField('gender', d.gender, 'female')];
    },
  },
  {
    id: 'U-04', name: 'Update ΑΜΚΑ',
    userMessage: `Άλλαξε ΑΜΚΑ σε 99099012345 στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [
        assertField('amka', d.amka, '99099012345'),
        assertNotEqual('amka changed', d.amka, '15039012345'),
      ];
    },
  },
  {
    id: 'U-05', name: 'Update τύπος εγγράφου → διαβατήριο',
    userMessage: `Άλλαξε τον τύπο εγγράφου του ${FIRST} σε διαβατήριο`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const t = String(d.documentType ?? '');
      return [{ label: 'documentType = passport', passed: t === 'passport' || t.includes('διαβατ'), expected: 'passport', actual: t }];
    },
  },
  {
    id: 'U-06', name: 'Update εργοδότης',
    userMessage: `Ο ${FIRST} δουλεύει τώρα στη Google`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const emp = String(d.employer ?? '').toLowerCase();
      return [{ label: 'employer contains Google', passed: emp.includes('google'), expected: 'Google', actual: String(d.employer) }];
    },
  },
  {
    id: 'U-07', name: 'Update θέση',
    userMessage: `Η θέση του ${FIRST} είναι CTO`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const pos = String(d.position ?? '').toUpperCase();
      return [{ label: 'position = CTO', passed: pos.includes('CTO'), expected: 'CTO', actual: String(d.position) }];
    },
  },
  {
    id: 'U-08', name: 'Update ΔΟΥ',
    userMessage: `Άλλαξε ΔΟΥ σε Ιωνίας Θεσσαλονίκης για τον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const t = String(d.taxOffice ?? '');
      return [
        { label: 'taxOffice 4-digit', passed: /^\d{4}$/.test(t), expected: '4-digit code', actual: t },
        assertNotEqual('taxOffice changed', d.taxOffice, '1312'),
      ];
    },
  },
  {
    id: 'U-09', name: 'Update χώρα γέννησης',
    userMessage: `Ο ${FIRST} γεννήθηκε στη Γερμανία`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const c = String(d.birthCountry ?? '');
      return [{ label: 'birthCountry = DE', passed: ['DE', 'de', 'Γερμανία', 'Germany'].includes(c), expected: 'DE', actual: c }];
    },
  },
  {
    id: 'U-10', name: 'Update επάγγελμα (νέο ESCO)',
    userMessage: `Ο ${FIRST} είναι πολιτικός μηχανικός`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [
        assertExists('escoUri updated', d.escoUri),
        assertExists('escoLabel updated', d.escoLabel),
      ];
    },
  },

  // ── 2ο email (append — tests array growth) ────────────────────────
  {
    id: 'U-11', name: 'Append 2ο email',
    userMessage: `Πρόσθεσε email work@testidis.gr στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const emails = d.emails as Array<{ email: string }> | undefined;
      return [
        { label: 'emails 2+', passed: (emails?.length ?? 0) >= 2, expected: '>= 2', actual: `${emails?.length}` },
        { label: 'work email', passed: !!emails?.some((e) => e.email === 'work@testidis.gr'), expected: 'work@testidis.gr', actual: JSON.stringify(emails) },
      ];
    },
  },

  // ── 2ο IBAN ───────────────────────────────────────────────────────
  {
    id: 'U-12', name: 'Append 2ο IBAN',
    userMessage: `Πρόσθεσε IBAN GR6201101250000000012345678, Alpha Bank στον ${FIRST}`,
    assertions: async (ctx) => {
      const id = ctx.state.contactId as string;
      if (!id) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const snap = await db.collection('contacts').doc(id).collection('bank_accounts').get();
      return [
        { label: 'bankAccounts 2+', passed: snap.size >= 2, expected: '>= 2', actual: `${snap.size}` },
      ];
    },
  },

  // ── 2ος ΚΑΔ ───────────────────────────────────────────────────────
  {
    id: 'U-13', name: 'Append 2ος ΚΑΔ',
    userMessage: `Πρόσθεσε ΚΑΔ 71.11 στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const acts = d.activities as Array<{ code: string }> | undefined;
      return [
        { label: 'activities 2+', passed: (acts?.length ?? 0) >= 2, expected: '>= 2', actual: `${acts?.length}` },
        { label: 'KAD 71.11', passed: !!acts?.some((a) => a.code?.includes('71.11')), expected: '71.11', actual: JSON.stringify(acts) },
      ];
    },
  },
];
