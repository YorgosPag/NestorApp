'use client';

/**
 * @fileoverview **«ΑΠΟΣΥΡΣΗ ΑΠΟ ΤΟΝ ΚΑΤΑΛΟΓΟ»** — το ΕΝΑ κουμπί της πράξης (ADR-841 §7 Α23.9 Φέτα Β).
 * @related components/mandate/AgencyShowcaseContent.tsx · components/mandate/ShowcaseRegistrySections.tsx
 * @module components/mandate/ShowcaseWithdrawButton
 *
 * 🔑 **N.18 (CHECK 3.28)**: η ένδειξη «κλειστή στο ΓΕΜΗ» προσφέρει την **ίδια** απόσυρση με τη σελίδα της βιτρίνας —
 * δύο αντίγραφα του κουμπιού θα μπορούσαν να διαφωνήσουν (π.χ. το ένα να μην κλειδώνει όσο δημοσιεύεται). Η πράξη
 * ζει στο `useAgencyShowcase.withdraw`· εδώ μόνο η απόδοσή της.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { SHOWCASE_KEYS, SHOWCASE_NS } from './agency-showcase-labels';

export function ShowcaseWithdrawButton({
  busy,
  onWithdraw,
}: {
  readonly busy: 'publishing' | 'withdrawing' | null;
  readonly onWithdraw: () => Promise<void>;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  return (
    // ⚠️ Κλειδωμένο όσο τρέχει **οποιαδήποτε** πράξη της βιτρίνας — ποτέ απόσυρση μέσα σε δημοσίευση.
    <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void onWithdraw()}>
      {busy === 'withdrawing' ? t(SHOWCASE_KEYS.withdrawing) : t(SHOWCASE_KEYS.withdraw)}
    </Button>
  );
}
