/**
 * =============================================================================
 * PERSONAL MESSAGE FIELD — SSoT (ADR-312 Phase 9.6)
 * =============================================================================
 *
 * Single source of truth for the "Προσωπικό Μήνυμα" field reused by both the
 * `LinkTokenForm` (link-creation dialog) and the `EmailShareForm` (email
 * channel dispatch). Enforces one consistent label, placeholder, character
 * limit and char-counter across every surface — zero duplicate markup.
 *
 * @module components/sharing/fields/PersonalMessageField
 * @see ADR-312 §9.6
 */

'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';

/**
 * Shared upper bound for the personal message. Mirrors the legacy
 * `EmailShareForm.MAX_MESSAGE_LENGTH` to preserve backward compatibility and
 * aligns with the server-side Zod `z.string().max(500)` on the showcase email
 * endpoint.
 */
export const MAX_PERSONAL_MESSAGE_LENGTH = 500;

export interface PersonalMessageFieldProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Textarea visible rows (default 3 — matches EmailShareForm legacy). */
  rows?: number;
  /** Optional wrapper className for caller-specific spacing. */
  className?: string;
}

export function PersonalMessageField({
  value,
  onChange,
  disabled = false,
  rows = 3,
  className,
}: PersonalMessageFieldProps): React.ReactElement {
  const { t } = useTranslation('common-shared');
  const remaining = MAX_PERSONAL_MESSAGE_LENGTH - value.length;

  return (
    <fieldset className={cn('space-y-1.5', className)}>
      <label className="text-sm font-medium flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        {t('personalMessage.label')}
        <span className="text-xs font-normal text-muted-foreground">
          ({t('personalMessage.optional')})
        </span>
      </label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_PERSONAL_MESSAGE_LENGTH))}
        placeholder={t('personalMessage.placeholder')}
        disabled={disabled}
        rows={rows}
        className="resize-none"
      />
      <p className="text-xs text-muted-foreground mt-1 text-right">
        {t('personalMessage.charsRemaining', { count: remaining })}
      </p>
    </fieldset>
  );
}

export default PersonalMessageField;
