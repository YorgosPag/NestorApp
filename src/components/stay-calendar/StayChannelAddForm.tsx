'use client';

/**
 * **ΠΡΟΣΘΗΚΗ ΠΗΓΗΣ** — ετικέτα + σύνδεσμος `.ics`.
 *
 * 🔴 **Ο διακομιστής ΔΙΑΒΑΖΕΙ τον σύνδεσμο πριν τον αποθηκεύσει**, οπότε η φόρμα δεν
 * υπόσχεται επιτυχία: περιμένει. Ένα τυπογραφικό λάθος δεν γίνεται ποτέ «πηγή που δεν
 * απαντά», που θα έβγαζε το κατάλυμα από την αγορά (`unsynced`).
 *
 * @related ADR-835 §22 (Στάδιο Γ) · lib/stay/stay-channel-command.ts
 */

import React from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  STAY_CHANNEL_LABEL_MAX_LENGTH,
  STAY_CHANNEL_URL_MAX_LENGTH,
  type StayChannelCommand,
} from '@/lib/stay/stay-channel-command';

const FIELD = 'rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground';

interface StayChannelAddFormProps {
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly onSend: (command: StayChannelCommand) => void;
}

export function StayChannelAddForm({ busy, disabled, onSend }: StayChannelAddFormProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const [label, setLabel] = React.useState('');
  const [url, setUrl] = React.useState('');
  const ready = label.trim() !== '' && url.trim() !== '' && !busy && !disabled;

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!ready) return;
    onSend({ action: 'add-feed', label: label.trim(), url: url.trim() });
    setLabel('');
    setUrl('');
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">
        {t('property-market:offer.stayChannels.add.title')}
      </h3>
      <p className="text-xs text-muted-foreground">{t('property-market:offer.stayChannels.add.hint')}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
          {t('property-market:offer.stayChannels.add.labelField')}
          <input
            type="text" value={label} onChange={(event) => setLabel(event.target.value)}
            maxLength={STAY_CHANNEL_LABEL_MAX_LENGTH} className={FIELD} disabled={disabled}
          />
        </label>
        <label className="flex flex-[2] flex-col gap-1 text-xs text-muted-foreground">
          {t('property-market:offer.stayChannels.add.urlField')}
          <input
            type="url" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)}
            maxLength={STAY_CHANNEL_URL_MAX_LENGTH} className={FIELD} disabled={disabled}
          />
        </label>
      </div>
      <button
        type="submit" disabled={!ready}
        className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50"
      >
        <Plus aria-hidden className="size-4" />
        {busy
          ? t('property-market:offer.stayChannels.add.checking')
          : t('property-market:offer.stayChannels.add.submit')}
      </button>
    </form>
  );
}
