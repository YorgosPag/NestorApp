/**
 * @fileoverview **ΑΓΚΥΡΕΣ: «ποιανού έργα βλέπει ο super admin;»** (ADR-356 · ADR-787 §5.3 ζ).
 * @related lib/auth/super-admin-scope · app/api/projects/list · app/api/projects/bootstrap
 *
 * 🔴 **ΤΟ ΓΕΓΟΝΟΣ (2026-09-11, μετρημένο ζωντανά)**: το `/o/me/projects` έδειξε «Έργα (7)».
 * Η αλυσίδα τελείωνε **εδώ**: ο δρόμος του API έφτανε με `superAdminOverride: false`, αυτός
 * ο βοηθός το διάβαζε ως «δεν ζήτησε τίποτα» και απαντούσε `filterCompanyId: null` —
 * δηλαδή **ΟΛΗ** τη συλλογή.
 *
 * 🔑 Η ερώτηση που έλειπε δεν είναι *«άλλαξε εταιρεία;»* (αυτό απαντά το
 * `superAdminOverride`) αλλά ***«ονόμασε κάποιος εταιρεία;»***. Γι' αυτό ο super-admin μέσα
 * στο **δικό του** γραφείο έπαιρνε επίσης καθολική όψη: δεν άλλαζε τίποτα, άρα «δεν ζήτησε».
 */

import { resolveSuperAdminProjectScope } from '../super-admin-scope';
import type { AuthContext, GlobalRole } from '../types';

const OWN = 'comp_own_001';
const OTHER = 'comp_other_999';

function ctx(
  globalRole: string,
  extra: Partial<AuthContext> = {},
  companyId = OWN,
): AuthContext {
  return {
    uid: 'user_1',
    email: 'user@example.com',
    companyId,
    globalRole: globalRole as GlobalRole,
    mfaEnrolled: false,
    isAuthenticated: true,
    ...extra,
  };
}

describe('Π — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ο απλός χρήστης δεν αγγίχθηκε', () => {
  it('Π1 — πάντα ο χώρος του, με ή χωρίς δήλωση', () => {
    expect(resolveSuperAdminProjectScope(ctx('company_admin'))).toEqual({
      filterCompanyId: OWN,
      cacheSlot: `tenant:${OWN}`,
      mode: 'tenant',
    });

    expect(
      resolveSuperAdminProjectScope(
        ctx('company_admin', { requestedWorkspace: { kind: 'org', companyId: OTHER } }),
      ).filterCompanyId,
    ).toBe(OWN);
  });
});

describe('Κ — Η ΚΑΘΟΛΙΚΗ ΟΨΗ ΜΟΝΟ ΟΤΑΝ ΔΕΝ ΟΝΟΜΑΣΤΗΚΕ ΤΙΠΟΤΑ', () => {
  it('Κ1 🔴 super admin σε ΔΗΛΩΜΕΝΟ δικό του χώρο ⇒ φίλτρο, ΟΧΙ όλη η συλλογή', () => {
    // ⚠️ Αυτή είναι **ακριβώς** η περίπτωση που ξέφευγε: `superAdminOverride` **false**
    //    (ίδιος χώρος με το claim) και παρ' όλα αυτά η διεύθυνση ονομάζει εταιρεία.
    const scope = resolveSuperAdminProjectScope(
      ctx('super_admin', { requestedWorkspace: { kind: 'org', companyId: OWN } }),
    );

    expect(scope).toEqual({
      filterCompanyId: OWN,
      cacheSlot: `super:${OWN}`,
      mode: 'super-admin-scoped',
    });
  });

  it('Κ2 — δήλωση ΞΕΝΟΥ (κριμένου) χώρου ⇒ φίλτρο σε αυτόν, με δικό του cache slot', () => {
    const scope = resolveSuperAdminProjectScope(
      ctx('super_admin', {
        requestedWorkspace: { kind: 'org', companyId: OTHER },
        superAdminOverride: true,
      }, OTHER),
    );

    expect(scope.filterCompanyId).toBe(OTHER);
    expect(scope.cacheSlot).toBe(`super:${OTHER}`);
  });

  it('Κ3 — ο παλιός δρόμος (μόνο `superAdminOverride`) μένει ισοδύναμος', () => {
    // 🔶 Φτάνει ακόμα έτσι όταν ο πελάτης στέλνει την **αποσυρόμενη** κεφαλίδα από ανοιχτή
    //    καρτέλα με παλιό πακέτο (Φάση Β). Η διάζευξη κρατά τη συμπεριφορά ταυτόσημη.
    const scope = resolveSuperAdminProjectScope(
      ctx('super_admin', { superAdminOverride: true }, OTHER),
    );

    expect(scope.mode).toBe('super-admin-scoped');
    expect(scope.filterCompanyId).toBe(OTHER);
  });

  it('Κ4 — `default` (δηλωμένη σιωπή) ⇒ καθολική όψη, όπως πάντα', () => {
    const scope = resolveSuperAdminProjectScope(
      ctx('super_admin', { requestedWorkspace: { kind: 'default' } }),
    );

    expect(scope).toEqual({ filterCompanyId: null, cacheSlot: 'all', mode: 'super-admin-global' });
  });

  it('Κ5 — καμία δήλωση (context εκτός HTTP) ⇒ καθολική όψη, καμία παλινδρόμηση', () => {
    expect(resolveSuperAdminProjectScope(ctx('super_admin')).mode).toBe('super-admin-global');
  });

  /**
   * 🔴 **BELT-AND-SUSPENDERS (N.7.2 #4).** Ο ιδιωτικός χώρος **δεν φτάνει ποτέ εδώ**: τον
   * αρνείται το `buildRequestContext` με 403 `MISSING_TENANT` πριν τον handler. Αν όμως
   * κάποιος **παρακάμψει** το σύνορο (χειροποίητο context, νέα πόρτα, refactor), η
   * απάντηση **δεν επιτρέπεται** να είναι `filterCompanyId: null` — που εδώ σημαίνει
   * «ΟΛΗ η συλλογή», δηλαδή **ακριβώς η διαρροή** που έκλεισε αυτό το όριο.
   *
   * ⚠️ Η μετάλλαξη που σκοτώνει: αφαίρεση του `assertQueryableWorkspace` ⇒ ο έλεγχος
   * πέφτει στο `super-admin-global` και το test κοκκινίζει.
   */
  it('Κ6 🔴 belt-and-suspenders: `personal` ΑΡΝΕΙΤΑΙ, δεν δίνει καθολική όψη', () => {
    expect(() =>
      resolveSuperAdminProjectScope(
        ctx('super_admin', { requestedWorkspace: { kind: 'personal' } }),
      ),
    ).toThrow(/ιδιωτικός χώρος/);
  });
});
