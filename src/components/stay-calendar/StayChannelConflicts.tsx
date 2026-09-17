'use client';

/**
 * **ΤΟ OVERBOOKING ΠΟΥ ΗΔΗ ΣΥΝΕΒΗ** — ονομασμένο, με ημερομηνίες και διέξοδο.
 *
 * 🏆 Η αγορά (Guesty · Vrbo) δείχνει «κόκκινη ετικέτα» που η τεκμηρίωσή της λέει ότι
 * *«μπορείς να αγνοήσεις»*. Εδώ κάθε σύγκρουση λέει **τι** συνέβη, **πότε**, και **τι
 * κάνει** ο άνθρωπος — και τα τρία είδη έχουν **άλλη** θεραπεία.
 *
 * @related ADR-835 §22 (Στάδιο Γ) · lib/stay/stay-channel-conflicts.ts
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay } from '@/lib/intl-formatting';
import type { StayChannelConflict, StayChannelConflictKind } from '@/lib/stay/stay-channel-conflicts';
import { cn } from '@/lib/utils';

/** Κλειδιά ως ΚΥΡΙΟΛΕΚΤΙΚΑ — η γεννήτρια των route slices τα διαβάζει από εδώ (ADR-744). */
const CONFLICT_TEXT: Readonly<Record<StayChannelConflictKind, string>> = {
  overbooking: 'property-market:offer.stayChannels.conflicts.overbooking',
  'owner-block': 'property-market:offer.stayChannels.conflicts.owner-block',
  'other-channel': 'property-market:offer.stayChannels.conflicts.other-channel',
};

const CONFLICT_REMEDY: Readonly<Record<StayChannelConflictKind, string>> = {
  overbooking: 'property-market:offer.stayChannels.conflicts.overbookingRemedy',
  'owner-block': 'property-market:offer.stayChannels.conflicts.owner-blockRemedy',
  'other-channel': 'property-market:offer.stayChannels.conflicts.other-channelRemedy',
};

interface StayChannelConflictsProps {
  readonly conflicts: readonly StayChannelConflict[];
}

export function StayChannelConflicts({ conflicts }: StayChannelConflictsProps): React.ReactElement | null {
  const { t } = useTranslation(['property-market']);
  if (conflicts.length === 0) return null;

  return (
    <section
      role="alert"
      className={cn('flex flex-col gap-2 rounded-lg border border-border p-3', COLOR_BRIDGE.bg.warning)}
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <AlertTriangle aria-hidden className="size-4" />
        {t('property-market:offer.stayChannels.conflicts.title', { count: conflicts.length })}
      </h3>
      <ul className="flex flex-col gap-2">
        {conflicts.map((conflict) => (
          <li key={`${conflict.blockId}:${conflict.party.entryId}`} className="flex flex-col gap-0.5 text-sm">
            <span className="text-foreground">
              {t(CONFLICT_TEXT[conflict.kind], {
                channelFrom: formatCalendarDay(conflict.from),
                channelTo: formatCalendarDay(conflict.to),
                from: formatCalendarDay(conflict.party.from),
                to: formatCalendarDay(conflict.party.to),
              })}
            </span>
            <span className="text-xs text-muted-foreground">{t(CONFLICT_REMEDY[conflict.kind])}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
