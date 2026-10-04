/**
 * @jest-environment node
 *
 * ADR-900 §8 #2 Β3 — άγκυρα του ΕΝΟΣ γραφέα ανάκλησης κατοχής (κύκλος UPRN · Zillow unclaim · Google Business Profile).
 *
 * Α1 πλαστό ΠΚΑ ⇒ κλειδαριές ελεύθερες + μονάδα `historical` · Α2 μεταβίβαση ⇒ η μονάδα ΜΕΝΕΙ ·
 * Α3 ο Α έγκυρος (superseded) + ο Β πλαστός ⇒ η μονάδα ΜΕΝΕΙ · Α4 ο ΑΦΜ μένει δεμένος όσο υπάρχει άλλη ενεργή ·
 * Α5 η κλειδαριά ΚΑΕΚ αλλού ⇒ δεν αγγίζεται · Α6 ιδεμποτία · Α7 οι πόρτες · Α8 νέα επαλήθευση ⇒ ίδια μονάδα `approved` ·
 * Ε1 ειδοποιήσεις (κάτοχος · προηγούμενος κάτοχος · λόγος) · Κ1 τα σύνολα λόγων.
 */
import {
  asAdmin, deps, linkedWorld, OWNER_B_LINE, OWNER_LINE, submit, TRUSTED_SEAL, units,
} from './ownership-world.fixture';
import type { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { decideOwnershipReview } from '../ownership-verification-review.service';
import {
  revocationRefusal,
  revokeOwnershipVerification,
  type RevokeInput,
} from '../ownership-verification-revoke.service';
import { ownershipDecisionWording } from '../ownership-decision-notifier.service';
import {
  ADMIN_REVOCATION_REASONS,
  OWNERSHIP_REVOCATION_REASONS,
  type OwnershipVerification,
} from '@/types/ownership-verification';

jest.mock('server-only', () => ({}));
jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: jest.fn(async () => ({ success: true })),
}));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn(async () => 'audit') } }));
jest.mock('@/config/trust/pdf-seal-trust', () => ({
  ...jest.requireActual('@/config/trust/pdf-seal-trust'),
  isExpectedSigner: (_kind: string, id: string | null) => id === 'VATEL-KTIMATOLOGIO-TEST',
}));

const dispatched = dispatchNotification as jest.MockedFunction<typeof dispatchNotification>;
const LATER = '2026-10-05T09:00:00.000Z';
const REVOKED_AT = '2026-10-06T10:00:00.000Z';

const verifications = (fake: FakeFirestore) =>
  Object.values(fake.getAllDocs('ownership_verifications')) as OwnershipVerification[];
const byUid = (fake: FakeFirestore, uid: string) => verifications(fake).find((record) => record.uid === uid) as OwnershipVerification;
const onlyUnit = (fake: FakeFirestore) => {
  const all = Object.values(units(fake));
  expect(all).toHaveLength(1);
  return all[0] as { status: string };
};

const revoke = (fake: FakeFirestore, verificationId: string, overrides: Partial<RevokeInput> = {}) =>
  revokeOwnershipVerification(asAdmin(fake), {
    verificationId,
    actor: { kind: 'admin', uid: 'admin-1' },
    reason: 'evidence-invalid',
    note: null,
    nowIso: REVOKED_AT,
    ...overrides,
  });

/** user-1 επαληθευμένος αυτόματα για ownp_a (δεσμός κτιρίου ⇒ μονάδα). */
async function verifiedWorld(): Promise<FakeFirestore> {
  const fake = linkedWorld();
  await submit(fake, 'user-1', 'ownp_a', deps(TRUSTED_SEAL, OWNER_LINE));
  return fake;
}

/** user-1 → user-2 (ουρά → έγκριση): η απόδειξη του user-1 γίνεται `superseded`. */
async function handedOverWorld(): Promise<FakeFirestore> {
  const fake = await verifiedWorld();
  const second = await submit(fake, 'user-2', 'ownp_b', deps(TRUSTED_SEAL, OWNER_B_LINE));
  const pendingId = second.kind === 'judged' ? second.view.id : '';
  await decideOwnershipReview(asAdmin(fake), {
    verificationId: pendingId, reviewerUid: 'admin-1', decision: 'approve', note: null, nowIso: LATER,
  });
  return fake;
}

beforeEach(() => dispatched.mockClear());

describe('Α1 — πλαστό ΠΚΑ, μοναδική βεβαίωση ⇒ ελευθερία κλειδαριών + μονάδα `historical`', () => {
  it('revoked με λόγο · okcl/txic σβησμένες · η μονάδα ΔΕΝ διαγράφεται, γίνεται ιστορική', async () => {
    const fake = await verifiedWorld();
    const outcome = await revoke(fake, byUid(fake, 'user-1').id);
    expect(outcome).toEqual({ kind: 'revoked', unitRetired: true });
    expect(byUid(fake, 'user-1')).toMatchObject({
      status: 'revoked', revocationReason: 'evidence-invalid', decidedBy: 'admin-1', decidedAt: REVOKED_AT,
    });
    expect(fake.getAllDocs('ownership_kaek_claims')).toEqual({});
    expect(fake.getAllDocs('tax_identity_claims')).toEqual({});
    expect(onlyUnit(fake)).toMatchObject({ status: 'historical', updatedAt: REVOKED_AT });
  });
});

