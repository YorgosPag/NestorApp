/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ ADR-916 Φ-Ε1 Σ2** — οι πόρτες πρόσβασης του κατόχου στον φάκελό του.
 * @related app/api/property-dossiers/[dossierId]/access/** · _shared/access-door.ts ·
 *          services/property-dossier/dossier-access-host.service.ts
 *
 * Εκτελεί τις **πραγματικές** πόρτες → σχήμα → υπηρεσία → μηχανή πρόσκλησης / ΕΝΑΝ γραφέα, πάνω σε ψεύτικη Firestore.
 * Μοκάρονται μόνο: η ταυτότητα (ο αιτών είναι πάντα `OWNER`), το όριο ρυθμού, η αποστολή email και το ίχνος.
 *
 * - **Θ** οι θέσεις: μία ανά ρόλο· ξένος/άκυρος ⇒ 404 · η κρίση έρχεται από τον κριτή (ληγμένη-ενεργή ⇒ όχι `engaged`).
 * - **Π** πρόσκληση: 201 + έγγραφο της ΜΙΑΣ μηχανής · ξένος ⇒ 404 χωρίς εγγραφή · `.strict()`/κενό εύρος ⇒ 400 ·
 *   αρχειοθετημένος ⇒ 409 · ζωντανή θέση (και ληγμένη-ενεργή) ⇒ 409 `SLOT_OCCUPIED`.
 * - **Α** ακύρωση πρόσκλησης: ιδεμποτής · πρόσκληση άλλου φακέλου ⇒ 404.
 * - **Σ** πράξη σε συμμετοχή: revoke · renew · reach μέσω του ΕΝΟΣ γραφέα · ανανέωση ανακλημένης ⇒ 409 · ξένος ⇒ 404.
 * - **Σ4 (όψη)** Θ3: η ανάγνωση φέρνει τα αρχεία με την καρτέλα του ΕΝΟΣ κριτή · Ε1: κάθε πράξη ειδοποιεί τον
 *   επαγγελματία (και το «noop» δεν ειδοποιεί).
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | `readOwnedDossier` χωρίς κρίση κατοχής | Θ1 · Π2 · Σ5 |
 * | χωρίς προέλεγχο ζωντανής θέσης | Π5 |
 * | `.strict()` / `grantingReachSchema` αφαιρείται | Π3 |
 * | `revokeDossierInvitation` χωρίς έλεγχο φακέλου | Α2 |
| `readDossierAccessView` χωρίς `files` | Θ3 |
| `changeDossierEngagement` χωρίς `announceDossierAccessChanged` | Ε1 |
 */

jest.mock('server-only', () => ({}));

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { Firestore } from 'firebase-admin/firestore';

const fake = new FakeFirestore();
const OWNER = 'u_owner';
const STRANGER = 'u_stranger';

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));

jest.mock('next/server', () => {
  class MockNextResponse {
    readonly status: number;
    private readonly body: unknown;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    async json(): Promise<unknown> { return this.body; }
    static json(body: unknown, init?: { status?: number }): MockNextResponse {
      return new MockNextResponse(body, init);
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(h: T) => h,
  withSensitiveRateLimit: <T>(h: T) => h,
}));

jest.mock('@/lib/auth/personal-scope-middleware', () => ({
  withPersonalOrOrgAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, context: unknown) =>
      callback(request, { scope: 'personal', ctx: { uid: OWNER, email: 'owner@example.gr' } }, context),
}));

/** Το `displayName` του προφίλ του κατόχου — `null` = προφίλ χωρίς όνομα (η ανώνυμη φράση). */
const mockOwnerName = jest.fn(async (_uid: string): Promise<string | null> => null);
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') },
  resolveUserDisplayName: (uid: string) => mockOwnerName(uid),
}));

interface DispatchedNotice { recipientId: string; titleKey: string; titleParams?: Record<string, string> }
const mockDispatch = jest.fn(async (_request: DispatchedNotice) => ({ ok: true }));
jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: (request: DispatchedNotice) => mockDispatch(request),
}));

