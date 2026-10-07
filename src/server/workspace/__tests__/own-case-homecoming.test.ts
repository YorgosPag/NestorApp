/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΠΑΛΙΟΣ ΣΥΝΔΕΣΜΟΣ ΤΟΥ ΠΡΩΗΝ ΜΕΛΟΥΣ** — ADR-901 §15.16 (δρόμος Α).
 * @related server/workspace/own-case-homecoming.ts · lib/conveyance/conveyance-routes.ts (`officeCaseEngagementIdOf`)
 *
 * Ερωτήματα: (1) ποιες διευθύνσεις **είναι** σελίδα μιας υπόθεσης γραφείου, και ποιες μοιάζουν; (2) δική του
 * υπόθεση που ζει αλλού ⇒ η διεύθυνση του σπιτιού της; (3) ξένη/ανύπαρκτη ⇒ **καμία** διαφορά από το 404 που
 * υπήρχε, και η βάση ρωτιέται **μόνο** για διεύθυνση υπόθεσης; (4) «δεν μπόρεσα να ρωτήσω» ⇒ ποτέ «δεν είναι δική
 * σου»; (5) σπίτι = η ίδια διεύθυνση ⇒ καμία ανακατεύθυνση σε κύκλο.
 */

jest.mock('server-only', () => ({}));

const mockReadRequestPath = jest.fn<Promise<string | null>, []>();
jest.mock('@/server/lib/request-path', () => ({ readRequestPath: () => mockReadRequestPath() }));

const DB = { marker: 'db' };
jest.mock('@/lib/api/admin-db', () => ({ requireAdminFirestore: () => DB }));

const mockLocate = jest.fn();
jest.mock('@/services/conveyance/conveyance-engagement-access.service', () => ({
  locateOwnCaseHome: (...args: unknown[]) => mockLocate(...args),
}));

const mockAddress = jest.fn();
jest.mock('@/lib/workspace/workspace-address', () => ({
  addressInWorkspace: (...args: unknown[]) => mockAddress(...args),
}));

import { officeCaseEngagementIdOf } from '@/lib/conveyance/conveyance-routes';
import { caseHomecomingForRequest } from '../own-case-homecoming';

const UID = 'uid_fotis';
const ENG = 'eng_123';
const OLD_LINK = `/o/grafeio-b/cases/${ENG}`;
const PERSONAL = { kind: 'personal', uid: UID } as const;
const OFFICE = { kind: 'org', companyId: 'comp_other' } as const;

beforeEach(() => {
  jest.clearAllMocks();
  mockReadRequestPath.mockResolvedValue(OLD_LINK);
  mockLocate.mockResolvedValue({ outcome: 'home', home: PERSONAL });
  mockAddress.mockImplementation(async (_workspace: unknown, path: string) => path);
});

describe('Δ — ποια διεύθυνση ΕΙΝΑΙ σελίδα μιας υπόθεσης γραφείου', () => {
  it.each([
    [OLD_LINK, ENG],
    [`${OLD_LINK}?tab=files#top`, ENG],
    [`${OLD_LINK}/`, ENG],
    ['/o/comp_9c7c/cases/eng%20x', 'eng x'],
  ])('🔑 Δ1 — %s ⇒ %s', (path, expected) => {
    expect(officeCaseEngagementIdOf(path)).toBe(expected);
  });

  it.each([
    ['/o/grafeio-b/cases'],
    ['/o/grafeio-b/cases/eng_123/files'],
    ['/o/grafeio-b/contacts/eng_123'],
    ['/cases/eng_123'],
    ['/engagements/eng_123'],
    ['/o/grafeio-b'],
    ['/o/grafeio-b/cases/%E0%A4%A'],
  ])('Δ2 — %s ⇒ όχι', (path) => {
    expect(officeCaseEngagementIdOf(path)).toBeNull();
  });
});

describe('Σ — το σπίτι της ΔΙΚΗΣ ΤΟΥ υπόθεσης', () => {
  it('🔑 Σ1 — πρώην μέλος ⇒ η υπόθεση στον προσωπικό του χώρο', async () => {
    await expect(caseHomecomingForRequest(UID)).resolves.toEqual({ outcome: 'moved', address: `/engagements/${ENG}` });
    expect(mockLocate).toHaveBeenCalledWith(DB, UID, ENG);
    expect(mockAddress).toHaveBeenCalledWith(PERSONAL, `/engagements/${ENG}`);
  });

  it('Σ2 — ανήκει σε ΑΛΛΟ γραφείο ⇒ η διεύθυνση εκείνου, χτισμένη από τον ΕΝΑ κανόνα', async () => {
    mockLocate.mockResolvedValue({ outcome: 'home', home: OFFICE });
    mockAddress.mockResolvedValue(`/o/allo-grafeio/cases/${ENG}`);

    await expect(caseHomecomingForRequest(UID)).resolves.toEqual({ outcome: 'moved', address: `/o/allo-grafeio/cases/${ENG}` });
    expect(mockAddress).toHaveBeenCalledWith(OFFICE, `/cases/${ENG}`);
  });

  it('🔑 Σ3 — το σπίτι είναι Η ΙΔΙΑ διεύθυνση (ο φρουρός μόλις την αρνήθηκε) ⇒ κανένας κύκλος', async () => {
    mockReadRequestPath.mockResolvedValue(`${OLD_LINK}?tab=files`);
    mockLocate.mockResolvedValue({ outcome: 'home', home: OFFICE });
    mockAddress.mockResolvedValue(OLD_LINK);

    await expect(caseHomecomingForRequest(UID)).resolves.toEqual({ outcome: 'none' });
  });
});

describe('Α — ό,τι δεν είναι δικό του μένει το ΙΔΙΟ 404', () => {
  it('🔑 Α1 — ξένη ή ανύπαρκτη συμμετοχή ⇒ `none`, καμία διεύθυνση', async () => {
    mockLocate.mockResolvedValue({ outcome: 'none' });

    await expect(caseHomecomingForRequest(UID)).resolves.toEqual({ outcome: 'none' });
    expect(mockAddress).not.toHaveBeenCalled();
  });

  it.each([[null], ['/o/grafeio-b/contacts'], ['/o/grafeio-b/cases']])(
    '🔑 Α2 — %s ⇒ `none` ΧΩΡΙΣ να ρωτηθεί η βάση',
    async (path) => {
      mockReadRequestPath.mockResolvedValue(path);

      await expect(caseHomecomingForRequest(UID)).resolves.toEqual({ outcome: 'none' });
      expect(mockLocate).not.toHaveBeenCalled();
    },
  );

  it('🔑 Α3 — «δεν μπόρεσα να ρωτήσω» ⇒ `unknown`, ποτέ «δεν είναι δική σου»', async () => {
    mockLocate.mockResolvedValue({ outcome: 'unknown' });

    await expect(caseHomecomingForRequest(UID)).resolves.toEqual({ outcome: 'unknown' });
  });
});
