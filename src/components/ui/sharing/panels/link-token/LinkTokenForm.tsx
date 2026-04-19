/**
 * =============================================================================
 * 🏢 ENTERPRISE: LinkTokenForm — Configure Link Token Draft
 * =============================================================================
 *
 * Presentational form for the link-token share model. Owns zero state —
 * draft values + setters are pushed in via props. Submit/cancel bubble up
 * to the hosting PermissionPanel.
 *
 * @module components/ui/sharing/panels/link-token/LinkTokenForm
 * @see ADR-147 Unified Share Surface
 */

'use client';

import React, { useMemo } from 'react';
import { Clock, Download, Lock, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import {
  MAX_PERSONAL_MESSAGE_LENGTH,
  PersonalMessageField,
} from '@/components/sharing/fields/PersonalMessageField';
import type { LinkTokenDraft } from './types';

export interface LinkTokenFormProps {
  draft: LinkTokenDraft;
  onDraftChange: (next: LinkTokenDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  /**
   * When true, the submit button is disabled even if not submitting.
   * Used by hosts that want to suppress no-op revoke+recreate cycles when
   * the draft matches the currently applied policy (ADR-312 Phase 9.8).
   */
  disabled?: boolean;
}

export function LinkTokenForm({
  draft,
  onDraftChange,
  onSubmit,
  onCancel,
  submitting,
  disabled = false,
}: LinkTokenFormProps): React.ReactElement {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();

  const expirationOptions = useMemo(
    () => [
      { value: '1', label: t('share.expirationOptions.1hour') },
      { value: '24', label: t('share.expirationOptions.24hours') },
      { value: '72', label: t('share.expirationOptions.3days') },
      { value: '168', label: t('share.expirationOptions.1week') },
      { value: '720', label: t('share.expirationOptions.30days') },
    ],
    [t],
  );

  const patch = (partial: Partial<LinkTokenDraft>): void => {
    onDraftChange({ ...draft, ...partial });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <fieldset className="space-y-1.5">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Clock className={cn('h-3.5 w-3.5', colors.text.muted)} />
          {t('share.expiration')}
        </label>
        <Select
          value={draft.expiresInHours}
          onValueChange={(value) => patch({ expiresInHours: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {expirationOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </fieldset>

      <fieldset className="space-y-1.5">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Lock className={cn('h-3.5 w-3.5', colors.text.muted)} />
          {t('share.password')}
          <span className={cn('text-xs font-normal', colors.text.muted)}>
            ({t('share.optional')})
          </span>
        </label>
        <input
          type="text"
          value={draft.password}
          onChange={(e) => patch({ password: e.target.value })}
          placeholder={t('share.passwordPlaceholder')}
          className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </fieldset>

      <fieldset className="space-y-1.5">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Download className={cn('h-3.5 w-3.5', colors.text.muted)} />
          {t('share.maxDownloads')}
        </label>
        <Select
          value={draft.maxDownloads}
          onValueChange={(value) => patch({ maxDownloads: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">{t('share.unlimited')}</SelectItem>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="5">5</SelectItem>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </fieldset>

      <PersonalMessageField
        value={draft.note}
        onChange={(next) => patch({ note: next.slice(0, MAX_PERSONAL_MESSAGE_LENGTH) })}
      />

      <nav className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('share.cancel')}
        </Button>
        <Button type="submit" disabled={submitting || disabled}>
          {submitting ? (
            <Spinner size="small" color="inherit" className="mr-2" />
          ) : (
            <Share2 className="h-4 w-4 mr-2" />
          )}
          {t('share.create')}
        </Button>
      </nav>
    </form>
  );
}
