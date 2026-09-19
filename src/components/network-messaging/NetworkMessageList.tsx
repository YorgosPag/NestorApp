'use client';

/**
 * @fileoverview **ΤΟ ΧΡΟΝΟΛΟΓΙΟ** — ημέρες · «νέα μηνύματα» · μηνύματα · εκκρεμείς αποστολές · «παλαιότερα».
 * @related ADR-867 Β7 · `lib/network-messaging/thread-timeline.ts` (όλες οι αποφάσεις) · Teams/Slack
 * @module components/network-messaging/NetworkMessageList
 *
 * 🔑 **Η οθόνη δεν αποφασίζει** πού μπαίνει η γραμμή «νέα», ποιο μήνυμα συνεχίζει ή τι επιτρέπεται — τα
 * παίρνει από τον καθαρό πυρήνα. Εδώ ζει **μόνο** η απόδοση και η κύλιση.
 * 📜 **Κύλιση**: στο άνοιγμα ⇒ στη γραμμή «νέα» (αλλιώς στο τέλος)· νέο μήνυμα ⇒ ακολουθεί **μόνο** αν ο
 * άνθρωπος ήταν ήδη κάτω (Slack): όποιος διαβάζει παλιά μηνύματα δεν πετιέται στο τέλος.
 */

import React, { useEffect, useLayoutEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { EmptyThreadNotice, LoadEarlierNav, MessageBubble, MessageMeta } from '@/components/shared/messaging/MessageBubble';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay, formatDate } from '@/lib/intl-formatting';
import { localDateOf, nowISO } from '@/lib/date-local';
import { buildTimeline, type TimelineItem } from '@/lib/network-messaging/thread-timeline';
import type { PendingMessage } from '@/hooks/network-messaging/useNetworkThreadActions';
import type { NetworkMessage } from '@/types/network-thread';

import { FAILURE_KEYS, MESSAGE_KEYS, NETWORK_NS, THREAD_KEYS } from './network-messaging-keys';
import { NetworkMessageItem } from './NetworkMessageItem';

const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
const NEAR_BOTTOM_PX = 120;
const dayKeyOf = (iso: string) => localDateOf(new Date(iso));

export interface NetworkMessageListProps {
  readonly messages: readonly NetworkMessage[];
  readonly pending: readonly PendingMessage[];
  readonly viewerUid: string;
  readonly anchorReadAt: string | null;
  readonly readOnly: boolean;
  readonly hasEarlier: boolean;
  readonly loading: boolean;
  readonly nameOf: (uid: string) => string;
  readonly onLoadEarlier: () => void;
  readonly onRetract: (messageId: string) => void;
  readonly onEdit: (messageId: string, text: string) => Promise<boolean>;
  readonly onRetry: (entry: PendingMessage) => void;
  readonly onDiscard: (clientKey: string) => void;
}

function DayLabel({ dayKey }: { readonly dayKey: string }): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  const today = localDateOf(new Date());
  const yesterday = localDateOf(new Date(Date.now() - 86_400_000));
  const label = dayKey === today ? t(THREAD_KEYS.today) : dayKey === yesterday ? t(THREAD_KEYS.yesterday) : formatCalendarDay(dayKey, dayKey.slice(0, 4) !== today.slice(0, 4));
  return (
    <li role="separator" className="my-2 text-center text-xs font-medium text-muted-foreground">
      {label}
    </li>
  );
}

function NewMessagesDivider({ dividerRef }: { readonly dividerRef: React.RefObject<HTMLLIElement | null> }): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  return (
    <li ref={dividerRef} role="separator" className="my-2 flex items-center gap-2 text-xs font-semibold text-destructive">
      <span className="h-px flex-1 bg-destructive" aria-hidden="true" />
      {t(THREAD_KEYS.newMessages)}
      <span className="h-px flex-1 bg-destructive" aria-hidden="true" />
    </li>
  );
}

