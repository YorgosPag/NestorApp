/**
 * @jest-environment node
 *
 * ADR-901 §15 (Γ2) — **το σπίτι της υπόθεσης**: διευθύνσεις, ο χώρος της σελίδας, ο σύνδεσμος της ειδοποίησης και η
 * ανακατεύθυνση όταν η υπόθεση ανοίξει σε λάθος χώρο. Κάθε `it` ονομάζει τη μετάλλαξη που πρέπει να πιάσει.
 *
 * 🔑 Η λύση του ψευδωνύμου (ανάγνωση βάσης) αντικαθίσταται· ο κανόνας «χώρος → διεύθυνση» (`addressInWorkspace`),
 *    ο κριτής `isInsideWorkspace` και η μετάφραση `ownerOfWorkspace` τρέχουν οι **πραγματικοί**.
 */

import { NextRequest } from 'next/server';

const mockAlias = jest.fn(async (owner: { kind: string; companyId?: string }, path: string) =>
  owner.kind === 'organization' ? `/o/alias-of-${owner.companyId}${path}` : `/o/me${path}`);
jest.mock('@/lib/workspace/workspace-destination', () => ({
  ...jest.requireActual('@/lib/workspace/workspace-destination'),
  workspaceDestinationOf: (owner: { kind: string; companyId?: string }, path: string) => mockAlias(owner, path),
}));
jest.mock('@/server/notifications/notification-orchestrator', () => ({ dispatchNotification: jest.fn(async () => undefined) }));
/** ADR-901 §15.15 (Γ2.1) — τα γραφεία όπου ΑΝΗΚΕΙ ο επαγγελματίας τη στιγμή της ειδοποίησης. Προεπιλογή: το γραφείο του. */
const mockOwnWorkspaces = jest.fn(async (_uid: string, _active: unknown): Promise<unknown> => ({ outcome: 'ok', reachable: ['comp_law'], belonging: ['comp_law'] }));
jest.mock('@/lib/auth/workspace-membership', () => ({
  ...jest.requireActual('@/lib/auth/workspace-membership'),
  listOwnWorkspaces: (uid: string, active: unknown) => mockOwnWorkspaces(uid, active),
}));

import { getToolsMenuItems } from '@/config/office-navigation/resolve-office-navigation';
import { resolvePersonalNavigation } from '@/config/personal-navigation';
import { ApiClientError } from '@/lib/api/api-client-types';
import { caseHomeOf } from '@/lib/conveyance/acting-acceptance';
import {
  CASE_HOMES,
  OFFICE_CASES_ROUTE,
  OFFICE_CASES_SEGMENT,
  PERSONAL_CASES_ROUTE,
  PERSONAL_CASES_SEGMENT,
  myCaseHref,
  myCasesRoute,
} from '@/lib/conveyance/conveyance-routes';
import { firstActionUrl } from '@/lib/notifications/notification-destination';
import { personalWorkspaceLanding } from '@/lib/workspace/personal-workspace-surface';
import { addressInWorkspace } from '@/lib/workspace/workspace-address';
import { OUTSIDE_WORKSPACE, isInsideWorkspace } from '@/lib/workspace/workspace-scope';
import { orgWorkspace, personalWorkspace } from '@/types/workspace-membership';
import { viewedWorkspace } from '../conveyance-acting-workspace.server';
import { readCaseViewer } from '../conveyance-case-viewer.server';
import { caseRelocationOf } from '../conveyance-engagement-gateway';
import { caseEngagementChangedDestination } from '../conveyance-engagement-notifier';

const UID = 'u_georgiou';
const LAW = orgWorkspace('comp_law');
const ME = personalWorkspace(UID);

