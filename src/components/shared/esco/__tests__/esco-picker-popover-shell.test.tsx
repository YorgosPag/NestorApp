/**
 * Unit tests for EscoPickerPopoverShell (ADR-325).
 *
 * Locks the SSoT contract that prevents the 2026-04-25 bug from reappearing:
 *   - Clicking the anchor MUST NOT toggle the popover open.
 *   - Popover open state is controlled exclusively by the parent via `open`.
 *   - onOpenChange still fires for Radix-owned transitions (Escape / outside
 *     click) so parent pickers stay in sync.
 *
 * @module components/shared/esco/__tests__/esco-picker-popover-shell
 * @see adrs/ADR-325-esco-picker-popover-anchor-ssot.md
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EscoPickerPopoverShell } from '../esco-picker-popover-shell';

describe('EscoPickerPopoverShell', () => {
  it('renders the anchor element', () => {
    render(
      <EscoPickerPopoverShell
        open={false}
        onOpenChange={() => {}}
        anchor={<button data-testid="anchor-btn">anchor</button>}
      >
        <p>content</p>
      </EscoPickerPopoverShell>,
    );
    expect(screen.getByTestId('anchor-btn')).toBeInTheDocument();
  });

  it('does NOT render popover content when open=false', () => {
    render(
      <EscoPickerPopoverShell
        open={false}
        onOpenChange={() => {}}
        anchor={<button>anchor</button>}
      >
        <p data-testid="content">hidden content</p>
      </EscoPickerPopoverShell>,
    );
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('renders popover content when open=true', () => {
    render(
      <EscoPickerPopoverShell
        open={true}
        onOpenChange={() => {}}
        anchor={<button>anchor</button>}
      >
        <p data-testid="content">visible content</p>
      </EscoPickerPopoverShell>,
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('does NOT call onOpenChange when clicking the anchor while closed', async () => {
    // THIS IS THE BUG GUARD. With PopoverTrigger the previous implementation
    // called onOpenChange(true) on click, which raced with the picker's
    // MIN_CHARS-gated setOpen. PopoverAnchor must not toggle on click.
    const onOpenChange = jest.fn();
    const user = userEvent.setup();

    render(
      <EscoPickerPopoverShell
        open={false}
        onOpenChange={onOpenChange}
        anchor={<button data-testid="anchor-btn">anchor</button>}
      >
        <p>content</p>
      </EscoPickerPopoverShell>,
    );

    await user.click(screen.getByTestId('anchor-btn'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('does NOT call onOpenChange when clicking the anchor while open', async () => {
    const onOpenChange = jest.fn();
    const user = userEvent.setup();

    render(
      <EscoPickerPopoverShell
        open={true}
        onOpenChange={onOpenChange}
        anchor={<button data-testid="anchor-btn">anchor</button>}
      >
        <p>content</p>
      </EscoPickerPopoverShell>,
    );

    await user.click(screen.getByTestId('anchor-btn'));
    // Anchor must not toggle. If Radix closes due to focus move, that is an
    // outside-click which is a separate contract — the click itself on the
    // anchor element must not issue a synthetic toggle.
    // Accept 0 calls or, if Radix did emit close, ensure it was NOT `true`.
    const calls = onOpenChange.mock.calls;
    const toggledOpen = calls.some(([nextOpen]) => nextOpen === true);
    expect(toggledOpen).toBe(false);
  });

  it('anchor wrapper has base positioning classes (relative w-full rounded-md)', () => {
    const { container } = render(
      <EscoPickerPopoverShell
        open={false}
        onOpenChange={() => {}}
        anchor={<input data-testid="inner-input" />}
      >
        <p>content</p>
      </EscoPickerPopoverShell>,
    );
    const input = container.querySelector('[data-testid="inner-input"]');
    const wrapper = input?.parentElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toMatch(/\brelative\b/);
    expect(wrapper?.className).toMatch(/\bw-full\b/);
    expect(wrapper?.className).toMatch(/\brounded-md\b/);
  });

  it('declares focus-within outline classes on wrapper (SSoT visual cue)', () => {
    // Guards the ADR-325 v1.4 contract: the shell owns the focus cue via
    // CSS pseudo-class `:focus-within` and the native `outline` property.
    // jsdom doesn't apply :focus-within visually, so we verify the static
    // class list contains the focus-within variants — Tailwind + the
    // browser do the rest at runtime.
    const { container } = render(
      <EscoPickerPopoverShell
        open={false}
        onOpenChange={() => {}}
        anchor={<input data-testid="inner-input" />}
      >
        <p>content</p>
      </EscoPickerPopoverShell>,
    );
    const input = container.querySelector<HTMLInputElement>('[data-testid="inner-input"]');
    const wrapper = input?.parentElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toMatch(/focus-within:outline\b/);
    expect(wrapper?.className).toMatch(/focus-within:outline-2\b/);
    expect(wrapper?.className).toMatch(/focus-within:outline-offset-2\b/);
    expect(wrapper?.className).toMatch(/focus-within:outline-blue-500\b/);
  });

  it('fires onOpenChange(false) when Escape is pressed while open', async () => {
    const onOpenChange = jest.fn();
    const user = userEvent.setup();

    render(
      <EscoPickerPopoverShell
        open={true}
        onOpenChange={onOpenChange}
        anchor={<button data-testid="anchor-btn">anchor</button>}
      >
        <p>content</p>
      </EscoPickerPopoverShell>,
    );

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
