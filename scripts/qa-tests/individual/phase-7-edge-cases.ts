/**
 * PHASE 7: EDGE CASES — Stress tests, unusual inputs, boundary conditions
 *
 * Google Test Matrix: Ελέγχει ότι ο AI agent χειρίζεται ασυνήθιστα inputs
 * χωρίς crash, data corruption ή hallucination.
 *
 * Κάθε test στέλνει "δύσκολο" input που θα μπορούσε να σπάσει τον agent.
 */

import {
  db,
  assertExists,
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

export const edgeCaseTests: QATestCase[] = [
  // ── ESCO 0 results → free-text fallback ─────────────────────────────
  {
    id: 'E-01', name: 'ESCO 0 results → free-text or ask',
    userMessage: `Ο ${FIRST} είναι αστροναύτης υποβρυχίων`,
    assertions: async (ctx) => {
      // AI should search ESCO, find nothing, and either save as free-text or explain
      const searchedEsco = ctx.toolCalls.some((tc) => tc.name === 'search_esco_occupations');
      const responded = ctx.aiResponse.length > 20;
      return [
        { label: 'searched ESCO', passed: searchedEsco, expected: 'search_esco_occupations', actual: ctx.toolCalls.map((t) => t.name).join(' → ') },
        { label: 'meaningful response', passed: responded, expected: 'explanation or fallback', actual: ctx.aiResponse.substring(0, 120) },
      ];
    },
  },

  // ── Duplicate contact creation (same name) → detection ──────────────
  {
    id: 'E-02', name: 'Duplicate contact → detection',
    userMessage: `Δημιούργησε νέα επαφή: ${FULL}`,
    assertions: async (ctx) => {
      // AI should detect existing contact and warn or ask
      const mentionsDuplicate = ctx.aiResponse.includes('ήδη') || ctx.aiResponse.includes('υπάρχ')
        || ctx.aiResponse.includes('βρέθηκε') || ctx.aiResponse.includes('ίδιο')
        || ctx.toolCalls.some((tc) => tc.name === 'search_text');
      return [
        { label: 'duplicate detected', passed: mentionsDuplicate, expected: 'warns about existing', actual: ctx.aiResponse.substring(0, 120) },
      ];
    },
  },

  // ── Search with typo → fuzzy or no results ──────────────────────────
  {
    id: 'E-03', name: 'Search with typo "Τεστιδησ"',
    userMessage: 'Βρες τον Τεστιδησ',
    assertions: async (ctx) => {
      const searched = ctx.toolCalls.some((tc) => tc.name === 'search_text');
      // AI should at least search — may or may not find due to typo
      return [
        { label: 'attempted search', passed: searched, expected: 'search_text called', actual: ctx.toolCalls.map((t) => t.name).join(', ') },
        { label: 'responded meaningfully', passed: ctx.aiResponse.length > 10, expected: 'results or no results', actual: ctx.aiResponse.substring(0, 100) },
      ];
    },
  },

  // ── All-caps input → handle normally ────────────────────────────────
  {
    id: 'E-04', name: 'All-caps "ΒΑΛΕ ΑΦΜ 333444555"',
    userMessage: `ΒΑΛΕ ΑΦΜ 333444555 ΣΤΟΝ ${FIRST.toUpperCase()}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [
        { label: 'AFM saved despite caps', passed: d.vatNumber === '333444555', expected: '333444555', actual: String(d.vatNumber ?? '') },
      ];
    },
  },

  // ── Mixed language input ────────────────────────────────────────────
  {
    id: 'E-05', name: 'Mixed language "Set email for Δημήτριος"',
    userMessage: `Set email work@mixed.com for ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const emails = d.emails as Array<{ email: string }> | undefined;
      const hasMixed = emails?.some((e) => e.email === 'work@mixed.com');
      return [
        { label: 'email saved despite mixed lang', passed: !!hasMixed, expected: 'work@mixed.com', actual: JSON.stringify(emails?.map((e) => e.email)) },
      ];
    },
  },

  // ── Phone with country code +30 ────────────────────────────────────
  {
    id: 'E-06', name: 'Phone with +30 country code',
    userMessage: `Πρόσθεσε τηλέφωνο +306955123456 στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const phones = d.phones as Array<{ number: string }> | undefined;
      // Should save with or without +30 prefix
      const found = phones?.some((p) => {
        const num = String(p.number ?? '');
        return num.includes('6955123456') || num.includes('+306955123456');
      });
      return [
        { label: 'phone with +30 saved', passed: !!found, expected: '6955123456 or +30...', actual: JSON.stringify(phones?.map((p) => p.number)) },
      ];
    },
  },

  // ── IBAN with spaces → handle gracefully ────────────────────────────
  {
    id: 'E-07', name: 'IBAN with spaces',
    userMessage: `Πρόσθεσε IBAN GR96 0810 0010 0000 0123 4567 890 στον ${FIRST}`,
    assertions: async (ctx) => {
      const id = ctx.state.contactId as string;
      if (!id) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const snap = await db.collection('contacts').doc(id).collection('bankAccounts').get();
      const hasGR96 = snap.docs.some((doc) => {
        const iban = String(doc.data().iban ?? '').replace(/\s/g, '');
        return iban.includes('GR9608100010');
      });
      return [
        { label: 'IBAN with spaces accepted', passed: hasGR96, expected: 'GR96... saved', actual: snap.docs.map((d) => d.data().iban).join(', ') || 'empty' },
      ];
    },
  },

  // ── Date in different format ────────────────────────────────────────
  {
    id: 'E-08', name: 'Date format "1990-03-15" (ISO)',
    userMessage: `Ο ${FIRST} γεννήθηκε 1990-03-15`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [assertExists('birthDate updated', d.birthDate)];
    },
  },

  // ── Empty/whitespace value → reject ─────────────────────────────────
  {
    id: 'E-09', name: 'Whitespace "Βάλε εργοδότη   " → reject',
    userMessage: `Βάλε εργοδότη     στον ${FIRST}`,
    assertions: async (ctx) => {
      // AI should ask which employer, not save whitespace
      const aiAsks = ctx.aiResponse.includes('ποι') || ctx.aiResponse.includes(';')
        || ctx.aiResponse.includes('εργοδότη') || ctx.aiResponse.includes('?');
      return [
        { label: 'AI asks for value', passed: aiAsks, expected: 'asks employer name', actual: ctx.aiResponse.substring(0, 100) },
      ];
    },
  },

  // ── Rapid same-field update → last value wins ───────────────────────
  {
    id: 'E-10', name: 'Same field twice → last value wins',
    userMessage: `Βάλε πατρώνυμο Νίκος στον ${FIRST}. Μάλλον κάνω λάθος, βάλε πατρώνυμο Στέφανος`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      // Last value should win (Στέφανος), or AI asks for clarification
      const fatherName = String(d.fatherName ?? '');
      const isCorrection = fatherName === 'Στέφανος'
        || ctx.aiResponse.includes('Στέφανος')
        || ctx.aiResponse.includes('ποι');
      return [
        { label: 'correction handled', passed: isCorrection, expected: 'Στέφανος or asks', actual: `fatherName=${fatherName}` },
      ];
    },
  },

  // ── Info retrieval without modification ─────────────────────────────
  {
    id: 'E-11', name: 'Read-only query — no data change',
    userMessage: `Ποια στοιχεία έχει ο ${FULL};`,
    assertions: async (ctx) => {
      // AI should retrieve data, not modify
      const hasUpdate = ctx.toolCalls.some((tc) =>
        tc.name === 'update_contact_field' || tc.name === 'append_contact_info'
      );
      const hasRead = ctx.toolCalls.some((tc) =>
        tc.name === 'search_text' || tc.name === 'firestore_get_document' || tc.name === 'firestore_query'
      );
      return [
        { label: 'used read tools', passed: hasRead, expected: 'search/query', actual: ctx.toolCalls.map((t) => t.name).join(', ') },
        { label: 'no write tools', passed: !hasUpdate, expected: 'no writes', actual: hasUpdate ? 'WROTE (bug!)' : 'read-only' },
      ];
    },
  },

  // ── Large batch: 6+ fields in one message ───────────────────────────
  {
    id: 'E-12', name: 'Large batch: 6 fields at once',
    userMessage: `Ο ${FIRST} έχει πατρώνυμο Ανδρέας, μητρώνυμο Σοφία, είναι άνδρας, γεννήθηκε 20/05/1985 στην Ελλάδα, ΑΦΜ 444555666`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      // At least 4 out of 6 should be saved
      let count = 0;
      if (d.fatherName === 'Ανδρέας') count++;
      if (d.motherName === 'Σοφία') count++;
      if (d.gender === 'male') count++;
      if (d.birthDate) count++;
      if (d.vatNumber === '444555666') count++;
      const birthC = String(d.birthCountry ?? '');
      if (['GR', 'gr', 'Ελλάδα', 'Greece'].includes(birthC)) count++;
      return [
        { label: `large batch: ${count}/6 fields saved`, passed: count >= 4, expected: '>= 4 fields', actual: `${count}/6` },
      ];
    },
  },
];
