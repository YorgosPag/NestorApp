/**
 * @fileoverview Άγκυρες — **Η ΟΘΟΝΗ ΛΕΕΙ ΠΟΙΕΣ ΤΑΙΡΙΑΖΟΥΝ ΚΑΙ ΩΣ ΤΙ** (ADR-777 §8.60.16).
 *
 * Τροφοδοτούνται από την **πραγματική** μηχανή (`answerDemand`), όχι από χειροποίητη απάντηση: αν η
 * μηχανή πάψει να λέει «ως τι», η οθόνη κοκκινίζει εδώ — όχι μόνο στα tests της μηχανής.
 *
 * | # | Κανόνας | Μετάλλαξη που πιάνει |
 * |---|---|---|
 * | Λ1 | κάθε ταίριασμα: σύνδεσμος + συναλλαγή **ως κείμενο** + ποσό στη μονάδα της + περιθώριο | ετικέτα χωρίς όνομα / με την κύρια τιμή |
 * | Λ2 | ταιριάζει ως **δύο** ⇒ **δύο** ετικέτες | μόνο το `pricedAs` |
 * | Λ3 | πάνω από το όριο ⇒ «και άλλες N», ποτέ σιωπή | `slice` χωρίς μέτρηση |
 * | Λ4 | η λίστα ζει **μόνο** στο σχήμα `has-matches` | λίστα και σε άλλο σχήμα |
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

// 🔑 Το `t()` επιστρέφει το κλειδί **και** τις παραμέτρους του: έτσι κρίνεται ΤΙ ειπώθηκε, όχι μόνο ότι ειπώθηκε κάτι.
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}[${Object.values(options).map(String).join('|')}]` : key,
    isNamespaceReady: true,
  }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import { DemandAnswerPanel } from '../DemandAnswerPanel';
import { DemandMatchedListings } from '../DemandMatchedListings';
import { answerDemand, MATCHED_PREVIEW_LIMIT, NO_LISTING_KNOWLEDGE } from '@/lib/demand/demand-answer';
import { NOW_ISO, TODAY, demand, listing, seek } from '@/lib/demand/__tests__/demand-fixtures';
import type { PropertyDemand } from '@/types/property-demand';
import type { PublicListing } from '@/types/public-listing';

const K = 'property-market:demand.answer.matchedList';

const BUY_OR_RENT = demand({
  seeks: [seek('sell', { max: 250_000 }), seek('leaseOut', { max: 900 })],
});

const SALE_AND_RENT = listing({
  id: 'prop_both',
  title: 'Δυάρι Καλαμαριά',
  commercialStatus: 'for-sale-and-rent',
  commercial: { askingPrice: 200_000, finalPrice: null, rentPrice: 800, nightlyRate: null },
  offerKinds: ['sell', 'leaseOut'],
});

function answerFor(subject: PropertyDemand, listings: readonly PublicListing[]) {
  return answerDemand({
    demand: subject,
    listings,
    knowledge: NO_LISTING_KNOWLEDGE,
    otherDemands: [],
    todayDate: TODAY,
    nowIso: NOW_ISO,
  });
}

describe('DemandMatchedListings — ποιες ταιριάζουν, και ως τι', () => {
  it('Λ1+Λ2 — σύνδεσμος στην αγγελία και ΔΥΟ ετικέτες-κείμενο, η καθεμία στη μονάδα της', () => {
    render(<DemandMatchedListings answer={answerFor(BUY_OR_RENT, [SALE_AND_RENT])} />);

    expect(screen.getByRole('link', { name: 'Δυάρι Καλαμαριά' })).toHaveAttribute(
      'href',
      expect.stringContaining('prop_both'),
    );
    const terms = screen.getAllByText((text) => text.startsWith(`${K}.term[`));
    expect(terms).toHaveLength(2);
    expect(terms[0]).toHaveTextContent('property-market:demand.summary.seekKind.sell');
    expect(terms[0]).toHaveTextContent('common:priceAmount.sale');
    expect(terms[1]).toHaveTextContent('property-market:demand.summary.seekKind.leaseOut');
    expect(terms[1]).toHaveTextContent('common:priceAmount.rent');
    // Περιθώριο στη μονάδα της κάθε συναλλαγής: 50.000 € πώλησης, 100 €/μήνα ενοικίου.
    expect(screen.getAllByText((text) => text.startsWith(`${K}.headroom[`))).toHaveLength(2);
  });

  it('Λ3 — πάνω από το όριο: δείχνει το όριο και ΜΕΤΡΑ τις υπόλοιπες', () => {
    const extra = 2;
    const many = Array.from({ length: MATCHED_PREVIEW_LIMIT + extra }, (_, index) =>
      listing({ ...SALE_AND_RENT, id: `prop_${index}`, title: `Αγγελία ${index}` }),
    );
    render(<DemandMatchedListings answer={answerFor(BUY_OR_RENT, many)} />);

    expect(screen.getAllByRole('article')).toHaveLength(MATCHED_PREVIEW_LIMIT);
    expect(screen.getByText(`${K}.more[${extra}]`)).toBeInTheDocument();
  });

  it('κανένα ταίριασμα ⇒ τίποτα (ούτε κενή επικεφαλίδα)', () => {
    const { container } = render(<DemandMatchedListings answer={answerFor(BUY_OR_RENT, [])} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('DemandAnswerPanel — η λίστα ζει ΜΟΝΟ στο σχήμα `has-matches`', () => {
  it('Λ4 — ταίριασμα ⇒ η λίστα αποδίδεται', () => {
    render(
      <DemandAnswerPanel
        demand={BUY_OR_RENT}
        answer={answerFor(BUY_OR_RENT, [SALE_AND_RENT])}
        competition={{ state: 'loading' }}
      />,
    );
    expect(screen.getByRole('heading', { name: `${K}.heading` })).toBeInTheDocument();
  });

  it('Λ4 — κοντινό αποτέλεσμα ⇒ καμία λίστα ταιριασμάτων', () => {
    const tight = demand({ seeks: [seek('sell', { max: 190_000 })] });
    render(
      <DemandAnswerPanel
        demand={tight}
        answer={answerFor(tight, [SALE_AND_RENT])}
        competition={{ state: 'loading' }}
      />,
    );
    expect(screen.queryByRole('heading', { name: `${K}.heading` })).not.toBeInTheDocument();
  });
});
