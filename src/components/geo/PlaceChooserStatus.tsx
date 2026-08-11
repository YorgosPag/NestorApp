'use client';

/**
 * @fileoverview **ΤΙ ΛΕΕΙ Η ΟΘΟΝΗ** για κάθε κατάσταση εντοπισμού τόπου.
 * @related ADR-777 · SPEC-777A §13.3 · §13.6 · hooks/geo/usePlaceIdentity.ts
 * @module components/geo/PlaceChooserStatus
 *
 * 🔴 **Εξήχθη ώστε η οθόνη να μη «βγάζει συμπεράσματα».** Κάθε κατάσταση του
 * {@link PlaceIdentityState} έχει **δική της** πρόταση, και η αντιστοίχιση γίνεται
 * **μία φορά** — αλλιώς θα ξαναγραφόταν στη φόρμα ζήτησης και στη φόρμα προσφοράς, με
 * τις δύο να αποκλίνουν για την **ίδια** απάντηση διακομιστή. Ίδιο ιδίωμα με το
 * `demandAnswerShape`: **πολιτική έξω από το JSX**.
 *
 * ⚠️ **Το `unavailable` ΔΕΝ γράφεται ως «δεν βρέθηκε»** — του λέει *«ξαναδοκίμασε,
 * μην αλλάξεις τίποτα»*. Η αντίθετη διατύπωση θα τον έσπρωχνε να ζωγραφίσει κτίριο
 * που **υπάρχει** στον χάρτη, γεννώντας δεύτερη ταυτότητα (§14.5).
 */

import React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { BuildingLookup, PlaceIdentityState } from '@/hooks/geo/usePlaceIdentity';

type Tone = 'neutral' | 'good' | 'warn';

const ICON_OF: Record<Tone, typeof Info> = {
  neutral: Info,
  good: CheckCircle2,
  warn: AlertCircle,
};

/**
 * Μία γραμμή κατάστασης.
 *
 * ⚠️ Ο τόνος **δεν** βάφεται με χρώμα και μόνο: κουβαλά **εικονίδιο**, δηλαδή
 * μη-χρωματικό κανάλι. Είναι ο ίδιος κανόνας που φρουρεί η CHECK 3.41 (WCAG 1.4.1):
 * *«ξέρω ποιο είναι ποιο χωρίς να δω χρώμα;»*.
 */
function StatusLine({ tone, children }: { tone: Tone; children: React.ReactNode }): React.ReactElement {
  const Icon = ICON_OF[tone];
  return (
    <p
      className={cn(
        'flex items-start gap-2 text-sm',
        tone === 'warn' ? 'text-destructive' : 'text-muted-foreground',
      )}
      role={tone === 'warn' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function LookupStatus({ lookup }: { lookup: BuildingLookup }): React.ReactElement | null {
  const { t } = useTranslation(['search-results']);

  switch (lookup.kind) {
    case 'idle':
      return null;
    case 'searching':
      return <StatusLine tone="neutral">{t('place.picker.searching')}</StatusLine>;
    case 'found':
      return (
        <StatusLine tone="good">
          {t('place.picker.found')}
          {' — '}
          {lookup.displayAddress ?? t('place.picker.noAddress')}
        </StatusLine>
      );
    case 'none':
      return <StatusLine tone="neutral">{t('place.picker.none')}</StatusLine>;
    case 'outside-area':
      return <StatusLine tone="warn">{t('place.picker.outsideArea')}</StatusLine>;
    case 'unavailable':
      return <StatusLine tone="warn">{t('place.picker.unavailable')}</StatusLine>;
  }
}

export function IdentityStatus({ state }: { state: PlaceIdentityState }): React.ReactElement | null {
  const { t } = useTranslation(['search-results']);

  switch (state.kind) {
    case 'idle':
    // Η **ερώτηση** διπλότυπου δεν είναι μήνυμα κατάστασης — έχει δικά της κουμπιά.
    case 'duplicate':
      return null;
    case 'working':
      return <StatusLine tone="neutral">{t('place.working')}</StatusLine>;
    case 'settled':
      return (
        <StatusLine tone="good">
          {state.created ? t('place.created') : t('place.reused')}
        </StatusLine>
      );
    case 'malformed':
      return <StatusLine tone="warn">{t(`place.defect.${state.defect}`)}</StatusLine>;
    case 'rejected':
      return <StatusLine tone="warn">{t(`place.rejection.${state.reason}`)}</StatusLine>;
    case 'unavailable':
      return <StatusLine tone="warn">{t('place.picker.unavailable')}</StatusLine>;
    case 'failed':
      return <StatusLine tone="warn">{t('place.failed')}</StatusLine>;
  }
}
