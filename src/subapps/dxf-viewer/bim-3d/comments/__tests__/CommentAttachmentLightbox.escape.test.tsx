/**
 * ADR-364 §10.14 — ESC ownership for the comment attachment lightbox.
 *
 * This overlay was never classified by §10.5 (it appears in none of the 42
 * buckets) and owned a raw global `window` keydown listener — the category the
 * ADR calls "the only genuinely dangerous one", because Μηχ. 2's
 * `stopImmediatePropagation` does not cut it when the bus consumes nothing.
 *
 * The decisive test is `beats a lower-priority canvas handler`: the bus listens
 * on `window` capture and Radix's DismissableLayer on `document` capture, so the
 * bus ALWAYS runs first. With a 3D element selected, the composite
 * `canvas/fallback-deselect` at DRAFT_POLYGON (400) would consume the press and
 * call stopImmediatePropagation — Radix would never see the key and the lightbox
 * would stay open. Registering at MODAL_DIALOG (1000) is what prevents that.
 */

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { CommentAttachmentLightbox } from '../CommentAttachmentLightbox';
import { escapeBus, ESC_PRIORITY } from '../../../systems/escape-bus';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const IMAGES = [
  { url: 'https://example.test/a.png', name: 'a.png' },
  { url: 'https://example.test/b.png', name: 'b.png' },
];

function pressEscape(): void {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  );
}

beforeEach(() => {
  escapeBus.__resetForTests();
});

afterEach(cleanup);

describe('lightbox — escape bus registration', () => {
  it('registers exactly one handler at MODAL_DIALOG while mounted', () => {
    render(
      <CommentAttachmentLightbox
        images={IMAGES}
        currentIndex={0}
        onIndexChange={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    const slot = escapeBus
      .inspect()
      .handlers.find((h) => h.id === 'bim-3d/comment-attachment-lightbox');

    expect(slot).toBeDefined();
    expect(slot?.priority).toBe(ESC_PRIORITY.MODAL_DIALOG);
    // No editable element exists inside the trapped dialog, so the bus's own
    // editable guard can never suppress this slot — allowWhenEditable must stay off.
    expect(slot?.allowWhenEditable).toBe(false);
  });

  it('closes on ESC', () => {
    const onClose = jest.fn();
    render(
      <CommentAttachmentLightbox
        images={IMAGES}
        currentIndex={0}
        onIndexChange={jest.fn()}
        onClose={onClose}
      />,
    );

    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('beats a lower-priority canvas handler (the real regression)', () => {
    const deselect = jest.fn(() => true);
    escapeBus.register({
      id: 'canvas/fallback-deselect',
      priority: ESC_PRIORITY.DRAFT_POLYGON,
      canHandle: () => true,
      handle: deselect,
    });

    const onClose = jest.fn();
    render(
      <CommentAttachmentLightbox
        images={IMAGES}
        currentIndex={0}
        onIndexChange={jest.fn()}
        onClose={onClose}
      />,
    );

    pressEscape();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(deselect).not.toHaveBeenCalled();
  });

  it('unregisters on unmount so ESC falls through again', () => {
    const { unmount } = render(
      <CommentAttachmentLightbox
        images={IMAGES}
        currentIndex={0}
        onIndexChange={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    unmount();

    expect(
      escapeBus.inspect().handlers.some((h) => h.id === 'bim-3d/comment-attachment-lightbox'),
    ).toBe(false);
  });

  it('installs no global window keydown listener of its own', () => {
    // Force the bus to install ITS single window listener first, so the spy
    // below can only ever see a listener added by the component itself.
    escapeBus.register({
      id: 'test/bus-listener-primer',
      priority: ESC_PRIORITY.TOOL_RESET,
      canHandle: () => false,
      handle: () => false,
    });

    const addSpy = jest.spyOn(window, 'addEventListener');
    render(
      <CommentAttachmentLightbox
        images={IMAGES}
        currentIndex={0}
        onIndexChange={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    // The bus owns the single window listener; the component must add none.
    const ownKeydownListeners = addSpy.mock.calls.filter(([type]) => type === 'keydown');
    expect(ownKeydownListeners).toHaveLength(0);
    addSpy.mockRestore();
  });
});

describe('lightbox — guards', () => {
  it('renders nothing when the index is out of range', () => {
    const { container } = render(
      <CommentAttachmentLightbox
        images={IMAGES}
        currentIndex={99}
        onIndexChange={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
