/**
 * ΑΓΚΥΡΕΣ — ΤΟ ΤΑΒΑΝΙ ΤΟΥ `/admin` (ADR-813 Φάση Β)
 *
 * **Το ερώτημα**: *«Ποιος περνά τον server guard του `/admin`, και από πού το
 * μαθαίνει ο guard;»*
 *
 * ⚠️ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΤΟ ΚΕΝΤΡΟ.** Οι άγκυρες `Π` αποδεικνύουν ότι το
 * **παλιό** λεξιλόγιο ήταν όντως νεκρό και ότι η λίστα email όντως έκρινε.
 * Χωρίς αυτές, το «ο `company_admin` περνά» θα μπορούσε να είναι πράσινο
 * επειδή **δεν υπήρξε ποτέ βλάβη**.
 *
 * @see server/admin/admin-guards.ts — ο PEP
 * @see lib/auth/roles.ts — `ADMINISTRATIVE_ROLES`, η παραγωγή
 */

import type { DecodedIdToken } from 'firebase-admin/auth';
import { hasAdminRole } from '../admin-guards';
import { ADMIN_ROLES, roleRequiresMfa } from '../admin-guards-types';
import { ADMINISTRATIVE_ROLES, getRolePermissions, isRoleBypass } from '@/lib/auth/roles';
import { GLOBAL_ROLES } from '@/lib/auth/types';
import { PREDEFINED_ROLES } from '@/lib/auth/role-catalogue';

/** Ελάχιστο token — μόνο ό,τι διαβάζει ο guard. */
function token(claims: Record<string, unknown>): DecodedIdToken {
  return { uid: 'u1', email: 'kapoios@example.com', ...claims } as unknown as DecodedIdToken;
}

/** Τα ονόματα που ζούσαν στη χειρόγραφη τετράδα πριν το ADR-813 Φάση Β. */
const OLD_HARDCODED = ['admin', 'broker', 'builder', 'super_admin'] as const;

describe('Π — ο παρονομαστής: το παλιό λεξιλόγιο ΗΤΑΝ νεκρό', () => {
  it('Π1 — ΤΡΙΑ από τα τέσσερα παλιά ονόματα δεν υπάρχουν σε ΚΑΝΕΝΑ λεξιλόγιο', () => {
    const dead = OLD_HARDCODED.filter(
      (r) => !(GLOBAL_ROLES as readonly string[]).includes(r) && !Object.hasOwn(PREDEFINED_ROLES, r),
    );
    // 🔴 `admin` · `broker` · `builder` — ούτε claim, ούτε κατάλογος.
    expect([...dead].sort()).toEqual(['admin', 'broker', 'builder']);
  });

  it('Π2 — και το `company_admin`, που ΕΙΝΑΙ υπαρκτός ρόλος, ΔΕΝ ήταν στην παλιά λίστα', () => {
    // Αυτό είναι το ελάττωμα με μία γραμμή: ο μόνος διαχειριστής εταιρείας που
    // υπάρχει στο λεξιλόγιο των claims **δεν** περνούσε από ρόλο. Τον περνούσε
    // η λίστα email — γι' αυτό η αφαίρεσή της θα τον κλείδωνε έξω.
    expect((OLD_HARDCODED as readonly string[]).includes('company_admin')).toBe(false);
    expect((GLOBAL_ROLES as readonly string[]).includes('company_admin')).toBe(true);
  });
});

