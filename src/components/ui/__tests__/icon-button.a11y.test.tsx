/**
 * @file ADR-898 §21.6 Ε10 · WCAG 4.1.2 — το κουμπί-εικονίδιο με υποχρεωτικό όνομα.
 *
 * Τι κλειδώνει:
 * - Α1: κανένα εύρημα axe (`button-name`) — το όνομα έρχεται από το `label`, όχι από το tooltip.
 * - Α2: το όνομα υπάρχει **χωρίς** να ανοίξει το tooltip (το Radix δένει το tooltip με `aria-describedby`).
 * - Α3: όνομα και tooltip είναι η **ίδια** συμβολοσειρά.
 * - Β1: `busy` ⇒ ανενεργό + `aria-busy`, και το όνομα **μένει** (ο Spinner δεν το αντικαθιστά).
 * - Β2: `disabled` του καταναλωτή δεν χάνεται όταν δεν είναι `busy`.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { expectNoA11yViolations } from '@/test-utils/a11y';
import { IconButton } from '../icon-button';
import { TooltipProvider } from '../tooltip';

const LABEL = 'Αποσύνδεση';

function renderButton(props: Partial<React.ComponentProps<typeof IconButton>> = {}) {
  return render(
    <TooltipProvider>
      <IconButton label={LABEL} {...props}>
        <svg data-testid="icon" aria-hidden="true" />
      </IconButton>
    </TooltipProvider>,
  );
}

describe('IconButton — προσβάσιμο όνομα', () => {
  it('Α1: κανένα εύρημα axe', async () => {
    await expectNoA11yViolations(renderButton().container);
  });

  it('Α2: έχει όνομα χωρίς να ανοίξει το tooltip', () => {
    renderButton();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: LABEL })).toBeInTheDocument();
  });

  it('Α3: το tooltip λέει ό,τι και το όνομα', async () => {
    const user = userEvent.setup();
    renderButton();
    await user.hover(screen.getByRole('button', { name: LABEL }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(LABEL);
  });
});

describe('IconButton — κατάσταση', () => {
  it('Β1: busy ⇒ ανενεργό, aria-busy, και το όνομα μένει', () => {
    renderButton({ busy: true });
    const button = screen.getByRole('button', { name: LABEL });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
  });

  it('Β2: disabled χωρίς busy ⇒ ανενεργό, χωρίς aria-busy, με το εικονίδιό του', () => {
    renderButton({ disabled: true });
    const button = screen.getByRole('button', { name: LABEL });
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute('aria-busy');
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('Β3: το πάτημα φτάνει στον καταναλωτή', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    renderButton({ onClick });
    await user.click(screen.getByRole('button', { name: LABEL }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
