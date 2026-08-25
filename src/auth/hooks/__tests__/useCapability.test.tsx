/**
 * =============================================================================
 * Ο PEP ΤΟΥ ΠΕΛΑΤΗ — ΑΓΚΥΡΕΣ (ADR-801 Φάση 3)
 * =============================================================================
 *
 * Το ερώτημα των αγκυρών **δεν** είναι «κρίνει σωστά;» — αυτό το απαντά ο
 * `authority.test.ts` με 30 άγκυρες. Εδώ ρωτάμε τα **τρία** που μόνο ο PEP
 * μπορεί να χαλάσει:
 *
 *   Δ — **ΔΕΝ κρίνει ο ίδιος**: κάθε απάντηση είναι ταυτόσημη με του κριτή.
 *   Ε — **ΕΚΚΡΕΜΟΤΗΤΑ**: όσο δεν έχει φτάσει η ταυτότητα, η άρνηση δεν είναι
 *       τελική — και παραμένει fail-closed για όποιον την αγνοήσει.
 *   Π — **ΠΑΡΟΝΟΜΑΣΤΗΣ**: το σχήμα που παράγει ο ζωντανός `buildAuthUser`
 *       φτάνει στον κριτή **χωρίς απώλεια**.
 *
 * ⚠️ Το Π είναι το κρίσιμο. Χωρίς αυτό, μια μετονομασία claim θα άφηνε τον PEP
 * να ταΐζει τον κριτή με `undefined` — **κάθε** άγκυρα πράσινη, **κάθε** χρήστης
 * αρνημένος. Ακριβώς το σφάλμα που έζησε ο πίνακας των 13 ρόλων.
 */

import React from 'react';
import { renderHook } from '@testing-library/react';

import { decideCapability } from '@/lib/auth/authority';
import { buildAuthUser } from '@/auth/contexts/auth-context/auth-context-session';
import type { PermissionId } from '@/lib/auth/types';
import { isGranted } from '@/types/capability-authority';
import { useCapability, useCapabilities } from '../useCapability';

// -----------------------------------------------------------------------------
// Ο διπλός του AuthContext — η ΜΟΝΗ πηγή ταυτότητας του PEP
// -----------------------------------------------------------------------------

interface FakeAuth {
  user: { globalRole?: string | null; permissions?: string[] | null } | null;
  loading: boolean;
}

let mockAuthState: FakeAuth = { user: null, loading: false };

jest.mock('../useAuth', () => ({
  useAuth: () => mockAuthState,
}));

const setAuth = (state: FakeAuth): void => {
  mockAuthState = state;
};

const ADMIN: PermissionId = 'admin_access';
const TEXT_EDIT: PermissionId = 'dxf:text:edit';

beforeEach(() => setAuth({ user: null, loading: false }));

// =============================================================================
// Δ — ΔΕΝ ΚΡΙΝΕΙ Ο ΙΔΙΟΣ
// =============================================================================

describe('Δ — ο PEP παραδίδει, δεν αποφασίζει', () => {
  const SUBJECTS = [
    { globalRole: 'super_admin', permissions: null },
    { globalRole: 'company_admin', permissions: null },
    { globalRole: 'internal_user', permissions: null },
    { globalRole: 'external_user', permissions: ['admin_access'] },
    { globalRole: 'admin', permissions: null },
    { globalRole: null, permissions: null },
  ];

  it('Δ1 — κάθε ετυμηγορία είναι ΤΑΥΤΟΣΗΜΗ με του κριτή', () => {
    for (const user of SUBJECTS) {
      for (const action of [ADMIN, TEXT_EDIT]) {
        setAuth({ user, loading: false });
        const { result } = renderHook(() => useCapability(action));
        const expected = decideCapability({ subject: user, action });
        expect({
          verdict: result.current.verdict,
          action: result.current.action,
          reason: result.current.reason,
        }).toEqual(expected);
      }
    }
  });

  it('Δ2 — καμία ταυτότητα ⇒ ό,τι λέει ο κριτής για το null', () => {
    const { result } = renderHook(() => useCapability(ADMIN));
    expect(result.current.verdict).toBe('denied-unauthenticated');
    expect(result.current.pending).toBe(false);
  });

  it('Δ3 — άγνωστη ικανότητα ⇒ ονομάζεται, ακόμη και για τον bypass', () => {
    setAuth({ user: { globalRole: 'super_admin' }, loading: false });
    const { result } = renderHook(() =>
      useCapability('dfx:view' as PermissionId),
    );
    expect(result.current.verdict).toBe('denied-unknown-action');
    expect(isGranted(result.current.verdict)).toBe(false);
  });

  it('Δ4 — η action επιστρέφεται ΡΗΤΑ (ένα «ναι» δεν ταξιδεύει αλλού)', () => {
    setAuth({ user: { globalRole: 'company_admin' }, loading: false });
    const { result } = renderHook(() => useCapability(TEXT_EDIT));
    expect(result.current.action).toBe(TEXT_EDIT);
  });
});

