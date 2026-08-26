/**
 * ΑΓΚΥΡΕΣ — ΤΟ CLAIM ΚΟΥΒΑΛΑ ΤΑΥΤΟΤΗΤΑ, ΟΧΙ ΑΝΤΙΓΡΑΦΟ (ADR-813 Φάση Β)
 *
 * ⚠️ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΤΟ ΚΕΝΤΡΟ.** Οι άγκυρες `Π` αποδεικνύουν ότι η
 * **παλιά** γραφή όντως έσπαγε το όριο. Χωρίς αυτές, το «το νέο claim χωράει»
 * θα μπορούσε να είναι πράσινο επειδή **δεν υπήρξε ποτέ βλάβη** — το σχήμα
 * «0 = κανείς δεν κοίταξε» μέσα στο όργανο που το κυνηγά.
 *
 * ⚠️ **Η ΠΑΛΙΑ ΣΥΝΘΕΣΗ ΑΝΑΠΑΡΑΓΕΤΑΙ ΕΔΩ ΕΠΙΤΗΔΕΣ** (`legacyCompose`). Δεν
 * είναι αντιγραφή ζωντανού κώδικα — είναι **ο παρονομαστής**: ο κώδικας που
 * διαγράφηκε, κρατημένος ώστε η σύγκριση «πριν → μετά» να έχει δύο πλευρές.
 * Αν κάποτε πάψει να ξεπερνά το όριο (π.χ. κλαδευτεί ο κατάλογος), η `Π1`
 * κοκκινίζει και **αυτό είναι σωστό**: η αιτιολόγηση της αλλαγής θα έχει λήξει.
 *
 * @see lib/auth/claim-payload.ts — η σύνθεση και το όριο
 * @see api/admin/set-user-claims/claims-handler.ts — ο καταναλωτής
 */

import {
  composeClaimPayload,
  claimPayloadBytes,
  checkClaimFits,
  FIREBASE_CLAIM_LIMIT_BYTES,
  type ClaimPayload,
} from '../claim-payload';
import { PREDEFINED_ROLES } from '../role-catalogue';
import { decideCapability } from '../authority';
import { isGranted } from '@/types/capability-authority';
import { GLOBAL_ROLES } from '../types';
import type { GlobalRole, PermissionId } from '../types';

const COMPANY = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';

/**
 * Η **ΔΙΑΓΡΑΜΜΕΝΗ** σύνθεση — `rolePermissions ∪ extras ∪ {admin_access}`.
 * Ζει μόνο εδώ, ως παρονομαστής. ⛔ ΜΗΝ την εισαγάγεις σε κώδικα παραγωγής.
 */
function legacyCompose(role: string, extras: readonly PermissionId[] = []): ClaimPayload {
  const rolePermissions = (PREDEFINED_ROLES[role]?.permissions ?? []) as PermissionId[];
  const merged = new Set<PermissionId>([...rolePermissions, ...extras]);
  if (role === 'super_admin' || role === 'company_admin') merged.add('admin_access');
  return {
    companyId: COMPANY,
    globalRole: role as GlobalRole,
    mfaEnrolled: false,
    permissions: Array.from(merged),
  };
}

/** Κάθε ρόλος του καταλόγου — η εμβέλεια είναι **παραγόμενη**, ποτέ λίστα. */
const ALL_ROLES = Object.keys(PREDEFINED_ROLES);

describe('ADR-813 Φάση Β — Π: ο παρονομαστής (η παλιά γραφή ΟΝΤΩΣ έσπαγε)', () => {
  it('Π1 — τουλάχιστον ΔΥΟ ρόλοι ήταν αδύνατο να γραφτούν με την παλιά σύνθεση', () => {
    const broken = ALL_ROLES.filter(
      (role) => claimPayloadBytes(legacyCompose(role)) > FIREBASE_CLAIM_LIMIT_BYTES,
    );
    // Το ADR-813 §7 είχε μετρήσει ΜΟΝΟ το `company_admin`· ο `project_manager`
    // έλειπε από τη μέτρηση. Η άγκυρα κλειδώνει ότι είναι **και οι δύο**.
    expect(broken).toEqual(expect.arrayContaining(['company_admin', 'project_manager']));
    expect(broken.length).toBeGreaterThanOrEqual(2);
  });

  it('Π2 — και η υπέρβαση ήταν ουσιώδης, όχι οριακή', () => {
    const bytes = claimPayloadBytes(legacyCompose('company_admin'));
    // ~1.585 bytes έναντι ορίου 1.000 — υπέρβαση >50%, όχι στρογγυλοποίηση.
    expect(bytes).toBeGreaterThan(FIREBASE_CLAIM_LIMIT_BYTES * 1.5);
  });
});

