'use client';

/**
 * @fileoverview **ΤΟ ΠΛΑΙΣΙΟ ΓΡΑΦΗΣ** — Enter στέλνει, Shift+Enter αλλάζει γραμμή, μετρητής με το όριο του γραφέα.
 * @related ADR-867 Β7 · `types/network-thread.ts` (`MAX_NETWORK_MESSAGE_CHARS` — ο **ίδιος** αριθμός με τον γραφέα)
 * @module components/network-messaging/NetworkComposer
 *
 * 🔑 **Η αποστολή δεν περιμένει τον διακομιστή** (αισιόδοξη, `useNetworkThreadActions`): το πλαίσιο
 * αδειάζει αμέσως και το μήνυμα φαίνεται ως «αποστέλλεται». ⚠️ Κατά τη σύνθεση κειμένου με IME
 * (`isComposing`) το Enter **δεν** στέλνει — αλλιώς ο άνθρωπος που γράφει με μέθοδο εισόδου χάνει λέξεις.
 */

import React, { useId, useState } from 'react';
import { Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { MAX_NETWORK_MESSAGE_CHARS } from '@/types/network-thread';

import { COMPOSER_KEYS, NETWORK_NS } from './network-messaging-keys';

export interface NetworkComposerProps {
  readonly disabled: boolean;
  readonly onSend: (text: string) => void;
}

/** Το πρόχειρο + οι κανόνες του: μήκος με το όριο του γραφέα, Enter/Shift+Enter, IME. */
function useComposerDraft(disabled: boolean, onSend: (text: string) => void) {
  const [draft, setDraft] = useState('');
  const length = draft.trim().length;
  const tooLong = length > MAX_NETWORK_MESSAGE_CHARS;
  const canSend = !disabled && length > 0 && !tooLong;
  const submit = () => {
    if (!canSend) return;
    onSend(draft);
    setDraft('');
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };
  return { draft, setDraft, length, tooLong, canSend, submit, onKeyDown };
}

function ComposerHint({ id, length, tooLong }: { readonly id: string; readonly length: number; readonly tooLong: boolean }): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  return (
    <p id={id} className={`m-0 flex justify-between text-xs ${tooLong ? 'text-destructive' : 'text-muted-foreground'}`}>
      <span>{tooLong ? t(COMPOSER_KEYS.tooLong, { max: MAX_NETWORK_MESSAGE_CHARS }) : t(COMPOSER_KEYS.hint)}</span>
      <span aria-hidden="true">{t(COMPOSER_KEYS.counter, { count: length, max: MAX_NETWORK_MESSAGE_CHARS })}</span>
    </p>
  );
}

export function NetworkComposer({ disabled, onSend }: NetworkComposerProps): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  const { draft, setDraft, tooLong, canSend, submit, onKeyDown, length } = useComposerDraft(disabled, onSend);
  // ⚠️ Πολλά νήματα στην ίδια σελίδα (ένα ανά γραφείο) ⇒ μοναδικά id, ποτέ σταθερά.
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor={inputId} className="sr-only">{t(COMPOSER_KEYS.label)}</label>
      <div className="flex items-end gap-2">
        <Textarea
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t(COMPOSER_KEYS.placeholder)}
          disabled={disabled}
          rows={2}
          aria-invalid={tooLong}
          aria-describedby={hintId}
          className="min-h-[3rem] flex-1 resize-y"
        />
        <Button type="submit" disabled={!canSend} aria-label={t(COMPOSER_KEYS.send)}>
          <Send aria-hidden="true" />
        </Button>
      </div>
      <ComposerHint id={hintId} length={length} tooLong={tooLong} />
    </form>
  );
}
