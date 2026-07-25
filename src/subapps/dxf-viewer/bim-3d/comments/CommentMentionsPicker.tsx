'use client';

/**
 * ADR-366 Phase 9 / C.2 — @-mention user picker for BIM comments.
 *
 * PRESENTATION ONLY. Candidates come from `useMentionCandidates`, and every key
 * — ArrowUp / ArrowDown / Enter / Escape — is handled by the focused
 * `<textarea>` in `CommentReplyInput`, never here.
 *
 * ADR-364 §10.5 Κ2-γ — why this component no longer has a keydown handler at
 * all. It used to carry one on a `role="listbox" tabIndex={-1}` element that
 * nothing ever focused (no `autoFocus`, no `.focus()` call anywhere), while the
 * real focus sat on its sibling `<textarea>`. The handler was therefore dead on
 * arrival: ESC, arrows and Enter all silently did nothing. §10.5 listed it for
 * deletion, which would have been correct for the ESC line alone but would have
 * frozen the accessibility defect — the @-mention list simply had no keyboard
 * navigation. The keys were moved to the element that actually has focus instead.
 *
 * ARIA model — the GitHub `combobox-nav` pattern (the library behind GitHub's own
 * @-mentions): DOM focus never leaves the textarea, and the active option is
 * published through `aria-activedescendant` on that textarea. Deliberately NOT
 * `role="combobox"`: ARIA 1.2 requires a combobox's text input to carry
 * `aria-multiline="false"`, so a `<textarea>` cannot be a conforming combobox.
 * GitHub ships `role="combobox"` on its textarea anyway; we use the same
 * interaction model without the non-conforming role, keeping `aria-autocomplete`
 * + `aria-controls` + `aria-activedescendant` on a plain multiline textbox.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { CompanyUser } from '@/components/admin/role-management/types';

interface CommentMentionsPickerProps {
  /** Filtered candidates, owned by the parent via `useMentionCandidates`. */
  readonly candidates: readonly CompanyUser[];
  /** Index of the visually active option — drives `aria-activedescendant`. */
  readonly activeIndex: number;
  readonly onActiveIndexChange: (index: number) => void;
  readonly onSelect: (userId: string, userName: string) => void;
  /** DOM id of the listbox — the textarea points at it with `aria-controls`. */
  readonly listboxId: string;
  /** Option ids are `${optionIdPrefix}-${index}`; the parent derives the same id. */
  readonly optionIdPrefix: string;
}

export function CommentMentionsPicker({
  candidates,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  listboxId,
  optionIdPrefix,
}: CommentMentionsPickerProps) {
  const { t } = useTranslation('bim3d');
  const listRef = useRef<HTMLUListElement>(null);

  // WAI-ARIA APG requirement for the aria-activedescendant model: the browser
  // does NOT scroll an active-descendant option into view the way it does for a
  // genuinely focused element, so it has to be done explicitly.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const option = list.children[activeIndex];
    if (option instanceof HTMLElement) {
      // Optional-call: jsdom does not implement scrollIntoView (repo convention,
      // same as the stair override sections).
      option.scrollIntoView?.({ block: 'nearest' });
    }
  }, [activeIndex]);

  if (candidates.length === 0) {
    return (
      <div className="rounded-md border border-border bg-popover p-2 text-xs text-muted-foreground shadow-md">
        {t('comments.mention.noUsers')}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-popover shadow-md">
      <ul
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label={t('comments.mention.placeholder')}
        className="max-h-48 overflow-y-auto py-1"
      >
        {candidates.map((u, i) => (
          <li
            key={u.uid}
            id={`${optionIdPrefix}-${i}`}
            role="option"
            aria-selected={i === activeIndex}
            className={[
              'cursor-pointer px-3 py-1.5 text-xs',
              i === activeIndex
                ? 'bg-accent text-accent-foreground'
                : 'text-popover-foreground hover:bg-accent/50',
            ].join(' ')}
            // `mousedown`, not `click`: the textarea must not blur before the
            // selection is applied, otherwise the caret position used to splice
            // the mention back into the text is already gone.
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(u.uid, u.displayName ?? u.email);
            }}
            onMouseEnter={() => onActiveIndexChange(i)}
          >
            <span className="font-medium">{u.displayName ?? u.email}</span>
            {u.displayName && (
              <span className="ml-1 text-muted-foreground">{u.email}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
