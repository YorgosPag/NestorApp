/**
 * @fileoverview Άγκυρες του πάνελ ζήτησης για **κλειστή διάθεση** και **ολοκληρωμένη**
 * συναλλαγή (ADR-864 Φ2 · §16).
 *
 * | # | Κανόνας | Μετάλλαξη που πιάνει |
 * |---|---|---|
 * | Π1 | `settled` ⇒ **κανένας** αριθμός, ούτε «κανείς», ούτε «κάτω από κατώφλι» | η στάση κρίνεται μετά τον αριθμό |
 * | Π2 | κλειστό κοινό + «αυτό ακριβώς» + πλήθος ⇒ γραμμή «δεν τη βλέπουν» | η γραμμή λείπει |
 * | Π3 | δημόσιο κοινό ⇒ **καμία** γραμμή κλειστής διάθεσης | η γραμμή σε κάθε αγγελία |
 * | Π4 | δόλωμα (`dormant`) σε κλειστό κοινό ⇒ **καμία** δεύτερη γραμμή (η εξήγηση αρκεί) | θόρυβος πάνω σε αδύναμο ισχυρισμό |
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, isNamespaceReady: true }),
}));

import { PlaceInterestPanel } from '../PlaceInterestPanel';
import type { PlaceInterestState } from '@/hooks/demand/usePlaceInterest';
import type { MarketingAudience } from '@/constants/marketing-audiences';

const KEY = 'property-market:demand.interest';

function ready(interest: Extract<PlaceInterestState, { state: 'ready' }>['interest']): PlaceInterestState {
  return { state: 'ready', interest };
}

function counted(stance: 'offered' | 'dormant', count: number | null): PlaceInterestState {
  return ready({ stance, disclosure: { audience: 'place-owner', count, minCount: 1 } });
}

function show(interest: PlaceInterestState, audience: MarketingAudience) {
  render(<PlaceInterestPanel interest={interest} audience={audience} />);
}

describe('ADR-864 Φ2 — το πάνελ ζήτησης', () => {
  it('Π1 — ολοκληρωμένη συναλλαγή: μόνο η εξήγηση, κανένας αριθμός', () => {
    show(ready({ stance: 'settled' }), 'public');

    expect(screen.getByText(`${KEY}.settled`)).toBeInTheDocument();
    for (const numberKey of ['none', 'hidden', 'offered', 'dormant']) {
      expect(screen.queryByText(`${KEY}.${numberKey}`)).not.toBeInTheDocument();
    }
  });

  it('Π2 — κλειστή διάθεση με πλήθος ⇒ «αυτοί δεν βλέπουν την αγγελία»', () => {
    show(counted('offered', 7), 'custodians');

    expect(screen.getByText(`${KEY}.offered`)).toBeInTheDocument();
    expect(screen.getByText(`${KEY}.closedReach`)).toBeInTheDocument();
  });

  it('Π3 — δημόσια αγγελία ⇒ καμία γραμμή κλειστής διάθεσης', () => {
    show(counted('offered', 7), 'public');

    expect(screen.queryByText(`${KEY}.closedReach`)).not.toBeInTheDocument();
  });

  it.each([
    ['dormant', 7],
    ['offered', 0],
    ['offered', null],
  ] as const)('Π4 — στάση «%s», πλήθος %s σε κλειστό κοινό ⇒ καμία γραμμή', (stance, count) => {
    show(counted(stance, count), 'custodians');

    expect(screen.queryByText(`${KEY}.closedReach`)).not.toBeInTheDocument();
  });
});