describe('Δ — οι διευθύνσεις: ένα τμήμα, ένας ιδιοκτήτης (CHECK 3.60 Κ3)', () => {
  it('το `cases` ζει ΜΕΣΑ σε χώρο, το `engagements` ΕΞΩ — ποτέ το ίδιο τμήμα και στα δύο', () => {
    // Μετάλλαξη: το `cases` ξαναδηλώνεται εκτός χώρου ⇒ η σελίδα του γραφείου γίνεται απροσπέλαστη από κάθε σύνδεσμο.
    expect(isInsideWorkspace(OFFICE_CASES_ROUTE)).toBe(true);
    expect(isInsideWorkspace(PERSONAL_CASES_ROUTE)).toBe(false);
    expect(Object.hasOwn(OUTSIDE_WORKSPACE, OFFICE_CASES_SEGMENT)).toBe(false);
    expect(Object.hasOwn(OUTSIDE_WORKSPACE, PERSONAL_CASES_SEGMENT)).toBe(true);
    expect(OFFICE_CASES_SEGMENT).not.toBe(PERSONAL_CASES_SEGMENT);
  });

  it('η διεύθυνση ακολουθεί το ΣΠΙΤΙ της συμμετοχής, και κωδικοποιεί την ταυτότητα', () => {
    // Μετάλλαξη: `myCaseHref` αγνοεί το `home` ⇒ υπόθεση γραφείου δείχνει στον προσωπικό χώρο (ή ανάποδα).
    expect(myCaseHref('eng_1', 'org')).toBe('/cases/eng_1');
    expect(myCaseHref('eng_1', 'personal')).toBe('/engagements/eng_1');
    expect(myCaseHref('a/b', 'org')).toBe('/cases/a%2Fb');
    expect(CASE_HOMES.map(myCasesRoute)).toEqual([OFFICE_CASES_ROUTE, PERSONAL_CASES_ROUTE]);
  });

  it('η κάρτα λέει το σπίτι της από το «για ποιον ενεργεί» — και `null` όταν δεν το ξέρει', () => {
    expect(caseHomeOf({ kind: 'office', office: { companyId: 'comp_law', name: 'Γραφείο' } })).toBe('org');
    expect(caseHomeOf({ kind: 'personal' })).toBe('personal');
    // §15.15 — μετάλλαξη: το `departed` διαβάζεται ως γραφείο ⇒ ο σύνδεσμος της κάρτας δείχνει σε χώρο που απαντά 404.
    expect(caseHomeOf({ kind: 'departed', office: { companyId: 'comp_law', name: 'Γραφείο' } })).toBe('personal');
    expect(caseHomeOf(null)).toBeNull();
  });
});

describe('Ν — οι δύο γραμμές του μενού δείχνουν η καθεμία στο ΔΙΚΟ της σπίτι', () => {
  it('η προσωπική γραμμή ⇒ `/engagements` (εκτός χώρου)· η γραμμή του γραφείου ⇒ `/cases` (εντός)', () => {
    // Μετάλλαξη: η προσωπική γραμμή μένει στο `/cases` ⇒ για μέλος γραφείου παίρνει πρόθεμα και ανοίγει τη λίστα του
    //            ΓΡΑΦΕΙΟΥ· για ιδιώτη καταλήγει στο δίχτυ. Επιζώσα μετάλλαξη (2026-10-05) πριν από αυτή την άγκυρα.
    const personal = resolvePersonalNavigation(null, 'sidebar').flatMap((g) => g.items).find((item) => item.id === 'myCases');
    expect(personal?.href).toBe(PERSONAL_CASES_ROUTE);
    const office = getToolsMenuItems([], 'production').flatMap((entry) => (entry.kind === 'group' ? entry.items : [entry]));
    expect(office.filter((item) => item.navLabelKey === personal?.navLabelKey).map((item) => item.href)).toEqual([OFFICE_CASES_ROUTE]);
  });
});