const sentTokens: string[] = [];
jest.mock('@/server/engagement-invitations/engagement-invitation-notice', () => ({
  notifyEngagementInvitation: jest.fn(async (_db: unknown, issued: { token: string }) => {
    sentTokens.push(issued.token);
    return 'accepted';
  }),
}));

import { activeDossierByInvitation } from '@/lib/auth/engagement-dossier-plan';
import { dossierEngagementsCollection } from '@/lib/auth/engagement-ref';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import type { DossierEngagement, DossierEngagementRole } from '@/types/engagement';
import { personalWorkspace } from '@/types/workspace-membership';

process.env.ENGAGEMENT_INVITE_SECRET ??= 'δοκιμαστικό-μυστικό-πρόσκλησης-φακέλου';

const { GET: slotsRoute } = require('../[dossierId]/access/route') as typeof import('../[dossierId]/access/route');
const { POST: inviteRoute } = require('../[dossierId]/access/invitations/route') as
  typeof import('../[dossierId]/access/invitations/route');
const { POST: cancelRoute } = require('../[dossierId]/access/invitations/[invitationId]/revoke/route') as
  typeof import('../[dossierId]/access/invitations/[invitationId]/revoke/route');
const { POST: changeRoute } = require('../[dossierId]/access/[engagementId]/route') as
  typeof import('../[dossierId]/access/[engagementId]/route');

type Reply = { status: number; json: () => Promise<Record<string, unknown>> };
type Slot = { role: string; engagement: Record<string, unknown> | null; invitation: Record<string, unknown> | null };
type Door = (request: unknown, context: unknown) => Promise<Reply>;

const db = () => fake as unknown as Firestore;
const DAY = 24 * 60 * 60 * 1000;
const INVITE = { email: 'lawyer@example.gr', role: 'owner_lawyer', reach: { tabs: ['documents'], excludedFileIds: [] }, shareDays: 30 };

function call(door: unknown, params: Record<string, string>, body: unknown = null): Promise<Reply> {
  return (door as Door)({ json: async () => body }, { params: Promise.resolve(params) });
}

async function slotsOf(reply: Reply): Promise<readonly Slot[]> {
  return (await reply.json()).slots as readonly Slot[];
}

function seedDossier(userId: string, lifecycle: 'active' | 'archived' = 'active'): string {
  const id = enterpriseIdService.generatePropertyDossierId();
  fake.seed(COLLECTIONS.PROPERTY_DOSSIERS, id, {
    id, userId, label: 'Οικόπεδο Πεύκων', type: 'apartment', lifecycle,
    createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
  });
  return id;
}

/** Συμμετοχή από τον **πραγματικό** σχεδιαστή της αποδοχής — ποτέ χειρόγραφο έγγραφο. */
async function seedEngagement(dossierId: string, role: DossierEngagementRole, acceptedAtMs = Date.now()): Promise<DossierEngagement> {
  const engagement = activeDossierByInvitation({
    subject: { kind: 'property_dossier', dossierId }, role, uid: 'u_pro', email: 'pro@example.gr',
    invitationId: 'einv_seed', actingFor: personalWorkspace('u_pro'),
    declaredCredential: { authority: 'notary-association', number: '4321', chapter: 'Αθηνών', assurance: 'declared', declaredAt: new Date(acceptedAtMs).toISOString() },
    reach: { tabs: ['documents', 'floorplan'], excludedFileIds: [] }, shareDays: 7, offeredBy: OWNER, nowMs: acceptedAtMs,
  });
  await dossierEngagementsCollection(db(), dossierId).doc(engagement.id).set(engagement);
  return engagement;
}

async function storedEngagement(dossierId: string, engagementId: string): Promise<DossierEngagement> {
  return (await dossierEngagementsCollection(db(), dossierId).doc(engagementId).get()).data() as DossierEngagement;
}

