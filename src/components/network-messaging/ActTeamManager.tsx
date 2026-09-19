'use client';

/**
 * @fileoverview **Η ΟΜΑΔΑ ΤΗΣ ΕΝΤΟΛΗΣ** (μόνο γραφείο) — υπεύθυνος · συνεργάτες · αλλαγή με έλεγχο έκδοσης.
 * @related ADR-834 §5 Β (ε) ①② · ADR-867 §4.3 · Β5 (`act-team-change.ts`: ευθύνη = γραφείο, συνεργασία = ομάδα)
 * @module components/network-messaging/ActTeamManager
 *
 * 🔑 **Δύο ερωτήματα, δύο κριτές** (Β5 — Follow Up Boss · Salesforce · HubSpot): «νέος υπεύθυνος» μόνο σε
 * όποιον έχει `network:act_teams:manage` (`canManage`)· συνεργάτες προσθέτει/αφαιρεί και **μέλος της ομάδας**.
 * Η οθόνη **κρύβει** ό,τι δεν επιτρέπεται· ο διακομιστής **ξανακρίνει** πάντα.
 * 👁️ **Ο διαχειριστής που προσθέτει τον εαυτό του ΦΑΙΝΕΤΑΙ** στην άλλη πλευρά (`admin-self`) — το λέμε
 * **πριν** το κάνει. ⚔️ Σύγκρουση (`stale-version`) ⇒ ξαναφόρτωση + «άλλαξε στο μεταξύ», ποτέ σιωπηλά.
 */

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ActTeamControl } from '@/hooks/network-messaging/useNetworkAwayAndTeam';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { NetworkPerson } from '@/types/network-wire';

import { FAILURE_KEYS, FALLBACK_NAME_KEYS, NETWORK_NS, TEAM_KEYS } from './network-messaging-keys';

function personName(candidates: readonly NetworkPerson[], uid: string, fallback: string): string {
  return candidates.find((person) => person.uid === uid)?.name ?? fallback;
}

function PersonPicker({ label, people, onPick, disabled }: {
  readonly label: string;
  readonly people: readonly NetworkPerson[];
  readonly onPick: (uid: string) => void;
  readonly disabled: boolean;
}): React.ReactElement | null {
  const { t } = useTranslation([NETWORK_NS]);
  const [value, setValue] = useState<string | undefined>(undefined);
  if (people.length === 0) return null;
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(uid) => {
          setValue(undefined);
          onPick(uid);
        }}
      >
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t(TEAM_KEYS.choose)} /></SelectTrigger>
        <SelectContent>
          {people.map((person) => (
            <SelectItem key={person.uid} value={person.uid}>{person.name ?? t(FALLBACK_NAME_KEYS.collaborator)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function OutcomeLine({ control }: { readonly control: ActTeamControl }): React.ReactElement | null {
  const { t } = useTranslation([NETWORK_NS]);
  const outcome = control.outcome;
  if (outcome === null) return null;
  if (outcome.kind === 'failed') return <p role="alert" className="m-0 text-xs text-destructive">{t(FAILURE_KEYS[outcome.failure])}</p>;
  const key = outcome.kind === 'applied' ? TEAM_KEYS.applied : outcome.kind === 'unchanged' ? TEAM_KEYS.unchanged : TEAM_KEYS.conflict;
  return <p role="status" className={`m-0 text-xs ${outcome.kind === 'conflict' ? 'text-destructive' : 'text-muted-foreground'}`}>{t(key)}</p>;
}

/** Η ομάδα — ορατή σε κάθε μέλος του γραφείου που βλέπει την εντολή· αλλαγές όπου επιτρέπεται. */
export function ActTeamManager({ control, viewerUid }: { readonly control: ActTeamControl; readonly viewerUid: string }): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  if (control.team.state === 'loading') return <p className="m-0 text-xs text-muted-foreground">{t(TEAM_KEYS.loading)}</p>;
  if (control.team.state === 'failed') return <p className="m-0 text-xs text-destructive">{t(FAILURE_KEYS[control.team.failure])}</p>;

  const { team, canManage, candidates } = control.team.value;
  const collaborators = team.memberUids.filter((uid) => uid !== team.responsibleUid);
  const canEditMembers = canManage || team.memberUids.includes(viewerUid);
  const outside = candidates.filter((person) => !team.memberUids.includes(person.uid));
  const fallback = t(FALLBACK_NAME_KEYS.collaborator);

  return (
    <section className="flex flex-col gap-2" aria-label={t(TEAM_KEYS.title)}>
      <h4 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(TEAM_KEYS.title)}</h4>
      <p className="m-0 text-xs text-muted-foreground">{t(TEAM_KEYS.visibleNotice)}</p>
      <p className="m-0 text-sm text-foreground">
        <span className="text-muted-foreground">{t(TEAM_KEYS.responsible)}: </span>{personName(candidates, team.responsibleUid, fallback)}
      </p>
      {canManage && (
        <PersonPicker label={t(TEAM_KEYS.assign)} people={candidates.filter((p) => p.uid !== team.responsibleUid)} disabled={control.busy} onPick={(uid) => control.change('assign-responsible', uid)} />
      )}
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {collaborators.length === 0 && <li className="text-xs text-muted-foreground">{t(TEAM_KEYS.none)}</li>}
        {collaborators.map((uid) => (
          <li key={uid} className="flex items-center justify-between gap-2 text-sm">
            {personName(candidates, uid, fallback)}
            {canEditMembers && (
              <Button type="button" size="sm" variant="ghost" disabled={control.busy} onClick={() => control.change('remove-collaborator', uid)}>{t(TEAM_KEYS.remove)}</Button>
            )}
          </li>
        ))}
      </ul>
      {canEditMembers && <PersonPicker label={t(TEAM_KEYS.add)} people={outside} disabled={control.busy} onPick={(uid) => control.change('add-collaborator', uid)} />}
      {canManage && outside.some((p) => p.uid === viewerUid) && <p className="m-0 text-xs text-muted-foreground">{t(TEAM_KEYS.addSelfNotice)}</p>}
      <OutcomeLine control={control} />
    </section>
  );
}
