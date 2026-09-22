/**
 * @file ADR-598 G11 · §3 procurement — τα δύο SSoT γραμμών: `LineItemsSection` + `AtoeCategoryCodeSelect`.
 *
 * - Γ1: η ενότητα ονομάζεται από την επικεφαλίδα της — **και** ο πίνακας.
 * - Γ2: κάθε στήλη είναι `columnheader`· η στήλη ενεργειών έχει όνομα (όχι κενό `<th />`).
 * - Γ3: χωρίς γραμμές ⇒ κανένας πίνακας (αλλά η ενότητα και οι ενέργειες μένουν).
 * - Κ1: `partitionAtoeCodes` — οι προτεινόμενοι ως έχουν, οι υπόλοιποι χωρίς αυτούς.
 * - Κ2: ο επιλογέας κωδικού έχει το όνομα που του δόθηκε.
 * - Α1: κανένα εύρημα axe.
 */

import * as React from 'react';
import { render, screen, within } from '@testing-library/react';

import { expectNoA11yViolations } from '@/test-utils/a11y';
import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';
import { LineItemsSection } from '../LineItemsSection';
import { AtoeCategoryCodeSelect, partitionAtoeCodes } from '../AtoeCategoryCodeSelect';

const COLUMNS = [
  { key: 'description', label: 'Περιγραφή' },
  { key: 'categoryCode', label: 'Κατηγορία ΑΤΟΕ' },
];

function renderSection(hasLines: boolean) {
  return render(
    <LineItemsSection
      title="Γραμμές Προσφοράς"
      columns={COLUMNS}
      actionsColumnLabel="Ενέργειες"
      hasLines={hasLines}
      actions={<button type="button">Προσθήκη Γραμμής</button>}
    >
      <tr>
        <td><input aria-label="Περιγραφή" /></td>
        <td>
          <AtoeCategoryCodeSelect
            aria-label="Κατηγορία ΑΤΟΕ"
            value={null}
            onChange={() => undefined}
            suggestedCodes={['OIK-1']}
            placeholder="Κωδ. ΑΤΟΕ"
            noneLabel="—"
          />
        </td>
        <td><button type="button" aria-label="Αφαίρεση">×</button></td>
      </tr>
    </LineItemsSection>,
  );
}

describe('LineItemsSection', () => {
  it('Γ1: ενότητα και πίνακας ονομάζονται από την επικεφαλίδα', () => {
    renderSection(true);
    expect(screen.getByRole('region', { name: 'Γραμμές Προσφοράς' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Γραμμές Προσφοράς' })).toBeInTheDocument();
  });

  it('Γ2: κάθε στήλη έχει κεφαλίδα με όνομα — και η στήλη ενεργειών', () => {
    renderSection(true);
    const headers = within(screen.getByRole('table')).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Περιγραφή', 'Κατηγορία ΑΤΟΕ', 'Ενέργειες']);
  });

  it('Γ3: χωρίς γραμμές ⇒ κανένας πίνακας, οι ενέργειες μένουν', () => {
    renderSection(false);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('button', { name: 'Προσθήκη Γραμμής' })).toBeInTheDocument();
  });

  it('Α1: κανένα εύρημα axe', async () => {
    renderSection(true);
    await expectNoA11yViolations(document.body);
  });
});

describe('AtoeCategoryCodeSelect', () => {
  it('Κ1: partitionAtoeCodes', () => {
    const first = ATOE_MASTER_CATEGORIES[0].code;
    const { suggested, remaining } = partitionAtoeCodes([first]);
    expect(suggested).toEqual([first]);
    expect(remaining).not.toContain(first);
    expect(remaining).toHaveLength(ATOE_MASTER_CATEGORIES.length - 1);
  });

  it('Κ2: ο επιλογέας έχει το όνομα που του δόθηκε', () => {
    renderSection(true);
    expect(screen.getByRole('combobox', { name: 'Κατηγορία ΑΤΟΕ' })).toBeInTheDocument();
  });
});