describe('ADR-916 Φ-Ε1 Σ2 — οι θέσεις του φακέλου', () => {
  it('Θ1 — ξένος ή άκυρη ταυτότητα ⇒ 404, ίδια απάντηση', async () => {
    expect((await call(slotsRoute, { dossierId: seedDossier(STRANGER) })).status).toBe(404);
    expect((await call(slotsRoute, { dossierId: 'not-a-dossier' })).status).toBe(404);
  });

  it('Θ2 — μία θέση ανά ρόλο· η ληγμένη-ενεργή ΔΕΝ κρίνεται «engaged» (ο κριτής, όχι το πεδίο)', async () => {
    const dossierId = seedDossier(OWNER);
    await seedEngagement(dossierId, 'notary', Date.now() - 30 * DAY);
    const slots = await slotsOf(await call(slotsRoute, { dossierId }));
    expect(slots.map((slot) => slot.role)).toEqual(['owner_lawyer', 'notary']);
    const notary = slots.find((slot) => slot.role === 'notary')?.engagement;
    expect(notary?.state).toBe('active');
    expect(notary?.verdict).not.toBe('engaged');
    expect(notary).not.toHaveProperty('uid');
  });

  it('Θ3 — η ανάγνωση φέρνει τα αρχεία του φακέλου με την καρτέλα τους (ο κριτής της πόρτας)· ξένο αρχείο λείπει', async () => {
    const dossierId = seedDossier(OWNER);
    const deed = {
      userId: OWNER, entityType: 'property_dossier', entityId: dossierId, status: 'ready', isDeleted: false,
      domain: 'admin', category: 'documents', purpose: 'study-title-deed', contentType: 'application/pdf', displayName: 'Τίτλος.pdf',
      createdAt: '2026-10-01T00:00:00.000Z',
    };
    fake.seed(COLLECTIONS.FILES_PERSONAL, 'file_deed', deed);
    fake.seed(COLLECTIONS.FILES_PERSONAL, 'file_foreign', { ...deed, userId: STRANGER });
    const files = (await (await call(slotsRoute, { dossierId })).json()).files as readonly { fileId: string; tab: string }[];
    expect(files.map((file) => [file.fileId, file.tab])).toEqual([['file_deed', 'documents']]);
  });
});

describe('ADR-916 Φ-Ε1 Σ2 — η πρόσκληση', () => {
  it('Π1 — ο κάτοχος καλεί ⇒ 201 + πρόσκληση της ΜΙΑΣ μηχανής, email σταλμένο', async () => {
    const dossierId = seedDossier(OWNER);
    const before = sentTokens.length;
    const reply = await call(inviteRoute, { dossierId }, INVITE);
    expect(reply.status).toBe(201);
    expect((await reply.json()).invited).toBe('accepted');
    expect(sentTokens.length).toBe(before + 1);
    const lawyer = (await slotsOf(reply)).find((slot) => slot.role === 'owner_lawyer');
    expect(lawyer?.invitation?.state).toBe('pending');
    const stored = fake.all<Record<string, unknown>>(COLLECTIONS.ENGAGEMENT_INVITATIONS)
      .find((doc) => (doc.subject as { dossierId?: string }).dossierId === dossierId);
    expect(stored?.invitedByUid).toBe(OWNER);
  });

  it('Π2 — ξένος φάκελος ⇒ 404 και ΚΑΜΙΑ εγγραφή', async () => {
    const dossierId = seedDossier(STRANGER);
    const writes = fake.writes;
    expect((await call(inviteRoute, { dossierId }, INVITE)).status).toBe(404);
    expect(fake.writes).toBe(writes);
  });

  it('Π3 — `.strict()` · καμία καρτέλα · ημέρες εκτός μενού ⇒ 400', async () => {
    const dossierId = seedDossier(OWNER);
    expect((await call(inviteRoute, { dossierId }, { ...INVITE, userId: STRANGER })).status).toBe(400);
    expect((await call(inviteRoute, { dossierId }, { ...INVITE, reach: { tabs: [], excludedFileIds: [] } })).status).toBe(400);
    expect((await call(inviteRoute, { dossierId }, { ...INVITE, shareDays: 14 })).status).toBe(400);
  });

  it('Π4 — αρχειοθετημένος φάκελος ⇒ 409 DOSSIER_ARCHIVED', async () => {
    const reply = await call(inviteRoute, { dossierId: seedDossier(OWNER, 'archived') }, INVITE);
    expect(reply.status).toBe(409);
    expect((await reply.json()).error).toBe('DOSSIER_ARCHIVED');
  });

  it('Π5 — ζωντανή θέση (και ληγμένη-ενεργή) ⇒ 409 SLOT_OCCUPIED· ο άλλος ρόλος μένει ελεύθερος', async () => {
    const dossierId = seedDossier(OWNER);
    await seedEngagement(dossierId, 'owner_lawyer', Date.now() - 30 * DAY);
    const occupied = await call(inviteRoute, { dossierId }, INVITE);
    expect(occupied.status).toBe(409);
    expect((await occupied.json()).error).toBe('SLOT_OCCUPIED');
    expect((await call(inviteRoute, { dossierId }, { ...INVITE, role: 'notary' })).status).toBe(201);
  });
});

