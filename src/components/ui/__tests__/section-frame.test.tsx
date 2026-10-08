/**
 * @file ADR-777 §8.87.10 — ΜΙΑ επιφάνεια (`Card`), και η ενότητα με τίτλο είναι ΠΑΝΤΑ ορόσημο με όνομα.
 *
 * Τι κλειδώνει:
 * - Κ1: `Card` χωρίς `asChild` ⇒ `<div>` όπως πάντα (δεκάδες υπάρχοντες καταναλωτές).
 * - Κ2: `Card asChild` ⇒ ΕΝΑΣ κόμβος, το στοιχείο του παιδιού, με την επιφάνεια ΚΑΙ τις κλάσεις του παιδιού.
 * - Π1: `SectionFrame` ⇒ ορόσημο `region` με όνομα την ΟΡΑΤΗ επικεφαλίδα, στο επίπεδο που δηλώθηκε.
 * - Π2: ρητό `headingId` σεβαστό· χωρίς αυτό παράγεται και δένει το ίδιο.
 * - Π3: `as="aside"` ⇒ ορόσημο `complementary` με το ίδιο όνομα.
 * - Π4: `actions` + `description` ζουν στην κεφαλίδα, όχι μέσα στην επικεφαλίδα (το όνομα μένει καθαρό).
 * - Π5: η επιφάνεια της ενότητας είναι η επιφάνεια του `Card` — ίδιες κλάσεις ορίου/φόντου, καμία δεύτερη συνταγή.
 * - Π6: `aria-live` / `aria-busy` περνούν στο ορόσημο.
 */

import * as React from 'react';
import { render, screen, within } from '@testing-library/react';

import { Card } from '@/components/ui/card';
import { SectionFrame } from '@/components/ui/section-frame';

/** Οι κλάσεις που κάνουν κάτι «επιφάνεια» — διαβάζονται από το ίδιο το `Card`, δεν αντιγράφονται εδώ. */
function surfaceClasses(): string[] {
  const { container, unmount } = render(<Card />);
  const classes = Array.from((container.firstElementChild as HTMLElement).classList);
  unmount();
  return classes;
}

describe('Card — asChild', () => {
  test('Κ1: χωρίς asChild αποδίδει <div>', () => {
    const { container } = render(<Card data-testid="card">περιεχόμενο</Card>);
    expect(screen.getByTestId('card').tagName).toBe('DIV');
    expect(container.childElementCount).toBe(1);
  });

  test('Κ2: με asChild η επιφάνεια φοριέται από το παιδί — ένας κόμβος, ενωμένες κλάσεις', () => {
    const surface = surfaceClasses();
    const { container } = render(
      <Card asChild className="p-4">
        <article className="flex flex-col" data-testid="row">γραμμή</article>
      </Card>,
    );
    const row = screen.getByTestId('row');
    expect(row.tagName).toBe('ARTICLE');
    expect(container.firstElementChild).toBe(row);
    expect(row.querySelector('div')).toBeNull();
    for (const cls of [...surface, 'p-4', 'flex', 'flex-col']) expect(row).toHaveClass(cls);
  });
});

describe('SectionFrame', () => {
  test('Π1: ορόσημο με όνομα την ορατή επικεφαλίδα, στο δηλωμένο επίπεδο', () => {
    render(<SectionFrame title="Τιμή" headingLevel="h2">σώμα</SectionFrame>);
    const region = screen.getByRole('region', { name: 'Τιμή' });
    expect(region.tagName).toBe('SECTION');
    expect(within(region).getByRole('heading', { level: 2, name: 'Τιμή' })).toBeInTheDocument();
    expect(region).toHaveTextContent('σώμα');
    expect(region).not.toHaveAttribute('aria-label');
  });

  test('Π2: ρητό headingId σεβαστό· αλλιώς παράγεται και δένει', () => {
    const { unmount } = render(<SectionFrame title="Α" headingLevel="h3" headingId="fixed-heading">.</SectionFrame>);
    expect(screen.getByRole('heading', { level: 3 })).toHaveAttribute('id', 'fixed-heading');
    expect(screen.getByRole('region')).toHaveAttribute('aria-labelledby', 'fixed-heading');
    unmount();

    render(<SectionFrame title="Β" headingLevel="h3">.</SectionFrame>);
    const id = screen.getByRole('heading', { level: 3 }).getAttribute('id');
    expect(id).toBeTruthy();
    expect(screen.getByRole('region')).toHaveAttribute('aria-labelledby', id);
  });

  test('Π3: as="aside" ⇒ complementary με το ίδιο όνομα', () => {
    render(<SectionFrame as="aside" title="Σχετικά" headingLevel="h2">.</SectionFrame>);
    expect(screen.getByRole('complementary', { name: 'Σχετικά' }).tagName).toBe('ASIDE');
  });

  test('Π4: ενέργειες και περιγραφή στην κεφαλίδα, έξω από την επικεφαλίδα', () => {
    render(
      <SectionFrame title="Λήψεις" headingLevel="h3" description="Ό,τι ανέβηκε" actions={<button type="button">Άνοιγμα</button>}>
        .
      </SectionFrame>,
    );
    const region = screen.getByRole('region', { name: 'Λήψεις' });
    const heading = within(region).getByRole('heading', { level: 3 });
    const action = within(region).getByRole('button', { name: 'Άνοιγμα' });
    expect(heading).not.toContainElement(action);
    expect(heading).toHaveTextContent(/^Λήψεις$/);
    expect(heading.closest('header')).toContainElement(action);
    expect(heading.closest('header')).toHaveTextContent('Ό,τι ανέβηκε');
  });

  test('Π5: η επιφάνεια είναι του Card — ένας κόμβος, καμία δεύτερη συνταγή', () => {
    const surface = surfaceClasses();
    const { container } = render(<SectionFrame title="Τ" headingLevel="h2" gap={3}>.</SectionFrame>);
    const region = screen.getByRole('region');
    expect(container.firstElementChild).toBe(region);
    for (const cls of [...surface, 'p-4', 'gap-3']) expect(region).toHaveClass(cls);
  });

  test('Π6: aria-live και aria-busy περνούν στο ορόσημο', () => {
    render(<SectionFrame title="Τ" headingLevel="h2" aria-live="polite" aria-busy>.</SectionFrame>);
    const region = screen.getByRole('region');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-busy', 'true');
  });
});
