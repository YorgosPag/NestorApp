/**
 * =============================================================================
 * Η ΑΓΚΥΡΑ ΤΗΣ ΙΣΟΔΥΝΑΜΙΑΣ ΤΩΝ ΔΥΟ ΚΡΙΤΩΝ (ADR-801 §2.6 · Φάση 3γ)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Όπου οι δύο κριτές ρωτούν το ΙΔΙΟ πράγμα, δίνουν την ίδια
 * απάντηση;»*
 *
 * Υπάρχουν **δύο** PDP και **δεν είναι διπλότυπα** — ο ένας είναι δομικά
 * αδύνατο να τρέξει στον φυλλομετρητή (`server-only` + Firestore Admin), ο
 * άλλος οφείλει να απαντά σύγχρονα για την **εργονομία**. Αλλά στο **κοινό
 * τους πεδίο** — ερώτημα **χωρίς πόρο** — η διαφωνία τους είναι σφάλμα.
 *
 * ⚠️ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΔΥΟ ΑΝΕΞΑΡΤΗΤΕΣ ΜΗΧΑΝΕΣ, ΟΧΙ ΜΙΑ ΜΕ ΤΟΝ ΕΑΥΤΟ
 * ΤΗΣ.** Η άγκυρα δεν συγκρίνει τον κριτή με στιγμιότυπο δικό του (σχήμα
 * ADR-790 §9.1, όπου ο παρονομαστής μετακινούνταν μαζί με τη μετάλλαξη): τρέχει
 * τον **πραγματικό** `decideCapability` και τον **πραγματικό** `checkPermission`.
 *
 * 🔬 **ΒΑΘΜΟΝΟΜΗΣΗ**: γράφτηκε **ΠΡΙΝ** τη διόρθωση και ήταν **ΚΟΚΚΙΝΗ** στον
 * `pagonis.oe@gmail.com` (πελάτης ✅ `granted-by-permission` / server ⛔
 * `permission_not_in_role`) **και** στο τυπογραφικό `'toString'` (πελάτης ⛔ /
 * server **✅ από το bypass**). Χωρίς αυτό, ένα «περνά» θα μπορούσε να σημαίνει
 * ότι **δεν υπήρξε ποτέ βλάβη** (μάθημα CHECK 3.45).
 *
 * 🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ — τι ΔΕΝ συγκρίνεται, και γιατί:**
 * - **Ερώτημα ΜΕ πόρο** (`projectId`/`propertyId`): ο πελάτης **δεν έχει** τη
 *   διάσταση. Το φυλάει χωριστά η ομάδα `Α4`.
 * - **Ρόλος εκτός `GLOBAL_ROLES`** (π.χ. το ιστορικό `'admin'`): ο server
 *   **δομικά** δεν τον δέχεται (`extractCustomClaims` → `isValidGlobalRole`),
 *   άρα δεν υπάρχει κοινό πεδίο. Ο πελάτης τον κρίνει `denied-unknown-role`
 *   (φυλάσσεται στο `authority.test.ts`).
 * - **Ταυτότητα χωρίς `globalRole`**: ο server δεν παράγει `AuthContext`.
 */

// ⚠️ Το `permissions.ts` φέρνει τον Firestore Admin **μεταβατικά** (μέσω των
//    lookups του σκέλους με πόρο). Στο μη-εμβελειοποιημένο σκέλος δεν αγγίζεται
//    ποτέ — αλλά το module φορτώνεται, οπότε mock-άρεται με το πρότυπο του
//    `audit-core-persistence.test.ts`.
jest.mock('@/lib/firebaseAdmin', () => ({
  isFirebaseAdminAvailable: () => false,
  getAdminFirestore: () => {
    throw new Error(
      'Ο Firestore ΔΕΝ επιτρέπεται να κληθεί στο μη-εμβελειοποιημένο σκέλος. ' +
      'Αν αυτό έσκασε, ο `checkPermission` άρχισε να διαβάζει βάση εκεί που ' +
      'έκρινε από claims — και η ισοδυναμία με τον σύγχρονο κριτή έγινε αδύνατη.',
    );
  },
  getAdminAuth: () => {
    throw new Error('unused');
  },
}));

