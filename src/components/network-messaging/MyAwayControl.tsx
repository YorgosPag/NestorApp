'use client';

/**
 * @fileoverview **Η ΑΠΟΥΣΙΑ ΜΟΥ** — δήλωση («από · έως»), «επέστρεψα» — **μόνο ημερομηνίες**.
 * @related ADR-867 §4.4 · Β5 (`network-away.ts`: όριο 365 ημερών, «γύρισα» = λήξη τώρα) · ADR-834 (ε) 🏆
 * @module components/network-messaging/MyAwayControl
 *
 * 🔒 **Κανένα ελεύθερο κείμενο, επίτηδες** (ΓΚΠΔ ελαχιστοποίηση): η άλλη πλευρά είναι ξένος χώρος· μαθαίνει
 * **μόνο** «ως πότε» και «ποιος διαβάζει στη θέση σας». 📅 Η λήξη είναι **το τέλος** της ημέρας που διαλέγει
 * ο άνθρωπος, στη **δική του** ώρα (Outlook): «έως 24/9» σημαίνει ότι στις 24/9 λείπει ακόμη.
 */

import React, { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { MyAway } from '@/hooks/network-messaging/useNetworkAwayAndTeam';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { localDateOf } from '@/lib/date-local';
import { formatDate } from '@/lib/intl-formatting';

import { AWAY_KEYS, FAILURE_KEYS, NETWORK_NS } from './network-messaging-keys';

const DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/** `YYYY-MM-DD` (τοπικά) ⇒ ISO της αρχής ή του τέλους εκείνης της ημέρας, στη ζώνη του ανθρώπου. */
function dayBoundaryISO(dayKey: string, edge: 'start' | 'end'): string | null {
  const [year, month, day] = dayKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  const local = edge === 'start' ? new Date(year, month - 1, day, 0, 0, 0) : new Date(year, month - 1, day, 23, 59, 59);
  return Number.isNaN(local.getTime()) ? null : local.toISOString();
}

function AwayForm({ control, onDone }: { readonly control: MyAway; readonly onDone: () => void }): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  const fromId = useId();
  const toId = useId();
  const today = localDateOf(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [invalid, setInvalid] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const endsAt = dayBoundaryISO(to, 'end');
    const startsAt = from === today ? undefined : dayBoundaryISO(from, 'start') ?? undefined;
    if (endsAt === null || to < from) return setInvalid(true);
    setInvalid(false);
    if (await control.set(endsAt, startsAt)) onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor={fromId} className="flex flex-col gap-1 text-sm">{t(AWAY_KEYS.mineFrom)}
        <Input id={fromId} type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} required />
      </label>
      <label htmlFor={toId} className="flex flex-col gap-1 text-sm">{t(AWAY_KEYS.mineTo)}
        <Input id={toId} type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} required />
      </label>
      {(invalid || control.failure === 'invalid-request') && <p className="m-0 text-sm text-destructive">{t(AWAY_KEYS.mineInvalid)}</p>}
      {control.failure !== null && control.failure !== 'invalid-request' && (
        <p className="m-0 text-sm text-destructive">{t(FAILURE_KEYS[control.failure])}</p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={control.saving}>{t(AWAY_KEYS.mineSave)}</Button>
      </DialogFooter>
    </form>
  );
}

function AwayState({ control }: { readonly control: MyAway }): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  if (control.away.state !== 'ready' || control.away.value === null) return <p className="m-0 text-sm text-muted-foreground">{t(AWAY_KEYS.mineNone)}</p>;
  const { startsAt, endsAt } = control.away.value;
  const started = Date.parse(startsAt) <= Date.now();
  return (
    <p className="m-0 text-sm text-foreground">
      {started
        ? t(AWAY_KEYS.mineActive, { date: formatDate(endsAt, DAY) })
        : t(AWAY_KEYS.mineScheduled, { from: formatDate(startsAt, DAY), to: formatDate(endsAt, DAY) })}
    </p>
  );
}

/** Η απουσία μου — δήλωση ή «επέστρεψα». */
export function MyAwayControl({ control }: { readonly control: MyAway }): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  const [open, setOpen] = useState(false);
  const declared = control.away.state === 'ready' && control.away.value !== null;
  return (
    <section className="flex flex-col gap-2" aria-label={t(AWAY_KEYS.mineTitle)}>
      <h4 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(AWAY_KEYS.mineTitle)}</h4>
      <AwayState control={control} />
      <footer className="flex flex-wrap gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" size="sm" variant="outline">{t(AWAY_KEYS.mineSet)}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t(AWAY_KEYS.mineTitle)}</DialogTitle>
              <DialogDescription>{t(AWAY_KEYS.mineHint)}</DialogDescription>
            </DialogHeader>
            <AwayForm control={control} onDone={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
        {declared && (
          <Button type="button" size="sm" variant="ghost" disabled={control.saving} onClick={() => void control.end()}>
            {t(AWAY_KEYS.mineEnd)}
          </Button>
        )}
      </footer>
    </section>
  );
}
