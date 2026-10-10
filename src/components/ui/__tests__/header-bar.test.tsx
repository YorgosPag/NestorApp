/**
 * @file ADR-912 §8 — η ΜΙΑ γραμμή «τίτλος + πράξεις».
 *
 * Τι κλειδώνει (δομή — το jsdom δεν έχει διάταξη· το «χωράει στα 390px» μετριέται στον browser):
 * - Δ1: η γραμμή αναδιπλώνεται (`flex-wrap`) — η απουσία του ήταν το ελάττωμα.
 * - Δ2: η περιοχή τίτλου υποχωρεί (`min-w-0`), μεγαλώνει (`flex-1`) και έχει βάση (`basis-48`).
 * - Δ3: οι πράξεις αναδιπλώνονται και δεν ξεπερνούν τον περιέκτη (`max-w-full`).
 * - Δ4: χωρίς `actions` (ή με `false`/`null` από συνθήκη του καλούντος) δεν αποδίδεται δεύτερος κόμβος.
 * - Δ5: `as` / `actionsAs` αλλάζουν στοιχείο, όχι διάταξη.
 * - Δ6: `align="start"` ⇒ `items-start`, αλλιώς `items-center`.
 * - Δ7: καμία παραβίαση axe.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { HeaderBar } from '@/components/ui/header-bar';

expect.extend(toHaveNoViolations);

function renderBar(props: Partial<React.ComponentProps<typeof HeaderBar>> = {}) {
  const { container } = render(
    <HeaderBar actions={<button type="button">Προσθήκη</button>} {...props}>
      <h3>Εργαζόμενοι</h3>
    </HeaderBar>,
  );
  return container.firstElementChild as HTMLElement;
}

describe('HeaderBar', () => {
  test('Δ1: η γραμμή αναδιπλώνεται', () => {
    expect(renderBar()).toHaveClass('flex', 'flex-wrap', 'justify-between');
  });

  test('Δ2: η περιοχή τίτλου υποχωρεί, μεγαλώνει και έχει βάση', () => {
    renderBar();
    const titleArea = screen.getByRole('heading', { name: 'Εργαζόμενοι' }).parentElement as HTMLElement;
    expect(titleArea).toHaveClass('min-w-0', 'flex-1', 'basis-48');
  });

  test('Δ3: οι πράξεις αναδιπλώνονται και δεν ξεπερνούν τον περιέκτη', () => {
    renderBar();
    const actions = screen.getByRole('button', { name: 'Προσθήκη' }).parentElement as HTMLElement;
    expect(actions).toHaveClass('flex', 'flex-wrap', 'max-w-full');
  });

  test.each([undefined, null, false])('Δ4: actions=%p ⇒ μόνο η περιοχή τίτλου', (actions) => {
    const root = renderBar({ actions });
    expect(root.childElementCount).toBe(1);
  });

  test('Δ5: as / actionsAs αλλάζουν στοιχείο', () => {
    const root = renderBar({ as: 'header', actionsAs: 'nav' });
    expect(root.tagName).toBe('HEADER');
    expect(root.lastElementChild?.tagName).toBe('NAV');
    expect(root).toHaveClass('flex-wrap');
  });

  test('Δ6: align', () => {
    expect(renderBar()).toHaveClass('items-center');
    expect(renderBar({ align: 'start' })).toHaveClass('items-start');
  });

  test('Δ7: καμία παραβίαση axe', async () => {
    const { container } = render(
      <main>
        <HeaderBar as="header" actions={<button type="button">Προσθήκη</button>}>
          <h1>Εργαζόμενοι</h1>
        </HeaderBar>
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
