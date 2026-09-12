/**
 * @jest-environment node
 *
 * =============================================================================
 * ΤΟ ΣΥΝΟΡΟ ΔΙΑΒΑΖΕΙ ΤΗ ΔΗΛΩΣΗ ΧΩΡΟΥ — ADR-787 §5.3 ζ, ΟΡΙΟ (1)
 * =============================================================================
 *
 * 🔴 **ΤΟ ΓΕΓΟΝΟΣ** (μετρημένο ζωντανά 2026-09-11 17:50Z, build `f6a915bb`): το
 * `https://nestorconstruct.gr/o/me/projects` — **ιδιωτικός** χώρος — έδειξε «Έργα (7)».
 * Ο πελάτης μετέφερε **μόνο εταιρεία**, άρα ο ιδιωτικός χώρος έφευγε στο σύρμα
 * **ταυτόσημος** με το «η διεύθυνση δεν ονομάζει χώρο», και ο διακομιστής διάβαζε την
 * απουσία ως *«κρίνε μόνος σου»*: για super-admin **καθολική όψη** όλων των εταιρειών,
 * για απλό χρήστη η εταιρεία του **claim**.
 *
 * ⚠️ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΜΙΣΗ Η ΑΓΚΥΡΑ**: χωρίς τις `Π*`, το «ο ιδιωτικός χώρος
 * αρνείται» θα μπορούσε να σημαίνει «αρνούνται όλοι».
 */

const mockVerifyIdToken = jest.fn();

jest.mock('@/lib/firebaseAdmin', () => ({
  isFirebaseAdminAvailable: () => true,
  getAdminAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
  getAdminFirestore: () => {
    throw new Error(
      'Ο Firestore ΔΕΝ πρέπει να κληθεί: όταν ο δηλωμένος χώρος είναι ο χώρος του token ' +
      '(ή δεν είναι εταιρεία καθόλου), η κρίση γίνεται με ΜΗΔΕΝ αναγνώσεις (ADR-787 Ε-5 §2).',
    );
  },
}));

import { NextRequest } from 'next/server';
import { buildApiIdentity, buildRequestContext } from '../auth-context';
import { createUnauthorizedResponse } from '../api-denial';
import { withPersonalOrOrgAuth, type ApiActor } from '../personal-scope-middleware';
import { isAuthenticated } from '../types';
import { REQUESTED_WORKSPACE_HEADER } from '@/lib/workspace/requested-workspace-wire';
import { NextResponse } from 'next/server';

const COMPANY = 'comp_alpha_emulator';

/** Ο επαγγελματίας μέσα σε γραφείο — **ο παρονομαστής**. */
const ORG_TOKEN = {
  uid: 'uid-int-architect',
  email: 'int.architect@alpha.local',
  companyId: COMPANY,
  globalRole: 'company_admin',
};

/** Ο πολίτης — ίδιο token, **χωρίς** `companyId`. */
const CITIZEN_TOKEN = {
  uid: 'uid-ext-owner',
  email: 'ext.owner@solo.local',
  globalRole: 'external_user',
};

function request(extra: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://nestorconstruct.gr/api/projects/list', {
    headers: { authorization: 'Bearer a-token', ...extra },
  });
}

beforeEach(() => jest.clearAllMocks());

// =============================================================================
// Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
// =============================================================================

describe('Π — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: τίποτα δεν έσπασε για όποιον ενεργεί σε γραφείο', () => {
  it('Π1 — καμία δήλωση ⇒ ο χώρος του token, όπως πάντα', async () => {
    mockVerifyIdToken.mockResolvedValue(ORG_TOKEN);

    const ctx = await buildRequestContext(request());

    expect(isAuthenticated(ctx)).toBe(true);
    if (!isAuthenticated(ctx)) throw new Error('unreachable');
    expect(ctx.companyId).toBe(COMPANY);
    // «Δεν δήλωσε» ⇒ `default`: η ΙΔΙΑ σημασιολογία που είχε πάντα η απουσία, με όνομα.
    expect(ctx.requestedWorkspace).toEqual({ kind: 'default' });
  });

  it('Π2 — δήλωση του ΙΔΙΟΥ χώρου ⇒ περνά, με ΜΗΔΕΝ αναγνώσεις', async () => {
    mockVerifyIdToken.mockResolvedValue(ORG_TOKEN);

    const ctx = await buildRequestContext(
      request({ [REQUESTED_WORKSPACE_HEADER]: `org:${COMPANY}` }),
    );

    expect(isAuthenticated(ctx)).toBe(true);
    if (!isAuthenticated(ctx)) throw new Error('unreachable');
    expect(ctx.companyId).toBe(COMPANY);
    // 🔑 Η δήλωση ταξιδεύει: τα δόγματα λίστας τη ρωτούν αντί να μαντεύουν από το
    //    `superAdminOverride` (που εδώ είναι εύλογα `false` — ίδιος χώρος με το claim).
    expect(ctx.requestedWorkspace).toEqual({ kind: 'org', companyId: COMPANY });
    expect(ctx.superAdminOverride).toBe(false);
  });
});

