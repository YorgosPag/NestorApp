/**
 * @jest-environment node
 *
 * =============================================================================
 * ΤΟ ΣΥΝΟΡΟ API ΑΠΟΚΤΑ ΤΡΙΤΗ ΚΑΤΑΣΤΑΣΗ (ADR-817)
 * =============================================================================
 *
 * 🔴 **ΤΟ ΓΕΓΟΝΟΣ**: μέχρι τις 2026-08-26 η απουσία `companyId` έβγαινε **401** σε
 * κάθε μία από τις **319** διαδρομές `withAuth`. Ο πολίτης έμπαινε, προσγειωνόταν,
 * **έβλεπε** — και δεν μπορούσε να καταχωρήσει (ADR-660 §5.7).
 *
 * ⚠️ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΜΙΣΗ Η ΑΓΚΥΡΑ.** Χωρίς τις `Π*`, το «δουλεύει ο πολίτης»
 * θα μπορούσε να σημαίνει «έσπασε ο επαγγελματίας» — και κάθε `ok:true` θα ήταν
 * πράσινο για λάθος λόγο.
 */

const mockVerifyIdToken = jest.fn();

jest.mock('@/lib/firebaseAdmin', () => ({
  isFirebaseAdminAvailable: () => true,
  getAdminAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
  getAdminFirestore: () => {
    throw new Error(
      'Ο Firestore ΔΕΝ πρέπει να κληθεί: χωρίς αίτημα για άλλον χώρο, το ' +
      '`resolveEffectiveCompanyId` επιστρέφει με ΜΗΔΕΝ αναγνώσεις (ADR-787 Ε-5 §2).',
    );
  },
}));

import { NextRequest } from 'next/server';
import { buildApiIdentity, buildRequestContext } from '../auth-context';
import { isAuthenticated } from '../types';

/** Ο επαγγελματίας μέσα σε γραφείο — **ο παρονομαστής**. */
const ORG_TOKEN = {
  uid: 'uid-int-architect',
  email: 'int.architect@alpha.local',
  companyId: 'comp_alpha_emulator',
  globalRole: 'company_admin',
};

/** Ο πολίτης — **ίδιο token, ΧΩΡΙΣ `companyId`**. Μία μεταβλητή, απομονωμένη. */
const CITIZEN_TOKEN = {
  uid: 'uid-ext-owner',
  email: 'ext.owner@solo.local',
  globalRole: 'external_user',
};

function bearer(): NextRequest {
  return new NextRequest('https://nestorconstruct.gr/api/x', {
    headers: { authorization: 'Bearer a-token' },
  });
}

beforeEach(() => jest.clearAllMocks());

