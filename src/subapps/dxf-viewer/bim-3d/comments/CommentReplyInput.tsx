'use client';

/**
 * ADR-366 Phase 9 / C.2 — Textarea input for BIM comment replies.
 * @-trigger opens CommentMentionsPicker. Ctrl+Enter submits.
 *
 * ADR-364 §10.5 Κ3 / §10.14 — this textarea owns ALL mention keys. The picker
 * used to carry its own arrow/Enter/Escape handler on an unfocusable
 * `role="listbox"`, so none of them ever fired; the keys now live on the
 * element that actually holds focus. The ESC branch below is unchanged and
 * remains a legitimate local Κ3 handler: while the textarea has focus the bus
 * skips every slot that is not `allowWhenEditable`, so there is no competitor
 * to arbitrate and no reason to register with it.
 *
 * ARIA: `aria-activedescendant` publishes the active option while DOM focus
 * stays here — see `CommentMentionsPicker` for why this is the GitHub
 * `combobox-nav` model and not `role="combobox"`.
 */

import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { noteLocalEscapeOwner } from '../../systems/escape-bus';
import { CommentMentionsPicker } from './CommentMentionsPicker';
import { useMentionCandidates } from './use-mention-candidates';

interface CommentReplyInputProps {
  readonly onSubmit: (content: string, mentionedIds: readonly string[]) => Promise<void>;
  readonly onCancel?: () => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
}

interface MentionContext {
  /** Text between `@` and the caret. */
  readonly query: string;
  /** Index of the `@` itself — the splice anchor. */
  readonly start: number;
}

/**
 * Detects an in-progress mention at the caret.
 *
 * Returns the `@` offset alongside the query so the replacement can be spliced
 * at the caret. The previous implementation returned the query alone and the
 * caller fell back to `text.replace(/@\w*$/, …)`, which rewrites the LAST
 * mention in the whole string — editing an earlier `@` in a multi-mention reply
 * silently corrupted a different one.
 */
function detectMentionContext(value: string, cursorPos: number): MentionContext | null {
  const before = value.slice(0, cursorPos);
  const match = before.match(/@(\w*)$/);
  if (!match) return null;
  return { query: match[1], start: cursorPos - match[0].length };
}

export function CommentReplyInput({
  onSubmit,
  onCancel,
  placeholder,
  disabled,
}: CommentReplyInputProps) {
  const { t } = useTranslation('bim3d');
  const [text, setText] = useState('');
  const [mentionedIds, setMentionedIds] = useState<readonly string[]>([]);
  const [mention, setMention] = useState<MentionContext | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef<number | null>(null);

  const domId = useId();
  const listboxId = `${domId}-mentions`;
  const optionIdPrefix = `${domId}-mention-option`;
  const instructionsId = `${domId}-mention-instructions`;

  const candidates = useMentionCandidates(mention?.query ?? null);
  const isPickerOpen = mention !== null;
  const activeOptionId =
    isPickerOpen && candidates.length > 0 ? `${optionIdPrefix}-${activeIndex}` : undefined;

  useEffect(() => {
    setActiveIndex(0);
  }, [mention?.query]);

  // Restore the caret after a mention splice — React re-renders with the new
  // value and would otherwise leave the caret at the end of the textarea.
  useEffect(() => {
    const caret = caretRef.current;
    if (caret === null) return;
    caretRef.current = null;
    textareaRef.current?.setSelectionRange(caret, caret);
  }, [text]);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>): void {
    const { value } = e.target;
    setText(value);
    setMention(detectMentionContext(value, e.target.selectionStart ?? value.length));
  }

  function handleMentionSelect(userId: string, userName: string): void {
    if (!mention) return;
    const caretPos = textareaRef.current?.selectionStart ?? text.length;
    const insert = `@${userName} `;
    const next = text.slice(0, mention.start) + insert + text.slice(caretPos);

    setMentionedIds((ids) => (ids.includes(userId) ? ids : [...ids, userId]));
    caretRef.current = mention.start + insert.length;
    setText(next);
    setMention(null);
    textareaRef.current?.focus();
  }

  async function handleSubmit(): Promise<void> {
    const content = text.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(content, mentionedIds);
      setText('');
      setMentionedIds([]);
    } finally {
      setSubmitting(false);
    }
  }

  /** Mention-list navigation. Returns true when the key was consumed. */
  function handleMentionKey(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
    if (!isPickerOpen) return false;

    if (e.key === 'Escape') {
      // ADR-364 §10.15 — δηλώνουμε τον Κ3 στον έλεγχο. Χωρίς αυτό ο Μηχ. 1 τύπωνε
      // `SHADOW-OWNER` σε ΚΑΘΕ κλείσιμο της λίστας — θόρυβος πάνω στον ίδιο του τον
      // θεσμοθετημένο ιδιοκτήτη. Αδήλωτος ωμός ιδιοκτήτης εξακολουθεί να πιάνεται.
      noteLocalEscapeOwner(e.nativeEvent, 'comment-reply/mention-list');
      setMention(null);
      return true;
    }
    if (candidates.length === 0) return false;

    if (e.key === 'ArrowDown') {
      setActiveIndex((i) => (i + 1) % candidates.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      setActiveIndex((i) => (i - 1 + candidates.length) % candidates.length);
      return true;
    }
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      const picked = candidates[activeIndex];
      if (!picked) return false;
      handleMentionSelect(picked.uid, picked.displayName ?? picked.email);
      return true;
    }
    return false;
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    // The open mention list claims its keys first — plain Enter must pick a user
    // rather than insert a newline while the list is showing.
    if (handleMentionKey(e)) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <div className="relative flex flex-col gap-2">
      {isPickerOpen && (
        <div className="absolute bottom-full left-0 z-10 w-64">
          <CommentMentionsPicker
            candidates={candidates}
            activeIndex={activeIndex}
            onActiveIndexChange={setActiveIndex}
            onSelect={handleMentionSelect}
            listboxId={listboxId}
            optionIdPrefix={optionIdPrefix}
          />
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? t('comments.details.addReply')}
        disabled={disabled || submitting}
        rows={2}
        className="resize-none text-xs"
        aria-autocomplete="list"
        aria-controls={isPickerOpen ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
        aria-describedby={instructionsId}
      />
      <span id={instructionsId} className="sr-only">
        {t('comments.mention.instructions')}
      </span>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={onCancel}
            disabled={submitting}
          >
            {t('comments.details.cancel')}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          className="text-xs"
          onClick={() => void handleSubmit()}
          disabled={!text.trim() || submitting}
        >
          <Send className="mr-1 h-3.5 w-3.5" />
          {t('comments.details.submit')}
        </Button>
      </div>
    </div>
  );
}
