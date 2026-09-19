'use client';

/**
 * @fileoverview **ΕΝΑ ΜΗΝΥΜΑ** — σώμα · ταφόπλακα · «επεξεργάστηκε» · ανάκληση · επεξεργασία επί τόπου.
 * @related ADR-867 Β4β (ειλικρινής ταφόπλακα) · Β7 (επεξεργασία) · `lib/network-messaging/thread-timeline.ts`
 * @module components/network-messaging/NetworkMessageItem
 *
 * 🔒 **ΑΠΛΟ ΚΕΙΜΕΝΟ, ΠΟΤΕ HTML**: το σώμα έρχεται από **άλλον οργανισμό** — `whitespace-pre-wrap`, καμία
 * απόδοση σήμανσης (το omnichannel αποδίδει HTML **καθαρισμένο** από κανάλια· εδώ δεν υπάρχει λόγος).
 * 🏆 **Η ταφόπλακα λέει αν πρόλαβε** («είχε ήδη διαβαστεί» / «πριν το δει κανείς») — και η ανάκληση
 * **διαφημίζει** το παράθυρό της πριν το πάτημα (XEP-0424 SHOULD). 🏆 «Επεξεργάστηκε **αφού διαβάστηκε**».
 */

import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { MessageBubble, MessageMeta } from '@/components/shared/messaging/MessageBubble';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate, formatDateTime } from '@/lib/intl-formatting';
import type { MessageAffordances } from '@/lib/network-messaging/thread-timeline';
import type { NetworkMessage } from '@/types/network-thread';

import { MESSAGE_KEYS, NETWORK_NS } from './network-messaging-keys';

const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

export interface NetworkMessageItemProps {
  readonly message: NetworkMessage;
  readonly own: boolean;
  readonly continuation: boolean;
  readonly affordances: MessageAffordances;
  readonly senderName: string;
  /** Κλειστό νήμα ⇒ καμία αλλαγή (ΓΚΠΔ (β)). */
  readonly readOnly: boolean;
  readonly onRetract: (messageId: string) => void;
  readonly onEdit: (messageId: string, text: string) => Promise<boolean>;
}

function TombstoneText({ message }: { readonly message: NetworkMessage }): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  const key = message.readBeforeRetraction === true
    ? MESSAGE_KEYS.retractedRead
    : message.readBeforeRetraction === false ? MESSAGE_KEYS.retractedUnread : MESSAGE_KEYS.retractedUnknown;
  return <p className="m-0 text-sm italic text-muted-foreground">{t(key)}</p>;
}

function EditedMark({ message }: { readonly message: NetworkMessage }): React.ReactElement | null {
  const { t } = useTranslation([NETWORK_NS]);
  if (message.editedAt === null) return null;
  const label = t(message.readBeforeEdit === true ? MESSAGE_KEYS.editedAfterRead : MESSAGE_KEYS.edited);
  return (
    <span className="text-xs text-muted-foreground" aria-label={t(MESSAGE_KEYS.editedAt, { at: formatDateTime(message.editedAt) })}>
      ({label})
    </span>
  );
}

function InlineEditor({
  initial,
  onSave,
  onCancel,
}: {
  readonly initial: string;
  readonly onSave: (text: string) => Promise<void>;
  readonly onCancel: () => void;
}): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Textarea aria-label={t(MESSAGE_KEYS.editLabel)} value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} autoFocus />
      <p className="m-0 text-xs text-muted-foreground">{t(MESSAGE_KEYS.editNotice)}</p>
      <footer className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>{t(MESSAGE_KEYS.cancel)}</Button>
        <Button type="submit" size="sm" disabled={saving || draft.trim() === ''}>{t(MESSAGE_KEYS.editSave)}</Button>
      </footer>
    </form>
  );
}

function MessageActions({
  affordances,
  onEdit,
  onRetract,
}: {
  readonly affordances: MessageAffordances;
  readonly onEdit: () => void;
  readonly onRetract: () => void;
}): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  const minutes = affordances.retractMinutesLeft;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="ghost" aria-label={t(MESSAGE_KEYS.actions)}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {affordances.canEdit && <DropdownMenuItem onSelect={onEdit}>{t(MESSAGE_KEYS.edit)}</DropdownMenuItem>}
        {minutes !== null && (
          <>
            <DropdownMenuItem onSelect={onRetract}>{t(MESSAGE_KEYS.retract)}</DropdownMenuItem>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {t(MESSAGE_KEYS.retractWindow, { minutes })}
            </DropdownMenuLabel>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RetractConfirm({
  open,
  onOpenChange,
  onConfirm,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
}): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(MESSAGE_KEYS.retractConfirmTitle)}</AlertDialogTitle>
          <AlertDialogDescription>{t(MESSAGE_KEYS.retractConfirmBody)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t(MESSAGE_KEYS.cancel)}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t(MESSAGE_KEYS.retractConfirm)}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Ένα μήνυμα του χρονολογίου. */
export function NetworkMessageItem(props: NetworkMessageItemProps): React.ReactElement {
  const { message, own, continuation, affordances, senderName, readOnly } = props;
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const retracted = message.retractedAt !== null;
  const actionable = !readOnly && !retracted && (affordances.canEdit || affordances.retractMinutesLeft !== null);

  const header = continuation ? null : (
    <MessageMeta name={senderName} at={message.createdAt} timeLabel={formatDate(message.createdAt, TIME)} trailing={<EditedMark message={message} />} />
  );
  const body = retracted ? (
    <TombstoneText message={message} />
  ) : editing ? (
    <InlineEditor
      initial={message.text}
      onCancel={() => setEditing(false)}
      onSave={async (text) => {
        if (await props.onEdit(message.id, text)) setEditing(false);
      }}
    />
  ) : (
    <p className="m-0 whitespace-pre-wrap break-words text-sm text-foreground">{message.text}</p>
  );

  return (
    <li className={`group flex items-start gap-1 ${own ? 'justify-end' : 'justify-start'}`}>
      {own && actionable && !editing && (
        <MessageActions affordances={affordances} onEdit={() => setEditing(true)} onRetract={() => setConfirming(true)} />
      )}
      <MessageBubble outbound={own}>
        {header}
        {body}
        {continuation && <EditedMark message={message} />}
      </MessageBubble>
      <RetractConfirm open={confirming} onOpenChange={setConfirming} onConfirm={() => props.onRetract(message.id)} />
    </li>
  );
}