describe('Κ — το ταβάνι είναι ΠΑΡΑΓΟΜΕΝΟ', () => {
  it('Κ1 — το `ADMIN_ROLES` ΕΙΝΑΙ το παραγόμενο σύνολο, όχι αντίγραφό του', () => {
    // ⚠️ Ταυτότητα αναφοράς, ΟΧΙ ισότητα περιεχομένου: αντίγραφο με τις ίδιες
    //    τιμές θα περνούσε το `toEqual` και θα αποκλίνε σιωπηλά αύριο.
    expect(ADMIN_ROLES).toBe(ADMINISTRATIVE_ROLES);
  });

  it('Κ2 — και η παραγωγή του βγαίνει από τον κατάλογο, όχι από λίστα ονομάτων', () => {
    const expected = (GLOBAL_ROLES as readonly string[]).filter(
      (r) => isRoleBypass(r) || getRolePermissions(r).includes('admin_access'),
    );
    expect([...ADMIN_ROLES]).toEqual(expected);
    expect(ADMIN_ROLES.length).toBeGreaterThan(0); // παρονομαστής: δεν είναι κενό
  });

  it('Κ3 — ο `company_admin` περνά πλέον το ταβάνι', () => {
    expect(hasAdminRole(token({ globalRole: 'company_admin' }))).toBe('company_admin');
  });

  it('Κ4 — και ο `super_admin` επίσης', () => {
    expect(hasAdminRole(token({ globalRole: 'super_admin' }))).toBe('super_admin');
  });

  it('Κ5 — μη-διοικητικός ρόλος ΔΕΝ περνά', () => {
    for (const role of GLOBAL_ROLES.filter((r) => !ADMIN_ROLES.includes(r))) {
      expect({ role, verdict: hasAdminRole(token({ globalRole: role })) }).toEqual({
        role,
        verdict: null,
      });
    }
  });
});

describe('Ε — η λίστα email ΔΕΝ κρίνει πια', () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_ADMIN_EMAILS;
    else process.env.NEXT_PUBLIC_ADMIN_EMAILS = ORIGINAL;
  });

  it('Ε1 — email στη λίστα ΧΩΡΙΣ ρόλο ⇒ ⛔ (ήταν ✅ «PRIMARY METHOD»)', () => {
    process.env.NEXT_PUBLIC_ADMIN_EMAILS = 'kapoios@example.com,allos@example.com';
    // 🔴 Πριν το ADR-813 Φάση Β αυτό επέστρεφε `'admin'`.
    expect(hasAdminRole(token({ email: 'kapoios@example.com' }))).toBeNull();
  });

  it('Ε2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ο ΙΔΙΟΣ άνθρωπος ΜΕ ρόλο περνά', () => {
    // Αλλιώς το Ε1 θα ήταν πράσινο επειδή ο guard αρνείται τα πάντα.
    process.env.NEXT_PUBLIC_ADMIN_EMAILS = 'kapoios@example.com';
    expect(hasAdminRole(token({ email: 'kapoios@example.com', globalRole: 'company_admin' }))).toBe(
      'company_admin',
    );
  });

  it('Ε3 — η μεταβλητή δεν διαβάζεται ΚΑΘΟΛΟΥ: άδεια ή γεμάτη, ίδια ετυμηγορία', () => {
    delete process.env.NEXT_PUBLIC_ADMIN_EMAILS;
    const xwris = hasAdminRole(token({ email: 'kapoios@example.com' }));
    process.env.NEXT_PUBLIC_ADMIN_EMAILS = 'kapoios@example.com';
    const me = hasAdminRole(token({ email: 'kapoios@example.com' }));
    expect({ xwris, me }).toEqual({ xwris: null, me: null });
  });
});

describe('Λ — οι legacy κλάδοι έφυγαν', () => {
  it('Λ1 — το legacy `role` claim ΔΕΝ κρίνει', () => {
    expect(hasAdminRole(token({ role: 'super_admin' }))).toBeNull();
  });

  it('Λ2 — το legacy `admin === true` ΔΕΝ κρίνει', () => {
    expect(hasAdminRole(token({ admin: true }))).toBeNull();
  });

  it('Λ3 — token χωρίς τίποτα ⇒ ⛔ (deny-by-default)', () => {
    expect(hasAdminRole(token({}))).toBeNull();
  });
});

describe('M — το MFA δεν απέκλινε', () => {
  it('M1 — ΚΑΘΕ ρόλος του ταβανιού απαιτεί MFA', () => {
    for (const role of ADMIN_ROLES) {
      expect({ role, mfa: roleRequiresMfa(role) }).toEqual({ role, mfa: true });
    }
  });

  it('M2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: μη-διοικητικός ρόλος ΔΕΝ απαιτεί MFA εδώ', () => {
    // Αλλιώς το M1 θα ήταν πράσινο επειδή η συνάρτηση επιστρέφει πάντα `true`.
    const nonAdmin = GLOBAL_ROLES.filter((r) => !ADMIN_ROLES.includes(r));
    expect(nonAdmin.length).toBeGreaterThan(0);
    for (const role of nonAdmin) {
      expect({ role, mfa: roleRequiresMfa(role) }).toEqual({ role, mfa: false });
    }
  });
});
