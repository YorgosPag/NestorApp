/**
 * ⚓ ΑΝΑΔΥΟΜΕΝΟ ΜΕΣΑ ΣΕ ΔΙΑΛΟΓΟ — «μπορεί ο άνθρωπος να ΠΑΤΗΣΕΙ ό,τι βλέπει;»
 *
 * ## Το περιστατικό (2026-10-16, ADR-915 §15)
 * Στον διάλογο ελέγχου μεταβίβασης κάθε κλικ σε μέρα του ημερολογίου **έκλεινε** τον picker χωρίς τιμή.
 * Το ημερολόγιο ζωγραφιζόταν σωστά από πάνω, αλλά είχε `pointer-events: none`, οπότε το κλικ περνούσε στο footer
 * του διαλόγου από κάτω. **Αιτία**: το lockfile είχε δύο `@radix-ui/react-dismissable-layer` (Dialog → 1.1.11 ·
 * Popover → 1.1.15). Η στοίβα στρώσεων ζει σε **context επιπέδου module**, και δύο αντίγραφα του module σημαίνουν
 * δύο στοίβες. Το popover δεν μάθαινε ποτέ ότι κάθεται πάνω σε modal, άρα κληρονομούσε το
 * `body { pointer-events: none }` του διαλόγου. Ίσχυε από το `e956d51b` (2026-07-10) σε κάθε Popover μέσα σε Dialog.
 *
 * ## Γιατί ΑΥΤΟ το test το βλέπει (ενώ τα 5 του διαλόγου δεν το είδαν)
 * Το `fireEvent.click` στέλνει το συμβάν απευθείας στο στοιχείο και αγνοεί τα `pointer-events`. Το `user-event`
 * ελέγχει την **κληρονομημένη** τιμή, όπως ο browser, και **αρνείται** το κλικ. Γι' αυτό εδώ μόνο `user-event`.
 * Τη ρίζα (μία έκδοση ανά κάτοχο καθολικής στοίβας) τη φυλάει επιπλέον η CHECK 3.65, κατάστιχο Ζ.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { Dialog, DialogContent, DialogTitle } from '../dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';
import { DatePickerField } from '../date-picker-field';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, currentLanguage: 'el' }),
}));

/** Το ΠΡΑΓΜΑΤΙΚΟ σχήμα του διαλόγου ελέγχου: ελεγχόμενη τιμή, picker μέσα σε modal. */
function DateInDialog() {
  const [value, setValue] = React.useState<Date | undefined>(undefined);
  return (
    <Dialog open>
      <DialogContent>
        <DialogTitle>τίτλος</DialogTitle>
        <DatePickerField id="d" value={value} onSelect={setValue} placeholder="κενό" />
        <output data-testid="picked">{value ? value.getDate() : ''}</output>
      </DialogContent>
    </Dialog>
  );
}

describe('Popover μέσα σε Dialog — αλληλεπίδραση', () => {
  it('DatePickerField: το κλικ σε μέρα ΚΡΑΤΙΕΤΑΙ ως τιμή', async () => {
    const user = userEvent.setup();
    render(<DateInDialog />);
    await user.click(screen.getByRole('button', { name: 'κενό' }));
    const day = screen.getAllByRole('gridcell').map((cell) => cell.querySelector('button')).find((b) => b?.textContent === '12');
    if (!day) throw new Error('δεν βρέθηκε η μέρα 12 στο πλέγμα');
    await user.click(day);
    expect(screen.getByTestId('picked')).toHaveTextContent('12');
  });

  it('τα κουμπιά πλοήγησης του ημερολογίου ονομάζονται από το i18n (όχι «Go to the Next Month»)', async () => {
    const user = userEvent.setup();
    render(<DateInDialog />);
    await user.click(screen.getByRole('button', { name: 'κενό' }));
    expect(screen.getByRole('button', { name: 'a11y.nextMonth' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'a11y.previousMonth' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Go to the/ })).not.toBeInTheDocument();
  });

  it('γενικό Popover: κουμπί μέσα του ΠΑΤΙΕΤΑΙ (όχι «κλικ έξω» προς τον διάλογο)', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>τίτλος</DialogTitle>
          <Popover>
            <PopoverTrigger>άνοιγμα</PopoverTrigger>
            <PopoverContent aria-label="αναδυόμενο">
              <button type="button" onClick={onPress}>μέσα</button>
            </PopoverContent>
          </Popover>
        </DialogContent>
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'άνοιγμα' }));
    await user.click(screen.getByRole('button', { name: 'μέσα' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: 'αναδυόμενο' })).toBeInTheDocument();
  });
});
