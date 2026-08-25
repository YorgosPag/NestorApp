/**
 * =============================================================================
 * ΟΙ ΙΚΑΝΟΤΗΤΕΣ ΚΕΙΜΕΝΟΥ — ΑΓΚΥΡΕΣ **ΜΕ ΠΑΡΟΝΟΜΑΣΤΗ** (ADR-801 Φάση 3)
 * =============================================================================
 *
 * 🔴 **ΓΙΑΤΙ ΞΑΝΑΓΡΑΦΤΗΚΕ ΟΛΟ.** Η προηγούμενη εκδοχή είχε **11 πράσινα** tests
 * που καλούσαν την καθαρή συνάρτηση με `'architect'`·`'foreman'`·`'client'` —
 * τιμές που **η ζωντανή διαδρομή δεν παράγει ΠΟΤΕ**. Το `useUserRole().user.role`
 * έχει **τρεις** δυνατές τιμές (`'admin'`·`'authenticated'`·`'public'`), άρα
 * **10 από τους 13** κλάδους του πίνακα ήταν δομικά νεκροί και τα tests
 * επικύρωναν κώδικα που δεν εκτελείται. *Ο παρονομαστής έλειπε.*
 *
 * ⇒ Η ομάδα **Π** εδώ **είναι** ο παρονομαστής: κρίνει μόνο ταυτότητες που ο
 *   `buildAuthUser` μπορεί να κατασκευάσει από **επαληθευμένα claims**, και
 *   απαιτεί κάθε κάδος του αποτελέσματος να είναι **προσιτός** από τουλάχιστον
 *   μία τέτοια ταυτότητα (πρότυπο: ομάδα `Λ` του `authority.test.ts`).
 */

import { renderHook } from '@testing-library/react';


let mockAuthState: {
  user: { globalRole?: string | null; permissions?: string[] | null } | null;
  loading: boolean;
} = { user: null, loading: false };

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

import { PREDEFINED_ROLES } from '@/lib/auth/roles';
import { GLOBAL_ROLES, PERMISSIONS, isValidGlobalRole } from '@/lib/auth/types';
import type { CapabilitySubject } from '@/types/capability-authority';
import { useCanEditText } from '../useCanEditText';
import {
  capabilitiesForSubject,
  TEXT_EDIT_ACTIONS,
  TEXT_EDIT_PERMISSIONS,
  type TextEditCapabilities,
} from '../text-edit-capabilities';

const subject = (
  globalRole: string | null,
  permissions?: readonly string[],
): CapabilitySubject => ({ globalRole, permissions: permissions ?? null });

const shape = (c: TextEditCapabilities): string =>
  [c.canCreate, c.canEdit, c.canDelete, c.canUnlockLayer].map(Number).join('');

// =============================================================================
// Π — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: τι μπορεί ΠΡΑΓΜΑΤΙΚΑ να φτάσει εδώ
// =============================================================================

describe('Π — ο παρονομαστής (μόνο παραγώγιμες ταυτότητες)', () => {
  it('Π0 — οι τέσσερις ικανότητες ΥΠΑΡΧΟΥΝ στο μητρώο και είναι διακριτές', () => {
    // Αν ένα κλειδί ήταν τυπογραφικό, ΚΑΘΕ άγκυρα θα περνούσε μέσω
    // `denied-unknown-action` — όλες πράσινες, καμία να μην κοιτά.
    expect(new Set(TEXT_EDIT_PERMISSIONS).size).toBe(4);
    for (const action of TEXT_EDIT_PERMISSIONS) {
      expect(Object.hasOwn(PERMISSIONS, action)).toBe(true);
    }
  });

  it('Π1 — το claim globalRole δέχεται ΜΟΝΟ τα GLOBAL_ROLES (4 τιμές)', () => {
    // Ο `claims-handler` γράφει μόνο ό,τι περνά το `isValidGlobalRole`.
    expect([...GLOBAL_ROLES]).toHaveLength(4);
    for (const role of GLOBAL_ROLES) expect(isValidGlobalRole(role)).toBe(true);
    for (const dead of ['architect', 'engineer', 'foreman', 'client', 'admin']) {
      expect(isValidGlobalRole(dead)).toBe(false);
    }
  });

  it('Π2 — ΚΑΘΕ παραγώγιμος ρόλος δίνει σχήμα που το SSoT των ρόλων εξηγεί', () => {
    for (const role of GLOBAL_ROLES) {
      const caps = capabilitiesForSubject(subject(role));
      const def = PREDEFINED_ROLES[role];
      const expected = def.isBypass
        ? '1111'
        : [
            TEXT_EDIT_ACTIONS.canCreate,
            TEXT_EDIT_ACTIONS.canEdit,
            TEXT_EDIT_ACTIONS.canDelete,
            TEXT_EDIT_ACTIONS.canUnlockLayer,
          ]
            .map((a) => Number(def.permissions.includes(a)))
            .join('');
      expect(`${role}:${shape(caps)}`).toBe(`${role}:${expected}`);
    }
  });

  it('Π3 — κανένας κάδος αποτελέσματος δεν είναι απρόσιτος (ΠΛΗΡΟΤΗΤΑ)', () => {
    // Ο λόγος ύπαρξης αυτού του αρχείου: πίνακας του οποίου κάδος δεν μπορεί
    // να πυροδοτήσει από τη ζωντανή διαδρομή είναι ψέμα με πράσινο test.
    const reachable = new Set(
      GLOBAL_ROLES.map((r) => shape(capabilitiesForSubject(subject(r)))),
    );
    expect(reachable.has('1111')).toBe(true); // super_admin / company_admin
    expect(reachable.has('0000')).toBe(true); // internal_user / external_user
    expect(reachable.size).toBeGreaterThan(1); // ΟΧΙ μονότονη απάντηση
  });
});

