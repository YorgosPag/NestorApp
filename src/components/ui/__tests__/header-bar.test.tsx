/**
 * @file ADR-912 §8 — η ΜΙΑ γραμμή «τίτλος + πράξεις».
 *
 * Τι κλειδώνει (δομή — το jsdom δεν έχει διάταξη· το «χωράει στα 390px» μετριέται στον browser):
 * - Δ1: η γραμμή αναδιπλώνεται (`flex-wrap`) — η απουσία του ήταν το ελάττωμα.
 * - Δ2: η περιοχή τίτλου υποχωρεί (`min-w-0`) και μεγαλώνει από το ΕΓΓΕΝΕΣ της πλάτος (`flex-auto`) — καμία σταθερή
 *   βάση: με `basis-48` μια στενή κάρτα έριχνε σήμα/εικονίδιο κάτω από τίτλο δύο λέξεων.
 * - Δ3: οι πράξεις αναδιπλώνονται και δεν ξεπερνούν τον περιέκτη (`max-w-full`).
 * - Δ4: χωρίς `actions` (ή με `false`/`null` από συνθήκη του καλούντος) δεν αποδίδεται δεύτερος κόμβος.
 * - Δ5: `as` / `actionsAs` αλλάζουν στοιχείο, όχι διάταξη.
 * - Δ6: `align="start"` ⇒ `items-start`, αλλιώς `items-center`.
 * - Δ7: καμία παραβίαση axe.
 * - Δ8: η περιγραφή μπαίνει ΜΕΣΑ στην περιοχή τίτλου, σε περιτύλιγμα `w-0 min-w-full` (δεν ψηφίζει στην αναδίπλωση)·
 *   η στοίχιση ΔΕΝ αλλάζει μόνη της (τη δηλώνει ο καλών — καμία σιωπηλή αλλαγή όψης στη μετανάστευση).
 * - Δ9: `wrap={false}` ⇒ καμία αναδίπλωση, ο τίτλος υποχωρεί (`flex-1`), το διακοσμητικό δεν συμπιέζεται (`shrink-0`).
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

function titleAreaOf(root: HTMLElement): HTMLElement {
  return root.firstElementChild as HTMLElement;
}

describe('HeaderBar', () => {
  test('Δ1: η γραμμή αναδιπλώνεται', () => {
    expect(renderBar()).toHaveClass('flex', 'flex-wrap', 'justify-between');
  });

  test('Δ2: η περιοχή τίτλου υποχωρεί και μεγαλώνει από το εγγενές της πλάτος', () => {
    const titleArea = titleAreaOf(renderBar());
    expect(titleArea).toContainElement(screen.getByRole('heading', { name: 'Εργαζόμενοι' }));
    expect(titleArea).toHaveClass('min-w-0', 'flex-auto');
    expect(titleArea.className).not.toMatch(/\bbasis-/);
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
        <HeaderBar as="header" description={<p>Όλοι οι εργαζόμενοι</p>} actions={<button type="button">Προσθήκη</button>}>
          <h1>Εργαζόμενοι</h1>
        </HeaderBar>
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Δ8: η περιγραφή ζει στην περιοχή τίτλου χωρίς να ψηφίζει στην αναδίπλωση', () => {
    const root = renderBar({ description: <p>Όλοι οι εργαζόμενοι του έργου</p> });
    const slot = screen.getByText('Όλοι οι εργαζόμενοι του έργου').parentElement as HTMLElement;
    expect(slot).toHaveClass('w-0', 'min-w-full');
    expect(slot.parentElement).toBe(titleAreaOf(root));
    expect(root).toHaveClass('items-center');
  });

  test.each([undefined, null, false])('Δ8: description=%p ⇒ κανένα περιτύλιγμα περιγραφής', (description) => {
    const root = renderBar({ description });
    expect(titleAreaOf(root).childElementCount).toBe(1);
    expect(root).toHaveClass('items-center');
  });

  test('Δ9: wrap={false} — διακοσμητικό που δεν αναδιπλώνεται ποτέ', () => {
    const root = renderBar({ wrap: false, actions: <svg data-testid="icon" /> });
    expect(root).toHaveClass('flex-nowrap');
    expect(root).not.toHaveClass('flex-wrap');
    expect(titleAreaOf(root)).toHaveClass('min-w-0', 'flex-1');
    expect(screen.getByTestId('icon').parentElement).toHaveClass('shrink-0');
  });
});
