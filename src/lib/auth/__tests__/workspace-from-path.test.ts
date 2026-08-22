/**
 * `lib/auth/workspace-from-path` — Η ΔΙΕΥΘΥΝΣΗ ΕΙΝΑΙ ΕΡΩΤΗΣΗ, ΠΟΤΕ ΑΠΟΔΕΙΞΗ
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΦΥΛΑΕΙ (ADR-787 §5.3 · Ε-5 §2/§4)
 * ─────────────────────────────────────────────────────────────────────────────
 * Τέσσερα πράγματα που, αν σπάσουν, βγάζουν **πράσινο** έλεγχο και **σπασμένη**
 * ασφάλεια:
 *
 * 1. **Ο κριτής καλείται ΠΑΝΤΑ.** Ένα ψευδώνυμο στη μπάρα του φυλλομετρητή δεν
 *    δίνει καμία άδεια — ο καθένας γράφει ό,τι θέλει.
 * 2. **`not-a-member` βγαίνει ως `not-found`** (Ε-5 §4 #1). Ένα «υπάρχει αλλά
 *    δεν επιτρέπεσαι» κάνει τη διεύθυνση **όργανο απαρίθμησης**.
 * 3. **`unknown` ΔΕΝ βγαίνει ως `not-found`** (N.12). Ένα 404 για γραφείο που
 *    **υπάρχει** και είσαι μέλος, επειδή η βάση δεν απάντησε, είναι **ψέμα**.
 * 4. **Ο ιδιωτικός χώρος κοστίζει ΜΗΔΕΝ αναγνώσεις** και δεν αποκτά ποτέ
 *    `companyId` (Ε-3 §3).
 */

const resolveAliasMock = jest.fn();
const decideMembershipMock = jest.fn();

jest.mock('@/lib/workspace/alias-registry', () => ({
  resolveAlias: (...args: unknown[]) => resolveAliasMock(...args),
}));

