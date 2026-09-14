'use client';

/**
 * @fileoverview **«EMAIL ΕΠΙΒΕΒΑΙΩΜΕΝΟ · ΣΕΠ 2026»** — η δημόσια ένδειξη (ADR-841 §7 Α21.18).
 * @related components/mandate/AgencyContactFacts.tsx (πριν την «Εμφάνιση») · components/mandate/ChannelReveal.tsx (ανά διεύθυνση)
 * @module components/mandate/EmailConfirmedNote
 *
 * 🔑 **ΛΕΕΙ ΜΟΝΟ ΟΤΙ ΛΑΜΒΑΝΕΙ, ΚΑΙ ΠΟΤΕ** — ποτέ «επαληθευμένος επαγγελματίας» (Α9.2 · DSA 6(3)/30): καμία
 * ασπίδα, καμία λέξη «verified». Κανένας από τους μεγάλους δεν δείχνει **φρεσκάδα** σε σήμα καναλιού· εδώ η
 * ημερομηνία είναι το ίδιο το σήμα.
 *
 * 🏆 **Ήπια φθορά** (απόφαση Giorgio): μετά από 12 μήνες η ένδειξη **σιγάζει** (χωρίς χρώμα έμφασης), αλλά
 * **δεν κρύβεται** — η ημερομηνία λέει ήδη την αλήθεια.
 *
 * ⚠️ **Ένα δημόσιο κλειδί για τις δύο θέσεις** — το route slice του `/pro/[alias]` είχε 56 bytes περιθώριο.
 */

import React from 'react';
import { MailCheck } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { confirmationFreshness } from '@/lib/agency/showcase-email-confirmation-rules';
import { nowISO } from '@/lib/date-local';
import { formatMonthYear } from '@/lib/intl-formatting';
import { AGENCY_PUBLIC_NS, PROFILE_KEYS } from './agency-directory-labels';

export function EmailConfirmedNote({ confirmedAt }: { readonly confirmedAt: string | null }): React.ReactElement | null {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  if (confirmedAt === null) return null;
  const fresh = confirmationFreshness(confirmedAt, nowISO()) === 'fresh';
  return (
    <span className={fresh ? 'inline-flex items-center gap-1 text-xs text-foreground' : 'inline-flex items-center gap-1 text-xs text-muted-foreground'}>
      <MailCheck aria-hidden="true" className="h-3.5 w-3.5" />
      {t(PROFILE_KEYS.cardEmailConfirmedOn, { date: formatMonthYear(confirmedAt) })}
    </span>
  );
}
