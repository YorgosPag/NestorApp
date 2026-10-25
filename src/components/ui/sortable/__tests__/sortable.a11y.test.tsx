/**
 * @file ADR-598 G11 — το συμβόλαιο προσβασιμότητας των `SortableList` / `SortableTree` (ADR-923 Φάση 1γ).
 *
 * - Α1: λίστα με λαβές μετακίνησης — κανένα εύρημα axe.
 * - Α2: δέντρο με παιδιά (κουμπί ανάπτυξης + επιλεγμένος κόμβος) — κανένα εύρημα axe.
 * - Α3: απενεργοποιημένα (χωρίς δικαίωμα αλλαγής) — κανένα εύρημα axe.
 */

import * as React from 'react';
import { render } from '@testing-library/react';

import { expectNoA11yViolations } from '@/test-utils/a11y';
import { SortableList } from '../SortableList';
import { SortableTree, type SortableTreeNode } from '../SortableTree';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

interface Row { readonly id: string; readonly name: string }

const ROWS: readonly Row[] = [
  { id: 'a', name: 'Ισχύς' },
  { id: 'b', name: 'Τάση' },
  { id: 'c', name: 'Βάρος' },
];

const NODES: readonly SortableTreeNode[] = [
  { id: 'root', parentId: null, label: 'Κλιματισμός' },
  { id: 'child', parentId: 'root', label: 'Fan coil' },
  { id: 'other', parentId: null, label: 'Φωτισμός' },
];

function renderList(disabled = false) {
  render(
    <SortableList
      items={ROWS}
      getId={(row) => row.id}
      getLabel={(row) => row.name}
      onMove={() => undefined}
      ariaLabel="Ιδιότητες"
      disabled={disabled}
      renderItem={(row, handle) => <>{handle}<span>{row.name}</span></>}
    />,
  );
}

function renderTree(disabled = false) {
  render(
    <SortableTree
      nodes={NODES}
      selectedId="child"
      onSelect={() => undefined}
      onMove={() => undefined}
      ariaLabel="Κατηγορίες"
      disabled={disabled}
      renderLabel={(node) => <span>{node.label}</span>}
    />,
  );
}

describe('Sortable a11y', () => {
  it('Α1: λίστα — κανένα εύρημα axe', async () => {
    renderList();
    await expectNoA11yViolations(document.body);
  });

  it('Α2: δέντρο — κανένα εύρημα axe', async () => {
    renderTree();
    await expectNoA11yViolations(document.body);
  });

  it('Α3: απενεργοποιημένα — κανένα εύρημα axe', async () => {
    renderList(true);
    renderTree(true);
    await expectNoA11yViolations(document.body);
  });
});
