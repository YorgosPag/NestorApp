'use client';

/**
 * @fileoverview **ΛΩΡΙΔΑ ΑΠΟΥΣΙΑΣ · ΣΙΓΑΣΗ · ΑΚΟΛΟΥΘΩ** — ό,τι λέει στον άνθρωπο «τι θα γίνει αν γράψω».
 * @related ADR-834 §5 Β (ε) 🏆 · ADR-867 §4.4 · §8 #10 · `lib/network-messaging/away-strip.ts`
 * @module components/network-messaging/ThreadStatusStrips
 *
 * 🏆 **Πριν πατήσει «στείλε»**: «ο Κώστας απουσιάζει ως 24/9 — διαβάζει η Ελένη» (Outlook: αυτόματη
 * απάντηση **μετά** · Intercom: μόνο ανάθεση · HubSpot: τίποτα). Κανείς δεν καλύπτει ⇒ **το λέμε**.
 * 🔔 **Ακολουθώ** φαίνεται **μόνο** σε συνεργάτη: το κύριο πρόσωπο ειδοποιείται πάντα (Β6), και ένας
 * διακόπτης που δεν αλλάζει τίποτα θα ήταν ψέμα.
 */

import React, { useId } from 'react';

import { Switch } from '@/components/ui/switch';
import type { SeatToggle } from '@/hooks/network-messaging/useThreadRoster';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate, formatList } from '@/lib/intl-formatting';
import type { AwayNotice } from '@/lib/network-messaging/away-strip';

import { AWAY_KEYS, FAILURE_KEYS, NETWORK_NS, SEAT_KEYS } from './network-messaging-keys';
import type { PersonLabeler } from './thread-labels';

const DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };

/** Μία ειδοποίηση ανά πλευρά με απόντα — `role="status"`: ανακοινώνεται χωρίς να διακόπτει. */
export function AwayStrip({ notices, labeler, viewerUid }: {
  readonly notices: readonly AwayNotice[];
  readonly labeler: PersonLabeler;
  readonly viewerUid: string;
}): React.ReactElement | null {
  const { t } = useTranslation([NETWORK_NS]);
  if (notices.length === 0) return null;
  const nameOf = (uid: string) => (uid === viewerUid ? t(AWAY_KEYS.you) : labeler.nameOf(uid));
  return (
    <ul role="status" className="m-0 flex list-none flex-col gap-1 rounded-md border border-border bg-muted p-2 text-sm text-foreground">
      {notices.map((notice) => (
        <li key={notice.relation}>
          {notice.absent.map((member) => (
            <span key={member.uid} className="block">
              {t(AWAY_KEYS.absent, { name: labeler.nameOf(member.uid), date: formatDate(member.until, DAY) })}
            </span>
          ))}
          <span className="block text-muted-foreground">
            {notice.covering.length > 0 ? t(AWAY_KEYS.covering, { names: formatList(notice.covering.map(nameOf)) }) : t(AWAY_KEYS.nobody)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SeatSwitch({ label, hint, toggle }: { readonly label: string; readonly hint: string; readonly toggle: SeatToggle }): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  const id = useId();
  return (
    <li className="flex items-start gap-2">
      <Switch id={id} checked={toggle.value} onCheckedChange={toggle.set} disabled={toggle.saving} aria-describedby={`${id}-hint`} />
      <label htmlFor={id} className="flex flex-col gap-0.5 text-sm text-foreground">
        {label}
        <span id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</span>
        {toggle.failure !== null && <span className="text-xs text-destructive">{t(FAILURE_KEYS[toggle.failure])}</span>}
      </label>
    </li>
  );
}

/** Σίγαση (όλοι) · ακολουθώ (μόνο συνεργάτης). */
export function SeatControls({ mute, follow, canFollow }: {
  readonly mute: SeatToggle;
  readonly follow: SeatToggle;
  readonly canFollow: boolean;
}): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      <SeatSwitch label={t(SEAT_KEYS.mute)} hint={t(SEAT_KEYS.muteHint)} toggle={mute} />
      {canFollow && <SeatSwitch label={t(SEAT_KEYS.follow)} hint={t(SEAT_KEYS.followHint)} toggle={follow} />}
    </ul>
  );
}
