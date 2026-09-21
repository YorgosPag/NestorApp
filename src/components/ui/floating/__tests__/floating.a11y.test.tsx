/**
 * ADR-598 G11 — axe στα αιωρούμενα primitives: το αγκυρωμένο αναδυόμενο και οι λαβές μεγέθους.
 *
 * Το `AnchoredPopover` αποδίδεται σε **portal** (top layer) — άρα η ανοιχτή κατάσταση σαρώνεται
 * στο `document.body`. Και η άγκυρα που το ανοίγει λέει `aria-haspopup="dialog"`, οπότε ό,τι
 * ανοίγει πρέπει να είναι **διάλογος με όνομα** (axe `aria-dialog-name`) — ο τύπος το απαιτεί,
 * εδώ επαληθεύεται ότι το όνομα **φτάνει** στο DOM.
 *
 * Οι λαβές μεγέθους είναι σκόπιμα `aria-hidden` (δες την κεφαλίδα τους): σαρώνονται μέσα σε ένα
 * πάνελ-διάλογο με περιεχόμενο, ώστε να φανεί ότι δεν προσθέτουν ούτε στάση Tab ούτε θόρυβο.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';

import { expectNoA11yViolations } from '@/test-utils/a11y';

import { AnchoredPopover } from '../AnchoredPopover';
import { FloatingPanelResizeHandles } from '../FloatingPanelResizeHandles';

/** Ο καταναλωτής όπως στην πράξη (`TableBorderDialogColor`): ετικέτα → άγκυρα → αναδυόμενο. */
function ColorControl({ open }: { readonly open: boolean }) {
  const [anchor, setAnchor] = React.useState<HTMLButtonElement | null>(null);
  return (
    <form>
      <span id="color-label">Χρώμα:</span>
      <button type="button" ref={setAnchor} aria-labelledby="color-label" aria-haspopup="dialog" aria-expanded={open}>
        Αυτόματο
      </button>
      <AnchoredPopover open={open} onOpenChange={jest.fn()} anchor={anchor} aria-labelledby="color-label">
        <button type="button" aria-pressed>
          Αυτόματο
        </button>
        <button type="button" aria-label="Κόκκινο #FF0000" aria-pressed={false} />
        <button type="button">Περισσότερα χρώματα…</button>
      </AnchoredPopover>
    </form>
  );
}

describe('AnchoredPopover a11y', () => {
  it('κλειστό: δεν αποδίδει τίποτα, η άγκυρα μόνη της είναι καθαρή', async () => {
    const { container } = render(<ColorControl open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('ανοιχτό (portal): διάλογος με το όνομα της ετικέτας που ονομάζει και την άγκυρα', async () => {
    render(<ColorControl open />);
    expect(await screen.findByRole('dialog', { name: 'Χρώμα:' })).toBeInTheDocument();
    await expectNoA11yViolations(document.body);
  });

  it('ρητός ρόλος μενού με aria-label', async () => {
    function MenuControl() {
      const [anchor, setAnchor] = React.useState<HTMLButtonElement | null>(null);
      return (
        <>
          <button type="button" ref={setAnchor} aria-haspopup="menu" aria-expanded>
            Ενέργειες
          </button>
          <AnchoredPopover open onOpenChange={jest.fn()} anchor={anchor} role="menu" aria-label="Ενέργειες γραμμής">
            <button type="button" role="menuitem">
              Διαγραφή
            </button>
          </AnchoredPopover>
        </>
      );
    }
    render(<MenuControl />);
    expect(await screen.findByRole('menu', { name: 'Ενέργειες γραμμής' })).toBeInTheDocument();
    await expectNoA11yViolations(document.body);
  });
});

describe('FloatingPanelResizeHandles a11y', () => {
  it('οκτώ λαβές μέσα σε πάνελ: αόρατες στην υποστηρικτική τεχνολογία, καμία στάση Tab', async () => {
    const { container } = render(
      <section role="dialog" aria-label="Ιδιότητες">
        <header>
          <h2>Ιδιότητες</h2>
        </header>
        <button type="button">Κλείσιμο</button>
        <FloatingPanelResizeHandles onStartResize={jest.fn()} />
      </section>,
    );

    const handles = container.querySelectorAll('[data-resize-edge]');
    expect(handles).toHaveLength(8);
    handles.forEach((handle) => {
      expect(handle).toHaveAttribute('aria-hidden', 'true');
      expect(handle).not.toHaveAttribute('tabindex');
    });
    await expectNoA11yViolations(container);
  });
});
