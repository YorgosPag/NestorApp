/**
 * @jest-environment node
 *
 * @fileoverview **«ΤΟ ΓΡΑΦΕΙΟ Χ ΣΑΣ ΑΦΑΙΡΕΣΕ» — ΜΕ ΛΟΓΙΑ** — ADR-892 §3.6 #3 (Φ1).
 * @related server/workspace/member-exit-notifier.ts
 *
 * Ερώτημα: η ειδοποίηση φτάνει σε χώρο που ο άνθρωπος **ακόμη βλέπει** (τον προσωπικό του), λέει **ποιο**
 * γραφείο, και δεν διπλασιάζεται όταν η πράξη επαναληφθεί;
 */

jest.mock('server-only', () => ({}));

const mockDispatch = jest.fn();
jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: (request: unknown) => mockDispatch(request),
}));
jest.mock('@/lib/workspace/workspace-catalog', () => ({ readWorkspaceName: async () => 'Γραφείο Α' }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
import elShared from '@/i18n/locales/el/common-shared.json';
import enShared from '@/i18n/locales/en/common-shared.json';
import { personalWorkspace, workspaceTenantId } from '@/types/workspace-membership';

import { announceMemberExit } from '../member-exit-notifier';

const NOTICE = { kind: 'removal', companyId: 'comp_w', uid: 'uid_x', occurredAtISO: '2026-09-27T08:00:00.000Z' } as const;

beforeEach(() => {
  mockDispatch.mockReset();
  mockDispatch.mockResolvedValue({ success: true });
});

describe('Ν — η ειδοποίηση εξόδου', () => {
  it('Ν1 🔴 στον ΠΡΟΣΩΠΙΚΟ χώρο του ανθρώπου — όχι στο γραφείο που δεν βλέπει πια', async () => {
    await announceMemberExit(NOTICE);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      eventType: NOTIFICATION_EVENT_TYPES.SECURITY_WORKSPACE_MEMBERSHIP_ENDED,
      recipientId: 'uid_x',
      tenantId: workspaceTenantId(personalWorkspace('uid_x')),
      workspace: personalWorkspace('uid_x'),
      titleParams: { office: 'Γραφείο Α' },
    }));
  });

  it('Ν2 — αφαίρεση και αποχώρηση λένε ΔΙΑΦΟΡΕΤΙΚΑ πράγματα', async () => {
    await announceMemberExit(NOTICE);
    await announceMemberExit({ ...NOTICE, kind: 'departure' });
    expect(mockDispatch.mock.calls.map(([request]) => (request as { titleKey: string }).titleKey)).toEqual([
      'workspaceMembershipEnded.removedTitle',
      'workspaceMembershipEnded.leftTitle',
    ]);
  });

  it('Ν3 — ταυτότητα = γραφείο + άνθρωπος + τέλος θητείας (ιδεμποτία του αγωγού)', async () => {
    await announceMemberExit(NOTICE);
    expect(mockDispatch.mock.calls[0][0]).toEqual(expect.objectContaining({
      eventId: 'workspace-exit:comp_w:uid_x:2026-09-27T08:00:00.000Z',
    }));
  });

  it('Ν5 — ADR-892 Φ2β: παύση και επαναφορά λέγονται ΧΩΡΙΣΤΑ, με δική τους ταυτότητα (ποτέ σύγκρουση με την έξοδο)', async () => {
    await announceMemberExit({ ...NOTICE, kind: 'pause' });
    await announceMemberExit({ ...NOTICE, kind: 'restore' });
    const sent = mockDispatch.mock.calls.map(([request]) => request as { titleKey: string; eventId: string });
    expect(sent.map((request) => request.titleKey)).toEqual([
      'workspaceMembershipEnded.pausedTitle',
      'workspaceMembershipEnded.restoredTitle',
    ]);
    expect(sent.map((request) => request.eventId)).toEqual([
      'workspace-pause:comp_w:uid_x:2026-09-27T08:00:00.000Z',
      'workspace-restore:comp_w:uid_x:2026-09-27T08:00:00.000Z',
    ]);
  });

  it('Ν4 — αποτυχία αγωγού ΔΕΝ ρίχνει (η έξοδος έγινε)', async () => {
    mockDispatch.mockRejectedValueOnce(new Error('down'));
    await expect(announceMemberExit(NOTICE)).resolves.toBeUndefined();
  });

  it('Ν6 🔴 — ADR-892 §13: ΚΑΘΕ δρόμος έχει ΣΩΜΑ, και τίτλος+σώμα (email) βγαίνουν ΑΠΟ ΤΟ LOCALE', async () => {
    // Ήταν γραμμένη εφεδρεία δίπλα στο κλειδί — μετρήθηκε ζωντανά ότι το email έλεγε ΑΛΛΑ από το κουδούνι.
    for (const kind of ['removal', 'departure', 'pause', 'restore'] as const) {
      mockDispatch.mockClear();
      await announceMemberExit({ ...NOTICE, kind });
      const request = mockDispatch.mock.calls[0][0] as Record<string, unknown> & {
        titleKey: string; bodyKey: string; title: string; body: string; bodyParams: Record<string, string>;
      };
      const elText = (key: string) => String(Reflect.get(elShared.workspaceMembershipEnded, key.split('.')[1]));
      const enText = (key: string) => Reflect.get(enShared.workspaceMembershipEnded, key.split('.')[1]);
      expect([kind, request.title]).toEqual([kind, elText(request.titleKey).replace('{office}', 'Γραφείο Α')]);
      expect([kind, request.body]).toEqual([kind, elText(request.bodyKey).replace('{office}', 'Γραφείο Α')]);
      expect(request.bodyParams).toEqual({ office: 'Γραφείο Α' });
      expect([kind, typeof enText(request.titleKey), typeof enText(request.bodyKey)]).toEqual([kind, 'string', 'string']);
    }
  });
});
