'use client';

/**
 * @fileoverview ADR-915 §45 Φ3 — **το κουμπί «Υπενθύμιση»** παράδοσης στον επαγγελματία (DocuSign «Remind»), ίδιο στη
 *   γραμμή του πίνακα και στο πάνελ.
 * @related registry-delivery-reminder-send.ts (η αποστολή + τα μηνύματα, δυναμικά) · RegistryRowAction.tsx (γραμμή) ·
 *   RegistryIssuanceDelivery.tsx (πάνελ, με τη γραμμή «τελευταία · επόμενη»)
 * @module components/document-registry/RegistryDeliveryReminder
 *
 * ⚠️ **Ελαφρύ, επίτηδες** (CHECK 3.34): το εισάγει ο πίνακας (πρώτο καρέ) ⇒ εδώ **μόνο** οι δύο λέξεις του κουμπιού. Η
 *    αποστολή και όλα τα μηνύματά της φορτώνονται με `import()` τη στιγμή του πατήματος (μετρημένο: με τα μηνύματα εδώ,
 *    το slice της διαδρομής ξεπερνούσε το ταβάνι κατά 713 bytes).
 * 🔑 Η κρίση «όχι δύο την ίδια ημέρα» είναι του **διακομιστή** (`TOO_SOON`)· η οθόνη απλώς τη λέει.
 * Χωρίς δικαίωμα (`canAct: false`) κανένα κουμπί (εργονομία, όχι ασφάλεια — ADR-801).
 */

import React, { useState } from 'react';
import { BellRing } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useIssuanceAssignmentActions } from '@/components/document-registry/issuance-assignment-context';
import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { DELIVERY_REMINDER_KEYS } from '@/components/document-registry/issuance-delivery-labels';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import { useNotifications } from '@/providers/NotificationProvider';

export interface DeliveryReminderTarget {
  readonly propertyId: string;
  readonly kind: DocumentKind;
}

/** Το κουμπί — `null` χωρίς δικαίωμα. */
export function DeliveryReminderButton({ target }: { readonly target: DeliveryReminderTarget }): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const { success, warning, error } = useNotifications();
  const [sending, setSending] = useState(false);
  if (actions === null || !actions.canAct) return null;
  const send = async () => {
    setSending(true);
    try {
      const { sendDeliveryReminder } = await import('@/components/document-registry/registry-delivery-reminder-send');
      // `t` περνά ως αναφορά, όχι ως κλήση: οι κλήσεις του ζουν στο δυναμικό αρχείο (CHECK 3.34 — καμία ανεπίλυτη `t()` εδώ).
      await sendDeliveryReminder(target, { t, success, warning, error, revalidate: actions.revalidate });
    } finally {
      setSending(false);
    }
  };
  return (
    <Button type="button" size="sm" variant="outline" className="w-fit gap-1" disabled={sending} aria-busy={sending} onClick={() => { void send(); }}>
      <BellRing className="size-3" aria-hidden="true" />
      {sending ? t(DELIVERY_REMINDER_KEYS.sending) : t(DELIVERY_REMINDER_KEYS.button)}
    </Button>
  );
}
