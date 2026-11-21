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

import React, { useId } from 'react';
import { MessageSquare } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { MAX_PERSONAL_MESSAGE_LENGTH } from '@/config/personal-message-policy';

/**
 * Shared upper bound for the personal message — lives in `@/config/personal-message-policy` so that
 * server-side zod schemas read the SAME number (a value exported from a `'use client'` module is not
 * readable on the server). Re-exported here for the existing consumers.
 */
export { MAX_PERSONAL_MESSAGE_LENGTH };

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
  // Η ετικέτα ονομάζει το πεδίο και ο μετρητής το περιγράφει (WCAG 1.3.1 · 4.1.2) — πριν ήταν ασύνδετα.
  const fieldId = useId();
  const counterId = `${fieldId}-remaining`;

  return (
    <fieldset className={cn('space-y-1.5', className)}>
      <label htmlFor={fieldId} className="text-sm font-medium flex items-center gap-1.5">
        <MessageSquare aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
        {t('personalMessage.label')}
        <span className="text-xs font-normal text-muted-foreground">
          ({t('personalMessage.optional')})
        </span>
      </label>
      <Textarea
        id={fieldId}
        aria-describedby={counterId}
        maxLength={MAX_PERSONAL_MESSAGE_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_PERSONAL_MESSAGE_LENGTH))}
        placeholder={t('personalMessage.placeholder')}
        disabled={disabled}
        rows={rows}
        className="resize-none"
      />
      <p id={counterId} className="text-xs text-muted-foreground mt-1 text-right">
        {t('personalMessage.charsRemaining', { count: remaining })}
      </p>
    </fieldset>
  );
}

export default PersonalMessageField;