import { decideCapability } from '../authority';
import { checkPermission } from '../permissions';
import { GLOBAL_ROLES, type AuthContext, type GlobalRole, type PermissionId } from '../types';
import type { CapabilitySubject } from '@/types/capability-authority';

// =============================================================================
// ΤΑ ΠΡΑΓΜΑΤΙΚΑ ΕΓΓΡΑΦΑ — όχι fixtures
// =============================================================================

/**
 * Στιγμιότυπο της ζωντανής `users` (2026-08-25), **περιορισμένο** στα έγγραφα
 * που μπορούν να φτάσουν **και στους δύο** κριτές.
 *
 * ⚠️ `mugeshraotech@gmail.com` (`globalRole: null`) και το ιστορικό
 * `dev-admin` με `globalRole: 'admin'` **δεν** είναι εδώ — όχι από παράλειψη:
 * ο server δεν παράγει γι' αυτούς `AuthContext`, άρα δεν υπάρχει κοινό πεδίο.
 */
const LIVE_SUBJECTS: ReadonlyArray<{
  readonly label: string;
  readonly globalRole: GlobalRole;
  readonly permissions?: readonly PermissionId[];
}> = [
  {
    label: 'georgios.pagonis@gmail.com — super_admin + ρητό admin_access',
    globalRole: 'super_admin',
    permissions: ['admin_access'],
  },
  {
    label: 'pagonis.oe@gmail.com — external_user + ρητό admin_access (Η ΑΠΟΚΛΙΣΗ)',
    globalRole: 'external_user',
    permissions: ['admin_access'],
  },
  {
    label: 'dev-admin — super_admin χωρίς claim permissions',
    globalRole: 'super_admin',
  },
  {
    label: 'συνθετικός company_admin χωρίς claim — ο ρόλος μόνος του',
    globalRole: 'company_admin',
  },
  {
    label: 'συνθετικός internal_user χωρίς claim — ο πιο περιορισμένος με ρόλο',
    globalRole: 'internal_user',
  },
];

/**
 * Οι ικανότητες που ρωτιούνται — **μία ανά κατηγορία απάντησης**, ώστε η
 * ισοδυναμία να μην αποδεικνύεται πάνω σε ένα μόνο μονοπάτι.
 */
const PROBED_ACTIONS: ReadonlyArray<{ readonly action: string; readonly why: string }> = [
  { action: 'admin_access', why: 'ρητό claim ΚΑΙ permission του company_admin' },
  { action: 'projects:projects:view', why: 'το δίνει ο ρόλος (ακόμη και ο external_user)' },
  { action: 'users:users:manage', why: 'το δίνει μόνο ο company_admin' },
  { action: 'dxf:text:edit', why: 'δεν το δίνει κανένας καθολικός ρόλος' },
  { action: 'toString', why: '🔴 ιδιότητα prototype — ΔΕΝ είναι ικανότητα' },
  { action: 'dfx:view', why: 'τυπογραφικό — άγνωστη ικανότητα' },
];

function asAuthContext(s: (typeof LIVE_SUBJECTS)[number]): AuthContext {
  return {
    uid: 'u',
    email: 'u@example.com',
    companyId: 'comp_test',
    globalRole: s.globalRole,
    mfaEnrolled: false,
    isAuthenticated: true,
    permissions: s.permissions,
  };
}

function asCapabilitySubject(s: (typeof LIVE_SUBJECTS)[number]): CapabilitySubject {
  return { globalRole: s.globalRole, permissions: s.permissions ?? null, companyId: 'comp_test' };
}

const GRANTING_VERDICTS = new Set(['granted-by-bypass', 'granted-by-permission', 'granted-by-role']);

// =============================================================================