// =============================================================================
// Ε — Η ΕΚΚΡΕΜΟΤΗΤΑ
// =============================================================================

describe('Ε — όσο δεν έχει φτάσει η ταυτότητα', () => {
  it('Ε1 — pending, ΚΑΙ fail-closed για όποιον το αγνοήσει', () => {
    setAuth({ user: null, loading: true });
    const { result } = renderHook(() => useCapability(ADMIN));
    expect(result.current.pending).toBe(true);
    expect(isGranted(result.current.verdict)).toBe(false);
  });

  it('Ε2 — ΚΑΝΕΝΑΣ λόγος όσο εκκρεμεί — δεν κρίθηκε τίποτα', () => {
    // Ένα «δεν επιτρέπεται» στην πρώτη απόδοση είναι άρνηση που δεν συνέβη.
    setAuth({ user: null, loading: true });
    const { result } = renderHook(() => useCapability(ADMIN));
    expect(result.current.reason).toBeNull();
  });

  it('Ε3 — το loading υπερισχύει ΑΚΟΜΑ ΚΑΙ με ταυτότητα στο χέρι', () => {
    setAuth({ user: { globalRole: 'super_admin' }, loading: true });
    const { result } = renderHook(() => useCapability(ADMIN));
    expect(result.current.pending).toBe(true);
    expect(isGranted(result.current.verdict)).toBe(false);
  });

  it('Ε5 — ΚΑΙ όσο εκκρεμεί, η πύλη κουβαλά την ΑΙΤΟΥΜΕΝΗ ικανότητα', () => {
    // Χωρίς αυτό, ο κλάδος εκκρεμότητας μπορούσε να επιστρέψει σταθερή
    // `action` και το `useCapabilities` να χτίσει χάρτη όπου το **κλειδί**
    // λέει άλλο πράγμα από την **τιμή** — «ναι» που ταξιδεύει σε άλλη πράξη.
    setAuth({ user: null, loading: true });
    const { result } = renderHook(() => useCapability(TEXT_EDIT));
    expect(result.current.action).toBe(TEXT_EDIT);
  });

  it('Ε4 — μόλις φτάσει, η άρνηση γίνεται τελική ή αίρεται', () => {
    setAuth({ user: { globalRole: 'super_admin' }, loading: false });
    const { result } = renderHook(() => useCapability(ADMIN));
    expect(result.current.pending).toBe(false);
    expect(result.current.verdict).toBe('granted-by-bypass');
  });
});

// =============================================================================
// Π — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η ΖΩΝΤΑΝΗ ταυτότητα φτάνει ακέραιη
// =============================================================================

describe('Π — ο παραγωγός ταυτότητας ταιριάζει με τον κριτή', () => {
  const firebaseUser = {
    uid: 'u1',
    email: 'a@b.gr',
    displayName: null,
    photoURL: null,
    emailVerified: true,
    providerData: [],
  } as unknown as Parameters<typeof buildAuthUser>[0];

  it('Π1 — buildAuthUser παράγει ΑΚΡΙΒΩΣ τα πεδία που κρίνει ο κριτής', () => {
    const claims = {
      globalRole: 'company_admin',
      companyId: 'c1',
      permissions: ['dxf:text:edit'],
    };
    const produced = buildAuthUser(firebaseUser, claims);

    expect(produced.globalRole).toBe('company_admin');
    expect(produced.permissions).toEqual(['dxf:text:edit']);

    // Ο κριτής πάνω στο ΠΑΡΑΓΟΜΕΝΟ δίνει ό,τι και πάνω στα ΩΜΑ claims.
    expect(decideCapability({ subject: produced, action: TEXT_EDIT })).toEqual(
      decideCapability({ subject: claims, action: TEXT_EDIT }),
    );
  });

  it('Π2 — και ο PEP δίνει το ίδιο με τον κριτή πάνω στο παραγόμενο', () => {
    const produced = buildAuthUser(firebaseUser, { globalRole: 'company_admin' });
    setAuth({ user: produced, loading: false });
    const { result } = renderHook(() => useCapability(ADMIN));
    expect(result.current.verdict).toBe(
      decideCapability({ subject: produced, action: ADMIN }).verdict,
    );
    expect(isGranted(result.current.verdict)).toBe(true);
  });

  it('Π3 — claims χωρίς ρόλο ΔΕΝ γίνονται «άγνωστος ρόλος»', () => {
    const produced = buildAuthUser(firebaseUser, {});
    expect(produced.globalRole).toBeUndefined();
    setAuth({ user: produced, loading: false });
    const { result } = renderHook(() => useCapability(ADMIN));
    expect(result.current.verdict).toBe('denied-insufficient');
  });
});

