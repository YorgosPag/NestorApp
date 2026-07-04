/**
 * useStructuralRelevanceRouter — SINGLE-PATH relevance (ADR-459 v19).
 *
 * Ο router είναι η **ΜΙΑ** πηγή αλήθειας: κρίνει αν ένα generic geometry event
 * (`bim:entities-moved` / `drawing:entity-created`) αγγίζει δομικό μέλος και, μόνο τότε,
 * εκπέμπει το σημασιολογικό `bim:structural-geometry-changed`. Αυτό το test κλειδώνει τη
 * λογική που πριν ζούσε διάσπαρτη ως `eventTouchesStructuralMember` (v17, superseded).
 */

import { act, renderHook } from '@testing-library/react';
import { EventBus } from '../../systems/events/EventBus';
import { useStructuralRelevanceRouter } from '../useStructuralRelevanceRouter';

function collectSemantic(): { members: readonly { type: string }[]; sourceEvent: string }[] {
  const out: { members: readonly { type: string }[]; sourceEvent: string }[] = [];
  EventBus.on('bim:structural-geometry-changed', (p) =>
    out.push(p as unknown as { members: readonly { type: string }[]; sourceEvent: string }),
  );
  return out;
}

describe('useStructuralRelevanceRouter — SINGLE-PATH relevance gate', () => {
  beforeEach(() => EventBus.clear());

  it('μετακίνηση ΓΡΑΜΜΗΣ → ΔΕΝ εκπέμπεται σημασιολογικό event', () => {
    const events = collectSemantic();
    renderHook(() => useStructuralRelevanceRouter());
    act(() => {
      EventBus.emit('bim:entities-moved', { movedEntities: [{ id: 'l1', type: 'line' }] } as never);
    });
    expect(events).toHaveLength(0);
  });

  it('μετακίνηση ΚΟΛΟΝΑΣ → εκπέμπεται ΜΙΑ φορά με τα δομικά μέλη', () => {
    const events = collectSemantic();
    renderHook(() => useStructuralRelevanceRouter());
    act(() => {
      EventBus.emit('bim:entities-moved', { movedEntities: [{ id: 'c1', type: 'column' }] } as never);
    });
    expect(events).toHaveLength(1);
    expect(events[0].sourceEvent).toBe('bim:entities-moved');
    expect(events[0].members.map((m) => m.type)).toEqual(['column']);
  });

  it('μεικτή μετακίνηση (γραμμή + κολόνα) → εκπέμπεται ΜΟΝΟ το δομικό υποσύνολο', () => {
    const events = collectSemantic();
    renderHook(() => useStructuralRelevanceRouter());
    act(() => {
      EventBus.emit('bim:entities-moved', {
        movedEntities: [{ id: 'l1', type: 'line' }, { id: 'c1', type: 'column' }, { id: 'b1', type: 'beam' }],
      } as never);
    });
    expect(events).toHaveLength(1);
    expect(events[0].members.map((m) => m.type)).toEqual(['column', 'beam']);
  });

  it('μη-array payload (άγνωστο shape) → κανένα crash, κανένα event', () => {
    const events = collectSemantic();
    renderHook(() => useStructuralRelevanceRouter());
    act(() => {
      EventBus.emit('bim:entities-moved', { movedEntities: undefined } as never);
    });
    expect(events).toHaveLength(0);
  });

  it('δημιουργία ΓΡΑΜΜΗΣ → κανένα event· δημιουργία ΚΟΛΟΝΑΣ → ένα event', () => {
    const events = collectSemantic();
    renderHook(() => useStructuralRelevanceRouter());
    act(() => {
      EventBus.emit('drawing:entity-created', { entity: { id: 'l1', type: 'line' }, tool: 'line' } as never);
    });
    expect(events).toHaveLength(0);
    act(() => {
      EventBus.emit('drawing:entity-created', { entity: { id: 'c1', type: 'column' }, tool: 'column' } as never);
    });
    expect(events).toHaveLength(1);
    expect(events[0].sourceEvent).toBe('drawing:entity-created');
  });
});
