'use client';

/**
 * @fileoverview **ΤΟ ΝΗΜΑ ΜΙΑΣ ΠΡΑΞΗΣ, ΜΕΣΑ ΣΤΗ ΣΕΛΙΔΑ ΤΗΣ** — ιδιοκτήτης (η αγγελία του) · γραφείο (η εντολή).
 * @related ADR-867 Β7 · ADR-834 §5 Β (γ) ③ · (ε) 🏆 · `useThreadPanelModel.ts`
 * @module components/network-messaging/NetworkThreadPanel
 *
 * 🌐 **ΕΝΟΤΗΤΑ ΣΤΗ ΣΕΛΙΔΑ, ΟΧΙ ΞΕΧΩΡΙΣΤΗ ΟΘΟΝΗ** (έρευνα 2026-09-19): Follow Up Boss — «Messages» στο προφίλ
 * του lead, απάντηση επί τόπου · Procore — απαντήσεις και λίστα διανομής στη σελίδα του αντικειμένου. Ο
 * άνθρωπος συζητά **για** την εντολή δίπλα **στην** εντολή.
 * 🏷️ **«Γράφετε σε άλλον οργανισμό»** (Slack Connect: banner · Teams: «External») — και 🏆 δίπλα η **ζωντανή**
 * λίστα «ποιοι διαβάζουν, από πότε», που κανείς τους δεν δίνει.
 * ⚠️ Το `id` της ενότητας **είναι** η άγκυρα της ειδοποίησης (`thread-anchor.ts`) — ένας ορισμός.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { buildAudienceRoster } from '@/lib/network-messaging/audience-roster';
import { awayNotices } from '@/lib/network-messaging/away-strip';
import { networkThreadAnchor } from '@/lib/network-messaging/thread-anchor';

import { ActTeamManager } from './ActTeamManager';
import { AudienceRosterPanel } from './AudienceRosterPanel';
import { MyAwayControl } from './MyAwayControl';
import { NetworkComposer } from './NetworkComposer';
import { FAILURE_KEYS, MESSAGE_KEYS, NETWORK_NS, THREAD_KEYS } from './network-messaging-keys';
import { NetworkMessageList } from './NetworkMessageList';
import { AwayStrip, SeatControls } from './ThreadStatusStrips';
import { useThreadPanelModel, type PanelNotice, type ThreadPanelModel } from './useThreadPanelModel';

export interface NetworkThreadPanelProps {
  readonly threadId: string;
  /** Μόνο στο γραφείο: η ομάδα της πράξης (διαχείριση). Ο ιδιοκτήτης **δεν** διαχειρίζεται ομάδα. */
  readonly teamId: string | null;
  readonly variant: 'owner' | 'office';
}

function NoticeLine({ notice }: { readonly notice: PanelNotice | null }): React.ReactElement | null {
  const { t } = useTranslation([NETWORK_NS]);
  if (notice === null) return null;
  if (notice.kind === 'failed') return <p role="alert" className="m-0 text-sm text-destructive">{t(FAILURE_KEYS[notice.failure])}</p>;
  const key = notice.kind === 'edited-after-read'
    ? MESSAGE_KEYS.editDoneAfterRead
    : notice.readBefore ? MESSAGE_KEYS.retractDoneRead : MESSAGE_KEYS.retractDoneUnread;
  return <p role="status" className="m-0 text-sm text-muted-foreground">{t(key)}</p>;
}

function PanelTitle({ model, variant, id }: { readonly model: ThreadPanelModel; readonly variant: NetworkThreadPanelProps['variant']; readonly id: string }): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  const hostName = model.roster.people?.hostName ?? null;
  const title = variant === 'office'
    ? t(THREAD_KEYS.withOwner)
    : hostName !== null ? t(THREAD_KEYS.withAgency, { name: hostName }) : t(THREAD_KEYS.withAgencyUnnamed);
  const personal = model.view.thread.state === 'ready' && model.view.thread.value.topic.kind === 'relationship';
  return (
    <header className="flex flex-col gap-1">
      <h2 id={id} className="m-0 text-lg font-semibold text-foreground">{title}</h2>
      <p className="m-0 text-sm text-muted-foreground">{t(personal ? THREAD_KEYS.personalNotice : THREAD_KEYS.externalNotice)}</p>
    </header>
  );
}

