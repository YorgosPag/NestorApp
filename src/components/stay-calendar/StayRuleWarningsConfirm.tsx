'use client';

/**
 * **«Η κράτηση παρακάμπτει κανόνες σας»** — ονομασμένες παραβιάσεις + ρητή επιβεβαίωση.
 *
 * 🏆 Guesty/Hostaway αφήνουν τη χειροκίνητη κράτηση να αγνοεί τους κανόνες **σιωπηλά**. Εδώ ο
 * οικοδεσπότης βλέπει **ποιους** κανόνες παρακάμπτει και επιβεβαιώνει· η αποδοχή μένει στο
 * ίχνος (ADR-835 §21). Η επικάλυψη δεν περνά ποτέ από εδώ — είναι σκληρή άρνηση.
 *
 * @related lib/stay/stay-rule-warnings.ts · services/stay-calendar/stay-calendar-rules-write.ts
 */

import React from 'react';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import type { StayRuleWarningKind } from '@/lib/stay/stay-rule-warnings';
import { cn } from '@/lib/utils';

/** Κλειδιά ως ΚΥΡΙΟΛΕΚΤΙΚΑ — η γεννήτρια των route slices τα διαβάζει από εδώ (ADR-744). */
const WARNING_LABEL: Readonly<Record<StayRuleWarningKind, string>> = {
  'arrival-not-allowed': 'property-market:offer.stayCalendar.warnings.arrival-not-allowed',
  'departure-not-allowed': 'property-market:offer.stayCalendar.warnings.departure-not-allowed',
  'below-min-nights': 'property-market:offer.stayCalendar.warnings.below-min-nights',
  'above-max-nights': 'property-market:offer.stayCalendar.warnings.above-max-nights',
  preparation: 'property-market:offer.stayCalendar.warnings.preparation',
};

const BUTTON = 'rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50';

/** Η κράτηση που αρνήθηκε ο διακομιστής, με τις προειδοποιήσεις που ζητούν αποδοχή. */
export interface StayPendingWarnings {
  readonly command: Extract<StayCalendarCommand, { action: 'book' }>;
  readonly warnings: readonly StayRuleWarningKind[];
}

interface StayRuleWarningsConfirmProps {
  readonly pending: StayPendingWarnings;
  readonly busy: boolean;
  readonly onSend: (command: StayCalendarCommand) => void;
  readonly onDismiss: () => void;
}

export function StayRuleWarningsConfirm({ pending, busy, onSend, onDismiss }: StayRuleWarningsConfirmProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const confirm = (): void => {
    const acknowledged = [...new Set([...pending.command.acknowledgedWarnings, ...pending.warnings])];
    onSend({ ...pending.command, acknowledgedWarnings: acknowledged });
  };
  return (
    <section aria-labelledby="stay-rule-warnings-heading" className="flex flex-col gap-2 rounded-md border border-border p-3">
      <h3 id="stay-rule-warnings-heading" className="text-sm font-semibold text-foreground">
        {t('property-market:offer.stayCalendar.warnings.heading')}
      </h3>
      <ul className="list-disc pl-5 text-sm text-foreground">
        {pending.warnings.map((warning) => <li key={warning}>{t(WARNING_LABEL[warning])}</li>)}
      </ul>
      <menu className="flex flex-wrap gap-2">
        <li><button type="button" disabled={busy} onClick={confirm} className={cn(BUTTON, COLOR_BRIDGE.action.caution)}>
          {t('property-market:offer.stayCalendar.warnings.confirm')}
        </button></li>
        <li><button type="button" onClick={onDismiss} className={cn(BUTTON, COLOR_BRIDGE.action.secondary)}>
          {t('property-market:offer.stayCalendar.warnings.dismiss')}
        </button></li>
      </menu>
    </section>
  );
}
