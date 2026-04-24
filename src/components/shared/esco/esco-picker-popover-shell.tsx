'use client';

/**
 * ============================================================================
 * ESCO Picker Popover Shell (ADR-325)
 * ============================================================================
 *
 * SSoT wrapper for ESCO picker popovers (EscoOccupationPicker, EscoSkillPicker).
 *
 * Purpose: encode the correct popover-trigger semantics for search-first
 * pickers in ONE place so the bug "click on empty input flashes a zero-height
 * dropdown" cannot reappear.
 *
 * Bug history (2026-04-25):
 *   The previous implementation used <PopoverTrigger asChild>{input}</>.
 *   Radix Trigger installs a built-in click handler that toggles `open`. On an
 *   empty input this raced with our focus/type-driven `setOpen(true)` gate,
 *   producing a popover opened with zero results — rendered as a tiny empty
 *   box. Same class of bug fixed in searchable-combobox.tsx on the same day.
 *
 * Fix: use <PopoverAnchor> instead of <PopoverTrigger>. Anchor positions the
 * popover but does NOT toggle open on click — the parent component fully owns
 * `open` state via its own onChange/onFocus handlers (gated on MIN_CHARS).
 *
 * @module components/shared/esco/esco-picker-popover-shell
 */

import * as React from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

export interface EscoPickerPopoverShellProps {
  /** Controlled open state — owned by parent picker */
  open: boolean;
  /** Radix onOpenChange handler (for outside click / Escape) */
  onOpenChange: (open: boolean) => void;
  /**
   * Anchor content — pass the Search icon + <Input> + spinner/badge/clear
   * elements as a fragment. The shell owns the relative/rounded wrapper and
   * the focus-within ring, so every ESCO picker shows an identical visual
   * focus cue regardless of which descendant actually receives focus.
   */
  anchor: React.ReactNode;
  /** Popover content (results listbox) */
  children: React.ReactNode;
}

/**
 * Visual wrapper classes for the anchor.
 *
 * Implementation history (2026-04-25 QA):
 *   Three earlier attempts to light up the wrapper on focus failed in
 *   production despite passing jsdom tests:
 *     v1.1 — CSS `:focus-within` + Tailwind `ring-*`: class list never
 *            showed the ring on the Δεξιότητες field; reason not
 *            reproducible outside the live browser.
 *     v1.2 — React state + `onFocusCapture` / `onBlurCapture`: state never
 *            transitioned to `true`; Radix `asChild` Slot composition
 *            likely intercepts synthetic focus events before they reach
 *            React's capture phase.
 *     v1.3 — Native `focusin` / `focusout` on a ref + `useState`: same
 *            outcome — wrapper class list never gained the focused classes
 *            in the live browser. Ref may not resolve through Slot in time.
 *
 *   v1.4 returns to **pure CSS** — no React state, no refs, no JS event
 *   listeners. `:focus-within` is a native browser pseudo-class that fires
 *   as soon as any descendant is focused, with zero framework involvement.
 *   `outline` is a native CSS property (not Tailwind's `ring-*`, which
 *   depends on the `--tw-ring-*` custom property chain). Combining both
 *   eliminates every framework and Tailwind-specific failure mode.
 */
const ANCHOR_CLASSES =
  'relative w-full rounded-md focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-500';

export function EscoPickerPopoverShell({
  open,
  onOpenChange,
  anchor,
  children,
}: EscoPickerPopoverShellProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div className={ANCHOR_CLASSES}>{anchor}</div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 max-h-80 overflow-y-auto"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

export default EscoPickerPopoverShell;
