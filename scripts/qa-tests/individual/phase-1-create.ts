/**
 * PHASE 1: CREATE — Δημιουργία + αρχική συμπλήρωση ΟΛΩΝ των πεδίων (ένα-ένα)
 *
 * Google Test Matrix: Happy path — κάθε πεδίο γράφεται για πρώτη φορά.
 * Ελέγχει ότι κάθε tool γράφει σωστά στο Firestore.
 */

import {
  db,
  findContactByName,
  assertField,
  assertExists,
  assertArrayLength,
  type QATestCase,
} from '../qa-test-runner';

const FIRST = 'Δημήτριος';
const LAST = 'Τεστίδης';
const FULL = `${FIRST} ${LAST}`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getContact(ctx: { state: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
  const id = ctx.state.contactId as string | undefined;
  if (!id) return null;
  const snap = await db.collection('contacts').doc(id).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}

export const createTests: QATestCase[] = [
  // ── Δημιουργία ────────────────────────────────────────────────────
  {
    id: 'C-01', name: 'Δημιουργία επαφής',
    userMessage: `Δημιούργησε νέα επαφή: ${FULL}`,
    assertions: async (ctx) => {
      await sleep(1000);
      const contactId = await findContactByName(FIRST, LAST);
      ctx.state.contactId = contactId;
      if (!contactId) return [{ label: 'Contact created', passed: false, expected: 'exists', actual: 'not found' }];
      const data = (await db.collection('contacts').doc(contactId).get()).data() as Record<string, unknown>;
      return [
        assertExists('contactId', contactId),
        assertField('type', data.type, 'individual'),
        assertField('firstName', data.firstName, FIRST),
        assertField('lastName', data.lastName, LAST),
        assertExists('companyId', data.companyId),
      ];
    },
  },

  // ── Scalar fields (update_contact_field) ──────────────────────────
  {
    id: 'C-02', name: 'Πατρώνυμο + Μητρώνυμο',
    userMessage: `Βάλε πατρώνυμο Αθανάσιος και μητρώνυμο Νικολέτα στον ${FULL}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [assertField('fatherName', d.fatherName, 'Αθανάσιος'), assertField('motherName', d.motherName, 'Νικολέτα')];
    },
  },
  {
    id: 'C-03', name: 'Φύλο + Ημερομηνία γέννησης',
    userMessage: `Ο ${FIRST} είναι άνδρας, γεννήθηκε 15 Μαρτίου 1990`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [assertField('gender', d.gender, 'male'), assertExists('birthDate', d.birthDate)];
    },
  },
  {
    id: 'C-04', name: 'Χώρα γέννησης',
    userMessage: `Ο ${FIRST} γεννήθηκε στην Ελλάδα`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const c = String(d.birthCountry ?? '');
      return [{ label: 'birthCountry', passed: ['GR', 'gr', 'Ελλάδα', 'Greece'].includes(c), expected: 'GR', actual: c }];
    },
  },
  {
    id: 'C-05', name: 'ΑΜΚΑ (11 ψηφία)',
    userMessage: `Βάλε ΑΜΚΑ 15039012345 στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [assertField('amka', d.amka, '15039012345')];
    },
  },
  {
    id: 'C-06', name: 'Ταυτότητα (5 πεδία)',
    userMessage: `Ο ${FIRST} έχει αστυνομική ταυτότητα ΑΚ 582946, Α.Τ. Θεσσαλονίκης, 15/03/2020, λήξη 15/03/2030`,
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
  {
    id: 'C-07', name: 'ΑΦΜ',
    userMessage: `Βάλε ΑΦΜ 123456789 στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [assertField('vatNumber', d.vatNumber, '123456789')];
    },
  },
  {
    id: 'C-08', name: 'ΔΟΥ (lookup)',
    userMessage: `ΔΟΥ Καλαμαριάς για τον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const t = String(d.taxOffice ?? '');
      return [{ label: 'taxOffice 4-digit', passed: /^\d{4}$/.test(t), expected: '4-digit code', actual: t }];
    },
  },
  {
    id: 'C-09', name: 'Εργοδότης + Θέση',
    userMessage: `Ο ${FIRST} δουλεύει ως Senior Engineer στην ΑΕΔΑΚ ΑΕ`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [assertExists('employer', d.employer), assertExists('position', d.position)];
    },
  },

  // ── ESCO (set_contact_esco) ───────────────────────────────────────
  {
    id: 'C-10', name: 'Επάγγελμα ESCO (unambiguous)',
    userMessage: `Ο ${FIRST} είναι αρχιτέκτονας τοπίου`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [assertExists('escoUri', d.escoUri), assertExists('escoLabel', d.escoLabel)];
    },
  },
  {
    id: 'C-11', name: 'Δεξιότητα ESCO',
    userMessage: `Πρόσθεσε δεξιότητα "project management" στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      return [assertArrayLength('escoSkills', d.escoSkills as unknown[] | undefined, 1)];
    },
  },

  // ── Array fields (append_contact_info) ────────────────────────────
  {
    id: 'C-12', name: 'Κινητό τηλέφωνο',
    userMessage: `Πρόσθεσε κινητό 6974050026 στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const phones = d.phones as Array<{ number: string }> | undefined;
      return [
        assertArrayLength('phones', phones, 1),
        { label: 'phone number', passed: !!phones?.some((p) => p.number?.includes('6974050026')), expected: '6974050026', actual: JSON.stringify(phones?.[0]) },
      ];
    },
  },
  {
    id: 'C-13', name: 'Σταθερό τηλέφωνο',
    userMessage: `Πρόσθεσε σταθερό 2310123456 στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const phones = d.phones as Array<{ number: string }> | undefined;
      return [
        assertArrayLength('phones 2+', phones, 2),
        { label: 'landline', passed: !!phones?.some((p) => p.number?.includes('2310123456')), expected: '2310123456', actual: String(phones?.length) },
      ];
    },
  },
  {
    id: 'C-14', name: 'Email',
    userMessage: `Πρόσθεσε email dimitrios@example.com στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const emails = d.emails as Array<{ email: string }> | undefined;
      return [
        assertArrayLength('emails', emails, 1),
        { label: 'email', passed: !!emails?.some((e) => e.email === 'dimitrios@example.com'), expected: 'dimitrios@example.com', actual: JSON.stringify(emails?.[0]) },
      ];
    },
  },
  {
    id: 'C-15', name: 'Διεύθυνση (structured)',
    userMessage: `Βάλε διεύθυνση Τσιμισκή 42, Θεσσαλονίκη 54623 στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const addr = (d.addresses as Array<Record<string, unknown>> | undefined)?.[0];
      return [
        assertExists('address exists', addr),
        assertExists('street', addr?.street),
        assertExists('city', addr?.city),
        assertExists('postalCode', addr?.postalCode),
      ];
    },
  },
  {
    id: 'C-16', name: 'Ιστοσελίδα',
    userMessage: `Πρόσθεσε ιστοσελίδα www.testidis.gr στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const w = d.websites as Array<Record<string, unknown>> | undefined;
      const sm = d.socialMedia as Array<Record<string, unknown>> | undefined;
      const found = (w?.length ?? 0) > 0 || sm?.some((s) => String(s.url ?? s.value ?? '').includes('testidis'));
      return [{ label: 'website stored', passed: !!found, expected: 'testidis.gr', actual: JSON.stringify({ w, sm }) }];
    },
  },
  {
    id: 'C-17', name: 'LinkedIn',
    userMessage: `Πρόσθεσε LinkedIn https://linkedin.com/in/testidis στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const sm = d.socialMedia as Array<Record<string, unknown>> | undefined;
      return [{ label: 'LinkedIn', passed: !!sm?.some((s) => String(s.platform ?? '').toLowerCase() === 'linkedin'), expected: 'linkedin', actual: JSON.stringify(sm) }];
    },
  },
  {
    id: 'C-18', name: 'Facebook',
    userMessage: `Πρόσθεσε Facebook https://facebook.com/testidis στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const sm = d.socialMedia as Array<Record<string, unknown>> | undefined;
      return [{ label: 'Facebook', passed: !!sm?.some((s) => String(s.platform ?? '').toLowerCase() === 'facebook'), expected: 'facebook', actual: JSON.stringify(sm) }];
    },
  },

  // ── Κοινωνικά Δίκτυα (append_contact_info: social) ───────────────
  {
    id: 'C-23', name: 'Instagram',
    userMessage: `Πρόσθεσε Instagram https://instagram.com/testidis στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const sm = d.socialMedia as Array<Record<string, unknown>> | undefined;
      return [{ label: 'Instagram', passed: !!sm?.some((s) => String(s.platform ?? '').toLowerCase() === 'instagram'), expected: 'instagram', actual: JSON.stringify(sm) }];
    },
  },
  {
    id: 'C-24', name: 'Twitter/X',
    userMessage: `Πρόσθεσε Twitter @testidis στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const sm = d.socialMedia as Array<Record<string, unknown>> | undefined;
      return [{ label: 'Twitter', passed: !!sm?.some((s) => String(s.platform ?? '').toLowerCase() === 'twitter'), expected: 'twitter', actual: JSON.stringify(sm) }];
    },
  },
  {
    id: 'C-25', name: 'YouTube',
    userMessage: `Πρόσθεσε YouTube https://youtube.com/@testidis στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const sm = d.socialMedia as Array<Record<string, unknown>> | undefined;
      return [{ label: 'YouTube', passed: !!sm?.some((s) => String(s.platform ?? '').toLowerCase() === 'youtube'), expected: 'youtube', actual: JSON.stringify(sm) }];
    },
  },
  {
    id: 'C-26', name: 'GitHub',
    userMessage: `Πρόσθεσε GitHub https://github.com/testidis στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const sm = d.socialMedia as Array<Record<string, unknown>> | undefined;
      return [{ label: 'GitHub', passed: !!sm?.some((s) => String(s.platform ?? '').toLowerCase() === 'github'), expected: 'github', actual: JSON.stringify(sm) }];
    },
  },
  {
    id: 'C-27', name: 'TikTok (→ other)',
    userMessage: `Πρόσθεσε TikTok @testidis_tiktok στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const sm = d.socialMedia as Array<Record<string, unknown>> | undefined;
      // TikTok maps to 'other' in SOCIAL_PLATFORM_MAP
      const found = sm?.some((s) => {
        const username = String(s.username ?? '').toLowerCase();
        return username.includes('testidis_tiktok') || username.includes('tiktok');
      });
      return [{ label: 'TikTok entry', passed: !!found, expected: 'tiktok entry in socialMedia', actual: JSON.stringify(sm) }];
    },
  },

  // ── Τραπεζικά (manage_bank_account) ───────────────────────────────
  {
    id: 'C-19', name: 'IBAN',
    userMessage: `Πρόσθεσε IBAN GR1601101250000000012300695, Εθνική Τράπεζα στον ${FIRST}`,
    assertions: async (ctx) => {
      const id = ctx.state.contactId as string;
      if (!id) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const snap = await db.collection('contacts').doc(id).collection('bank_accounts').get();
      return [
        { label: 'bankAccounts exists', passed: !snap.empty, expected: '>= 1', actual: `${snap.size}` },
        { label: 'IBAN GR16', passed: snap.docs.some((d) => String(d.data().iban ?? '').includes('GR16')), expected: 'GR16...', actual: snap.empty ? 'empty' : String(snap.docs[0].data().iban) },
      ];
    },
  },

  // ── ΚΑΔ (manage_activities) ───────────────────────────────────────
  {
    id: 'C-20', name: 'ΚΑΔ δραστηριότητα',
    userMessage: `Πρόσθεσε ΚΑΔ 41.20 στον ${FIRST}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const acts = d.activities as Array<{ code: string }> | undefined;
      return [
        assertArrayLength('activities', acts, 1),
        { label: 'KAD 41.20', passed: !!acts?.some((a) => a.code?.includes('41.20')), expected: '41.20', actual: JSON.stringify(acts) },
      ];
    },
  },

  // ── Σχέσεις (manage_relationship) ─────────────────────────────────
  {
    id: 'C-21', name: 'Δημιουργία 2ης επαφής',
    userMessage: 'Δημιούργησε νέα επαφή: Μαρία Τεστίδου',
    assertions: async (ctx) => {
      await sleep(1000);
      const id = await findContactByName('Μαρία', 'Τεστίδου');
      ctx.state.secondContactId = id;
      return [assertExists('2nd contact', id)];
    },
  },
  {
    id: 'C-22', name: 'Σχέση σύζυγος',
    userMessage: `Η Μαρία Τεστίδου είναι σύζυγος του ${FULL}`,
    assertions: async (ctx) => {
      const snap = await db.collection('contact_relationships').where('type', '==', 'spouse').limit(5).get();
      const ids = [ctx.state.contactId as string, ctx.state.secondContactId as string];
      const found = snap.docs.some((doc) => {
        const d = doc.data();
        return ids.includes(String(d.sourceContactId ?? '')) || ids.includes(String(d.targetContactId ?? ''));
      });
      return [{ label: 'spouse relationship', passed: found, expected: 'exists', actual: `${snap.size} rels` }];
    },
  },
];