describe('Χ — ο χώρος της ΣΕΛΙΔΑΣ: το είδος το δηλώνει το κέλυφος, το γραφείο το δίνει το κριμένο αίτημα', () => {
  const office = { companyId: 'comp_law', verdict: 'home' } as const;

  it('🔴 «προσωπικά» ⇒ ο προσωπικός χώρος, ΑΚΟΜΗ ΚΙ ΑΝ το αίτημα ενεργεί σε γραφείο', () => {
    // Μετάλλαξη: ο χώρος της σελίδας = `active` ⇒ η προσωπική λίστα μέλους γραφείου δείχνει τις υποθέσεις του
    //            γραφείου, και οι παλιές συμμετοχές χωρίς `actingFor` δεν φαίνονται πουθενά.
    expect(viewedWorkspace({ uid: UID, active: office }, 'personal')).toEqual(ME);
    expect(viewedWorkspace({ uid: UID, active: null }, 'personal')).toEqual(ME);
  });

  it('«γραφείο» ⇒ το γραφείο ΤΟΥ ΑΙΤΗΜΑΤΟΣ· χωρίς γραφείο ⇒ καμία απάντηση (ποτέ προσωπικός στη θέση του)', () => {
    // Μετάλλαξη: `null` ⇒ προσωπικός ⇒ σελίδα γραφείου χωρίς κριμένο χώρο θα έδειχνε την προσωπική λίστα.
    expect(viewedWorkspace({ uid: UID, active: office }, 'org')).toEqual(LAW);
    expect(viewedWorkspace({ uid: UID, active: null }, 'org')).toBeNull();
  });

  const request = (query: string) => new NextRequest(`https://nestor.test/api/engagements${query}`);
  const rejected = async (reading: ReturnType<typeof readCaseViewer>) =>
    'rejected' in reading ? { status: reading.rejected.status, body: await reading.rejected.json() } : null;

  it('το σύνορο: απόν · άγνωστο · «γραφείο» χωρίς γραφείο ⇒ 400 στο πεδίο `home` — ποτέ προεπιλογή', async () => {
    // Μετάλλαξη: απόν `home` ⇒ προσωπικός ⇒ σελίδα που «ξέχασε» να δηλώσει παίρνει σιωπηλά τη λάθος λίστα.
    for (const query of ['', '?home=', '?home=office', '?home=comp_law', '?home=org']) {
      expect(await rejected(readCaseViewer(request(query), { uid: UID, active: null })))
        .toEqual({ status: 400, body: { error: 'MALFORMED_QUERY', malformed: ['home'] } });
    }
  });

  it('το σύνορο: έγκυρη δήλωση ⇒ ο θεατής με τον χώρο της σελίδας του', () => {
    expect(readCaseViewer(request('?home=org'), { uid: UID, active: office })).toEqual({ uid: UID, active: office, viewed: LAW });
    expect(readCaseViewer(request('?home=personal'), { uid: UID, active: office })).toEqual({ uid: UID, active: office, viewed: ME });
  });
});