describe('ADR-916 Φ-Ε1 Σ2 — η ακύρωση πρόσκλησης', () => {
  async function invitedId(dossierId: string): Promise<string> {
    const slots = await slotsOf(await call(inviteRoute, { dossierId }, INVITE));
    return String(slots.find((slot) => slot.role === 'owner_lawyer')?.invitation?.invitationId);
  }

  it('Α1 — ακύρωση ⇒ revoked· δεύτερη φορά ⇒ 200 χωρίς εγγραφή (ιδεμποτής)', async () => {
    const dossierId = seedDossier(OWNER);
    const invitationId = await invitedId(dossierId);
    const first = await call(cancelRoute, { dossierId, invitationId });
    expect(first.status).toBe(200);
    expect((await slotsOf(first)).find((slot) => slot.role === 'owner_lawyer')?.invitation?.state).toBe('revoked');
    const writes = fake.writes;
    expect((await call(cancelRoute, { dossierId, invitationId })).status).toBe(200);
    expect(fake.writes).toBe(writes);
  });

  it('Α2 — πρόσκληση ΑΛΛΟΥ φακέλου του ίδιου κατόχου ⇒ 404, μένει pending', async () => {
    const [mine, other] = [seedDossier(OWNER), seedDossier(OWNER)];
    const invitationId = await invitedId(other);
    expect((await call(cancelRoute, { dossierId: mine, invitationId })).status).toBe(404);
    expect(fake.getData(COLLECTIONS.ENGAGEMENT_INVITATIONS, invitationId)?.state).toBe('pending');
  });
});