function ConversationColumn({ model, viewerUid }: { readonly model: ThreadPanelModel; readonly viewerUid: string }): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  const { view, actions, labeler } = model;
  const closed = view.thread.state === 'ready' && view.thread.value.state === 'closed';
  const notices = view.audience !== null && model.roster.presence !== null ? awayNotices(model.roster.presence, view.audience, viewerUid) : [];
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label={t(THREAD_KEYS.messagesLabel)}>
      <NetworkMessageList
        messages={view.messages}
        pending={actions.pending}
        viewerUid={viewerUid}
        anchorReadAt={view.anchorReadAt ?? null}
        readOnly={closed}
        hasEarlier={view.hasEarlier}
        loading={view.messagesLoading}
        nameOf={labeler.nameOf}
        onLoadEarlier={view.loadEarlier}
        onRetract={(messageId) => void model.retract(messageId)}
        onEdit={model.edit}
        onRetry={actions.retry}
        onDiscard={actions.discard}
      />
      <NoticeLine notice={model.notice} />
      <AwayStrip notices={notices} labeler={labeler} viewerUid={viewerUid} />
      {closed ? <p className="m-0 text-sm text-muted-foreground">{t(THREAD_KEYS.closed)}</p> : <NetworkComposer disabled={false} onSend={actions.send} />}
    </section>
  );
}

function SideColumn({ model, viewerUid, variant }: { readonly model: ThreadPanelModel; readonly viewerUid: string; readonly variant: NetworkThreadPanelProps['variant'] }): React.ReactElement | null {
  const { view } = model;
  if (view.audience === null || view.thread.state !== 'ready') return null;
  const roster = buildAudienceRoster(view.audience, viewerUid, view.thread.value.topic.kind);
  return (
    <aside className="flex flex-col gap-4 rounded-md border border-border bg-card p-3">
      <AudienceRosterPanel roster={roster} labeler={model.labeler} />
      <SeatControls mute={model.mute} follow={model.follow} canFollow={model.me?.role === 'collaborator'} />
      <MyAwayControl control={model.away} />
      {variant === 'office' && <ActTeamManager control={model.team} viewerUid={viewerUid} />}
    </aside>
  );
}

/**
 * Νήμα που δεν φαίνεται. ⚠️ Στο γραφείο το ίδιο «δεν υπάρχει» σημαίνει **και** «δεν είστε στην ομάδα» (ίδια
 * απάντηση επίτηδες, ADR-742) — γι' αυτό δικό του, ειλικρινές κείμενο, και η ομάδα **μένει** διαχειρίσιμη:
 * υπάρχει και χωρίς νήμα (Β5).
 */
function StateNotice({ model, variant }: { readonly model: ThreadPanelModel; readonly variant: NetworkThreadPanelProps['variant'] }): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  const state = model.view.thread.state;
  if (state === 'absent') {
    return (
      <>
        <p className="m-0 flex flex-col gap-1 text-sm text-muted-foreground">
          {t(THREAD_KEYS.absent)}
          <span className="text-xs">{t(variant === 'office' ? THREAD_KEYS.absentOfficeHint : THREAD_KEYS.absentHint)}</span>
        </p>
        {variant === 'office' && model.viewerUid !== null && <ActTeamManager control={model.team} viewerUid={model.viewerUid} />}
      </>
    );
  }
  return <p className="m-0 text-sm text-muted-foreground">{t(state === 'error' ? THREAD_KEYS.failed : THREAD_KEYS.loading)}</p>;
}

/** **Το νήμα της πράξης** — ζωντανό, με «ποιοι διαβάζουν» πάντα ορατό. */
export function NetworkThreadPanel({ threadId, teamId, variant }: NetworkThreadPanelProps): React.ReactElement | null {
  const { isNamespaceReady } = useTranslation([NETWORK_NS]);
  const model = useThreadPanelModel(threadId, variant === 'office' ? teamId : null);
  const titleId = `${networkThreadAnchor(threadId)}-title`;
  // ⚠️ Το namespace φορτώνεται **όταν ανοίξει** το πάνελ (όριο `next/dynamic`, CHECK 3.34) ⇒ τίποτα ως τότε,
  //    ποτέ ωμό κλειδί για ένα καρέ. Χωρίς χρήστη (SSR) ⇒ τίποτα: η συνομιλία είναι μόνο για συνδεδεμένους.
  if (model.viewerUid === null || !isNamespaceReady) return null;
  const ready = model.view.thread.state === 'ready';
  return (
    <section id={networkThreadAnchor(threadId)} ref={model.sectionRef} aria-labelledby={titleId} className="flex w-full flex-col gap-3 scroll-mt-4">
      <PanelTitle model={model} variant={variant} id={titleId} />
      {ready ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <ConversationColumn model={model} viewerUid={model.viewerUid} />
          <SideColumn model={model} viewerUid={model.viewerUid} variant={variant} />
        </div>
      ) : (
        <StateNotice model={model} variant={variant} />
      )}
    </section>
  );
}
