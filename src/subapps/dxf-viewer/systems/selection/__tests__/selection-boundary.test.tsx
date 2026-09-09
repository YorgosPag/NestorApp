/**
 * ADR-688 / ADR-371 — «ποιος εγγυάται τον SelectionContext;»
 *
 * Περιστατικό (2026-09-09, `/o/<c>/properties?view=floorplan`): το `BimViewport3D`
 * καλεί άνευ όρων `useUniversalSelectionStable` (edit-interaction + clipboard), αλλά
 * ο μόνος `<SelectionSystem>` ζει στο `DxfViewerApp`. Κάθε άλλο mount site
 * (Properties read-only overlay, test-harness) έριχνε ΟΛΗ τη σελίδα με
 * «useUniversalSelectionStable must be used within a SelectionSystem».
 *
 * Οι δύο ερωτήσεις που ΕΚΤΕΛΟΥΝΤΑΙ εδώ — και οι δύο πρέπει να μπορούν να κοκκινίσουν:
 *  Κ1 «χωρίς host provider, ζει ο καταναλωτής;»  → μετάλλαξη: boundary = passthrough
 *  Κ2 «ΜΕ host provider, μένει ΕΝΑΣ;»            → μετάλλαξη: boundary = πάντα provider
 *
 * Το Κ2 δεν είναι καλλωπισμός: ο `SelectedEntitiesStore` είναι singleton με ΕΝΑΝ
 * legacy sink (`registerLegacySink`). Φωλιασμένος δεύτερος provider αρπάζει τον sink
 * του host και στο unmount τον μηδενίζει — δηλαδή σπάει τη ζωντανή επιλογή του
 * `/dxf/viewer`, εκεί που τίποτα δεν φαίνεται σπασμένο στο mount.
 */

import * as React from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { SelectionBoundary } from '../SelectionBoundary';
import {
  SelectionContext,
  SelectionSystem,
  useUniversalSelectionStable,
} from '../SelectionSystem';
import { SelectedEntitiesStore } from '../SelectedEntitiesStore';
import type { SelectionContextType } from '../useSelectionSystemState';

beforeEach(() => {
  SelectedEntitiesStore.clearAll();
});

describe('SelectionBoundary — Κ1: χωρίς host provider', () => {
  it('ο καταναλωτής ΔΕΝ πετάει και η επιλογή φτάνει στο store', () => {
    const { result } = renderHook(() => useUniversalSelectionStable(), {
      wrapper: ({ children }) => <SelectionBoundary>{children}</SelectionBoundary>,
    });

    act(() => { result.current.select('entity-1', 'dxf-entity'); });

    expect(SelectedEntitiesStore.isSelected('entity-1')).toBe(true);
  });

  it('ΑΓΚΥΡΑ: ο ΙΔΙΟΣ καταναλωτής ΧΩΡΙΣ το boundary πετάει (το test μετρά ό,τι νομίζει)', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => renderHook(() => useUniversalSelectionStable())).toThrow(
        /must be used within a SelectionSystem/,
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe('SelectionBoundary — Κ2: ΜΕ host provider', () => {
  it('δεν φτιάχνει δεύτερο — ο context μέσα είναι Ο ΙΔΙΟΣ με του host', () => {
    let outside: SelectionContextType | null = null;
    let inside: SelectionContextType | null = null;

    function Probe({ sink }: { sink: (c: SelectionContextType | null) => void }) {
      sink(React.useContext(SelectionContext));
      return null;
    }

    render(
      <SelectionSystem>
        <Probe sink={(c) => { outside = c; }} />
        <SelectionBoundary>
          <Probe sink={(c) => { inside = c; }} />
        </SelectionBoundary>
      </SelectionSystem>,
    );

    expect(outside).not.toBeNull();
    expect(inside).toBe(outside);
  });
});
