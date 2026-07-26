/**
 * @tests ADR-711 Ε2 — επαναφορά focus μετά το κλείσιμο dialog.
 *
 * ── ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΕΙΝΑΙ Η ΑΛΗΘΙΝΗ ΔΙΚΛΕΙΔΑ ──
 *
 * Το ελάττωμα Ε2 (161 από 170 αρχεία με `DialogContent` χωρίς `DialogTrigger` άφηναν
 * το focus στο `<body>`) έζησε επί μήνες με **πράσινα** tests, επειδή κανένα δεν
 * ρωτούσε «πού πήγε το focus όταν έκλεισε;». Η προγραμματική εστίαση **δουλεύει**
 * κανονικά στο jsdom — άρα, σε αντίθεση με τα Ε1/Ε4, το Ε2 ΕΙΝΑΙ πιάσιμο εδώ.
 *
 * ⚠️ ΜΕΤΡΗΜΕΝΟ ΚΑΤΑ ΤΗ ΣΥΓΓΡΑΦΗ: το `FocusScope` του Radix εκπέμπει το
 * AUTOFOCUS_ON_UNMOUNT μέσα σε `setTimeout(…, 0)`. Άρα η επαναφορά focus **δεν είναι
 * σύγχρονη** με το κλείσιμο· σύγχρονο assert βγαίνει πάντα `body` και θα διαβαζόταν
 * λανθασμένα ως «η διόρθωση δεν δουλεύει». Κάθε assert εδώ είναι `await waitFor`.
 */

import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '../dialog';

/** Ο κανόνας των 161: ελεγχόμενο `open`, opener εκτός του Dialog. */
function ControlledDialog(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  return (
    <main>
      <button type="button" onClick={() => setOpen(true)}>
        opener
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>τίτλος</DialogTitle>
          <button type="button" onClick={() => setOpen(false)}>
            inside-close
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}

/** Το μειοψηφικό 31: υπάρχει `DialogTrigger` — έλεγχος μη-παλινδρόμησης. */
function TriggeredDialog(): React.JSX.Element {
  return (
    <Dialog>
      <DialogTrigger>opener</DialogTrigger>
      <DialogContent>
        <DialogTitle>τίτλος</DialogTitle>
      </DialogContent>
    </Dialog>
  );
}

describe('DialogContent — επαναφορά focus χωρίς DialogTrigger', () => {
  it('επιστρέφει το focus στο στοιχείο που άνοιξε τον διάλογο', async () => {
    render(<ControlledDialog />);
    const opener = screen.getByRole('button', { name: 'opener' });

    opener.focus();
    expect(document.activeElement).toBe(opener);

    fireEvent.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Ο Radix μετακινεί το focus ΜΕΣΑ στον διάλογο (focus trap).
    expect(document.activeElement).not.toBe(opener);

    fireEvent.click(screen.getByRole('button', { name: 'inside-close' }));

    // ΠΡΙΝ ΤΟ ADR-711 ΕΔΩ ΕΜΕΝΕ `document.body` για πάντα.
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('δεν παλινδρομεί όταν ΥΠΑΡΧΕΙ DialogTrigger', async () => {
    render(<TriggeredDialog />);
    const trigger = screen.getByRole('button', { name: 'opener' });

    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('δεν σκάει όταν ο opener έχει φύγει από το DOM', async () => {
    function DisappearingOpener(): React.JSX.Element {
      const [open, setOpen] = React.useState(false);
      const [gone, setGone] = React.useState(false);
      return (
        <main>
          {!gone && (
            <button type="button" onClick={() => setOpen(true)}>
              opener
            </button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogTitle>τίτλος</DialogTitle>
              <button
                type="button"
                onClick={() => {
                  setGone(true);
                  setOpen(false);
                }}
              >
                delete-and-close
              </button>
            </DialogContent>
          </Dialog>
        </main>
      );
    }

    render(<DisappearingOpener />);
    fireEvent.click(screen.getByRole('button', { name: 'opener' }));
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: 'delete-and-close' })),
    ).not.toThrow();
    // Η επαναφορά είναι ασύγχρονη — περιμένουμε να τρέξει και να ΜΗΝ σκάσει.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