describe('Ε — η ειδοποίηση αποκτά ΑΠΟΤΕΛΕΣΜΑ: ο σύνδεσμος ανοίγει στο γραφείο για το οποίο αναλήφθηκε', () => {
  const landingOf = async (engagement: Parameters<typeof caseEngagementChangedDestination>[0]) => {
    const destination = await caseEngagementChangedDestination(engagement);
    const path = firstActionUrl(destination.actions);
    if (typeof path !== 'string') throw new Error('η ειδοποίηση δεν έχει προορισμό');
    return { workspace: destination.workspace, address: await addressInWorkspace(destination.workspace, path) };
  };

  it('για γραφείο ⇒ `/o/<το γραφείο του>/cases/<eng>`', async () => {
    // Μετάλλαξη: ο παραγωγός κρατά την προσωπική διαδρομή ⇒ ο χώρος μένει ετικέτα και η υπόθεση ανοίγει εκτός γραφείου.
    expect(await landingOf({ id: 'eng_1', uid: UID, actingFor: LAW }))
      .toEqual({ workspace: LAW, address: '/o/alias-of-comp_law/cases/eng_1' });
  });

  it('προσωπικός · και συμμετοχή πριν από το §15 (χωρίς πεδίο) ⇒ `/engagements/<eng>`, αυτούσια', async () => {
    mockAlias.mockClear();
    expect(await landingOf({ id: 'eng_1', uid: UID, actingFor: ME })).toEqual({ workspace: ME, address: '/engagements/eng_1' });
    expect(await landingOf({ id: 'eng_1', uid: UID })).toEqual({ workspace: ME, address: '/engagements/eng_1' });
    // Η προσωπική διαδρομή ζει εκτός χώρου ⇒ κανένα ψευδώνυμο δεν λύνεται (καμία ανάγνωση βάσης).
    expect(mockAlias).not.toHaveBeenCalled();
  });

  describe('§15.15 (Γ2.1) — όποιος ΕΦΥΓΕ από το γραφείο προσγειώνεται στον προσωπικό του χώρο', () => {
    const own = (belonging: readonly string[]) => mockOwnWorkspaces.mockImplementationOnce(async () => ({ outcome: 'ok', reachable: belonging, belonging }));

    it('δεν ανήκει πια στο γραφείο της υπόθεσης ⇒ `/engagements/<eng>`, χώρος ο προσωπικός — ποτέ `/o/<γραφείο>` που απαντά 404', async () => {
      // Μετάλλαξη: ο παραγωγός αγνοεί το βιβλίο μελών ⇒ η ειδοποίηση οδηγεί τον αποχωρήσαντα σε 404.
      own([]);
      expect(await landingOf({ id: 'eng_1', uid: UID, actingFor: LAW })).toEqual({ workspace: ME, address: '/engagements/eng_1' });
      own(['comp_other']);
      expect(await landingOf({ id: 'eng_1', uid: UID, actingFor: LAW })).toEqual({ workspace: ME, address: '/engagements/eng_1' });
    });

    it('ρωτά το βιβλίο για τον ΠΑΡΑΛΗΠΤΗ, χωρίς χώρο αιτήματος — και ΚΑΘΟΛΟΥ για προσωπική συμμετοχή', async () => {
      // Μετάλλαξη: ανάγνωση για κάθε ειδοποίηση ⇒ ο ιδιώτης πληρώνει ανάγνωση που δεν του χρησιμεύει.
      mockOwnWorkspaces.mockClear();
      await landingOf({ id: 'eng_1', uid: UID });
      expect(mockOwnWorkspaces).not.toHaveBeenCalled();
      await landingOf({ id: 'eng_1', uid: UID, actingFor: LAW });
      expect(mockOwnWorkspaces.mock.calls).toEqual([[UID, null]]);
    });

    it('«δεν μπόρεσα να ρωτήσω» ⇒ το ΓΕΓΟΝΟΣ (το γραφείο): η ειδοποίηση δεν χάνεται για μια αποτυχημένη ανάγνωση', async () => {
      // Μετάλλαξη: το άγνωστο διαβάζεται «αποχώρησε» ⇒ κάθε αστοχία του βιβλίου στέλνει μέλη γραφείου στον προσωπικό.
      mockOwnWorkspaces.mockImplementationOnce(async () => ({ outcome: 'unknown', reason: 'query-failed' }));
      expect(await landingOf({ id: 'eng_1', uid: UID, actingFor: LAW })).toEqual({ workspace: LAW, address: '/o/alias-of-comp_law/cases/eng_1' });
    });
  });

  it('🔴 ο ΠΑΛΙΟΣ σύνδεσμος (`/cases/<eng>`, χώρος-στόχος προσωπικός) καταλήγει στη νέα προσωπική διεύθυνση', async () => {
    // Οι 2 συμμετοχές της παραγωγής έχουν ειδοποιήσεις γραμμένες ΠΡΙΝ από τη Γ2. Μετάλλαξη: χωρίς το προσωπικό
    // δίδυμο το `/o/me/cases/…` προσγειώνεται στην αρχική — ο άνθρωπος πατά την ειδοποίηση και δεν βρίσκει την υπόθεση.
    const stale = await addressInWorkspace(ME, '/cases/eng_1');
    expect(stale).toBe('/o/me/cases/eng_1');
    expect(personalWorkspaceLanding(stale)).toBe('/engagements/eng_1');
  });
});

describe('Μ — «η υπόθεση ζει αλλού»: ο πελάτης ακολουθεί ΜΟΝΟ εσωτερική διεύθυνση', () => {
  const failure = (body: Record<string, unknown>) => new ApiClientError('Conflict', 409, 'HTTP_409', undefined, 'req_1', undefined, body);

  it('δέχεται εσωτερική διαδρομή· αρνείται ό,τι θα έβγαζε τον άνθρωπο από την εφαρμογή', () => {
    // Μετάλλαξη: `location` αυτούσιο ⇒ ανοιχτή ανακατεύθυνση (`//evil.example`, `https://…`).
    const moved = (location: unknown) => caseRelocationOf(failure({ error: 'ENGAGEMENT_ELSEWHERE', location }));
    expect(moved('/o/georgiou/cases/eng_1')).toBe('/o/georgiou/cases/eng_1');
    expect(moved('/engagements/eng_1')).toBe('/engagements/eng_1');
    for (const hostile of ['//evil.example/x', 'https://evil.example', 'engagements/eng_1', '', null, 42]) expect(moved(hostile)).toBeNull();
    expect(caseRelocationOf(failure({ error: 'ENGAGEMENT_NOT_ACTIVE', location: '/engagements/eng_1' }))).toBeNull();
  });
});
