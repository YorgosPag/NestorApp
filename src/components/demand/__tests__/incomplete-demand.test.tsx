/**
 * @fileoverview Άγκυρες — **Η ΕΛΛΙΠΗΣ ΖΗΤΗΣΗ ΕΜΦΑΝΙΖΕΤΑΙ, ΔΕΝ ΕΞΑΦΑΝΙΖΕΤΑΙ** (ADR-864 Α15).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΕΣ ΟΙ ΑΓΚΥΡΕΣ ΥΠΑΡΧΟΥΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το σύνορο ανάγνωσης (`property-demand-from-document.ts`) βγάζει την ελλιπή ζήτηση
 * **εκτός** κάθε αθροίσματος και ταιριάσματος — καραντίνα, πρότυπο **RESO**
 * `Incomplete`. Εκείνη η πλευρά έχει ήδη τις δικές της άγκυρες.
 *
 * **Αυτό εδώ φυλάει την ΑΛΛΗ μισή απόφαση**, που είναι και η μόνη που βλέπει άνθρωπος:
 * στον **δικό του** κατάλογο η ελλιπής **εμφανίζεται**, λέει **τι λείπει**, και δίνει
 * **δρόμο διόρθωσης** (Α5 §4.1 — *ποτέ σιωπηλή εξαφάνιση*). Χωρίς αυτές τις άγκυρες, η
 * πιο εύκολη «απλοποίηση» του επόμενου —να φιλτράρει τις ελλιπείς από τη λίστα— θα
 * περνούσε **πράσινη**, και ο άνθρωπος θα έβλεπε κάτι δικό του να χάνεται μόνο του.
 *
 * | # | Κανόνας | Μετάλλαξη που πιάνει |
 * |---|---|---|
 * | Ρ1 | ελλιπής ⇒ ετικέτα + λόγος + δρόμος διόρθωσης | η κάρτα αποδίδεται ως κανονική |
 * | Ρ2 | ο λόγος **ονομάζει ΤΙ λείπει** | γενικό «σφάλμα» χωρίς πεδία |
 * | Ρ3 | ελλιπής ⇒ **καμία** πράξη κύκλου ζωής / «ψάχνω ακόμη» | κουμπιά πάνω σε κριτήρια που δεν διαβάστηκαν |
 * | Ρ4 | πλήρης ⇒ **καμία** γραμμή ελλιπούς | η ετικέτα σε κάθε ζήτηση |
 * | Σ1 | κατάλογος με 1 πλήρη + 1 ελλιπή ⇒ **ΔΥΟ** στοιχεία | σιωπηλό φιλτράρισμα των ελλιπών |
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

// 🔑 Το `t()` επιστρέφει **το κλειδί** — και, όταν υπάρχουν παράμετροι, **και την τιμή
//    τους**: αλλιώς η Ρ2 δεν θα μπορούσε να κρίνει ότι ο λόγος ονομάζει τα κενά.
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && 'gaps' in options ? `${key}|${String(options.gaps)}` : key,
    isNamespaceReady: true,
  }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('@/i18n/route-slice', () => ({ registerRouteSlice: () => undefined }));

const useMyDemands = jest.fn();
jest.mock('@/services/realtime/hooks/useMyDemands', () => ({
  useMyDemands: () => useMyDemands(),
}));

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'usr_1' } }),
}));

import { DemandCard } from '../DemandCard';
import { MyDemandsContent } from '../MyDemandsContent';
import type { StoredDemandRead } from '@/lib/demand/property-demand-from-document';
import type { DemandGap } from '@/types/property-demand';
import { demand } from '@/lib/demand/__tests__/demand-fixtures';

const K = 'property-market:demand.incomplete';

/**
 * Μια ζήτηση που **δεν διαβάστηκε ολόκληρη**, με ονομασμένα κενά.
 *
 * 🔑 Ο τύπος είναι το **κλειστό λεξιλόγιο** ({@link DemandGap}), όχι `string[]`: μια
 * άγκυρα που δέχεται ελεύθερο κείμενο θα συνέχιζε να περνά αφού κάποιος μετονομάσει
 * κενό — δηλαδή θα δοκίμαζε κόσμο που δεν υπάρχει.
 */
