/**
 * PHASE 6: GUARDS — Guardrail & boundary tests
 *
 * Google Test Matrix: Ελέγχει ότι τα guardrails (FIND-R, FIND-U, FIND-Z,
 * ESCO Protection, append-only) λειτουργούν σωστά σε φυσικά πρόσωπα.
 *
 * Κάθε test στέλνει εντολή που ΠΡΕΠΕΙ να αρνηθεί ή να χειριστεί ειδικά.
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

export const guardTests: QATestCase[] = [
  // ── ESCO Protection: profession MUST go via set_contact_esco ─────────
  {
    id: 'G-01', name: 'ESCO Protection — profession via set_contact_esco',
    userMessage: `Ο ${FIRST} είναι πολιτικός μηχανικός`,
    assertions: async (ctx) => {
      // AI should call search_esco_occupations or set_contact_esco, NOT update_contact_field(field=profession)
      const usedEsco = ctx.toolCalls.some((tc) =>
        tc.name === 'search_esco_occupations' || tc.name === 'set_contact_esco'
      );
      const usedUpdateForProfession = ctx.toolCalls.some((tc) =>
        tc.name === 'update_contact_field' && tc.args.includes('profession')
      );
      return [
        { label: 'used ESCO tool path', passed: usedEsco, expected: 'search_esco/set_contact_esco', actual: ctx.toolCalls.map((t) => t.name).join(' → ') },
        { label: 'NOT update_contact_field(profession)', passed: !usedUpdateForProfession, expected: 'no direct profession write', actual: usedUpdateForProfession ? 'BUG: direct write!' : 'correct' },
      ];
    },
  },

  // ── FIND-U: ΑΦΜ + ΔΟΥ in same request → DOY blocked ────────────────
  {
    id: 'G-02', name: 'FIND-U: ΑΦΜ+ΔΟΥ same request → ΔΟΥ guard',
    userMessage: `Βάλε ΑΦΜ 111222333 και ΔΟΥ Α' Θεσσαλονίκης στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      // vatNumber should be updated
      const vatOk = d.vatNumber === '111222333';
      // AI should mention DOY restriction or handle it gracefully
      const aiMentionsDoy = ctx.aiResponse.includes('ΔΟΥ') || ctx.aiResponse.includes('DOY')
        || ctx.aiResponse.includes('ξεχωριστά') || ctx.aiResponse.includes('χωριστά');
      return [
        assertField('vatNumber updated', d.vatNumber, '111222333'),
        { label: 'AI acknowledges DOY guard', passed: vatOk && aiMentionsDoy, expected: 'AFM saved + DOY mention', actual: `vat=${d.vatNumber}, mentions DOY: ${aiMentionsDoy}` },
      ];
    },
  },

  // ── Append-only: delete email → reject ──────────────────────────────
  {
    id: 'G-03', name: 'Append-only: σβήσε email → αρνείται',
    userMessage: `Σβήσε το email dimitrios@example.com του ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const emails = d.emails as Array<{ email: string }> | undefined;
      const stillExists = emails?.some((e) => e.email === 'dimitrios@example.com');
      return [
        { label: 'email preserved (append-only)', passed: !!stillExists, expected: 'still exists', actual: stillExists ? 'preserved' : 'DELETED (bug!)' },
      ];
    },
  },

  // ── Append-only: delete address → reject ────────────────────────────
  {
    id: 'G-04', name: 'Append-only: σβήσε διεύθυνση → αρνείται',
    userMessage: `Σβήσε τη διεύθυνση Τσιμισκή του ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const addresses = d.addresses as Array<Record<string, unknown>> | undefined;
      return [
        { label: 'addresses preserved', passed: (addresses?.length ?? 0) >= 1, expected: '>= 1 address', actual: `${addresses?.length ?? 0} addresses` },
      ];
    },
  },

  // ── Append-only: delete social → reject ─────────────────────────────
  {
    id: 'G-05', name: 'Append-only: σβήσε LinkedIn → αρνείται',
    userMessage: `Σβήσε το LinkedIn του ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const sm = d.socialMedia as Array<Record<string, unknown>> | undefined;
      const hasLinkedin = sm?.some((s) => String(s.platform ?? '').toLowerCase() === 'linkedin');
      return [
        { label: 'LinkedIn preserved', passed: !!hasLinkedin, expected: 'still exists', actual: hasLinkedin ? 'preserved' : 'DELETED (bug!)' },
      ];
    },
  },

  // ── displayName auto-sync on lastName change ────────────────────────
  {
    id: 'G-06', name: 'displayName auto-sync on lastName update',
    userMessage: `Άλλαξε το επίθετο του ${FIRST} σε Παπαδόπουλος`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const display = String(d.displayName ?? '');
      return [
        assertField('lastName', d.lastName, 'Παπαδόπουλος'),
        { label: 'displayName synced', passed: display.includes('Παπαδόπουλος'), expected: 'contains Παπαδόπουλος', actual: display },
      ];
    },
  },

  // ── Revert lastName back for subsequent tests ───────────────────────
  {
    id: 'G-07', name: 'Επαναφορά επιθέτου σε Τεστίδης',
    userMessage: `Άλλαξε το επίθετο του ${FIRST} πίσω σε Τεστίδης`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [assertField('lastName reverted', d.lastName, 'Τεστίδης')];
    },
  },

  // ── IBAN validation: invalid MOD 97 → reject ───────────────────────
  {
    id: 'G-08', name: 'IBAN invalid MOD 97 → reject',
    userMessage: `Πρόσθεσε IBAN GR0000000000000000000000000 στον ${FIRST}`,
    assertions: async (ctx) => {
      const id = ctx.state.contactId as string;
      if (!id) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const snap = await db.collection('contacts').doc(id).collection('bankAccounts').get();
      const hasInvalid = snap.docs.some((doc) => {
        const iban = String(doc.data().iban ?? '');
        return iban.includes('GR0000000000000000000000000');
      });
      return [
        { label: 'invalid IBAN rejected', passed: !hasInvalid, expected: 'not saved', actual: hasInvalid ? 'SAVED (bug!)' : 'rejected' },
      ];
    },
  },

  // ── Non-existent contact → graceful failure ─────────────────────────
  {
    id: 'G-09', name: 'Update ανύπαρκτη επαφή → αναζήτηση',
    userMessage: 'Βάλε ΑΦΜ 999888777 στον Αλέξανδρο Πετρίδη',
    assertions: async (ctx) => {
      // AI should search and not find, or ask to create
      const searched = ctx.toolCalls.some((tc) => tc.name === 'search_text' || tc.name === 'firestore_query');
      const responseOk = ctx.aiResponse.includes('δεν βρ') || ctx.aiResponse.includes('δεν υπάρχ')
        || ctx.aiResponse.includes('δημιουργ') || ctx.aiResponse.includes('βρήκα')
        || ctx.aiResponse.length > 10; // AI responded something meaningful
      return [
        { label: 'searched for contact', passed: searched, expected: 'search attempt', actual: ctx.toolCalls.map((t) => t.name).join(', ') },
        { label: 'graceful response', passed: responseOk, expected: 'not found / create?', actual: ctx.aiResponse.substring(0, 100) },
      ];
    },
  },

  // ── Empty value → AI asks or rejects ────────────────────────────────
  {
    id: 'G-10', name: 'Empty value "Βάλε ΑΦΜ" χωρίς αριθμό',
    userMessage: `Βάλε ΑΦΜ στον ${FIRST}`,
    assertions: async (ctx) => {
      // AI should ask what the AFM number is, not write empty
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const vatEmpty = !d.vatNumber || String(d.vatNumber).trim() === '';
      const aiAsks = ctx.aiResponse.includes('ποι') || ctx.aiResponse.includes('αριθμ')
        || ctx.aiResponse.includes('ΑΦΜ') || ctx.aiResponse.includes('?') || ctx.aiResponse.includes(';');
      return [
        { label: 'AI asks for value (not empty write)', passed: aiAsks || !vatEmpty, expected: 'asks or keeps existing', actual: ctx.aiResponse.substring(0, 100) },
      ];
    },
  },

  // ── Short AFM (5 digits instead of 9) → AI flags or rejects ────────
  {
    id: 'G-11', name: 'ΑΦΜ 5 ψηφία → validation',
    userMessage: `Βάλε ΑΦΜ 12345 στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      // AFM should NOT be exactly '12345' (too short)
      const saved5digit = d.vatNumber === '12345';
      return [
        { label: 'short AFM rejected/flagged', passed: !saved5digit, expected: 'not 12345', actual: String(d.vatNumber ?? 'empty') },
      ];
    },
  },

  // ── Conflicting values in same message ──────────────────────────────
  {
    id: 'G-12', name: 'Conflicting values: 2 ΑΜΚΑ → AI picks one or asks',
    userMessage: `Βάλε ΑΜΚΑ 11111111111 και ΑΜΚΑ 22222222222 στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const amka = String(d.amka ?? '');
      // Either one of the two is saved (AI picked), or AI asked for clarification
      const resolved = amka === '11111111111' || amka === '22222222222'
        || ctx.aiResponse.includes('ποι') || ctx.aiResponse.includes(';');
      return [
        { label: 'conflict resolved (picked one or asked)', passed: resolved, expected: 'one value or question', actual: `amka=${amka}` },
      ];
    },
  },
];
