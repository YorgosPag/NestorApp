/**
 * ADR-327 §7.5 — ο ΕΝΑΣ builder του μηνύματος πρόσκλησης (Ε2 · Ε3), για τις τέσσερις διαδρομές αποστολής.
 */

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => { throw new Error('admin unavailable'); },
}));

import { COLLECTIONS } from '@/config/firestore-collections';
import { buildVendorInviteMessage, greetingName, type VendorInviteMessageInput } from '../vendor-invite-message';

function fakeDb(docs: Record<string, Record<string, unknown>>) {
  const reads: string[] = [];
  return {
    reads,
    db: {
      collection: (path: string) => ({
        doc: (id: string) => ({
          get: async () => {
            reads.push(`${path}/${id}`);
            return { exists: docs[id] !== undefined, data: () => docs[id] };
          },
        }),
      }),
    },
  };
}

const LINK = { portalUrl: 'https://app.test/q#t', declineUrl: 'https://app.test/d#t', expiresAtIso: '2026-11-20T21:59:59.999Z' };

function input(overrides: Partial<VendorInviteMessageInput> = {}): VendorInviteMessageInput {
  return {
    companyId: 'co1',
    inviteId: 'vi_1',
    rfq: { title: 'Καλώδια', projectId: 'prj_1', deadlineDate: null },
    to: 'vendor@example.test',
    recipientName: 'Ηλεκτρική Α.Ε.',
    link: LINK,
    buyerNote: null,
    locale: 'el',
    ...overrides,
  };
}

describe('greetingName (Ε3)', () => {
  it.each([
    [null, null],
    [undefined, null],
    ['', null],
    ['   ', null],
    ['info@vendor.gr', null],
    ['Γιώργος <g@vendor.gr>', null],
    ['  Ηλεκτρική Α.Ε. ', 'Ηλεκτρική Α.Ε.'],
  ])('%p ⇒ %p', (raw, expected) => {
    expect(greetingName(raw)).toBe(expected);
  });
});

describe('buildVendorInviteMessage (Ε2)', () => {
  it('reads the project name of the SAME company from the projects collection', async () => {
    const { db, reads } = fakeDb({ prj_1: { companyId: 'co1', name: 'Πολυκατοικία Λάρισας' } });
    const message = await buildVendorInviteMessage(input({ db }));
    expect(message.projectName).toBe('Πολυκατοικία Λάρισας');
    expect(message.rfqTitle).toBe('Καλώδια');
    expect(reads).toEqual([`${COLLECTIONS.PROJECTS}/prj_1`]);
  });

  it('a project of another company, an unnamed one, or none ⇒ no project line (never «Unknown»)', async () => {
    const foreign = fakeDb({ prj_1: { companyId: 'co2', name: 'Ξένο' } }).db;
    const unnamed = fakeDb({ prj_1: { companyId: 'co1' } }).db;
    expect((await buildVendorInviteMessage(input({ db: foreign }))).projectName).toBeNull();
    expect((await buildVendorInviteMessage(input({ db: unnamed }))).projectName).toBeNull();
    expect((await buildVendorInviteMessage(input({ db: unnamed, rfq: { title: 'Κ', projectId: '', deadlineDate: null } }))).projectName).toBeNull();
  });

  it('a failing project read never stops the delivery — the message goes out without the project', async () => {
    await expect(buildVendorInviteMessage(input())).resolves.toMatchObject({ projectName: null, rfqTitle: 'Καλώδια' });
  });

  it('carries the greeting name, the trimmed note, the RFQ deadline and the link', async () => {
    const { db } = fakeDb({});
    const deadline = { toMillis: () => Date.parse('2026-11-18T10:00:00.000Z') } as unknown as NonNullable<VendorInviteMessageInput['rfq']['deadlineDate']>;
    const message = await buildVendorInviteMessage(input({
      db, recipientName: 'info@vendor.gr', buyerNote: '  Δείτε τα σχέδια.  ', rfq: { title: 'Κ', projectId: 'prj_x', deadlineDate: deadline },
    }));
    expect(message).toMatchObject({
      vendorName: null, buyerNote: 'Δείτε τα σχέδια.', responseDueAt: '2026-11-18T10:00:00.000Z',
      portalUrl: LINK.portalUrl, declineUrl: LINK.declineUrl, expiresAt: LINK.expiresAtIso, recipient: 'vendor@example.test',
    });
  });

  it('a blank note is no note', async () => {
    const { db } = fakeDb({});
    expect((await buildVendorInviteMessage(input({ db, buyerNote: '   ' }))).buyerNote).toBeNull();
  });
});