describe('ADR-801 §2.6 — ΙΣΟΔΥΝΑΜΙΑ ΤΩΝ ΔΥΟ PDP (ερώτημα χωρίς πόρο)', () => {
  // ---------------------------------------------------------------------------
  // Κ0 — ο παρονομαστής των ίδιων των αγκυρών
  // ---------------------------------------------------------------------------
  describe('Κ0 — ο παρονομαστής', () => {
    it('Κ0.1 — κάθε δοκιμαζόμενος ρόλος ανήκει στο λεξιλόγιο των claims', () => {
      for (const s of LIVE_SUBJECTS) {
        expect(GLOBAL_ROLES as readonly string[]).toContain(s.globalRole);
      }
    });

    it('Κ0.2 — οι ερωτήσεις καλύπτουν ΚΑΙ επιτρεπτικές ΚΑΙ απορριπτικές απαντήσεις', () => {
      const verdicts = new Set<string>();
      for (const s of LIVE_SUBJECTS) {
        for (const { action } of PROBED_ACTIONS) {
          verdicts.add(
            decideCapability({
              subject: asCapabilitySubject(s),
              action: action as PermissionId,
            }).verdict,
          );
        }
      }
      // Χωρίς αυτό, μια σουίτα όπου ΟΛΑ απορρίπτονται θα ήταν «ισοδύναμη» και
      // δεν θα κοιτούσε τίποτα.
      expect([...verdicts].some((v) => GRANTING_VERDICTS.has(v))).toBe(true);
      expect([...verdicts].some((v) => !GRANTING_VERDICTS.has(v))).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Α1 — η ισοδυναμία, εξαντλητικά
  // ---------------------------------------------------------------------------
  describe('Α1 — κάθε (ταυτότητα × ικανότητα) δίνει την ίδια απάντηση', () => {
    for (const s of LIVE_SUBJECTS) {
      for (const { action, why } of PROBED_ACTIONS) {
        it(`Α1 — ${s.label} × ${action} (${why})`, async () => {
          const client = decideCapability({
            subject: asCapabilitySubject(s),
            action: action as PermissionId,
          });
          const server = await checkPermission(asAuthContext(s), action as PermissionId, {});

          expect({ who: s.label, action, granted: server.granted }).toEqual({
            who: s.label,
            action,
            granted: GRANTING_VERDICTS.has(client.verdict),
          });
        });
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Α2 — το ονομαστικό περιστατικό, ρητά
  // ---------------------------------------------------------------------------
  it('Α2 — ο `pagonis.oe` παίρνει `admin_access` ΚΑΙ από τους δύο (ήταν η απόκλιση §2.6)', async () => {
    const oe = LIVE_SUBJECTS[1];
    expect(decideCapability({ subject: asCapabilitySubject(oe), action: 'admin_access' }).verdict)
      .toBe('granted-by-permission');

    const server = await checkPermission(asAuthContext(oe), 'admin_access', {});
    expect(server.granted).toBe(true);
    expect(server.source).toBe('company_scoped_claim');
  });

  it('Α2γ — η ΠΗΓΗ ξεχωρίζει claim από ρόλο, και δεν λέει ψέματα', async () => {
    // ⚠️ Γεννήθηκε από μετάλλαξη που ΕΜΕΙΝΕ ΠΡΑΣΙΝΗ: το `source` του καθολικού
    //    ρόλου ήταν `'project_role'` — **ψευδές**, εδώ δεν υπάρχει έργο — και
    //    κανένα test δεν το κοιτούσε. Το `source` είναι η μόνη λέξη που λέει
    //    **από πού** ήρθε η παραχώρηση· αν λέει ψέματα, το log του `withAuth`
    //    (§2.8, Β6) παραπλανά ακριβώς όταν το χρειάζεσαι.
    const viaRole = await checkPermission(asAuthContext(LIVE_SUBJECTS[3]), 'users:users:manage', {});
    expect(viaRole).toEqual({ granted: true, reason: null, source: 'global_role' });

    const viaClaim = await checkPermission(asAuthContext(LIVE_SUBJECTS[1]), 'admin_access', {});
    expect(viaClaim.source).toBe('company_scoped_claim');

    const viaBypass = await checkPermission(asAuthContext(LIVE_SUBJECTS[2]), 'admin_access', {});
    expect(viaBypass.source).toBe('global_role_bypass');
  });

  it('Α2β — ΠΑΡΟΝΟΜΑΣΤΗΣ: ο ίδιος ρόλος ΧΩΡΙΣ το claim ΔΕΝ παίρνει `admin_access`', async () => {
    const withoutClaim = { label: 'x', globalRole: 'external_user' as GlobalRole };
    expect(
      decideCapability({ subject: asCapabilitySubject(withoutClaim), action: 'admin_access' }).verdict,
    ).toBe('denied-insufficient');

    const server = await checkPermission(asAuthContext(withoutClaim), 'admin_access', {});
    expect(server.granted).toBe(false);
    expect(server.reason).toBe('permission_not_in_role');
  });

  // ---------------------------------------------------------------------------
  // Α3 — η τρύπα του prototype (§2.9)
  // ---------------------------------------------------------------------------
  it('Α3 — `toString` ΔΕΝ είναι ικανότητα, ούτε καν για τον `super_admin`', async () => {
    const su = LIVE_SUBJECTS[0];
    expect(decideCapability({ subject: asCapabilitySubject(su), action: 'toString' as PermissionId }).verdict)
      .toBe('denied-unknown-action');

    // 🔴 Πριν το §2.9 αυτό επέστρεφε `granted: true` μέσω `global_role_bypass`:
    //    το `isValidPermission` έκανε `permission in PERMISSIONS`, και το `in`
    //    βλέπει ΟΛΟ το prototype.
    const server = await checkPermission(asAuthContext(su), 'toString' as PermissionId, {});
    expect(server.granted).toBe(false);
    expect(server.reason).toBe('invalid_permission');
  });

  // ---------------------------------------------------------------------------
  // Α4 — ΤΟ ΔΗΛΩΜΕΝΟ ΟΡΙΟ: η παραχώρηση είναι εμβέλειας ΕΤΑΙΡΕΙΑΣ
  // ---------------------------------------------------------------------------
  describe('Α4 — το claim ΔΕΝ απαντά σε ερώτημα με πόρο', () => {
    it('Α4.1 — με `projectId`, το ρητό claim δεν υποκαθιστά τη συμμετοχή στο έργο', async () => {
      // Ο `external_user` με ρητό `projects:projects:update` στο claim.
      const ctx = asAuthContext({
        label: 'x',
        globalRole: 'external_user',
        permissions: ['projects:projects:update'],
      });

      const unscoped = await checkPermission(ctx, 'projects:projects:update', {});
      expect(unscoped.granted).toBe(true); // ✅ εμβέλεια εταιρείας

      const scoped = await checkPermission(ctx, 'projects:projects:update', { projectId: 'p1' });
      // ⚠️ ΜΗΝ «διορθώσεις» αυτό σε `true`. Το claim γράφεται ως
      //    `rolePermissions ∪ extras` (claims-handler.ts:159) και ο ΡΟΛΟΣ δεν
      //    απαντά σε ερώτημα με πόρο· αν το claim απαντούσε, το ΙΔΙΟ permission
      //    id θα συμπεριφερόταν αλλιώς ανάλογα με τη διαδρομή παράδοσης.
      expect(scoped.granted).toBe(false);
      expect(scoped.reason).toBe('no_project_membership');
    });

    it('Α4.2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ο `super_admin` ΟΝΤΩΣ περνά και με πόρο (bypass)', async () => {
      // Αλλιώς το Α4.1 θα ήταν πράσινο επειδή το σκέλος με πόρο αρνείται
      // **σε όλους** — δηλαδή δεν θα απεδείκνυε τίποτα για το claim.
      const ctx = asAuthContext(LIVE_SUBJECTS[0]);
      const scoped = await checkPermission(ctx, 'projects:projects:update', { projectId: 'p1' });
      expect(scoped.granted).toBe(true);
      expect(scoped.source).toBe('global_role_bypass');
    });
  });
});