// =============================================================================
// Κ — ΤΟ ΣΥΜΒΟΛΑΙΟ
// =============================================================================

describe('Κ — το συμβόλαιο των ικανοτήτων κειμένου', () => {
  it('Κ1 — ο super_admin τα παίρνει ΟΛΑ, μέσω bypass', () => {
    const caps = capabilitiesForSubject(subject('super_admin'));
    expect(shape(caps)).toBe('1111');
    expect(caps.denyReason).toBeNull();
  });

  it('Κ2 — ο company_admin τα παίρνει ΟΛΑ, μέσω ρόλου', () => {
    const caps = capabilitiesForSubject(subject('company_admin'));
    expect(shape(caps)).toBe('1111');
    expect(caps.denyReason).toBeNull();
  });

  it('Κ3 — 🔴 Η ΡΙΖΑ ΤΟΥ BUG: ο company_admin ΔΕΝ παίρνει πια μηδέν', () => {
    // Πριν: `useUserRole().user.role` έδινε `'authenticated'` ⇒ default ⇒ NONE.
    expect(capabilitiesForSubject(subject('company_admin')).canEdit).toBe(true);
  });

  it('Κ4 — ο internal_user δεν επεξεργάζεται κείμενο, και ΛΕΕΙ γιατί', () => {
    const caps = capabilitiesForSubject(subject('internal_user'));
    expect(shape(caps)).toBe('0000');
    expect(caps.denyReason).toBe('auth:capability.denyReason.insufficient');
  });

  it('Κ5 — καμία ταυτότητα ⇒ άλλος λόγος από «ανεπαρκής»', () => {
    const caps = capabilitiesForSubject(null);
    expect(shape(caps)).toBe('0000');
    expect(caps.denyReason).toBe('auth:capability.denyReason.notAuthenticated');
  });

  it('Κ6 — ρόλος εκτός λεξιλογίου ⇒ ΟΝΟΜΑΖΕΤΑΙ, δεν σιωπά', () => {
    // Μετρημένο ζωντανά: το `users/dev-admin` έφερε `globalRole: 'admin'`.
    const caps = capabilitiesForSubject(subject('admin'));
    expect(shape(caps)).toBe('0000');
    expect(caps.denyReason).toBe('auth:capability.denyReason.unknownRole');
  });

  it('Κ7 — απουσία ρόλου ΔΕΝ είναι άγνωστος ρόλος (ο ιδιώτης)', () => {
    for (const raw of [null, '', '   ']) {
      const caps = capabilitiesForSubject(subject(raw));
      expect(caps.denyReason).toBe('auth:capability.denyReason.insufficient');
    }
  });

  it('Κ8 — ΡΗΤΗ παραχώρηση στο claim permissions πιάνει τόπο', () => {
    // Ήταν αδύνατο με τον πίνακα ρόλων: δεν υπήρχε καν διαδρομή.
    const caps = capabilitiesForSubject(
      subject('internal_user', ['dxf:text:edit']),
    );
    expect(caps.canEdit).toBe(true);
    expect(caps.canDelete).toBe(false);
    expect(caps.denyReason).toBeNull();
  });

  it('Κ9 — ο denyReason κρέμεται ΜΟΝΟ από την κύρια πράξη', () => {
    // Μπορεί να γράφει αλλά όχι να σβήνει ⇒ κανένα μήνυμα άρνησης.
    const caps = capabilitiesForSubject(
      subject('internal_user', ['dxf:text:create', 'dxf:text:edit']),
    );
    expect(caps.canEdit).toBe(true);
    expect(caps.canDelete).toBe(false);
    expect(caps.denyReason).toBeNull();
  });

  it('Κ10 — 🔶 ΤΟ ΔΗΛΩΜΕΝΟ ΟΡΙΟ: οι ρόλοι ΕΡΓΟΥ δεν θεραπεύονται εδώ', () => {
    // Τα `architect`/`engineer`/`project_manager`/`site_manager` **έχουν**
    // δικαιώματα κειμένου στο SSoT — και ο κριτής τα τιμά αν του δοθούν…
    for (const projectRole of ['architect', 'engineer', 'project_manager']) {
      expect(capabilitiesForSubject(subject(projectRole)).canEdit).toBe(true);
    }
    // …ΑΛΛΑ κανένα δεν μπορεί να είναι τιμή του claim `globalRole` (Π1), άρα
    // η ζωντανή διαδρομή δεν φτάνει ΠΟΤΕ εδώ με αυτές. Η ικανότητά τους
    // απαντιέται **ανά έργο** (`checkPermission(ctx, action, { projectId })`) —
    // η διάσταση `resource` που ο κριτής δηλωμένα δεν έχει (ADR-801 §7).
    for (const projectRole of ['architect', 'engineer', 'project_manager']) {
      expect(isValidGlobalRole(projectRole)).toBe(false);
    }
  });

  it('Κ11 — ονόματα εκτός ΚΑΘΕ λεξιλογίου ονομάζονται άγνωστα', () => {
    // Το `foreman` και το `client` ήταν κλάδοι του παλιού πίνακα και δεν
    // υπάρχουν πουθενά — τώρα δεν σιωπούν ως «ανεπαρκή», λέγονται άγνωστα.
    for (const ghost of ['foreman', 'client', 'mystery_role']) {
      expect(Object.hasOwn(PREDEFINED_ROLES, ghost)).toBe(false);
      const caps = capabilitiesForSubject(subject(ghost));
      expect(shape(caps)).toBe('0000');
      expect(caps.denyReason).toBe('auth:capability.denyReason.unknownRole');
    }
  });
});