jest.mock('../workspace-membership', () => ({
  decideMembership: (...args: unknown[]) => decideMembershipMock(...args),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

import * as moduleUnderTest from '../workspace-from-path';
import { resolveWorkspaceFromPath } from '../workspace-from-path';
import type { CustomClaims } from '../types';

const UID = 'user-1';
const CLAIMS = { companyId: 'comp_home', globalRole: 'user' } as CustomClaims;
const FOREIGN = 'comp_foreign';

beforeEach(() => {
  resolveAliasMock.mockReset();
  decideMembershipMock.mockReset();
});

// =============================================================================
// Α — ΔΕΝ ΟΝΟΜΑΖΕΙ ΧΩΡΟ
// =============================================================================

describe('Α — διεύθυνση χωρίς πρόθεμα', () => {
  it.each(['/login', '/privacy-policy', '/', '/obligations'])(
    'Α1: «%s» ⇒ no-workspace, ΧΩΡΙΣ να αγγίξει τίποτα',
    async (path) => {
      const res = await resolveWorkspaceFromPath(path, UID, CLAIMS);
      expect(res.outcome).toBe('no-workspace');
      expect(resolveAliasMock).not.toHaveBeenCalled();
      expect(decideMembershipMock).not.toHaveBeenCalled();
    },
  );
});

// =============================================================================
// Β — Ο ΙΔΙΩΤΙΚΟΣ ΧΩΡΟΣ: ΜΗΔΕΝ ΑΝΑΓΝΩΣΕΙΣ, ΠΟΤΕ companyId
// =============================================================================

describe('Β — /o/me', () => {
  it('Β1: ⚡ ΜΗΔΕΝ αναγνώσεις — ούτε ευρετήριο, ούτε κριτής', async () => {
    // Υπάρχει επειδή υπάρχει ο άνθρωπος (Ε-3 §2). Μια αναζήτηση στο ευρετήριο θα
    // ήταν ερώτηση χωρίς νόημα, και θα κόστιζε ανάγνωση σε ΚΑΘΕ αίτημα.
    const res = await resolveWorkspaceFromPath('/o/me/demands', UID, CLAIMS);
    expect(res.outcome).toBe('resolved');
    expect(resolveAliasMock).not.toHaveBeenCalled();
    expect(decideMembershipMock).not.toHaveBeenCalled();
  });

  it('Β2: 🔴 ΔΕΝ αποκτά ΠΟΤΕ companyId (Ε-3 §3)', async () => {
    const res = await resolveWorkspaceFromPath('/o/me', UID, CLAIMS);
    if (res.outcome !== 'resolved') throw new Error('αδύνατο');
    expect(res.personal).toBe(true);
    expect(res.companyId).toBe('');
    expect(res.verdict).toBe('self');
  });

  it('Β3: το «ME» με κεφαλαία είναι ο ίδιος ιδιωτικός χώρος', async () => {
    const res = await resolveWorkspaceFromPath('/o/ME', UID, CLAIMS);
    expect(res.outcome).toBe('resolved');
  });
});

// =============================================================================
// Γ — ΞΕΝΟΣ ΧΩΡΟΣ: Ο ΚΡΙΤΗΣ ΚΑΛΕΙΤΑΙ ΠΑΝΤΑ
// =============================================================================

describe('Γ — /o/<γραφείο>', () => {
  it('Γ1: μέλος ⇒ resolved', async () => {
    resolveAliasMock.mockResolvedValue({ outcome: 'found', companyId: FOREIGN, current: true });
    decideMembershipMock.mockResolvedValue({ verdict: 'member' });

    const res = await resolveWorkspaceFromPath('/o/nikos/projects', UID, CLAIMS);
    expect(res.outcome).toBe('resolved');
    if (res.outcome !== 'resolved') throw new Error('αδύνατο');
    expect(res.companyId).toBe(FOREIGN);
    expect(res.personal).toBe(false);
  });

  it('Γ2: 🔴🔴 Ο ΚΡΙΤΗΣ ΚΑΛΕΙΤΑΙ — η διεύθυνση ΔΕΝ δίνει άδεια', async () => {
    resolveAliasMock.mockResolvedValue({ outcome: 'found', companyId: FOREIGN, current: true });
    decideMembershipMock.mockResolvedValue({ verdict: 'member' });

    await resolveWorkspaceFromPath('/o/nikos/projects', UID, CLAIMS);
    expect(decideMembershipMock).toHaveBeenCalledTimes(1);
    expect(decideMembershipMock).toHaveBeenCalledWith(
      expect.objectContaining({ uid: UID, claimCompanyId: CLAIMS.companyId }),
    );
  });

  it('Γ3: 🔴 ΜΗ ΜΕΛΟΣ ⇒ not-found, ΟΧΙ «δεν επιτρέπεσαι» (Ε-5 §4 #1)', async () => {
    // Ένα «υπάρχει αλλά δεν επιτρέπεσαι» κάνει τη διεύθυνση όργανο απαρίθμησης:
    // δοκιμάζοντας ονόματα μαθαίνεις ποια γραφεία υπάρχουν.
    resolveAliasMock.mockResolvedValue({ outcome: 'found', companyId: FOREIGN, current: true });
    decideMembershipMock.mockResolvedValue({ verdict: 'not-a-member' });

    expect((await resolveWorkspaceFromPath('/o/nikos', UID, CLAIMS)).outcome).toBe('not-found');
  });

  it('Γ4: 🔴 ΑΝΑΚΛΗΘΕΙΣ (suspended) ⇒ ΚΑΙ ΑΥΤΟΣ not-found προς τα έξω', async () => {
    resolveAliasMock.mockResolvedValue({ outcome: 'found', companyId: FOREIGN, current: true });
    decideMembershipMock.mockResolvedValue({ verdict: 'suspended' });

    expect((await resolveWorkspaceFromPath('/o/nikos', UID, CLAIMS)).outcome).toBe('not-found');
  });

  it('Γ5: ανύπαρκτο ψευδώνυμο ⇒ not-found ΧΩΡΙΣ να καλέσει τον κριτή', async () => {
    resolveAliasMock.mockResolvedValue({ outcome: 'not-found' });

    expect((await resolveWorkspaceFromPath('/o/kanenas', UID, CLAIMS)).outcome).toBe('not-found');
    expect(decideMembershipMock).not.toHaveBeenCalled();
  });

  it('Γ6: platform-bypass ⇒ resolved (ο CompanySwitcher μένει ακέραιος)', async () => {
    resolveAliasMock.mockResolvedValue({ outcome: 'found', companyId: FOREIGN, current: true });
    decideMembershipMock.mockResolvedValue({ verdict: 'platform-bypass' });

    expect((await resolveWorkspaceFromPath('/o/nikos', UID, CLAIMS)).outcome).toBe('resolved');
  });
});

// =============================================================================
// Δ — «ΑΓΝΩΣΤΟ ≠ ΚΕΝΟ» — ΤΟ 404 ΠΟΥ ΘΑ ΗΤΑΝ ΨΕΜΑ
// =============================================================================

describe('Δ — άγνωστο ≠ κενό (N.12 · Ε-5 §4 #3)', () => {
  it('Δ1: 🔴 το ευρετήριο δεν απάντησε ⇒ unavailable, ΠΟΤΕ not-found', async () => {
    resolveAliasMock.mockResolvedValue({ outcome: 'unknown' });

    expect((await resolveWorkspaceFromPath('/o/nikos', UID, CLAIMS)).outcome).toBe('unavailable');
    expect(decideMembershipMock).not.toHaveBeenCalled();
  });

  it('Δ2: 🔴 ο ΚΡΙΤΗΣ δεν μπόρεσε να ρωτήσει ⇒ unavailable, ΠΟΤΕ not-found', async () => {
    // Αυτή είναι η πιο εύκολη ένωση, και η πιο επικίνδυνη: το «δεν κοίταξα» θα
    // φορούσε τη στολή του «δεν υπάρχει», και ο άνθρωπος θα έβλεπε «η σελίδα δεν
    // υπάρχει» για ΤΟ ΔΙΚΟ ΤΟΥ γραφείο.
    resolveAliasMock.mockResolvedValue({ outcome: 'found', companyId: FOREIGN, current: true });
    decideMembershipMock.mockResolvedValue({ verdict: 'unknown' });

    expect((await resolveWorkspaceFromPath('/o/nikos', UID, CLAIMS)).outcome).toBe('unavailable');
  });

  it('Δ3: οι τέσσερις καταστάσεις είναι ΔΙΑΚΡΙΤΕΣ — όχι δύο', async () => {
    const outcomes = new Set<string>();

    outcomes.add((await resolveWorkspaceFromPath('/login', UID, CLAIMS)).outcome);

    resolveAliasMock.mockResolvedValue({ outcome: 'found', companyId: FOREIGN, current: true });
    decideMembershipMock.mockResolvedValue({ verdict: 'member' });
    outcomes.add((await resolveWorkspaceFromPath('/o/a', UID, CLAIMS)).outcome);

    decideMembershipMock.mockResolvedValue({ verdict: 'not-a-member' });
    outcomes.add((await resolveWorkspaceFromPath('/o/a', UID, CLAIMS)).outcome);

    resolveAliasMock.mockResolvedValue({ outcome: 'unknown' });
    outcomes.add((await resolveWorkspaceFromPath('/o/a', UID, CLAIMS)).outcome);

    expect(outcomes).toEqual(new Set(['no-workspace', 'resolved', 'not-found', 'unavailable']));
  });
});

// =============================================================================
// Ε — ΤΟ ΔΟΜΙΚΟ ΣΥΜΒΟΛΑΙΟ: ΚΑΜΙΑ ΑΚΡΙΤΗ ΔΙΕΞΟΔΟΣ
// =============================================================================

describe('Ε — δεν υπάρχει τρόπος να πάρεις ακρίτητο companyId', () => {
  it('Ε1: 🔴 ΤΟ ΑΡΧΕΙΟ ΕΞΑΓΕΙ **ΜΙΑ** ΣΥΝΑΡΤΗΣΗ, ΚΑΙ ΑΥΤΗ ΚΡΙΝΕΙ', () => {
    // Αν κάποιος προσθέσει βοηθό «απλώς πάρε το companyId από το pathname», ο
    // κριτής γίνεται κανόνας που ο ΕΠΟΜΕΝΟΣ καλών πρέπει να θυμάται — δηλαδή
    // ακριβώς το σχήμα που το CHECK 3.58 υπάρχει για να απαγορεύει (§5.2 στ).
    const exported = Object.keys(moduleUnderTest).filter(
      (k) => typeof (moduleUnderTest as Record<string, unknown>)[k] === 'function',
    );
    expect(exported).toEqual(['resolveWorkspaceFromPath']);
  });
});