describe('ADR-813 Φάση Β — Κ: η νέα σύνθεση', () => {
  it('Κ1 — ΚΑΘΕ ρόλος του καταλόγου χωράει πλέον στο όριο', () => {
    for (const role of ALL_ROLES) {
      const fit = checkClaimFits(
        composeClaimPayload({ companyId: COMPANY, globalRole: role as GlobalRole }),
      );
      expect({ role, fits: fit.fits }).toEqual({ role, fits: true });
    }
  });

  it('Κ2 — το claim ΔΕΝ κουβαλά τα δικαιώματα του ρόλου', () => {
    const payload = composeClaimPayload({ companyId: COMPANY, globalRole: 'company_admin' });
    const rolePerms = PREDEFINED_ROLES['company_admin']?.permissions ?? [];
    // Μόνο το `admin_access` επιβιώνει, και **ρητά** (sidebar). Τίποτε άλλο.
    expect(payload.permissions).toEqual(['admin_access']);
    expect(rolePerms.length).toBeGreaterThan(50); // ο παρονομαστής: είχε τι να κόψει
  });

  it('Κ3 — το `admin_access` επιβιώνει και για τους ΔΥΟ διοικητικούς ρόλους', () => {
    // 🔑 Ο λόγος διαφέρει: ο `company_admin` το είχε στα 54 του (που πλέον δεν
    //    αντιγράφονται), ο `super_admin` έχει `permissions: []`. Και οι δύο θα
    //    το έχαναν χωρίς τη ρητή προσθήκη ⇒ **κενό sidebar**.
    for (const role of ['super_admin', 'company_admin'] as const) {
      const payload = composeClaimPayload({ companyId: COMPANY, globalRole: role });
      expect(payload.permissions).toContain('admin_access');
    }
  });

  it('Κ4 — μη-διοικητικός ρόλος ΔΕΝ παίρνει `admin_access`', () => {
    for (const role of GLOBAL_ROLES.filter((r) => r !== 'super_admin' && r !== 'company_admin')) {
      const payload = composeClaimPayload({ companyId: COMPANY, globalRole: role });
      expect(payload.permissions).not.toContain('admin_access');
    }
  });

  it('Κ5 — τα ρητά extras περνούν αυτούσια', () => {
    const payload = composeClaimPayload({
      companyId: COMPANY,
      globalRole: 'internal_user',
      explicitPermissions: ['dxf:files:view'],
    });
    expect(payload.permissions).toContain('dxf:files:view');
  });

  it('Κ6 — άκυρο permission id πέφτει, δεν μολύνει το token', () => {
    const payload = composeClaimPayload({
      companyId: COMPANY,
      globalRole: 'internal_user',
      explicitPermissions: ['skoupidi:den:yparxei' as PermissionId],
    });
    expect(payload.permissions).not.toContain('skoupidi:den:yparxei');
  });
});

describe('ADR-813 Φάση Β — Μ: το MFA δεν σβήνεται', () => {
  it('Μ1 — υπάρχουσα εγγραφή MFA ΔΙΑΤΗΡΕΙΤΑΙ', () => {
    const payload = composeClaimPayload({
      companyId: COMPANY,
      globalRole: 'company_admin',
      previousClaims: { mfaEnrolled: true },
    });
    // 🔴 Η παλιά γραφή έγραφε σταθερό `false` ⇒ «δίνω ρόλο» = «κλειδώνω έξω».
    expect(payload.mfaEnrolled).toBe(true);
  });

  it('Μ2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: απουσία εγγραφής μένει `false` (fail-closed)', () => {
    // Αλλιώς το Μ1 θα ήταν πράσινο επειδή το πεδίο είναι πάντα `true`.
    const payload = composeClaimPayload({
      companyId: COMPANY,
      globalRole: 'company_admin',
      previousClaims: {},
    });
    expect(payload.mfaEnrolled).toBe(false);
  });

  it('Μ3 — truthy τιμή ΔΕΝ περνά για εγγραφή (`=== true`, ποτέ truthy)', () => {
    for (const junk of ['true', 1, {}, []]) {
      const payload = composeClaimPayload({
        companyId: COMPANY,
        globalRole: 'company_admin',
        previousClaims: { mfaEnrolled: junk },
      });
      expect(payload.mfaEnrolled).toBe(false);
    }
  });
});

