'use client';

/**
 * ADR-366 Phase 9 / C.2 — Textarea input for BIM comment replies.
 * @-trigger opens CommentMentionsPicker. Ctrl+Enter submits.
 */

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CommentMentionsPicker } from './CommentMentionsPicker';

interface CommentReplyInputProps {
  readonly onSubmit: (content: string, mentionedIds: readonly string[]) => Promise<void>;
  readonly onCancel?: () => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
}

function detectMentionQuery(value: string, cursorPos: number): string | null {
  const before = value.slice(0, cursorPos);
  const match = before.match(/@(\w*)$/);
  return match ? match[1] : null;
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
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>): void {
    const { value } = e.target;
    setText(value);
    const query = detectMentionQuery(value, e.target.selectionStart ?? value.length);
    setMentionQuery(query);
  }

  function handleMentionSelect(userId: string, userName: string): void {
    setMentionedIds((ids) => (ids.includes(userId) ? ids : [...ids, userId]));
    setText((prev) => prev.replace(/@\w*$/, `@${userName} `));
    setMentionQuery(null);
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

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSubmit();
    }
    if (e.key === 'Escape' && mentionQuery !== null) {
      setMentionQuery(null);
    }
  }

  return (
    <div className="relative flex flex-col gap-2">
      {mentionQuery !== null && (
        <div className="absolute bottom-full left-0 z-10 w-64">
          <CommentMentionsPicker
            query={mentionQuery}
            onSelect={handleMentionSelect}
            onClose={() => setMentionQuery(null)}
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
      />

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
