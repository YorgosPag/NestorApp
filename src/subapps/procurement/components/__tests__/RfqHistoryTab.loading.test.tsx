/**
 * @fileoverview Η καρτέλα «Ιστορικό» δεν λέει «δεν υπάρχει ιστορικό» πριν φτάσουν τα δεδομένα (ADR-327).
 *
 * Μετρημένο ζωντανά 2026-10-28: σε ψυχρή φόρτωση με `?tab=history` η καρτέλα έδειχνε «Δεν υπάρχει ιστορικό ακόμα»
 * όσο φόρτωναν οι προσφορές — το ιστορικό ζητείται ΑΝΑ προσφορά, άρα «καμία προσφορά ακόμη» έμοιαζε με «κανένα ιστορικό».
 *
 * Ι1 προσφορές σε πτήση ⇒ ΟΧΙ κενή κατάσταση · Ι2 φορτωμένες και πράγματι κενές ⇒ κενή κατάσταση.
 *
 * ⚠️ Μετάλλαξη που ΠΡΕΠΕΙ να κοκκινίζει: `const isLoading = history.isLoading` (χωρίς `quotesLoading`) ⇒ Ι1.
 */

import { render, screen } from '@testing-library/react';
import { RfqHistoryTab } from '../RfqHistoryTab';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../hooks/useRfqHistory', () => ({
  useRfqHistory: () => ({ entries: [], isLoading: false, error: null }),
}));
jest.mock('@/ui-adapters/react/useSemanticColors', () => ({ useSemanticColors: () => ({ text: { muted: '' } }) }));

describe('RfqHistoryTab — καμία ψευδής κενή κατάσταση', () => {
  it('Ι1: προσφορές σε πτήση ⇒ δεν δείχνει «δεν υπάρχει ιστορικό»', () => {
    render(<RfqHistoryTab rfqId="rfq_1" quotes={[]} quotesLoading />);
    expect(screen.queryByText('rfqs.history.empty')).toBeNull();
  });

  it('Ι2: φορτωμένο και κενό ⇒ κενή κατάσταση', () => {
    render(<RfqHistoryTab rfqId="rfq_1" quotes={[]} quotesLoading={false} />);
    expect(screen.getByText('rfqs.history.empty')).toBeInTheDocument();
  });
});
