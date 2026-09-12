/**
 * Υ — **Η κοινή ενέργεια κεφαλίδας λέει «τρέχω»** (ADR-332 D27 Ζ5).
 *
 * 🔴 **Η αφορμή, μετρημένη ζωντανά**: η «Αποθήκευση» μιας επαφής κρατούσε **61,4 δευτερόλεπτα** με το
 * κουμπί **ενεργό** και καμία ένδειξη. Και δεν ήταν παράλειψη του καλούντος — ήταν **δομικά αδύνατο**:
 * ο τύπος του `createEntityAction` απέκλειε ρητά ακόμη και το `disabled` από τα overrides.
 *
 * 🔑 **Η διόρθωση ζει στο SSoT**, όχι στις επαφές: κάθε κεφαλίδα οντότητας του έργου κερδίζει την ίδια
 * ικανότητα. Ένα μπάλωμα μόνο στις επαφές θα άφηνε την **ίδια** βλάβη σε έργα, κτίρια, πωλήσεις.
 *
 * ⚠️ Τα **τρία μαζί** — απενεργοποίηση **και** `aria-busy` **και** ορατή αλλαγή. Το W3C (ARIA25)
 * προειδοποιεί ρητά ότι η παράλειψη της απενεργοποίησης είναι το συνηθισμένο λάθος: ο βλέπων χρήστης
 * εξακολουθεί να βλέπει και να πατά το κουμπί.
 */

/* global describe, it, expect, jest */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { User } from 'lucide-react';
import { EntityDetailsHeader } from '../UnifiedEntityHeaderSystem';
import { createEntityAction } from '../entity-action-presets';

function renderHeader(action: ReturnType<typeof createEntityAction>) {
  return render(<EntityDetailsHeader icon={User} title="Δοκιμή" actions={[action]} />);
}

describe('Υ — ενέργεια κεφαλίδας σε εξέλιξη', () => {
  it('Υ4 — όσο τρέχει: απενεργοποιημένο ΚΑΙ aria-busy ΚΑΙ αλλαγμένη ετικέτα', async () => {
    const onClick = jest.fn();
    renderHeader(
      createEntityAction('save', 'Αποθήκευση', onClick, {
        pending: true,
        pendingLabel: 'Αποθήκευση...',
      }),
    );

    const button = screen.getByRole('button', { name: /Αποθήκευση\.\.\./ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    // Και δεν ενεργοποιείται με κλικ — η απενεργοποίηση είναι πραγματική, όχι οπτική.
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('Υ4β — ΠΑΡΟΝΟΜΑΣΤΗΣ: χωρίς `pending` το κουμπί πατιέται κανονικά', async () => {
    // Χωρίς αυτόν, η Υ4 θα μπορούσε να είναι πράσινη επειδή το κουμπί είναι **πάντα** νεκρό.
    const onClick = jest.fn();
    renderHeader(createEntityAction('save', 'Αποθήκευση', onClick));

    const button = screen.getByRole('button', { name: 'Αποθήκευση' });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute('aria-busy', 'true');

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Υ4γ — ο κατασκευαστής ΜΕΤΑΦΕΡΕΙ τη σημαία (δεν την καταπίνει σιωπηλά)', () => {
    // Ο τύπος του `createEntityAction` απέκλειε το `disabled`· η μεταφορά είναι το ίδιο το εύρημα.
    const action = createEntityAction('save', 'Αποθήκευση', () => undefined, {
      pending: true,
      pendingLabel: 'Αποθήκευση...',
      disabled: true,
    });

    expect(action.pending).toBe(true);
    expect(action.pendingLabel).toBe('Αποθήκευση...');
    expect(action.disabled).toBe(true);
  });
});
