/**
 * =============================================================================
 * 🏢 ENTERPRISE: LinkTokenForm — Configure Link Token Draft
 * =============================================================================
 *
 * Presentational form for the link-token share model. Owns zero state —
 * draft values + setters are pushed in via props.
 *
 * Τρία κομμάτια (ADR-315 §5), ώστε **δημιουργία** και **αλλαγή ρυθμίσεων** να μοιράζονται
 * τα ίδια πεδία αντί για δύο φόρμες που θα απέκλιναν:
 *   - `LinkLabelField`  — η εσωτερική ετικέτα «Για ποιον;» (Α14).
 *   - `LinkTokenFields` — λήξη · κωδικός · όριο ανοιγμάτων · (μόνο στη δημιουργία) μήνυμα.
 *   - `LinkTokenForm`   — ετικέτα + πεδία + κουμπιά (αλλαγή ρυθμίσεων υπάρχοντος συνδέσμου).
 *
 * @module components/ui/sharing/panels/link-token/LinkTokenForm
 * @see ADR-147 Unified Share Surface · ADR-315 Α13/Α14
 */

'use client';

import React, { useMemo } from 'react';
import { Clock, Download, Lock, Save, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SHARE_LABEL_MAX_LENGTH } from '@/services/sharing/share-resolve-contract';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import {
  MAX_PERSONAL_MESSAGE_LENGTH,
  PersonalMessageField,
} from '@/components/sharing/fields/PersonalMessageField';
import { LINK_EXPIRY_OPTION_HOURS, LINK_EXPIRY_UNCHANGED } from './draft-mapping';
import type { LinkTokenDraft } from './types';

const MAX_ACCESS_OPTIONS = ['1', '5', '10', '25', '100'] as const;
const EXPIRY_LABEL_KEY: Record<(typeof LINK_EXPIRY_OPTION_HOURS)[number], string> = {
  '1': 'share.expirationOptions.1hour',
  '24': 'share.expirationOptions.24hours',
  '72': 'share.expirationOptions.3days',
  '168': 'share.expirationOptions.1week',
  '720': 'share.expirationOptions.30days',
};

export type LinkTokenFormMode = 'create' | 'edit';

interface DraftProps {
  draft: LinkTokenDraft;
  onDraftChange: (next: LinkTokenDraft) => void;
}

// ============================================================================
// LABEL
// ============================================================================

export function LinkLabelField({ draft, onDraftChange }: DraftProps): React.ReactElement {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  return (
    <fieldset className="space-y-1.5">
      <label htmlFor="share-link-label" className="text-sm font-medium flex items-center gap-1.5">
        <Tag className={cn('h-3.5 w-3.5', colors.text.muted)} />
        {t('share.label')}
        <span className={cn('text-xs font-normal', colors.text.muted)}>({t('share.optional')})</span>
      </label>
      <Input
        id="share-link-label"
        value={draft.label}
        maxLength={SHARE_LABEL_MAX_LENGTH}
        onChange={(e) => onDraftChange({ ...draft, label: e.target.value })}
        placeholder={t('share.labelPlaceholder')}
        autoComplete="off"
      />
      <p className={cn('text-xs', colors.text.muted)}>{t('share.labelHint')}</p>
    </fieldset>
  );
}

// ============================================================================
// POLICY FIELDS
// ============================================================================

export interface LinkTokenFieldsProps extends DraftProps {
  mode?: LinkTokenFormMode;
  /** Αλλαγή ρυθμίσεων: ο σύνδεσμος έχει ήδη κωδικό (εμφανίζει «Αφαίρεση κωδικού»). */
  hasPassword?: boolean;
}

