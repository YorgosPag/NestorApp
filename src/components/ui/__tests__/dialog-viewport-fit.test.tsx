/**
 * @tests ADR-912 §9 — ο διάλογος χωρά ΠΑΝΤΑ στην οθόνη και κυλά.
 *
 * Το ελάττωμα: `DialogContent` = `fixed` + κεντραρισμένο, χωρίς μέγιστο ύψος και χωρίς κύλιση. Στα 390px η φόρμα
 * φάσης (Gantt) ξεπερνούσε την οθόνη, κοβόταν πάνω και κάτω, και τα κουμπιά της δεν ήταν προσβάσιμα με κανέναν τρόπο.
 *
 * ⚠️ Το jsdom δεν έχει διάταξη: εδώ καρφώνεται η ΔΗΛΩΣΗ (οι κλάσεις της βάσης και ότι ο καλών μπορεί να τις
 * αντικαταστήσει)· το «κυλά στα 390px» μετριέται στον browser.
 * - Υ1: η βάση δηλώνει μέγιστο ύψος σε `dvh` και κάθετη κύλιση.
 * - Υ2: `className` του καλούντος με άλλο ύψος/υπερχείλιση ΚΕΡΔΙΖΕΙ (δεν μένουν δύο αντικρουόμενες κλάσεις).
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/useIconSizes', () => ({ useIconSizes: () => ({ sm: 'h-4 w-4' }) }));
jest.mock('@/hooks/useBorderTokens', () => ({
  useBorderTokens: () => ({ radius: { sm: 'rounded-sm' }, quick: { card: 'rounded-lg border' } }),
}));
jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({ bg: { primary: 'bg-white' } }),
}));

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../dialog';

function renderDialog(className?: string): HTMLElement {
  render(
    <Dialog open>
      <DialogContent className={className}>
        <DialogTitle>τίτλος</DialogTitle>
        <DialogDescription>περιγραφή</DialogDescription>
      </DialogContent>
    </Dialog>,
  );
  return screen.getByRole('dialog');
}

describe('DialogContent — χωρά στην οθόνη', () => {
  test('Υ1: η βάση δηλώνει μέγιστο ύψος σε dvh και κάθετη κύλιση', () => {
    const dialog = renderDialog();
    expect(dialog).toHaveClass('max-h-[calc(100dvh-2rem)]', 'overflow-y-auto');
  });

  test('Υ2: το className του καλούντος αντικαθιστά ύψος και υπερχείλιση', () => {
    const dialog = renderDialog('max-h-[80vh] overflow-hidden');
    expect(dialog).toHaveClass('max-h-[80vh]', 'overflow-hidden');
    expect(dialog).not.toHaveClass('max-h-[calc(100dvh-2rem)]');
    expect(dialog).not.toHaveClass('overflow-y-auto');
  });
});