// =============================================================================
// Η ΚΑΡΔΙΑ ΤΟΥ ΟΡΙΟΥ (1)
// =============================================================================

describe('Κ — Ο ΙΔΙΩΤΙΚΟΣ ΧΩΡΟΣ ΑΡΝΕΙΤΑΙ ΠΡΙΝ ΤΟΝ HANDLER', () => {
  it('Κ1 🔴 δηλωμένος ιδιωτικός χώρος ⇒ ΔΕΝ παράγεται εταιρικό context', async () => {
    mockVerifyIdToken.mockResolvedValue(ORG_TOKEN);

    const ctx = await buildRequestContext(
      request({ [REQUESTED_WORKSPACE_HEADER]: 'personal' }),
    );

    expect(isAuthenticated(ctx)).toBe(false);
    if (isAuthenticated(ctx)) throw new Error('unreachable');
    expect(ctx.reason).toBe('workspace_personal');
  });

  it('Κ2 🔴 η άρνηση είναι 403 με κωδικό `MISSING_TENANT` — ΠΟΤΕ 401', async () => {
    const response = createUnauthorizedResponse('workspace_personal');
    const body = (await response.json()) as { code?: string };

    expect(response.status).toBe(403);
    expect(body.code).toBe('MISSING_TENANT');
    // 🔴 ΤΟ 401 ΕΙΝΑΙ ΑΠΑΓΟΡΕΥΜΕΝΟ ΕΔΩ, ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΗ ΜΗΧΑΝΙΚΗ: ο
    //    `enterprise-api-client` σε κάθε 401 **ανανεώνει token και επαναλαμβάνει** το
    //    αίτημα — δηλαδή θα διπλασίαζε κάθε αίτημα του ιδιωτικού χώρου, για κατάσταση που
    //    καμία ανανέωση δεν αλλάζει.
    expect(response.status).not.toBe(401);
  });

  it('Κ3 — κακοσχηματισμένη δήλωση ⇒ 400, ποτέ σιωπηλή προεπιλογή', async () => {
    mockVerifyIdToken.mockResolvedValue(ORG_TOKEN);

    const ctx = await buildRequestContext(
      request({ [REQUESTED_WORKSPACE_HEADER]: 'company:comp_x' }),
    );

    expect(isAuthenticated(ctx)).toBe(false);
    if (isAuthenticated(ctx)) throw new Error('unreachable');
    expect(ctx.reason).toBe('workspace_malformed');

    const response = createUnauthorizedResponse(ctx.reason);
    expect(response.status).toBe(400);
  });

  it('Κ4 — ο πολίτης ΧΩΡΙΣ claim μένει σε `missing_claims` (401), και είναι σκόπιμο', async () => {
    mockVerifyIdToken.mockResolvedValue(CITIZEN_TOKEN);

    const ctx = await buildRequestContext(
      request({ [REQUESTED_WORKSPACE_HEADER]: 'personal' }),
    );

    expect(isAuthenticated(ctx)).toBe(false);
    if (isAuthenticated(ctx)) throw new Error('unreachable');
    // ⚠️ ΜΗΝ το «ενοποιήσεις» με το `workspace_personal`: ο νεοεγκεκριμένος άνθρωπος έχει
    //    ακόμα **παλιό token** χωρίς `companyId`, και το 401 είναι ΑΚΡΙΒΩΣ αυτό που
    //    πυροδοτεί την αναγκαστική ανανέωση του token ⇒ παίρνει το claim του. Ένα 403 εδώ
    //    θα τον κρατούσε κλειδωμένο έξω μέχρι να λήξει μόνο του το token.
    expect(ctx.reason).toBe('missing_claims');
  });
});

// =============================================================================
// Η ΑΠΟΣΥΡΟΜΕΝΗ ΚΕΦΑΛΙΔΑ
// =============================================================================

