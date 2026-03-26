/**
 * PHASE 3: DELETE — Διαγραφή/Εκκαθάριση πεδίων
 *
 * Google Test Matrix: Κάθε πεδίο που υποστηρίζει clear → σβήνεται.
 * Ελέγχει ότι η τιμή γίνεται empty/null.
 *
 * Υποστηρίζεται:
 * - Scalar fields → clear via update_contact_field(value="")
 * - Bank accounts → delete via manage_bank_account(operation="delete")
 * - Relationships → remove via manage_relationship(operation="remove")
 * - Activities → remove via manage_activities(operation="remove")
 * - ΔΕΝ υποστηρίζεται: delete phone/email/address/website/social (append-only)
 */

import {
  db,
  assertEmpty,
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

export const deleteTests: QATestCase[] = [
  // ── Scalar field clears ───────────────────────────────────────────
  {
    id: 'D-01', name: 'Σβήσε μητρώνυμο',
    userMessage: `Σβήσε το μητρώνυμο του ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [assertEmpty('motherName cleared', d.motherName)];
    },
  },
  {
    id: 'D-02', name: 'Σβήσε ΑΜΚΑ',
    userMessage: `Σβήσε το ΑΜΚΑ του ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [assertEmpty('amka cleared', d.amka)];
    },
  },
  {
    id: 'D-03', name: 'Σβήσε θέση',
    userMessage: `Σβήσε τη θέση εργασίας του ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [assertEmpty('position cleared', d.position)];
    },
  },
  {
    id: 'D-04', name: 'Σβήσε εργοδότη',
    userMessage: `Σβήσε τον εργοδότη του ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [assertEmpty('employer cleared', d.employer)];
    },
  },
  {
    id: 'D-05', name: 'Σβήσε ΑΦΜ',
    userMessage: `Σβήσε το ΑΦΜ του ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [assertEmpty('vatNumber cleared', d.vatNumber)];
    },
  },

  // ── Bank account delete ───────────────────────────────────────────
  {
    id: 'D-06', name: 'Διαγραφή IBAN',
    userMessage: `Διέγραψε το IBAN GR1601101250000000012300695 του ${FIRST}`,
    assertions: async (ctx) => {
      const id = ctx.state.contactId as string;
      if (!id) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const snap = await db.collection('contacts').doc(id).collection('bankAccounts').get();
      const hasGR16 = snap.docs.some((doc) => {
        const iban = String(doc.data().iban ?? '');
        return iban.includes('GR160110125000000001230069');
      });
      return [
        { label: 'GR16 IBAN removed', passed: !hasGR16, expected: 'not found', actual: hasGR16 ? 'still exists' : 'removed' },
      ];
    },
  },

  // ── KAD activity remove ───────────────────────────────────────────
  {
    id: 'D-07', name: 'Αφαίρεση ΚΑΔ',
    userMessage: `Αφαίρεσε τον ΚΑΔ 41.20 από τον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const acts = d.activities as Array<{ code: string }> | undefined;
      const has4120 = acts?.some((a) => a.code?.includes('41.20'));
      return [
        { label: 'KAD 41.20 removed', passed: !has4120, expected: 'not found', actual: has4120 ? 'still exists' : 'removed' },
      ];
    },
  },

  // ── Relationship remove ───────────────────────────────────────────
  {
    id: 'D-08', name: 'Αφαίρεση σχέσης σύζυγος',
    userMessage: `Αφαίρεσε τη σχέση σύζυγος μεταξύ ${FULL} και Μαρίας Τεστίδου`,
    assertions: async (ctx) => {
      const snap = await db.collection('contact_relationships')
        .where('type', '==', 'spouse')
        .where('status', '==', 'active')
        .limit(5).get();
      const ids = [ctx.state.contactId as string, ctx.state.secondContactId as string];
      const activeSpouse = snap.docs.some((doc) => {
        const d = doc.data();
        return ids.includes(String(d.sourceContactId ?? '')) || ids.includes(String(d.targetContactId ?? ''));
      });
      return [
        { label: 'spouse relationship removed', passed: !activeSpouse, expected: 'inactive/removed', actual: activeSpouse ? 'still active' : 'removed' },
      ];
    },
  },

  // ── Verify non-deletable (phones = append-only) ───────────────────
  {
    id: 'D-09', name: 'Phones → append-only (graceful decline)',
    userMessage: `Σβήσε το τηλέφωνο 6974050026 του ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const phones = d.phones as Array<{ number: string }> | undefined;
      // Phone should still exist — AI should decline or not have a tool
      const stillExists = phones?.some((p) => p.number?.includes('6974050026'));
      return [
        { label: 'phone still exists (append-only)', passed: !!stillExists, expected: 'phone preserved', actual: stillExists ? 'preserved' : 'DELETED (bug!)' },
      ];
    },
  },
];