describe('Α2 — ο λόγος κρίνει τη μονάδα (Zillow: το σπίτι υπάρχει)', () => {
  it.each(['ownership-ended', 'claimed-in-error'] as const)('%s', async (reason) => {
    const fake = await verifiedWorld();
    const outcome = await revoke(fake, byUid(fake, 'user-1').id, { reason });
    const retires = reason === 'claimed-in-error';
    expect(outcome).toEqual({ kind: 'revoked', unitRetired: retires });
    expect(onlyUnit(fake).status).toBe(retires ? 'historical' : 'approved');
    expect(fake.getAllDocs('ownership_kaek_claims')).toEqual({});
  });
});

describe('Α3 — η ύπαρξη στέκει όσο υπάρχει ΕΣΤΩ ΜΙΑ έγκυρη βεβαίωση', () => {
  it('🔴 ο Α (έγκυρος, superseded) → ο Β (πλαστός) ανακαλείται ⇒ η μονάδα ΜΕΝΕΙ approved', async () => {
    const fake = await handedOverWorld();
    expect(byUid(fake, 'user-1').status).toBe('superseded');
    const outcome = await revoke(fake, byUid(fake, 'user-2').id);
    expect(outcome).toEqual({ kind: 'revoked', unitRetired: false });
    expect(onlyUnit(fake).status).toBe('approved');
  });

  it('και οι δύο πλαστές ⇒ με τη ΔΕΥΤΕΡΗ ανάκληση η μονάδα γίνεται ιστορική', async () => {
    const fake = await handedOverWorld();
    await revoke(fake, byUid(fake, 'user-2').id);
    const outcome = await revoke(fake, byUid(fake, 'user-1').id);
    expect(outcome).toEqual({ kind: 'revoked', unitRetired: true });
    expect(onlyUnit(fake).status).toBe('historical');
  });
});

describe('Α4 — ο ΑΦΜ μένει δεμένος όσο ο άνθρωπος έχει ΑΛΛΗ ενεργή απόδειξη', () => {
  it('δεύτερο ακίνητο του ίδιου ανθρώπου ⇒ η txic ΔΕΝ σβήνει με την ανάκληση του πρώτου', async () => {
    const fake = await verifiedWorld();
    fake.seed('ownership_verifications', 'ovr_other', {
      ...byUid(fake, 'user-1'), id: 'ovr_other', ownerPropertyId: 'ownp_other', kaek: '050681726003/0/2',
    });
    await revoke(fake, byUid(fake, 'user-1').id, { reason: 'ownership-ended' });
    expect(Object.values(fake.getAllDocs('tax_identity_claims'))).toEqual([expect.objectContaining({ uid: 'user-1' })]);
  });
});

describe('Α5 — η κλειδαριά ΚΑΕΚ αγγίζεται ΜΟΝΟ αν δείχνει στην ανακαλούμενη', () => {
  it('ανάκληση της superseded ⇒ η κλειδαριά του νέου κατόχου μένει ανέπαφη', async () => {
    const fake = await handedOverWorld();
    await revoke(fake, byUid(fake, 'user-1').id, { reason: 'ownership-ended' });
    expect(Object.values(fake.getAllDocs('ownership_kaek_claims'))).toEqual([expect.objectContaining({ uid: 'user-2' })]);
  });
});

describe('Α6 — ιδεμποτία', () => {
  it('δεύτερη ανάκληση ⇒ not-revocable, καμία εγγραφή, καμία δεύτερη ειδοποίηση', async () => {
    const fake = await verifiedWorld();
    const id = byUid(fake, 'user-1').id;
    await revoke(fake, id);
    dispatched.mockClear();
    const snapshot = JSON.stringify(fake.getAllDocs('ownership_verifications'));
    expect(await revoke(fake, id, { nowIso: LATER })).toEqual({ kind: 'refused', reason: 'not-revocable' });
    expect(JSON.stringify(fake.getAllDocs('ownership_verifications'))).toBe(snapshot);
    expect(dispatched).not.toHaveBeenCalled();
  });
});