function incomplete(gaps: readonly DemandGap[]): StoredDemandRead {
  return { kind: 'incomplete', id: 'dmnd_a1b2c3d4', gaps };
}

/** Μια ζήτηση που διαβάστηκε ολόκληρη. */
const COMPLETE: StoredDemandRead = { kind: 'complete', demand: demand() };

describe('Ρ — η κάρτα της ελλιπούς ζήτησης', () => {
  it('Ρ1 — ελλιπής ⇒ ετικέτα, λόγος, και δρόμος διόρθωσης', () => {
    render(<DemandCard read={incomplete(['place'])} />);

    expect(screen.getByText(`${K}.badge`)).toBeInTheDocument();
    expect(screen.getByText(`${K}.reassure`)).toBeInTheDocument();

    // Ο δρόμος διόρθωσης είναι **σύνδεσμος προς τη ζήτηση**, όχι νεκρό κείμενο.
    const fix = screen.getByText(`${K}.fix`).closest('a');
    expect(fix).toHaveAttribute('href', expect.stringContaining('dmnd_a1b2c3d4'));
  });

  it('Ρ2 — ο λόγος ΟΝΟΜΑΖΕΙ τι λείπει, ποτέ γενικό «σφάλμα»', () => {
    render(<DemandCard read={incomplete(['place', 'timing'])} />);

    const why = screen.getByText(new RegExp(`^${K}\\.why\\|`));
    expect(why).toHaveTextContent(`${K}.gap.place`);
    expect(why).toHaveTextContent(`${K}.gap.timing`);
  });

  it('🔴 Ρ3 — ελλιπής ⇒ ΚΑΜΙΑ πράξη πάνω σε κριτήρια που δεν διαβάστηκαν', () => {
    render(<DemandCard read={incomplete(['lifecycle'])} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('property-market:demand.affirm.action')).not.toBeInTheDocument();
    expect(
      screen.queryByText('property-market:demand.lifecycle.active'),
    ).not.toBeInTheDocument();
  });

  it('Ρ4 — πλήρης ⇒ η κάρτα όπως ήταν, ΚΑΜΙΑ γραμμή ελλιπούς', () => {
    render(<DemandCard read={COMPLETE} />);

    expect(screen.getByText('property-market:demand.lifecycle.active')).toBeInTheDocument();
    expect(screen.queryByText(`${K}.badge`)).not.toBeInTheDocument();
  });
});

describe('🔴 Σ — ο κατάλογος ΔΕΝ εξαφανίζει (Α5 §4.1)', () => {
  it('Σ1 — μία πλήρης + μία ελλιπής ⇒ ΔΥΟ στοιχεία στη λίστα', () => {
    useMyDemands.mockReturnValue({
      state: 'ready',
      demands: [COMPLETE, incomplete(['seeks'])],
    });

    render(<MyDemandsContent />);

    // Η μετάλλαξη που πιάνει: ένα `filter(r => r.kind === 'complete')` στον κατάλογο
    // θα άφηνε **ένα** στοιχείο — και ο άνθρωπος δεν θα μάθαινε ποτέ γιατί.
    // ADR-886: κάθε κάρτα έχει πλέον **δική της** λίστα σημάτων — μετρώνται μόνο τα στοιχεία του
    // **καταλόγου** (η εξωτερική λίστα), όχι τα σήματα μέσα στις κάρτες.
    const [catalogue] = screen.getAllByRole('list');
    const entries = screen.getAllByRole('listitem').filter((item) => item.parentElement === catalogue);
    expect(entries).toHaveLength(2);
    expect(screen.getByText(`${K}.badge`)).toBeInTheDocument();
    expect(screen.getByText('property-market:demand.lifecycle.active')).toBeInTheDocument();
  });

  it('Σ2 — κενός κατάλογος μένει κενή κατάσταση, όχι «ελλιπής»', () => {
    useMyDemands.mockReturnValue({ state: 'ready', demands: [] });

    render(<MyDemandsContent />);

    expect(screen.getByText('property-market:demand.list.empty')).toBeInTheDocument();
    expect(screen.queryByText(`${K}.badge`)).not.toBeInTheDocument();
  });
});