describe('Α — Η ΑΠΟΣΥΡΟΜΕΝΗ ΚΕΦΑΛΙΔΑ: δεκτή, αλλά ΠΟΤΕ δεν νικά τη νέα', () => {
  it('Α1 — μόνη της, μεταφράζεται στη νέα γραμματική', async () => {
    mockVerifyIdToken.mockResolvedValue(ORG_TOKEN);

    const ctx = await buildRequestContext(request({ 'x-super-admin-company-id': COMPANY }));

    expect(isAuthenticated(ctx)).toBe(true);
    if (!isAuthenticated(ctx)) throw new Error('unreachable');
    expect(ctx.requestedWorkspace).toEqual({ kind: 'org', companyId: COMPANY });
  });

  it('Α2 🔴 η ΝΕΑ νικά: παλιό πακέτο δεν μπορεί να ακυρώσει τη δήλωση ιδιωτικού χώρου', async () => {
    mockVerifyIdToken.mockResolvedValue(ORG_TOKEN);

    const ctx = await buildRequestContext(
      request({
        [REQUESTED_WORKSPACE_HEADER]: 'personal',
        'x-super-admin-company-id': COMPANY,
      }),
    );

    expect(isAuthenticated(ctx)).toBe(false);
    if (isAuthenticated(ctx)) throw new Error('unreachable');
    expect(ctx.reason).toBe('workspace_personal');
  });
});

// =============================================================================
// Η ΠΟΡΤΑ ΤΟΥ ΠΟΛΙΤΗ — ΤΟ ΔΗΛΩΜΕΝΟ ΟΡΙΟ
// =============================================================================

describe('Π-ΠΟΛΙΤΗ — η δήλωση ΔΕΝ αλλάζει τον δρώντα του `withPersonalOrOrgAuth`', () => {
  /**
   * 🔴 **ΓΙΑΤΙ ΑΥΤΗ Η ΑΓΚΥΡΑ ΕΙΝΑΙ ΦΡΕΝΟ ΚΑΙ ΟΧΙ ΠΕΡΙΓΡΑΦΗ.**
   *
   * Η «προφανής συμμετρία» θα ήταν: δηλωμένος ιδιωτικός χώρος ⇒ ο δρών γίνεται
   * `personal` **και σε αυτή** την πόρτα. Θα ήταν **βλάβη ασφαλείας**, μετρημένη στον
   * κώδικα: το `POST /api/workspaces` κρίνει *«έχεις ήδη χώρο;»* από τον **δρώντα**
   * (`currentCompanyId: actorWorkspace(actor)`), οπότε ένα μέλος οργανισμού θα μπορούσε,
   * δηλώνοντας «ιδιωτικός χώρος», να φτιάξει **δεύτερο** χώρο και να του γραφτούν **νέα
   * claims**. Και το `GET /api/workspaces` — ο κατάλογος «οι χώροι μου», που τρέφει τον
   * επιλογέα — θα αρνιόταν μέσα στο `/o/me`, δηλαδή ο άνθρωπος θα **κλεινόταν** στον
   * ιδιωτικό του χώρο χωρίς τρόπο επιστροφής.
   *
   * ⇒ Ο δρών αυτής της πόρτας είναι **ταυτότητα**, όχι διεύθυνση. Αν χρειαστεί ποτέ να
   * αλλάξει, θα είναι **ρητή απόφαση** — και αυτή η άγκυρα θα κοκκινίσει για να τη δει
   * άνθρωπος.
   */
  it('ΠΠ1 🔴 μέλος οργανισμού + δήλωση `personal` ⇒ ο δρών μένει `organization`', async () => {
    mockVerifyIdToken.mockResolvedValue(ORG_TOKEN);
    const seen: ApiActor[] = [];

    const handler = withPersonalOrOrgAuth(async (_req, actor) => {
      seen.push(actor);
      return NextResponse.json({ ok: true });
    });

    const response = await handler(request({ [REQUESTED_WORKSPACE_HEADER]: 'personal' }));

    expect(response.status).toBe(200);
    expect(seen).toHaveLength(1);
    expect(seen[0].scope).toBe('organization');
  });

  it('ΠΠ2 — ο πολίτης εξακολουθεί να περνά αυτή την πόρτα', async () => {
    mockVerifyIdToken.mockResolvedValue(CITIZEN_TOKEN);

    const identity = await buildApiIdentity(request({ [REQUESTED_WORKSPACE_HEADER]: 'personal' }));

    expect(identity.ok).toBe(true);
    if (!identity.ok) throw new Error('unreachable');
    expect(identity.scope).toBe('personal');
  });
});
