/**
 * @tests ADR-915 §29.1 — ο τίτλος του διαλόγου δεν περνά ΚΑΤΩ από το «×».
 *
 * Το ελάττωμα (μετρημένο σε browser 2026-10-17): το `DialogClose` είναι `absolute right-4 top-4` και το `DialogHeader`
 * δεν του άφηνε χώρο ⇒ «Ανάθεση έκδοσης: Πιστοποιητικό Ενεργειακής Απόδοσης» έγραφε κάτω από το κουμπί.
 *
 * ⚠️ Το jsdom δεν έχει διάταξη: εδώ καρφώνεται η ΔΗΛΩΣΗ (ο χώρος δεσμεύεται, και μόνο όταν το «×» υπάρχει)· το
 * «δεν επικαλύπτονται» μετρήθηκε στον browser (τίτλος 1398px < «×» 1422px).
 * - Κ1: με «×» ⇒ το περιεχόμενο δεσμεύει χώρο για κάθε κεφαλίδα, και η κεφαλίδα φέρει το σημάδι.
 * - Κ2: χωρίς «×» ⇒ κανένας χώρος (δεν κλέβουμε πλάτος από τίτλο που δεν συγκρούεται με τίποτα).
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

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../dialog';

const CLEARANCE = '[&_[data-dialog-header]]:pr-8';

function renderDialog(hideCloseButton: boolean): HTMLElement {
  render(
    <Dialog open>
      <DialogContent hideCloseButton={hideCloseButton}>
        <DialogHeader>
          <DialogTitle>Ανάθεση έκδοσης: Πιστοποιητικό Ενεργειακής Απόδοσης (ΠΕΑ)</DialogTitle>
          <DialogDescription>περιγραφή</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>,
  );
  return screen.getByRole('dialog');
}

describe('DialogHeader — χώρος για το «×» (ADR-915 §29.1)', () => {
  it('Κ1: με «×» το περιεχόμενο δεσμεύει χώρο και η κεφαλίδα φέρει το σημάδι', () => {
    const dialog = renderDialog(false);
    expect(dialog.className.split(' ')).toContain(CLEARANCE);
    expect(dialog.querySelector('[data-dialog-header]')).toContainElement(screen.getByRole('heading'));
  });

  it('Κ2: χωρίς «×» κανένας χώρος', () => {
    const dialog = renderDialog(true);
    expect(dialog.className.split(' ')).not.toContain(CLEARANCE);
  });
});
