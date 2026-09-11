/**
 * ADR-364 §10.15.γ · ADR-241 — **A5: ένα re-render δεν αλλάζει ποιος κατέχει το Escape.**
 *
 * Οι καλούντες του `useEscapeKey` περνούν συχνά νέο closure σε κάθε render (`useEscapeKey(onClose)` στο lightbox των
 * συνημμένων). Αν η εγγραφή εξαρτιόταν από την ταυτότητα του handler, κάθε render θα ξαναέβαζε τη στρώση στην
 * **κορυφή** της στοίβας — η εξωτερική επιφάνεια θα «έκλεβε» το Escape από την εσώτερη χωρίς να ανοίξει τίποτα.
 */

import React from 'react';
import { act, render } from '@testing-library/react';

import { __resetEscapeLayersForTests, inspectEscapeLayers } from '@/lib/a11y/escape-layers';
import { useEscapeKey } from '../useEscapeKey';

/**
 * ⚠️ Ο handler περνά **αυτούσιος** — όχι `() => onEscape()`. Ένα νέο closure μέσα στο component θα άλλαζε ταυτότητα
 * σε **κάθε** στρώση σε κάθε render, οπότε αν το hook ξαναγραφόταν κατά ταυτότητα θα ξαναγράφονταν **όλες** με την
 * ίδια σειρά και το ελάττωμα θα έμενε αόρατο (μετρημένο: η μετάλλαξη «handler στα deps» επέζησε με εκείνη τη γραφή).
 */
function Layer({ id, onEscape, enabled = true }: { id: string; onEscape: () => void; enabled?: boolean }): null {
  useEscapeKey(onEscape, enabled, id);
  return null;
}

function pressEscape(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  act(() => {
    document.body.dispatchEvent(event);
  });
  return event;
}

afterEach(() => {
  __resetEscapeLayersForTests();
});

describe('A5 — η σειρά ιδιοκτησίας αντέχει τα re-renders', () => {
  test('νέο closure στην εξωτερική στρώση ⇒ το Escape μένει στην εσώτερη', () => {
    const outer = jest.fn();
    const inner = jest.fn();
    const view = render(
      <>
        <Layer id="test/outer" onEscape={outer} />
        <Layer id="test/inner" onEscape={inner} />
      </>,
    );
    // Re-render: η εξωτερική παίρνει ΝΕΟ handler (νέα ταυτότητα) — όπως κάθε `useEscapeKey(onClose)`.
    view.rerender(
      <>
        <Layer id="test/outer" onEscape={() => outer()} />
        <Layer id="test/inner" onEscape={inner} />
      </>,
    );
    pressEscape();
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    expect(inspectEscapeLayers()).toEqual(['test/outer', 'test/inner']);
  });

  test('ο πιο πρόσφατος handler καλείται (το ref δεν μένει μπαγιάτικο)', () => {
    const first = jest.fn();
    const latest = jest.fn();
    const view = render(<Layer id="test/only" onEscape={first} />);
    view.rerender(<Layer id="test/only" onEscape={latest} />);
    pressEscape();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  test('`enabled=false` ⇒ η στρώση φεύγει από τη στοίβα, το πάτημα μένει ελεύθερο', () => {
    const onEscape = jest.fn();
    const view = render(<Layer id="test/only" onEscape={onEscape} />);
    view.rerender(<Layer id="test/only" onEscape={onEscape} enabled={false} />);
    const event = pressEscape();
    expect(onEscape).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(inspectEscapeLayers()).toEqual([]);
  });

  test('unmount ⇒ η στρώση φεύγει', () => {
    const view = render(<Layer id="test/only" onEscape={jest.fn()} />);
    view.unmount();
    expect(inspectEscapeLayers()).toEqual([]);
  });
});
