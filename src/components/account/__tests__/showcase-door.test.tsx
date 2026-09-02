/**
 * @jest-environment jsdom
 *
 * @fileoverview **Η ΠΟΡΤΑ ΤΗΣ ΒΙΤΡΙΝΑΣ** — τρεις καταστάσεις, ποτέ boolean (ADR-841 Φ6-Β6).
 * @related components/account/ShowcaseDoor.tsx · components/account/pages/PrivateProfileContent.tsx
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΤΡΙΤΟ ΚΕΛΙ ΕΙΝΑΙ ΟΛΟΚΛΗΡΟ ΤΟ N.12, ΚΑΙ ΜΟΝΟ ΕΝΑ TEST ΤΟ ΒΛΕΠΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο πιο φυσικός τρόπος να γραφτεί αυτό το component είναι
 * `user?.companyId ?? null` — δηλαδή **δύο** κλάδοι για **τρεις** καταστάσεις.
 * Τότε, όσο η ταυτότητα δεν έχει λυθεί, ο **ιδιοκτήτης γραφείου** βλέπει «Θέλω
 * να με βρίσκουν» για ένα καρέ — και **ένα πάτημα εκεί τον στέλνει να φτιάξει
 * δεύτερο χώρο**. Καμία πύλη δεν το βλέπει· ένα καρέ δεν αφήνει ίχνος.
 *
 * ⇒ *Άγνωστο ≠ κενό*: μέχρι να μάθουμε, η πόρτα **δεν υπάρχει**.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import el from '@/i18n/locales/el/common-account.json';

/** Αληθινή επίλυση πάνω στο **ίδιο** JSON που φορτώνει η εφαρμογή. */
function resolve(key: string): string {
  const path = key.replace(/^common-account:/, '').split('.');
  let node: unknown = el;
  for (const step of path) {
    node = (node as Record<string, unknown> | undefined)?.[step];
  }
  return typeof node === 'string' ? node : `⛔ ΑΛΥΤΟ: ${key}`;
}

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => resolve(key), i18n: { language: 'el' } }),
}));

const authState: { user: { companyId?: string | null } | null } = { user: null };
jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => authState }));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { ShowcaseDoor } from '../ShowcaseDoor';
import { CREATE_WORKSPACE_ROUTE, HOME_REDIRECT_ROUTE } from '@/lib/workspace/workspace-routes';

const ABSENT_CTA = resolve('common-account:account.showcase.absentCta');
const PRESENT_CTA = resolve('common-account:account.showcase.presentCta');

describe('Π — τρεις καταστάσεις, και η τρίτη δεν είναι η πρώτη', () => {
  it('🔑 Π1 — ΧΩΡΙΣ ΧΩΡΟ: η πόρτα ανοίγει, και δείχνει στη ΜΙΑ μηχανή', () => {
    authState.user = { companyId: null };

    render(<ShowcaseDoor />);

    // 🔑 Ο μάστορας **δεν βλέπει ποτέ τη λέξη «χώρος»** — τη βλέπει ως βιτρίνα.
    expect(screen.getByText(ABSENT_CTA)).toBeInTheDocument();
    // ⚠️ Και οδηγεί στην **υπάρχουσα** διαδρομή: μια δεύτερη βιτρίνα εδώ θα ήταν
    //    δίδυμο (N.18).
    expect(screen.getByRole('link')).toHaveAttribute('href', CREATE_WORKSPACE_ROUTE);
  });

  it('🔴 Π2 — ΜΕ ΧΩΡΟ: ΠΟΤΕ «φτιάξε χώρο» — ο άνθρωπος έχει ήδη έναν', () => {
    authState.user = { companyId: 'comp_grafeio' };

    render(<ShowcaseDoor />);

    expect(screen.queryByText(ABSENT_CTA)).not.toBeInTheDocument();
    expect(screen.getByText(PRESENT_CTA)).toBeInTheDocument();
    // ⚠️ `/home` και **όχι** `/o/<ψευδώνυμο>`: το `useWorkspaceAlias()` επιστρέφει
    //    `null` εκτός προθέματος, και το `/profile` είναι εκτός.
    expect(screen.getByRole('link')).toHaveAttribute('href', HOME_REDIRECT_ROUTE);
  });

  it('🔴 Π3 — ΤΑΥΤΟΤΗΤΑ ΑΛΥΤΗ: ΤΙΠΟΤΑ — ούτε σκελετός, ούτε προεπιλογή', () => {
    // 🔴 **Η ΑΓΚΥΡΑ.** Ένα `user?.companyId ?? null` θα έδειχνε εδώ «Θέλω να με
    //    βρίσκουν» — σε άνθρωπο που **μπορεί να έχει ήδη γραφείο**.
    authState.user = null;

    const { container } = render(<ShowcaseDoor />);

    expect(container).toBeEmptyDOMElement();
  });

  it('🔴 Π3α — ΚΑΙ ΜΕ `user` ΧΩΡΙΣ ΠΕΔΙΟ `companyId`: «δεν δηλώθηκε» ⇒ χωρίς χώρο', () => {
    // ⚠️ Διακριτή περίπτωση από το Π3: **ξέρουμε** ποιος είναι ο άνθρωπος, και
    //    το προφίλ του **δεν φέρει** μισθωτή. Αυτό είναι «δεν έχει χώρο», όχι
    //    «δεν ξέρουμε» — και οφείλει να ανοίξει η πόρτα.
    authState.user = {};

    render(<ShowcaseDoor />);

    expect(screen.getByText(ABSENT_CTA)).toBeInTheDocument();
  });

  it('🔴 Π4 — ΚΑΝΕΝΑ ΚΛΕΙΔΙ ΑΛΥΤΟ: το `common-account` έχει ΚΑΘΕ κείμενο της πόρτας', () => {
    // 🔑 Χωρίς αυτό, τα Π1/Π2 θα συνέκριναν το placeholder `⛔ ΑΛΥΤΟ:` **με τον
    //    εαυτό του** — πράσινα για κείμενο που δεν υπάρχει.
    for (const user of [{ companyId: null }, { companyId: 'comp_x' }]) {
      authState.user = user;
      const { unmount } = render(<ShowcaseDoor />);
      expect(screen.queryByText(/⛔ ΑΛΥΤΟ:/)).not.toBeInTheDocument();
      unmount();
    }
  });

  it('🔴 Π5 — ΤΑ ΔΥΟ CTA ΕΙΝΑΙ ΔΥΟ: καμία ισοπέδωση σε ένα κείμενο', () => {
    // Ο `Record<>` δεν υπάρχει εδώ να φυλάξει την πληρότητα, και δύο κλειδιά με
    // **ίδιο κείμενο** θα έστελναν τον ιδιοκτήτη γραφείου και τον μάστορα στην
    // ίδια πρόταση — ενώ οι θεραπείες τους είναι **αντίθετες**.
    expect(ABSENT_CTA).not.toBe(PRESENT_CTA);
    expect(resolve('common-account:account.showcase.absentLead')).not.toBe(
      resolve('common-account:account.showcase.presentLead'),
    );
  });
});