describe('ADR-817 §4.1 — buildApiIdentity: ΤΡΕΙΣ ρητές καταστάσεις', () => {
  it('Π1 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ο επαγγελματίας βγαίνει `organization` και κρατά τον χώρο του', async () => {
    mockVerifyIdToken.mockResolvedValue(ORG_TOKEN);

    const identity = await buildApiIdentity(bearer());

    expect(identity.ok).toBe(true);
    if (!identity.ok) throw new Error('unreachable');
    expect(identity.scope).toBe('organization');
    if (identity.scope !== 'organization') throw new Error('unreachable');
    expect(identity.ctx.companyId).toBe('comp_alpha_emulator');
  });

  it('Κ1 — ο πολίτης ΧΩΡΙΣ εταιρεία βγαίνει `personal` και ΕΧΕΙ ταυτότητα', async () => {
    mockVerifyIdToken.mockResolvedValue(CITIZEN_TOKEN);

    const identity = await buildApiIdentity(bearer());

    expect(identity.ok).toBe(true);
    if (!identity.ok) throw new Error('unreachable');
    expect(identity.scope).toBe('personal');
    expect(identity.ctx.uid).toBe('uid-ext-owner');
    expect(identity.ctx.isAuthenticated).toBe(true);
  });

  it('Κ2 — το `personal` ΔΕΝ ΚΟΥΒΑΛΑ πεδίο companyId (ούτε undefined, ούτε κενό)', async () => {
    mockVerifyIdToken.mockResolvedValue(CITIZEN_TOKEN);

    const identity = await buildApiIdentity(bearer());
    if (!identity.ok || identity.scope !== 'personal') throw new Error('unreachable');

    // ⛔ Ο μεταγλωττιστής το εγγυάται στον τύπο· εδώ κλειδώνεται και στον ΧΡΟΝΟ
    //    ΕΚΤΕΛΕΣΗΣ, γιατί ένα `companyId: ''` θα περνούσε τον τύπο ενός `Omit` αν
    //    κάποιος το πρόσθετε με spread — και θα γινόταν «κενός μισθωτής» (CHECK 3.35).
    expect(Object.prototype.hasOwnProperty.call(identity.ctx, 'companyId')).toBe(false);
  });

  it('Κ3 — ΚΕΝΗ συμβολοσειρά = ΑΠΟΥΣΙΑ, όχι μισθωτής (ADR-657 §3.5)', async () => {
    mockVerifyIdToken.mockResolvedValue({ ...CITIZEN_TOKEN, companyId: '' });

    const identity = await buildApiIdentity(bearer());

    expect(identity.ok).toBe(true);
    if (!identity.ok) throw new Error('unreachable');
    expect(identity.scope).toBe('personal');
  });

  it('Κ4 — Ο ΡΟΛΟΣ ΠΡΙΝ ΤΟΝ ΧΩΡΟ: άκυρος ρόλος ΧΩΡΙΣ εταιρεία ⇒ ΑΠΟΡΡΙΨΗ, όχι personal', async () => {
    // 🔴 ADR-807 §3.4β — με την αντίστροφη σειρά, η διόρθωση της γραφής θα
    //    **χαλάρωνε την ασφάλεια σιωπηλά**: cookie με άκυρο ρόλο θα γινόταν πολίτης.
    mockVerifyIdToken.mockResolvedValue({ ...CITIZEN_TOKEN, globalRole: 'not_a_real_role' });

    const identity = await buildApiIdentity(bearer());

    expect(identity.ok).toBe(false);
    if (identity.ok) throw new Error('unreachable');
    expect(identity.reason).toBe('missing_claims');
  });

  it('Κ5 — άκυρο token ⇒ απόρριψη με `invalid_token`', async () => {
    mockVerifyIdToken.mockResolvedValue(null);

    const identity = await buildApiIdentity(bearer());

    expect(identity.ok).toBe(false);
    if (identity.ok) throw new Error('unreachable');
    expect(identity.reason).toBe('invalid_token');
  });
});

describe('ADR-817 §4.1 — buildRequestContext: Η ΠΡΟΕΠΙΛΟΓΗ ΜΕΝΕΙ FAIL-CLOSED', () => {
  it('Π2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ο επαγγελματίας ΔΕΝ ΕΧΑΣΕ ΤΙΠΟΤΑ', async () => {
    mockVerifyIdToken.mockResolvedValue(ORG_TOKEN);

    const ctx = await buildRequestContext(bearer());

    expect(isAuthenticated(ctx)).toBe(true);
    if (!isAuthenticated(ctx)) throw new Error('unreachable');
    expect(ctx.companyId).toBe('comp_alpha_emulator');
    expect(ctx.globalRole).toBe('company_admin');
  });

  it('Κ6 — ο πολίτης ΕΞΑΚΟΛΟΥΘΕΙ να απορρίπτεται στις 319 εταιρικές διαδρομές', async () => {
    // 🔑 **ΜΗΔΕΝ ΑΛΛΑΓΗ ΣΥΜΠΕΡΙΦΟΡΑΣ** (ADR-817 §4.1): το `AuthContext` εγγυάται
    //    μισθωτή. Μια διαδρομή αποκτά προσωπική εμβέλεια ΜΟΝΟ δηλώνοντάς το.
    mockVerifyIdToken.mockResolvedValue(CITIZEN_TOKEN);

    const ctx = await buildRequestContext(bearer());

    expect(isAuthenticated(ctx)).toBe(false);
    if (isAuthenticated(ctx)) throw new Error('unreachable');
    expect(ctx.reason).toBe('missing_claims');
  });
});
