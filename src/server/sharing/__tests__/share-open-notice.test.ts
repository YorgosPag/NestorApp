/**
 * @jest-environment node
 */

/**
 * ADR-884 §9.1 Α3′ — «ο αποστολέας μαθαίνει ότι άνοιξε ο σύνδεσμός του» — ΜΟΝΟ στο πρώτο άνοιγμα και από νέα συσκευή.
 *
 * Εκτελείται ο ΠΡΑΓΜΑΤΙΚΟΣ δρόμος `resolvePublicShare` → `noteShareOpened` → `registerShareDevice` πάνω σε ψεύτικο
 * Firestore· μόνο ο αναγγελέας (`announceTourLinkOpened`) είναι κατάσκοπος — ό,τι κρίνεται εδώ είναι **πότε** καλείται.
 */

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/server/spatial-tour/tour-access-notifier', () => ({
  announceTourLinkOpened: jest.fn(async () => undefined),
}));

import { NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { hashShareToken } from '@/lib/sharing/share-token';
import { announceTourLinkOpened } from '@/server/spatial-tour/tour-access-notifier';
import { SHARE_KIND_LINK_POLICY, type ResolvableShareKind } from '@/services/sharing/share-resolve-contract';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import type { ShareEntityType } from '@/types/sharing';

import {
  SHARE_DEVICE_FIELD,
  SHARE_DEVICE_MEMORY,
  attachShareDevice,
  judgeShareDevice,
  shareDeviceCookieName,
} from '../share-device';
import { OPEN_NOTICE_KINDS } from '../share-open-notice';
import { buildShareDocument } from '../share-create';
import { resolvePublicShare } from '../share-resolve';

const TOKEN = 'NewGenerationToken_abcdefghijklmnopqrstuvwxy';
const DEVICE_A = 'DeviceA_abcdefghijklmnopqrstuvwxyz0123456789';
const DEVICE_B = 'DeviceB_abcdefghijklmnopqrstuvwxyz0123456789';
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

const announce = announceTourLinkOpened as jest.MockedFunction<typeof announceTourLinkOpened>;
let kit: MockFirestoreKit;
const db = (): Firestore => kit.instance as unknown as Firestore;
const noGrant = () => false;

/**
 * 🔴 Σπέρνει ό,τι γράφει ο **ΕΝΑΣ γραφέας** (`buildShareDocument`) — ποτέ χειροποίητο σχήμα. Ζωντανή επαλήθευση
 * 2026-09-26 (ADR-884 §4.7 Α3′′): η άγκυρα έσπερνε `note: 'Γιάννης Π.'` ενώ ο γραφέας βάζει το «για ποιον» στο `label`
 * — 12/12 πράσινα, **καμία** ειδοποίηση στην παραγωγή. Με **και** μήνυμα **και** «για ποιον», λάθος πεδίο = κόκκινο.
 */
async function seedShare(entityType: ShareEntityType, extra: Record<string, unknown> = {}): Promise<void> {
  const written = await buildShareDocument({
    entityType, entityId: 'tour_1', companyId: 'comp_1', createdBy: 'usr_sender', expiresInHours: 24,
    label: 'Γιάννης Π.', note: 'Καλησπέρα! Δείτε την περιήγηση πριν το ραντεβού.',
  }, await hashShareToken(TOKEN));
  kit.seedCollection(COLLECTIONS.SHARES, { share_1: { ...written, expiresAt: FUTURE, ...extra } });
  kit.seedCollection(COLLECTIONS.SPATIAL_TOURS, {
    tour_1: { companyId: 'comp_1', subject: { kind: 'company-property', id: 'prop_1' } },
  });
}

/** Ένα άνοιγμα **νέας επίσκεψης** από τη συσκευή `device` (`null` = browser χωρίς cookie συσκευής). */
function open(device: string | null) {
  return resolvePublicShare({ adminDb: db(), token: TOKEN, hasGrant: noGrant, readDevice: () => device });
}

beforeEach(() => {
  kit = createMockFirestore();
  process.env.SHARE_ACCESS_SECRET = 'test-secret-with-enough-entropy-0123456789';
  announce.mockClear();
});

describe('ειδοποίηση ανοίγματος — πότε', () => {
  it('🔴 ΑΓΚΥΡΑ — πρώτο άνοιγμα ⇒ ΜΙΑ ειδοποίηση προς τον αποστολέα, με το «για ποιον» και αύξοντα 1', async () => {
    await seedShare('spatial_tour');

    const { outcome, device } = await open(DEVICE_A);

    expect(outcome.status).toBe('resolved');
    expect(device).toBeNull(); // η συσκευή ήταν ήδη δηλωμένη — κανένα νέο cookie
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce.mock.calls[0][1]).toEqual({
      subject: { kind: 'company-property', id: 'prop_1' },
      shareId: 'share_1',
      senderUid: 'usr_sender',
      who: 'Γιάννης Π.',
      deviceOrdinal: 1,
    });
  });

  it('🔴 ΑΓΚΥΡΑ — ΙΔΙΑ συσκευή, νέα επίσκεψη ⇒ ΚΑΜΙΑ δεύτερη ειδοποίηση (η επαναφόρτωση δεν είναι είδηση)', async () => {
    await seedShare('spatial_tour');

    await open(DEVICE_A);
    await open(DEVICE_A);
    await open(DEVICE_A);

    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('🔴 ΑΓΚΥΡΑ — ΝΕΑ συσκευή ⇒ ειδοποίηση με αύξοντα 2 («από νέα συσκευή»)', async () => {
    await seedShare('spatial_tour');

    await open(DEVICE_A);
    await open(DEVICE_B);

    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce.mock.calls[1][1].deviceOrdinal).toBe(2);
  });

  it('browser χωρίς cookie ⇒ γεννιέται συσκευή, επιστρέφεται για εγγραφή, και μετρά ως πρώτο άνοιγμα', async () => {
    await seedShare('spatial_tour');

    const { device } = await open(null);

    expect(device).toEqual({ shareId: 'share_1', value: expect.any(String), expiresAt: FUTURE });
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('μέσα στην επίσκεψη (κουπόνι) ⇒ ούτε καταγραφή ούτε ειδοποίηση', async () => {
    await seedShare('spatial_tour');

    await resolvePublicShare({ adminDb: db(), token: TOKEN, hasGrant: () => true, readDevice: () => DEVICE_A });

    expect(announce).not.toHaveBeenCalled();
  });

  it('στο όριο μνήμης συσκευών ⇒ σιωπή (ο σύνδεσμος έχει προωθηθεί ευρέως)', async () => {
    const full = Array.from({ length: SHARE_DEVICE_MEMORY }, (_, i) => `hash_${i}`);
    await seedShare('spatial_tour', { [SHARE_DEVICE_FIELD]: full });

    await open(DEVICE_A);

    expect(announce).not.toHaveBeenCalled();
  });

  it('είδος ΧΩΡΙΣ `openNotice` ⇒ κανένα cookie συσκευής, καμία καταγραφή', async () => {
    await seedShare('contact', { entityId: 'tour_1' });
    kit.seedCollection(COLLECTIONS.CONTACTS, { tour_1: { companyId: 'comp_1', firstName: 'Χ' } });

    const { device } = await open(null);

    expect(device).toBeNull();
    expect(announce).not.toHaveBeenCalled();
  });
});

describe('πολιτική ⇔ αναγγελέας', () => {
  it('🔴 ΑΓΚΥΡΑ — κάθε είδος με `openNotice` έχει αναγγελέα, και κάθε αναγγελέας δηλωμένη πολιτική', () => {
    const promised = (Object.keys(SHARE_KIND_LINK_POLICY) as ResolvableShareKind[])
      .filter((kind) => SHARE_KIND_LINK_POLICY[kind].openNotice);

    expect([...OPEN_NOTICE_KINDS].sort()).toEqual(promised.sort());
  });

  it('`openNotice` μόνο σε ονομαστικό σύνδεσμο — αλλιώς η ειδοποίηση δεν λέει ΠΟΙΟΣ', () => {
    for (const policy of Object.values(SHARE_KIND_LINK_POLICY)) {
      if (policy.openNotice) expect(policy.labelRequired).toBe(true);
    }
  });
});

describe('share-device — καθαρή κρίση + cookie', () => {
  it('πρώτο · νέα · γνωστή · κορεσμός', () => {
    expect(judgeShareDevice([], 'h1')).toBe('first-open');
    expect(judgeShareDevice(['h1'], 'h2')).toBe('new-device');
    expect(judgeShareDevice(['h1', 'h2'], 'h1')).toBe('known');
    expect(judgeShareDevice(Array.from({ length: SHARE_DEVICE_MEMORY }, (_, i) => `h${i}`), 'new')).toBe('saturated');
  });

  it('το cookie ζει όσο ο σύνδεσμος, μόνο στο `/api/shares`, HttpOnly', () => {
    const now = Date.parse('2026-09-26T10:00:00Z');
    const response = NextResponse.json({});

    attachShareDevice(response, { shareId: 's1', value: DEVICE_A, expiresAt: '2026-09-27T10:00:00Z' }, now);

    const cookie = response.cookies.get(shareDeviceCookieName('s1'));
    expect(cookie).toMatchObject({ value: DEVICE_A, path: '/api/shares', httpOnly: true, maxAge: 86_400 });
  });

  it('ληγμένος σύνδεσμος ⇒ κανένα cookie', () => {
    const response = NextResponse.json({});

    attachShareDevice(response, { shareId: 's1', value: DEVICE_A, expiresAt: '2020-01-01T00:00:00Z' });

    expect(response.cookies.get(shareDeviceCookieName('s1'))).toBeUndefined();
  });
});