function PendingItem({ entry, onRetry, onDiscard }: {
  readonly entry: PendingMessage;
  readonly onRetry: (entry: PendingMessage) => void;
  readonly onDiscard: (clientKey: string) => void;
}): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  const failed = entry.status === 'failed';
  // «Στάλθηκε» ⇒ καμία ετικέτα: η φούσκα μένει ώσπου να την αντικαταστήσει το ΙΔΙΟ id από το snapshot.
  const state = failed ? t(MESSAGE_KEYS.failed) : entry.status === 'sending' ? t(MESSAGE_KEYS.sending) : null;
  return (
    <li className="flex justify-end">
      <MessageBubble outbound className={failed ? 'border-destructive' : entry.status === 'sending' ? 'opacity-70' : ''}>
        <MessageMeta name={t(MESSAGE_KEYS.you)} at={entry.createdAt} timeLabel={formatDate(entry.createdAt, TIME)} trailing={state === null ? null : <span className="text-xs">{state}</span>} />
        <p className="m-0 whitespace-pre-wrap break-words text-sm text-foreground">{entry.text}</p>
        {failed && (
          <footer className="mt-2 flex flex-wrap items-center justify-end gap-2">
            {entry.failure !== null && <span className="text-xs text-destructive">{t(FAILURE_KEYS[entry.failure])}</span>}
            <Button type="button" size="sm" variant="ghost" onClick={() => onDiscard(entry.clientKey)}>{t(MESSAGE_KEYS.discard)}</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => onRetry(entry)}>{t(MESSAGE_KEYS.retry)}</Button>
          </footer>
        )}
      </MessageBubble>
    </li>
  );
}

/** Κύλιση: στο άνοιγμα στη γραμμή «νέα»· μετά, ακολουθεί το τέλος **μόνο** αν ήσουν ήδη κάτω. */
function useThreadScroll(scrollRef: React.RefObject<HTMLDivElement | null>, dividerRef: React.RefObject<HTMLLIElement | null>, count: number) {
  const opened = useRef(false);
  const nearBottom = useRef(true);

  useEffect(() => {
    const node = scrollRef.current;
    if (node === null) return undefined;
    const onScroll = () => {
      nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < NEAR_BOTTOM_PX;
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, [scrollRef]);

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (node === null || count === 0) return;
    if (!opened.current) {
      opened.current = true;
      const divider = dividerRef.current;
      node.scrollTop = divider === null ? node.scrollHeight : Math.max(divider.offsetTop - node.offsetTop - 16, 0);
      return;
    }
    if (nearBottom.current) node.scrollTop = node.scrollHeight;
  }, [count, scrollRef, dividerRef]);
}

function renderItem(item: TimelineItem, index: number, props: NetworkMessageListProps, dividerRef: React.RefObject<HTMLLIElement | null>): React.ReactNode {
  if (item.kind === 'day') return <DayLabel key={`day-${item.dayKey}-${index}`} dayKey={item.dayKey} />;
  if (item.kind === 'new-messages') return <NewMessagesDivider key="new-messages" dividerRef={dividerRef} />;
  return (
    <NetworkMessageItem
      key={item.message.id}
      message={item.message}
      own={item.own}
      continuation={item.continuation}
      affordances={item.affordances}
      senderName={props.nameOf(item.message.senderUid)}
      readOnly={props.readOnly}
      onRetract={props.onRetract}
      onEdit={props.onEdit}
    />
  );
}

/** Το χρονολόγιο του νήματος. */
export function NetworkMessageList(props: NetworkMessageListProps): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLLIElement>(null);
  const items = buildTimeline({ messages: props.messages, viewerUid: props.viewerUid, anchorReadAt: props.anchorReadAt, nowISO: nowISO(), dayKeyOf });
  useThreadScroll(scrollRef, dividerRef, props.messages.length + props.pending.length);

  const empty = props.messages.length === 0 && props.pending.length === 0 && !props.loading;
  return (
    <div ref={scrollRef} className="max-h-[32rem] min-h-[12rem] overflow-y-auto rounded-md border border-border bg-card p-3">
      {props.hasEarlier && (
        <LoadEarlierNav label={t(THREAD_KEYS.loadEarlier)} navLabel={t(THREAD_KEYS.paginationLabel)} onLoadMore={props.onLoadEarlier} disabled={props.loading} />
      )}
      {empty ? (
        <EmptyThreadNotice message={t(THREAD_KEYS.empty)} label={t(THREAD_KEYS.emptyLabel)} />
      ) : (
        <ol className="m-0 flex list-none flex-col gap-2 p-0" role="log" aria-live="polite" aria-label={t(THREAD_KEYS.messagesLabel)}>
          {items.map((item, index) => renderItem(item, index, props, dividerRef))}
          {props.pending.map((entry) => (
            <PendingItem key={entry.clientKey} entry={entry} onRetry={props.onRetry} onDiscard={props.onDiscard} />
          ))}
        </ol>
      )}
    </div>
  );
}