// =============================================================================
// Μ — ΤΟ ΠΛΗΘΥΝΤΙΚΟ ΑΓΚΙΣΤΡΟ
// =============================================================================

describe('Μ — useCapabilities', () => {
  it('Μ1 — επιστρέφει ΑΚΡΙΒΩΣ τα κλειδιά που ζητήθηκαν, παγωμένα', () => {
    setAuth({ user: { globalRole: 'company_admin' }, loading: false });
    const { result } = renderHook(() =>
      useCapabilities([TEXT_EDIT, 'dxf:text:delete'] as PermissionId[]),
    );
    expect(Object.keys(result.current).sort()).toEqual(
      [TEXT_EDIT, 'dxf:text:delete'].sort(),
    );
    expect(Object.isFrozen(result.current)).toBe(true);
  });

  it('Μ2 — ΙΔΙΑ ταυτότητα αντικειμένου σε επαναληπτική απόδοση', () => {
    // Αλλιώς κάθε καταναλωτής με `useMemo([gates])` ξαναϋπολογίζει σε ΚΑΘΕ
    // απόδοση — και ο πρώτος καταναλωτής, το `useCanEditText`, κάνει ακριβώς
    // αυτό. Ο πίνακας φτιάχνεται inline, άρα η μνήμη ΠΡΕΠΕΙ να είναι
    // περιεχομένου, όχι ταυτότητας.
    setAuth({ user: { globalRole: 'company_admin' }, loading: false });
    const { result, rerender } = renderHook(() =>
      useCapabilities([TEXT_EDIT, 'dxf:text:delete'] as PermissionId[]),
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('Μ5 — ΚΑΘΕ κλειδί του χάρτη ισούται με την action της τιμής του', () => {
    // Ο χάρτης είναι το σημείο όπου μια λάθος `action` γίνεται σιωπηλή:
    // το UI διαβάζει με το κλειδί και εμπιστεύεται την τιμή.
    for (const loading of [false, true]) {
      setAuth({ user: { globalRole: 'company_admin' }, loading });
      const { result } = renderHook(() =>
        useCapabilities([TEXT_EDIT, ADMIN, 'dxf:text:delete'] as PermissionId[]),
      );
      for (const [key, gate] of Object.entries(result.current)) {
        expect(gate.action).toBe(key);
      }
    }
  });

  it('Μ3 — κενός πίνακας ⇒ κενός χάρτης, όχι ψεύτικο κλειδί', () => {
    setAuth({ user: { globalRole: 'company_admin' }, loading: false });
    const { result } = renderHook(() => useCapabilities([] as PermissionId[]));
    expect(Object.keys(result.current)).toEqual([]);
  });

  it('Μ4 — κάθε πύλη ταυτόσημη με το ενικό άγκιστρο', () => {
    setAuth({ user: { globalRole: 'internal_user' }, loading: false });
    const many = renderHook(() =>
      useCapabilities([TEXT_EDIT, ADMIN] as PermissionId[]),
    );
    const one = renderHook(() => useCapability(TEXT_EDIT));
    expect(many.result.current[TEXT_EDIT]).toEqual(one.result.current);
  });
});

// -----------------------------------------------------------------------------
// Μηδενικός καταναλωτής React χωρίς JSX — κρατά τον linter ήσυχο
// -----------------------------------------------------------------------------
void React;
