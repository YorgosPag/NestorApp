'use client';

/**
 * @fileoverview **«ΠΟΙΟΙ ΔΙΑΒΑΖΟΥΝ»** — ζωντανή λίστα, με ρόλο, «από πότε» και όσους διάβαζαν παλαιότερα.
 * @related ADR-834 §5 Β (γ) ③ *(πάντα ορατό)* · (ε) 🏆 · `lib/network-messaging/audience-roster.ts`
 * @module components/network-messaging/AudienceRosterPanel
 *
 * 🏆 Κανείς από Front/Intercom/HubSpot/Zendesk/Teams δεν δείχνει στον **εξωτερικό** αποστολέα ποιοι
 * διαβάζουν και από πότε. Εδώ φαίνεται **πάντα**, και ο λόγος εισόδου όπου έχει σημασία για τον άλλον
 * (ο διαχειριστής που μπήκε **μόνος** του · ο κληρονόμος μιας αποχώρησης).
 */

import React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { AudienceRoster, RosterMember, RosterSide } from '@/lib/network-messaging/audience-roster';

import { ALSO_HOST_KEYS, NETWORK_NS, REASON_KEYS, ROLE_KEYS, ROSTER_KEYS } from './network-messaging-keys';
import { initialsOf, type PersonLabeler } from './thread-labels';

const DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** Οι λόγοι που ο **άλλος** δικαιούται να δει ρητά — οι υπόλοιποι είναι αυτονόητοι. */
const SPOKEN_REASONS = new Set(['admin-self', 'failover']);

function MemberRow({ member, labeler }: { readonly member: RosterMember; readonly labeler: PersonLabeler }): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  const name = labeler.nameOf(member.uid);
  const photo = labeler.photoOf(member.uid);
  // Θητεία που έληξε ⇒ **διάστημα**: ο ίδιος άνθρωπος μπορεί να έχει πολλές (Ε8), το «ως» μόνο δεν τις ξεχωρίζει.
  const when = member.until === null
    ? t(ROSTER_KEYS.since, { date: formatDate(member.since, DAY) })
    : t(ROSTER_KEYS.between, { from: formatDate(member.since, DAY), to: formatDate(member.until, DAY) });
  return (
    <li className="flex items-start gap-2">
      <Avatar className="h-7 w-7">
        {photo !== null && <AvatarImage src={photo} alt="" />}
        <AvatarFallback className="text-xs">{initialsOf(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-sm font-medium text-foreground">
          {name} {member.isViewer && <span className="font-normal text-muted-foreground">{t(ROSTER_KEYS.you)}</span>}
        </p>
        <p className="m-0 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Badge variant="outline" className="px-1 py-0 text-[0.7rem]">{t(ROLE_KEYS[member.role])}</Badge>
          {/* ADR-867 Β9 — η δεύτερη ιδιότητα ΔΗΛΩΝΕΤΑΙ και στις δύο πλευρές (NAR Άρθρο 4), ποτέ δεν κρύβεται. */}
          {member.alsoHostRole !== null && (
            <Badge variant="secondary" className="px-1 py-0 text-[0.7rem]">{t(ALSO_HOST_KEYS[member.alsoHostRole])}</Badge>
          )}
          {member.mirror && <Badge variant="secondary" className="px-1 py-0 text-[0.7rem]">{t(ROSTER_KEYS.mirror)}</Badge>}
          <span>{when}</span>
          {SPOKEN_REASONS.has(member.reason) && <span>· {t(REASON_KEYS[member.reason])}</span>}
        </p>
      </div>
    </li>
  );
}

function SideBlock({ side, labeler }: { readonly side: RosterSide; readonly labeler: PersonLabeler }): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  return (
    <section className="flex flex-col gap-2">
      <h4 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t(side.relation === 'theirs' ? ROSTER_KEYS.theirs : ROSTER_KEYS.mine)}
      </h4>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {side.current.map((member) => <MemberRow key={member.key} member={member} labeler={labeler} />)}
      </ul>
      {side.past.length + side.pastOmitted > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">{t(ROSTER_KEYS.past)}</summary>
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            {side.past.map((member) => <MemberRow key={member.key} member={member} labeler={labeler} />)}
          </ul>
          {side.pastOmitted > 0 && <p className="m-0 mt-2">{t(ROSTER_KEYS.pastOmitted, { count: side.pastOmitted })}</p>}
        </details>
      )}
    </section>
  );
}

/** Η λίστα — `aside`, γιατί συνοδεύει τη συνομιλία χωρίς να είναι η συνομιλία. */
export function AudienceRosterPanel({ roster, labeler }: { readonly roster: AudienceRoster; readonly labeler: PersonLabeler }): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  return (
    <section aria-label={t(ROSTER_KEYS.title)} className="flex flex-col gap-3">
      <h3 className="m-0 text-sm font-semibold text-foreground">{t(ROSTER_KEYS.title)}</h3>
      {roster.personal && <p className="m-0 text-xs text-muted-foreground">{t(ROSTER_KEYS.personal)}</p>}
      {roster.solo && <p className="m-0 text-xs text-muted-foreground">{t(ROSTER_KEYS.solo)}</p>}
      {roster.sides.map((side) => <SideBlock key={side.relation} side={side} labeler={labeler} />)}
    </section>
  );
}
