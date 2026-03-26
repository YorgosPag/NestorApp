/**
 * PHASE 5: VALIDATION — Rejection scenarios, edge cases, guards
 *
 * Google Test Matrix: Δοκιμάζει ότι ο AI agent ΑΠΟΡΡΙΠΤΕΙ λάθος input.
 * Ελέγχει server-side guards, format validation, business rules.
 */

import {
  db,
  assertField,
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

export const validationTests: QATestCase[] = [
  // ── ΑΜΚΑ validation (10 ψηφία → reject) ───────────────────────────
  {
    id: 'V-01', name: 'ΑΜΚΑ λάθος (10 ψηφία) → reject',
    userMessage: `Βάλε ΑΜΚΑ 1234567890 στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      // amka should be 01019912345 from batch phase (or empty) — NOT 1234567890
      const amka = String(d.amka ?? '');
      return [
        { label: 'amka NOT 10-digit', passed: amka !== '1234567890', expected: 'rejected', actual: amka || 'empty' },
      ];
    },
  },

  // ── ΑΜΚΑ validation (γράμματα → reject) ───────────────────────────
  {
    id: 'V-02', name: 'ΑΜΚΑ γράμματα → reject',
    userMessage: `Βάλε ΑΜΚΑ abcdefghijk στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [
        { label: 'amka NOT letters', passed: String(d.amka ?? '') !== 'abcdefghijk', expected: 'rejected', actual: String(d.amka ?? '') || 'empty' },
      ];
    },
  },

  // ── Duplicate email → reject ──────────────────────────────────────
  {
    id: 'V-03', name: 'Duplicate email → reject',
    userMessage: `Πρόσθεσε email batch@test.gr στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const emails = d.emails as Array<{ email: string }> | undefined;
      const count = emails?.filter((e) => e.email === 'batch@test.gr').length ?? 0;
      return [
        { label: 'batch@test.gr appears once (duplicate rejected)', passed: count <= 1, expected: '<= 1 occurrence', actual: `${count} occurrences` },
      ];
    },
  },

  // ── Duplicate phone → reject ──────────────────────────────────────
  {
    id: 'V-04', name: 'Duplicate phone → reject',
    userMessage: `Πρόσθεσε κινητό 6988111222 στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const phones = d.phones as Array<{ number: string }> | undefined;
      const count = phones?.filter((p) => p.number?.includes('6988111222')).length ?? 0;
      return [
        { label: '6988111222 appears once (duplicate rejected)', passed: count <= 1, expected: '<= 1 occurrence', actual: `${count} occurrences` },
      ];
    },
  },

  // ── Invalid email format → reject ─────────────────────────────────
  {
    id: 'V-05', name: 'Invalid email (no @) → reject',
    userMessage: `Πρόσθεσε email not-an-email στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const emails = d.emails as Array<{ email: string }> | undefined;
      const hasInvalid = emails?.some((e) => e.email === 'not-an-email');
      return [
        { label: 'invalid email rejected', passed: !hasInvalid, expected: 'not saved', actual: hasInvalid ? 'SAVED (bug!)' : 'rejected' },
      ];
    },
  },

  // ── Invalid phone format → reject ─────────────────────────────────
  {
    id: 'V-06', name: 'Invalid phone (3 ψηφία) → reject',
    userMessage: `Πρόσθεσε κινητό 123 στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const phones = d.phones as Array<{ number: string }> | undefined;
      const hasInvalid = phones?.some((p) => p.number === '123');
      return [
        { label: 'invalid phone rejected', passed: !hasInvalid, expected: 'not saved', actual: hasInvalid ? 'SAVED (bug!)' : 'rejected' },
      ];
    },
  },

  // ── ESCO ambiguous (πρέπει να ρωτήσει) ────────────────────────────
  {
    id: 'V-07', name: 'ESCO ambiguous → disambiguation',
    userMessage: `Ο ${FIRST} είναι μηχανικός`,
    assertions: async (ctx) => {
      // "μηχανικός" is ambiguous — AI should ask which type
      const asksDisambig = ctx.aiResponse.includes('ποι') || ctx.aiResponse.includes('τύπ')
        || ctx.aiResponse.includes('εξειδίκευση') || ctx.aiResponse.includes('ειδικότητα')
        || ctx.toolCalls.some((tc) => tc.name === 'search_esco_occupations');
      return [
        { label: 'AI asks disambiguation or searches ESCO', passed: asksDisambig, expected: 'disambiguation', actual: ctx.aiResponse.substring(0, 120) },
      ];
    },
  },

  // ── Search γενική πτώση (FIND-005 regression) ─────────────────────
  {
    id: 'V-08', name: 'Search γενική πτώση "Τεστίδη"',
    userMessage: 'Βρες τον Τεστίδη',
    assertions: async (ctx) => {
      const toolUsed = ctx.toolCalls.some((tc) => tc.name === 'search_text');
      const mentions = ctx.aiResponse.includes(FIRST) || ctx.aiResponse.includes('Τεστίδ');
      return [
        { label: 'search_text used', passed: toolUsed, expected: 'search_text', actual: ctx.toolCalls.map((t) => t.name).join(', ') },
        { label: 'found despite genitive', passed: mentions, expected: 'mentions contact', actual: ctx.aiResponse.substring(0, 100) },
      ];
    },
  },

  // ── Gender σε non-gender context (FIND-C regression) ──────────────
  {
    id: 'V-09', name: '"Είναι άνδρας" → gender, NOT ESCO search',
    userMessage: `Ο ${FIRST} είναι άνδρας`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const escoSearched = ctx.toolCalls.some((tc) => tc.name === 'search_esco_occupations');
      return [
        assertField('gender = male', d.gender, 'male'),
        { label: 'NO ESCO search (efficiency)', passed: !escoSearched, expected: 'no search_esco_occupations', actual: escoSearched ? 'ESCO searched (waste)' : 'correct' },
      ];
    },
  },

  // ── Hallucinated contactId guard (FIND-A/T regression) ────────────
  {
    id: 'V-10', name: 'Fresh search — no hallucinated ID',
    userMessage: `Ποια στοιχεία έχει ο ${FULL};`,
    assertions: async (ctx) => {
      // AI should use search_text or get_document, NOT fabricate an ID
      const usedSearch = ctx.toolCalls.some((tc) =>
        tc.name === 'search_text' || tc.name === 'firestore_get_document' || tc.name === 'firestore_query'
      );
      return [
        { label: 'used search/query tool', passed: usedSearch, expected: 'search_text or query', actual: ctx.toolCalls.map((t) => t.name).join(', ') },
      ];
    },
  },
];