describe('ADR-916 Φ-Ε1 Σ2 — πράξεις σε συμμετοχή (ο ΕΝΑΣ γραφέας)', () => {
  it('Σ1 — renew ⇒ νέα λήξη από σήμερα, από το μενού', async () => {
    const dossierId = seedDossier(OWNER);
    const engagement = await seedEngagement(dossierId, 'notary', Date.now() - 6 * DAY);
    const reply = await call(changeRoute, { dossierId, engagementId: engagement.id }, { action: 'renew', shareDays: 90 });
    expect(reply.status).toBe(200);
    const after = await storedEngagement(dossierId, engagement.id);
    expect(after.shareDays).toBe(90);
    expect(Date.parse(after.expiresAt)).toBeGreaterThan(Date.now() + 89 * DAY);
  });

  it('Σ2 — reach ⇒ νέες καρτέλες/εξαιρέσεις', async () => {
    const dossierId = seedDossier(OWNER);
    const engagement = await seedEngagement(dossierId, 'notary');
    const reach = { tabs: ['documents'], excludedFileIds: ['file_1'] };
    expect((await call(changeRoute, { dossierId, engagementId: engagement.id }, { action: 'reach', reach })).status).toBe(200);
    expect((await storedEngagement(dossierId, engagement.id)).reach).toEqual(reach);
  });

  it('Σ3 — revoke ⇒ revoked· μετά renew ⇒ 409 NOT_ALLOWED (ποτέ ανάσταση)', async () => {
    const dossierId = seedDossier(OWNER);
    const engagement = await seedEngagement(dossierId, 'notary');
    expect((await call(changeRoute, { dossierId, engagementId: engagement.id }, { action: 'revoke' })).status).toBe(200);
    expect((await storedEngagement(dossierId, engagement.id)).state).toBe('revoked');
    const renew = await call(changeRoute, { dossierId, engagementId: engagement.id }, { action: 'renew', shareDays: 30 });
    expect(renew.status).toBe(409);
    expect((await renew.json()).error).toBe('NOT_ALLOWED');
  });

  it('Σ4 — συμμετοχή ΑΛΛΟΥ φακέλου ⇒ 404 και μένει ανέγγιχτη', async () => {
    const [mine, other] = [seedDossier(OWNER), seedDossier(OWNER)];
    const engagement = await seedEngagement(other, 'notary');
    expect((await call(changeRoute, { dossierId: mine, engagementId: engagement.id }, { action: 'revoke' })).status).toBe(404);
    expect((await storedEngagement(other, engagement.id)).state).toBe('active');
  });

  it('Ε1 — revoke · renew · reach ⇒ ο επαγγελματίας ειδοποιείται με το κλειδί της πράξης· noop ⇒ καμία ειδοποίηση', async () => {
    const dossierId = seedDossier(OWNER);
    const engagement = await seedEngagement(dossierId, 'notary');
    mockDispatch.mockClear();
    await call(changeRoute, { dossierId, engagementId: engagement.id }, { action: 'renew', shareDays: 90 });
    await call(changeRoute, { dossierId, engagementId: engagement.id }, { action: 'reach', reach: { tabs: ['documents'], excludedFileIds: [] } });
    await call(changeRoute, { dossierId, engagementId: engagement.id }, { action: 'reach', reach: { tabs: ['documents'], excludedFileIds: [] } });
    await call(changeRoute, { dossierId, engagementId: engagement.id }, { action: 'revoke' });
    expect(mockDispatch.mock.calls.map(([request]) => [request.recipientId, request.titleKey])).toEqual([
      ['u_pro', 'caseEngagementChanged.dossier.renewedTitle'],
      ['u_pro', 'caseEngagementChanged.dossier.reachTitle'],
      ['u_pro', 'caseEngagementChanged.dossier.revokedTitle'],
    ]);
  });

  it('Ε2 — κάτοχος με όνομα ⇒ `…dossier.named.*` με `{host}` = το όνομα του ΚΑΤΟΧΟΥ (ποτέ email)', async () => {
    const dossierId = seedDossier(OWNER);
    const engagement = await seedEngagement(dossierId, 'owner_lawyer');
    mockOwnerName.mockImplementation(async (uid) => (uid === OWNER ? 'Γιώργος Παγώνης' : null));
    mockDispatch.mockClear();
    try {
      await call(changeRoute, { dossierId, engagementId: engagement.id }, { action: 'renew', shareDays: 90 });
      await call(changeRoute, { dossierId, engagementId: engagement.id }, { action: 'revoke' });
    } finally {
      mockOwnerName.mockImplementation(async () => null);
    }
    expect(mockDispatch.mock.calls.map(([request]) => [request.titleKey, request.titleParams?.host])).toEqual([
      ['caseEngagementChanged.dossier.named.renewedTitle', 'Γιώργος Παγώνης'],
      ['caseEngagementChanged.dossier.named.revokedTitle', 'Γιώργος Παγώνης'],
    ]);
    expect(mockDispatch.mock.calls.every(([request]) => !String(request.titleParams?.host).includes('@'))).toBe(true);
  });

  it('Σ5 — ξένος φάκελος ⇒ 404 · άγνωστη πράξη ή ξένο πεδίο ⇒ 400', async () => {
    const foreign = seedDossier(STRANGER);
    const engagement = await seedEngagement(foreign, 'notary');
    expect((await call(changeRoute, { dossierId: foreign, engagementId: engagement.id }, { action: 'revoke' })).status).toBe(404);
    expect((await storedEngagement(foreign, engagement.id)).state).toBe('active');
    const dossierId = seedDossier(OWNER);
    const own = await seedEngagement(dossierId, 'notary');
    expect((await call(changeRoute, { dossierId, engagementId: own.id }, { action: 'extend' })).status).toBe(400);
    expect((await call(changeRoute, { dossierId, engagementId: own.id }, { action: 'revoke', byUid: STRANGER })).status).toBe(400);
  });
});