describe('ADR-813 Φάση Β — Ι: ΚΑΜΙΑ ετυμηγορία δεν άλλαξε', () => {
  it('Ι1 — για ΚΑΘΕ ρόλο × ΚΑΘΕ δικαίωμά του, ο κριτής απαντά ταυτόσημα', () => {
    // 🔑 Η ουσία της αλλαγής: το claim μίκρυνε **χωρίς** να χάσει κανείς
    //    τίποτα, γιατί το βήμα (6) του κριτή **παράγει** τον ρόλο.
    const divergences: string[] = [];

    for (const role of ALL_ROLES) {
      const before = legacyCompose(role);
      const after = composeClaimPayload({ companyId: COMPANY, globalRole: role as GlobalRole });

      for (const action of PREDEFINED_ROLES[role]?.permissions ?? []) {
        const vBefore = decideCapability({
          subject: { globalRole: role, permissions: before.permissions },
          action,
        });
        const vAfter = decideCapability({
          subject: { globalRole: role, permissions: after.permissions },
          action,
        });
        if (isGranted(vBefore.verdict) !== isGranted(vAfter.verdict)) {
          divergences.push(`${role} × ${action}: ${vBefore.verdict} → ${vAfter.verdict}`);
        }
      }
    }

    expect(divergences).toEqual([]);
  });

  it('Ι2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: το Ι1 όντως εξέτασε δικαιώματα, δεν έτρεξε σε κενό', () => {
    // Χωρίς αυτό, ένας κατάλογος με μηδέν permissions θα έκανε το Ι1 πράσινο
    // επειδή ο βρόχος δεν μπήκε ποτέ — «κοίταξα» χωρίς να κοιτάξω.
    const examined = ALL_ROLES.reduce(
      (sum, role) => sum + (PREDEFINED_ROLES[role]?.permissions.length ?? 0),
      0,
    );
    expect(examined).toBeGreaterThan(100);
  });

  it('Ι3 — και η πηγή της παραχώρησης όντως μετακινήθηκε claim → ρόλος', () => {
    // Αν το verdict έμενε `granted-by-permission`, τότε το claim θα κουβαλούσε
    // ακόμη το δικαίωμα και η αλλαγή δεν θα είχε συμβεί.
    const action = (PREDEFINED_ROLES['company_admin']?.permissions ?? []).find(
      (p) => p !== 'admin_access',
    ) as PermissionId;
    const after = composeClaimPayload({ companyId: COMPANY, globalRole: 'company_admin' });

    const decision = decideCapability({
      subject: { globalRole: 'company_admin', permissions: after.permissions },
      action,
    });
    expect(decision.verdict).toBe('granted-by-role');
  });
});

describe('ADR-813 Φάση Β — Ο: το όριο φυλάγεται και από τα extras', () => {
  it('Ο1 — πολλά ρητά extras ΞΕΠΕΡΝΟΥΝ το όριο και το `checkClaimFits` το λέει', () => {
    // 🔑 Η κλάση, όχι το δείγμα: το request δεν έχει όριο πλήθους, οπότε ο
    //    χειριστής μπορεί να ξαναφέρει το σφάλμα από άλλη πόρτα.
    const many = (PREDEFINED_ROLES['company_admin']?.permissions ?? []) as PermissionId[];
    const fit = checkClaimFits(
      composeClaimPayload({
        companyId: COMPANY,
        globalRole: 'company_admin',
        explicitPermissions: many,
      }),
    );
    expect(fit.fits).toBe(false);
    expect(fit.overBy).toBeGreaterThan(0);
  });

  it('Ο2 — η ετυμηγορία κουβαλά ΑΡΙΘΜΟΥΣ, ποτέ σκέτο boolean', () => {
    // 🏆 Το σκαλί πάνω από τη Firebase: εκείνη λέει μόνο «too large».
    const fit = checkClaimFits(
      composeClaimPayload({ companyId: COMPANY, globalRole: 'company_admin' }),
    );
    expect(fit.limit).toBe(FIREBASE_CLAIM_LIMIT_BYTES);
    expect(fit.bytes).toBeGreaterThan(0);
    expect(fit.overBy).toBe(0);
  });

  it('Ο3 — η μέτρηση περιλαμβάνει τη σφραγίδα `claimsUpdatedAt` του γραφέα', () => {
    // ⚠️ Χωρίς αυτό η μέτρηση είναι αισιόδοξη κατά ~31 bytes και ένα claim 995
    //    bytes θα περνούσε τον έλεγχο και θα έσκαγε στη Firebase.
    const payload = composeClaimPayload({ companyId: COMPANY, globalRole: 'company_admin' });
    const naive = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    expect(claimPayloadBytes(payload)).toBeGreaterThan(naive);
  });
});