describe('Α7 — οι δύο πόρτες', () => {
  const record = { uid: 'user-1', status: 'verified' as const };

  it('ο κάτοχος: μόνο `owner-request`, μόνο τη ΔΙΚΗ του, μόνο `verified`', () => {
    expect(revocationRefusal(record, { kind: 'owner', uid: 'user-1' }, 'owner-request')).toBeNull();
    expect(revocationRefusal(record, { kind: 'owner', uid: 'user-1' }, 'evidence-invalid')).toBe('reason-not-allowed');
    expect(revocationRefusal(record, { kind: 'owner', uid: 'user-2' }, 'owner-request')).toBe('not-found');
    expect(revocationRefusal({ uid: 'user-1', status: 'superseded' }, { kind: 'owner', uid: 'user-1' }, 'owner-request'))
      .toBe('not-revocable');
  });

  it('ο διαχειριστής: ποτέ `owner-request`· από verified ΚΑΙ superseded· ποτέ από εκκρεμή/απορριφθείσα', () => {
    const admin = { kind: 'admin', uid: 'admin-1' } as const;
    expect(revocationRefusal(record, admin, 'owner-request')).toBe('reason-not-allowed');
    expect(revocationRefusal({ uid: 'user-1', status: 'superseded' }, admin, 'evidence-invalid')).toBeNull();
    expect(revocationRefusal({ uid: 'user-1', status: 'pending-review' }, admin, 'evidence-invalid')).toBe('not-revocable');
    expect(revocationRefusal({ uid: 'user-1', status: 'rejected' }, admin, 'evidence-invalid')).toBe('not-revocable');
  });

  it('αποδέσμευση από τον κάτοχο ⇒ η μονάδα ΜΕΝΕΙ, οι κλειδαριές ελεύθερες', async () => {
    const fake = await verifiedWorld();
    const outcome = await revoke(fake, byUid(fake, 'user-1').id, {
      actor: { kind: 'owner', uid: 'user-1' }, reason: 'owner-request',
    });
    expect(outcome).toEqual({ kind: 'revoked', unitRetired: false });
    expect(onlyUnit(fake).status).toBe('approved');
    expect(fake.getAllDocs('ownership_kaek_claims')).toEqual({});
  });
});

describe('Α8 — κύκλος UPRN: νέα επαλήθευση ⇒ ΙΔΙΑ μονάδα, ξανά approved', () => {
  it('ιστορική μονάδα + νέο ΠΚΑ ⇒ ίδιο `punit_*`, status approved', async () => {
    const fake = await verifiedWorld();
    const [unitId] = Object.keys(units(fake));
    await revoke(fake, byUid(fake, 'user-1').id);
    await submit(fake, 'user-1', 'ownp_a', deps(TRUSTED_SEAL, OWNER_LINE, LATER));
    expect(Object.keys(units(fake))).toEqual([unitId]);
    expect(onlyUnit(fake).status).toBe('approved');
  });
});

describe('Ε1 — ειδοποιήσεις (σχήμα Google Business Profile)', () => {
  it('αυτόματη επαλήθευση ⇒ ο κάτοχος μαθαίνει (διακόπτης `properties`)', async () => {
    await verifiedWorld();
    expect(dispatched).toHaveBeenCalledTimes(1);
    expect(dispatched.mock.calls[0][0]).toMatchObject({
      eventType: 'properties.ownershipVerificationDecided',
      recipientId: 'user-1',
      titleKey: 'ownershipDecision.verifiedTitle',
      entityId: 'ownp_a',
    });
  });

  it('αλλαγή χεριών ⇒ και ο ΠΡΟΗΓΟΥΜΕΝΟΣ κάτοχος μαθαίνει (υποχρεωτικό `security`)', async () => {
    await handedOverWorld();
    const superseded = dispatched.mock.calls.map(([request]) => request).find((r) => r.titleKey === 'ownershipDecision.supersededTitle');
    expect(superseded).toMatchObject({ eventType: 'security.ownershipLost', recipientId: 'user-1', entityId: 'ownp_a' });
  });

  it('ανάκληση ⇒ ο κάτοχος μαθαίνει ΤΟΝ ΛΟΓΟ· ιδεμποτικό eventId ανά μετάβαση', async () => {
    const fake = await verifiedWorld();
    dispatched.mockClear();
    const id = byUid(fake, 'user-1').id;
    await revoke(fake, id, { reason: 'ownership-ended' });
    expect(dispatched.mock.calls[0][0]).toMatchObject({
      eventType: 'security.ownershipLost',
      recipientId: 'user-1',
      bodyKey: 'ownershipDecision.revokedBodyOwnershipEnded',
      eventId: `ownership-decision:${id}>revoked`,
    });
  });

  it('εκκρεμής ⇒ ΣΙΩΠΗ (δεν είναι απόφαση)', () => {
    expect(ownershipDecisionWording({ status: 'pending-review', revocationReason: null })).toBeNull();
  });
});

describe('Κ1 — τα σύνολα λόγων', () => {
  it('ο διαχειριστής έχει ΚΑΘΕ λόγο εκτός από το `owner-request` — ούτε περισσότερους, ούτε λιγότερους', () => {
    expect([...ADMIN_REVOCATION_REASONS].sort()).toEqual(
      OWNERSHIP_REVOCATION_REASONS.filter((reason) => reason !== 'owner-request').sort(),
    );
  });
});