function PasswordField({ draft, onDraftChange, mode, hasPassword }: LinkTokenFieldsProps): React.ReactElement {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const editing = mode === 'edit';
  return (
    <fieldset className="space-y-1.5">
      <label htmlFor="share-link-password" className="text-sm font-medium flex items-center gap-1.5">
        <Lock className={cn('h-3.5 w-3.5', colors.text.muted)} />
        {editing && hasPassword ? t('share.newPassword') : t('share.password')}
        <span className={cn('text-xs font-normal', colors.text.muted)}>({t('share.optional')})</span>
      </label>
      <Input
        id="share-link-password"
        type="text"
        autoComplete="off"
        value={draft.password}
        disabled={draft.removePassword}
        onChange={(e) => onDraftChange({ ...draft, password: e.target.value })}
        placeholder={editing && hasPassword ? t('share.passwordKeepHint') : t('share.passwordPlaceholder')}
      />
      {editing && hasPassword && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={draft.removePassword}
            onCheckedChange={(checked) => onDraftChange({ ...draft, removePassword: checked === true, password: '' })}
          />
          {t('share.removePassword')}
        </label>
      )}
    </fieldset>
  );
}

export function LinkTokenFields(props: LinkTokenFieldsProps): React.ReactElement {
  const { draft, onDraftChange, mode = 'create' } = props;
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const patch = (partial: Partial<LinkTokenDraft>): void => onDraftChange({ ...draft, ...partial });

  // Ένα υπάρχον όριο εκτός λίστας (π.χ. 3) πρέπει να φαίνεται — αλλιώς το Select δείχνει κενό.
  const maxOptions = useMemo(() => {
    const values: string[] = [...MAX_ACCESS_OPTIONS];
    if (draft.maxDownloads !== '0' && !values.includes(draft.maxDownloads)) values.push(draft.maxDownloads);
    return values.sort((a, b) => Number(a) - Number(b));
  }, [draft.maxDownloads]);

  return (
    <>
      <fieldset className="space-y-1.5">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Clock className={cn('h-3.5 w-3.5', colors.text.muted)} />
          {t('share.expiration')}
        </label>
        <Select value={draft.expiresInHours} onValueChange={(value) => patch({ expiresInHours: value })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {mode === 'edit' && <SelectItem value={LINK_EXPIRY_UNCHANGED}>{t('share.expiryUnchanged')}</SelectItem>}
            {LINK_EXPIRY_OPTION_HOURS.map((hours) => (
              <SelectItem key={hours} value={hours}>{t(EXPIRY_LABEL_KEY[hours])}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </fieldset>

      <PasswordField {...props} mode={mode} />

      <fieldset className="space-y-1.5">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Download className={cn('h-3.5 w-3.5', colors.text.muted)} />
          {t('share.maxDownloads')}
        </label>
        <Select value={draft.maxDownloads} onValueChange={(value) => patch({ maxDownloads: value })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">{t('share.unlimited')}</SelectItem>
            {maxOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
          </SelectContent>
        </Select>
      </fieldset>

      {mode === 'create' && (
        <PersonalMessageField
          value={draft.note}
          onChange={(next) => patch({ note: next.slice(0, MAX_PERSONAL_MESSAGE_LENGTH) })}
        />
      )}
    </>
  );
}

// ============================================================================
// FORM (αλλαγή ρυθμίσεων υπάρχοντος συνδέσμου)
// ============================================================================

export interface LinkTokenFormProps extends LinkTokenFieldsProps {
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  /** Ανενεργό κουμπί όταν το προσχέδιο δεν διαφέρει από την εφαρμοσμένη πολιτική. */
  disabled?: boolean;
}

export function LinkTokenForm({
  onSubmit,
  onCancel,
  submitting,
  disabled = false,
  ...fields
}: LinkTokenFormProps): React.ReactElement {
  const { t } = useTranslation(['files', 'files-media']);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <LinkLabelField draft={fields.draft} onDraftChange={fields.onDraftChange} />
      <LinkTokenFields {...fields} />
      <nav className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('share.cancel')}
        </Button>
        <Button type="submit" disabled={submitting || disabled}>
          {submitting ? <Spinner size="small" color="inherit" className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {t('share.save')}
        </Button>
      </nav>
    </form>
  );
}