// =============================================================================
// Ρ — Η ΚΑΛΩΔΙΩΣΗ: εκεί ήταν το bug, ΟΧΙ στην καθαρή συνάρτηση
// =============================================================================

describe('Ρ — το άγκιστρο διαβάζει τη ΣΩΣΤΗ ταυτότητα', () => {
  it('Ρ1 — 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: company_admin από claims ⇒ πλήρη δικαιώματα', () => {
    // Πριν, το άγκιστρο διάβαζε `useUserRole().user.role` ⇒ 'authenticated'
    // ⇒ NONE. Η καθαρή συνάρτηση ήταν σωστή· η **πηγή** ήταν λάθος, και καμία
    // από τις 11 προηγούμενες άγκυρες δεν κοιτούσε την πηγή.
    mockAuthState = { user: { globalRole: 'company_admin' }, loading: false };
    const { result } = renderHook(() => useCanEditText());
    expect(shape(result.current)).toBe('1111');
    expect(result.current.denyReason).toBeNull();
  });

  it('Ρ2 — ο παρονομαστής: internal_user ⇒ ΟΧΙ πλήρη (δεν λέει «ναι» πάντα)', () => {
    mockAuthState = { user: { globalRole: 'internal_user' }, loading: false };
    const { result } = renderHook(() => useCanEditText());
    expect(shape(result.current)).toBe('0000');
  });

  it('Ρ3 — όσο φορτώνει η ταυτότητα ΔΕΝ κατηγορεί τον χρήστη', () => {
    mockAuthState = { user: null, loading: true };
    const { result } = renderHook(() => useCanEditText());
    expect(shape(result.current)).toBe('0000');
    expect(result.current.denyReason).toBeNull();
  });

  it('Ρ4 — σταθερή ταυτότητα αντικειμένου σε επαναληπτική απόδοση', () => {
    mockAuthState = { user: { globalRole: 'company_admin' }, loading: false };
    const { result, rerender } = renderHook(() => useCanEditText());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
