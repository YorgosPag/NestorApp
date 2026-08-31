/**
 * 🔴 **Η ΓΡΑΜΜΗ ΠΟΥ ΜΕΤΡΑΕΙ ΑΝΤΙ ΝΑ ΚΡΥΒΕΙ** — άγκυρα οθόνης (ADR-835 §4.6).
 *
 * ⚠️ **ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ ΚΑΙ ΤΙ ΟΧΙ, δηλωμένο**: το jsdom δεν έχει διάταξη. Εδώ
 * αποδεικνύεται η **απόφαση** — ποιοι κάδοι τυπώνονται, ποιοι όχι, και **πότε
 * φωνάζουν οι δύο φρουροί** — όχι η εμφάνιση, που είναι του περιηγητή.
 *
 * 🔑 Ο μεταφραστής επιστρέφει το **κλειδί**, οπότε κάθε δοκιμή ελέγχει ότι ζητήθηκε
 * το **σωστό** κλειδί. Ένα συναρμολογημένο κλειδί (παγίδα CHECK 3.8) θα φαινόταν εδώ
 * ως λάθος συμβολοσειρά.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { StayLedgerBar } from '../StayLedgerBar';
import { computeStayLedger, type StayLedger } from '@/lib/listings/stay-ledger';
import { STAY_AVAILABILITY_KINDS } from '@/lib/stay/stay-availability-vocabulary';
import type { ListingLedger } from '@/types/public-listing';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars === undefined ? key : `${key}#${JSON.stringify(vars)}`,
  }),
}));

/** Λογιστική με τους δοσμένους κάδους· οι υπόλοιποι στο μηδέν. */
function ledgerOf(counts: Partial<Record<(typeof STAY_AVAILABILITY_KINDS)[number], number>>): StayLedger {
  const byKind = { ...computeStayLedger([], () => undefined).byKind };
  let total = 0;
  for (const [kind, n] of Object.entries(counts)) {
    byKind[kind as (typeof STAY_AVAILABILITY_KINDS)[number]] = n as number;
    total += n as number;
  }
  return { total, byKind };
}

const position = (total: number, mapped: number): ListingLedger => ({
  total,
  mapped,
  unmapped: total - mapped,
});

describe('Α — «14 αγγελίες · 9 ελεύθερα · 4 κρατημένα · 1 χωρίς ημερολόγιο»', () => {
  it('τυπώνει το σύνολο ΚΑΙ κάθε μη-μηδενικό κάδο', () => {
    const stay = ledgerOf({ free: 9, occupied: 4, unknown: 1 });
    render(<StayLedgerBar stay={stay} position={position(14, 10)} asked />);

    expect(screen.getByText(/ledger\.total/)).toBeInTheDocument();
    expect(screen.getByText(/ledger\.kind\.free/)).toBeInTheDocument();
    expect(screen.getByText(/ledger\.kind\.occupied/)).toBeInTheDocument();
    expect(screen.getByText(/ledger\.kind\.unknown/)).toBeInTheDocument();
  });

  it('🔴 ΤΟ «ΧΩΡΙΣ ΔΗΛΩΜΕΝΟ ΗΜΕΡΟΛΟΓΙΟ» ΤΥΠΩΝΕΤΑΙ — δεν εξαφανίζεται σιωπηλά', () => {
    // Ο κρίσιμος κάδος: όλοι οι άλλοι θα το έκρυβαν. Είναι το «1» του §4.6.
    render(<StayLedgerBar stay={ledgerOf({ unknown: 8 })} position={position(8, 3)} asked />);
    expect(screen.getByText(/ledger\.kind\.unknown.*"count":8/)).toBeInTheDocument();
  });

  it('🔴 μηδενικοί κάδοι ΔΕΝ τυπώνονται — ο παρονομαστής', () => {
    // Χωρίς αυτό, ένα component που τυπώνει και τους εννέα πάντα θα περνούσε τα από πάνω.
    render(<StayLedgerBar stay={ledgerOf({ free: 2 })} position={position(2, 1)} asked />);
    expect(screen.queryByText(/ledger\.kind\.occupied/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ledger\.kind\.not-a-stay/)).not.toBeInTheDocument();
  });

  it('χωρίς ερώτηση, η γραμμή λέει τι λείπει αντί να σιωπά', () => {
    render(<StayLedgerBar stay={ledgerOf({ unknown: 3 })} position={position(3, 1)} asked={false} />);
    expect(screen.getByText('short-stay:ledger.idle')).toBeInTheDocument();
    expect(screen.queryByText(/ledger\.total/)).not.toBeInTheDocument();
  });
});

describe('🔴 Β — ΟΙ ΔΥΟ ΦΡΟΥΡΟΙ ΦΩΝΑΖΟΥΝ, ΚΑΙ ΞΕΧΩΡΙΣΤΑ', () => {
  it('σωστή λογιστική ⇒ ΚΑΝΕΝΑΣ συναγερμός', () => {
    render(<StayLedgerBar stay={ledgerOf({ free: 2, occupied: 1 })} position={position(3, 2)} asked />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('🔴 άθροισμα που ΔΕΝ κλείνει ⇒ `imbalanced`', () => {
    const broken: StayLedger = { ...ledgerOf({ free: 2 }), total: 5 };
    render(<StayLedgerBar stay={broken} position={position(5, 2)} asked />);
    expect(screen.getByRole('alert')).toHaveTextContent('short-stay:ledger.imbalanced');
  });

  it('🔴 ΔΥΟ ΔΙΑΜΕΡΙΣΕΙΣ ΜΕ ΑΛΛΟ ΣΥΝΟΛΟ ⇒ `disagree` — ΔΕΥΤΕΡΟ μήνυμα, όχι το ίδιο', () => {
    // Το ρεαλιστικό σφάλμα: κάποιος πέρασε στη μία τις φιλτραρισμένες, στην άλλη όλες.
    // Ένας κοινός συναγερμός θα έλεγε «κάτι δεν πάει καλά» χωρίς να πει **ποιο**.
    render(<StayLedgerBar stay={ledgerOf({ free: 3 })} position={position(9, 4)} asked />);
    expect(screen.getByRole('alert')).toHaveTextContent('short-stay:ledger.disagree');
  });

  it('🔴 όταν ΔΕΝ κλείνει, φωνάζει ΜΟΝΟ ο πρώτος — ποτέ δύο συναγερμοί μαζί', () => {
    const broken: StayLedger = { ...ledgerOf({ free: 2 }), total: 5 };
    render(<StayLedgerBar stay={broken} position={position(9, 4)} asked />);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});
