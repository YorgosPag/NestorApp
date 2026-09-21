/**
 * ADR-598 G11 · Δ — **Το αναδυόμενο έχει όνομα, χωρίς να το θυμηθεί ο καταναλωτής.**
 *
 * Το Radix δίνει σε κάθε `Popover.Content` `role="dialog"` χωρίς όνομα· μετρήθηκαν 28 στα 29
 * ανώνυμα. Το SSoT `popover.tsx` ονομάζει τον διάλογο από το trigger (React Aria
 * `DialogTrigger`), αφήνει το ρητό όνομα να κερδίσει, και με `role="presentation"` γίνεται
 * ουδέτερος φορέας για popup που δεν είναι διάλογος (Fluent `PopoverSurface`).
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { expectNoA11yViolations } from '@/test-utils/a11y';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '../popover';
import { MultiCombobox } from '../multi-combobox';

async function openWith(user: ReturnType<typeof userEvent.setup>, name: string): Promise<void> {
  await user.click(screen.getByRole('button', { name }));
}

describe('PopoverContent — όνομα διαλόγου', () => {
  it('χωρίς ρητό όνομα ⇒ το όνομα του TRIGGER (React Aria `DialogTrigger`)', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>Φίλτρα</PopoverTrigger>
        <PopoverContent>περιεχόμενο</PopoverContent>
      </Popover>,
    );
    await openWith(user, 'Φίλτρα');

    expect(screen.getByRole('dialog', { name: 'Φίλτρα' })).toBeInTheDocument();
    await expectNoA11yViolations(document.body);
  });

  it('ρητό `aria-label` ΚΕΡΔΙΖΕΙ το trigger', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>21/09/2026</PopoverTrigger>
        <PopoverContent aria-label="Επιλογή ημερομηνίας">ημερολόγιο</PopoverContent>
      </Popover>,
    );
    await openWith(user, '21/09/2026');

    expect(screen.getByRole('dialog', { name: 'Επιλογή ημερομηνίας' })).toBeInTheDocument();
  });

  it('`asChild` με ΔΙΚΟ του `id` το παιδί ⇒ το όνομα δείχνει στο id που ΥΠΑΡΧΕΙ στο DOM', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger asChild>
          <Button id="own-trigger-id">Ρυθμίσεις</Button>
        </PopoverTrigger>
        <PopoverContent>περιεχόμενο</PopoverContent>
      </Popover>,
    );
    await openWith(user, 'Ρυθμίσεις');

    const dialog = screen.getByRole('dialog', { name: 'Ρυθμίσεις' });
    expect(dialog).toHaveAttribute('aria-labelledby', 'own-trigger-id');
  });

  it('`role="presentation"` ⇒ ουδέτερο δοχείο, κανένα όνομα, καμία παραβίαση', async () => {
    render(
      <Popover open>
        <PopoverAnchor asChild>
          <input aria-label="Αναζήτηση" role="combobox" aria-expanded="true" aria-controls="results" readOnly />
        </PopoverAnchor>
        <PopoverContent role="presentation" onOpenAutoFocus={(e) => e.preventDefault()}>
          <ul id="results" role="listbox" aria-label="Αποτελέσματα">
            <li role="option" aria-selected="false">Αθήνα</li>
          </ul>
        </PopoverContent>
      </Popover>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await expectNoA11yViolations(document.body);
  });

  it('η ΑΠΟΔΕΙΞΗ ότι χρειάζεται: anchor χωρίς όνομα ⇒ ανώνυμος διάλογος (γι’ αυτό το στατικό test)', () => {
    render(
      <Popover open>
        <PopoverAnchor asChild><span>άγκυρα</span></PopoverAnchor>
        <PopoverContent>περιεχόμενο</PopoverContent>
      </Popover>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toHaveAttribute('aria-labelledby');
    expect(dialog).not.toHaveAttribute('aria-label');
  });
});

describe('MultiCombobox — το ωμό Content παίρνει το όνομα από το ΙΔΙΟ SSoT', () => {
  it('ανοιχτό: ο διάλογος ονομάζεται από το combobox που τον άνοιξε', async () => {
    const user = userEvent.setup();
    render(
      <MultiCombobox
        ariaLabel="Ειδικότητες"
        options={[{ value: 'a', label: 'Ελαιοχρωματιστής' }]}
        value={[]}
        onChange={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: 'Ειδικότητες' }));

    expect(screen.getByRole('dialog', { name: 'Ειδικότητες' })).toBeInTheDocument();
  });
});
