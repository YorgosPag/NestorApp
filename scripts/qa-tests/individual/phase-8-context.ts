/**
 * PHASE 8: CONTEXT — Conversation context awareness tests
 *
 * Google Test Matrix: Ελέγχει ότι ο AI agent κρατάει context μεταξύ μηνυμάτων.
 * Χρησιμοποιεί implicit references ("βάλε του", "πόσα έχει;") χωρίς
 * να κατονομάζει ρητά τον contact.
 *
 * ΣΗΜΑΝΤΙΚΟ: Αυτά τα tests εξαρτώνται από τα προηγούμενα phases.
 * Ο AI έχει ήδη πλήρες chat history με τον Δημήτριο Τεστίδη.
 */

import {
  db,
  type QATestCase,
} from '../qa-test-runner';

const FIRST = 'Δημήτριος';

async function getContact(ctx: { state: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
  const id = ctx.state.contactId as string | undefined;
  if (!id) return null;
  const snap = await db.collection('contacts').doc(id).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}

export const contextTests: QATestCase[] = [
  // ── Implicit reference: "βάλε του" χωρίς όνομα ─────────────────────
  {
    id: 'X-01', name: 'Implicit ref: "βάλε του" χωρίς όνομα',
    userMessage: 'Βάλε του εργοδότη Microsoft',
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const employerSet = String(d.employer ?? '').toLowerCase().includes('microsoft');
      return [
        { label: 'employer via implicit ref', passed: employerSet, expected: 'Microsoft', actual: String(d.employer ?? 'empty') },
      ];
    },
  },

  // ── Implicit query: "πόσα τηλέφωνα έχει;" ──────────────────────────
  {
    id: 'X-02', name: 'Implicit query: "πόσα τηλέφωνα έχει;"',
    userMessage: 'Πόσα τηλέφωνα έχει;',
    assertions: async (ctx) => {
      // AI should reference Δημήτριος from context and answer about phones
      const mentionsPhones = ctx.aiResponse.includes('τηλέφων') || ctx.aiResponse.includes('κινητ')
        || ctx.aiResponse.includes('σταθερ') || ctx.aiResponse.match(/\d{3,}/);
      const mentionsContact = ctx.aiResponse.includes(FIRST) || ctx.aiResponse.includes('Τεστίδ')
        || ctx.aiResponse.includes('επαφ') || ctx.aiResponse.includes('του');
      return [
        { label: 'mentions phones in response', passed: !!mentionsPhones, expected: 'phone info', actual: ctx.aiResponse.substring(0, 120) },
        { label: 'knows which contact', passed: !!mentionsContact || !!mentionsPhones, expected: 'references contact', actual: ctx.aiResponse.substring(0, 80) },
      ];
    },
  },

  // ── "κι ένα" implies append ─────────────────────────────────────────
  {
    id: 'X-03', name: '"κι ένα email" → append via context',
    userMessage: 'Βάλε κι ένα email extra@context.gr',
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const emails = d.emails as Array<{ email: string }> | undefined;
      const hasExtra = emails?.some((e) => e.email === 'extra@context.gr');
      return [
        { label: 'email appended via context', passed: !!hasExtra, expected: 'extra@context.gr', actual: JSON.stringify(emails?.map((e) => e.email)) },
      ];
    },
  },

  // ── "Σωστά;" after update → confirm, don't re-execute ──────────────
  {
    id: 'X-04', name: '"Σωστά;" → confirm without re-executing',
    userMessage: 'Σωστά;',
    assertions: async (ctx) => {
      // AI should respond conversationally, NOT call write tools
      const hasWrite = ctx.toolCalls.some((tc) =>
        tc.name === 'update_contact_field' || tc.name === 'append_contact_info'
        || tc.name === 'set_contact_esco' || tc.name === 'manage_bank_account'
      );
      const responded = ctx.aiResponse.length > 5;
      return [
        { label: 'no write tools on "Σωστά;"', passed: !hasWrite, expected: 'conversational only', actual: hasWrite ? `WROTE: ${ctx.toolCalls.map((t) => t.name).join(', ')}` : 'no writes' },
        { label: 'AI responded', passed: responded, expected: 'confirmation', actual: ctx.aiResponse.substring(0, 100) },
      ];
    },
  },

  // ── Correction: "Όχι, βάλε X αντί Y" ──────────────────────────────
  {
    id: 'X-05', name: 'Correction: "Όχι, βάλε θέση CTO"',
    userMessage: 'Βάλε του θέση CTO',
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const position = String(d.position ?? '');
      return [
        { label: 'position updated via context', passed: position.toUpperCase().includes('CTO'), expected: 'CTO', actual: position },
      ];
    },
  },

  // ── "Τι του λείπει;" → completeness check ──────────────────────────
  {
    id: 'X-06', name: '"Τι του λείπει;" → completeness check',
    userMessage: 'Τι στοιχεία του λείπουν;',
    assertions: async (ctx) => {
      // AI should check fields and report missing ones
      const hasRead = ctx.toolCalls.some((tc) =>
        tc.name === 'search_text' || tc.name === 'firestore_get_document' || tc.name === 'firestore_query'
      );
      const mentionsFields = ctx.aiResponse.includes('λείπ') || ctx.aiResponse.includes('δεν έχ')
        || ctx.aiResponse.includes('κενό') || ctx.aiResponse.includes('ελλιπ')
        || ctx.aiResponse.includes('στοιχεί') || ctx.aiResponse.includes('πλήρ')
        || ctx.aiResponse.includes('συμπληρ');
      return [
        { label: 'reads contact data', passed: hasRead, expected: 'query/get', actual: ctx.toolCalls.map((t) => t.name).join(', ') },
        { label: 'reports completeness', passed: !!mentionsFields, expected: 'mentions missing fields', actual: ctx.aiResponse.substring(0, 120) },
      ];
    },
  },

  // ── Switch context: "πάμε στη Μαρία" ───────────────────────────────
  {
    id: 'X-07', name: 'Context switch: "πάμε στη Μαρία Τεστίδου"',
    userMessage: 'Πάμε στη Μαρία Τεστίδου. Βάλε της εργοδότη Eurobank',
    assertions: async (ctx) => {
      // AI should switch to second contact and update
      const id2 = ctx.state.secondContactId as string;
      if (!id2) return [{ label: 'secondContactId', passed: false, expected: 'exists', actual: 'null' }];
      const snap = await db.collection('contacts').doc(id2).get();
      if (!snap.exists) return [{ label: 'Contact 2', passed: false, expected: 'exists', actual: 'null' }];
      const d = snap.data() as Record<string, unknown>;
      const employerSet = String(d.employer ?? '').toLowerCase().includes('eurobank');
      return [
        { label: 'context switched to Μαρία', passed: employerSet, expected: 'Eurobank', actual: String(d.employer ?? 'empty') },
      ];
    },
  },

  // ── Switch back: "πίσω στον Δημήτριο" ──────────────────────────────
  {
    id: 'X-08', name: 'Context switch back: "πίσω στον Δημήτριο"',
    userMessage: `Πίσω στον ${FIRST}. Ποιο είναι το ΑΦΜ του;`,
    assertions: async (ctx) => {
      // AI should switch back and answer about Δημήτριος's AFM
      const mentionsAfm = ctx.aiResponse.includes('ΑΦΜ') || ctx.aiResponse.includes('AFM')
        || ctx.aiResponse.match(/\d{9}/);
      const mentionsDimitrios = ctx.aiResponse.includes(FIRST) || ctx.aiResponse.includes('Τεστίδ');
      return [
        { label: 'mentions AFM value', passed: !!mentionsAfm, expected: 'AFM in response', actual: ctx.aiResponse.substring(0, 120) },
        { label: 'context is Δημήτριος', passed: !!mentionsDimitrios || !!mentionsAfm, expected: 'references Δημήτριος', actual: ctx.aiResponse.substring(0, 80) },
      ];
    },
  },
];
