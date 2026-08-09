'use client';

/**
 * 📱🖥️ RESPONSIVE COMPACT TOOLBAR
 *
 * The toolbar as every list page actually uses it: always on for desktop,
 * collapsible behind a toggle on mobile.
 *
 * WHY THIS EXISTS
 * ---------------
 * That arrangement takes two `<CompactToolbar>` elements with an IDENTICAL prop
 * list — one inside `hidden md:block`, one inside `md:hidden` guarded by the
 * toggle. Eleven list pages had written both out by hand, so the props of any
 * one page existed twice and could disagree with themselves; CHECK 3.28
 * measured the pair as a clone. Passing the props once removes the class of bug
 * where a handler is added to the desktop copy and silently missing on a phone.
 *
 * The responsive rule itself is the point: it is a decision about how this app
 * presents a toolbar, and a decision belongs in one place. A page that wants a
 * different arrangement should still render `<CompactToolbar>` directly.
 *
 * @module components/core/CompactToolbar/ResponsiveCompactToolbar
 */

import { CompactToolbar } from './CompactToolbar';
import type { CompactToolbarProps } from './types';

export interface ResponsiveCompactToolbarProps extends CompactToolbarProps {
  /**
   * Whether the mobile copy is currently expanded.
   *
   * Desktop ignores this — the toolbar is always visible there, which is why
   * the flag cannot simply gate both copies at once.
   */
  showOnMobile: boolean;
}

export function ResponsiveCompactToolbar({
  showOnMobile,
  ...toolbarProps
}: ResponsiveCompactToolbarProps) {
  return (
    <>
      {/* Desktop — always visible */}
      <div className="hidden md:block">
        <CompactToolbar {...toolbarProps} />
      </div>

      {/* Mobile — behind the page's toggle */}
      <div className="md:hidden">
        {showOnMobile && <CompactToolbar {...toolbarProps} />}
      </div>
    </>
  );
}
