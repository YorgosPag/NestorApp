'use client';

/**
 * ADR-901 Φ2 §5.2 — **δηλωμένη συναίνεση** της πλευράς του αγοραστή, πριν από πρόταση πρόσβασης σε ρόλο που
 * βλέπει και τα δικά του έγγραφα (δικηγόρος αγοραστή · συμβολαιογράφος).
 *
 * Η βάση είναι **κλειστό σύνολο** (`ATTESTABLE_BASES`) — ποτέ ελεύθερο κείμενο: ο server ξανακρίνει την ίδια
 * λίστα, και το ίχνος γράφει **τι** δηλώθηκε, **ποιος** και **πότε**.
 *
 * @module components/sales/conveyance/ConveyanceEngagementConsentDialog
 */

import React, { useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ATTESTABLE_BASES } from '@/lib/conveyance/engagement-consent';
import type { ConsentBasis } from '@/types/engagement';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

type AttestableBasis = (typeof ATTESTABLE_BASES)[number];

function isAttestableBasis(value: string): value is AttestableBasis {
  return (ATTESTABLE_BASES as readonly string[]).includes(value);
}

interface ConsentDialogProps {
  /** Ο ρόλος που περιμένει συναίνεση — `null` ⇒ κλειστός διάλογος. */
  readonly role: LegalProfessionalRole | null;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: (role: LegalProfessionalRole, basis: ConsentBasis) => void;
}

export function ConveyanceEngagementConsentDialog({ role, busy, onCancel, onConfirm }: ConsentDialogProps) {
  const { t } = useTranslation(['conveyance']);
  const [basis, setBasis] = useState<AttestableBasis | null>(null);
  if (role === null) return null;

  const close = () => { setBasis(null); onCancel(); };
  const confirm = () => { if (basis) onConfirm(role, basis); };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('engagement.consent.title')}</DialogTitle>
          <DialogDescription>{t('engagement.consent.description')}</DialogDescription>
        </DialogHeader>
        <section className="space-y-2">
          <Label htmlFor="engagement-consent-basis">{t('engagement.consent.basisLabel')}</Label>
          <Select value={basis ?? undefined} onValueChange={(value) => { if (isAttestableBasis(value)) setBasis(value); }}>
            <SelectTrigger id="engagement-consent-basis">
              <SelectValue placeholder={t('engagement.consent.basisPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {ATTESTABLE_BASES.map((value) => (
                <SelectItem key={value} value={value}>{t(`engagement.consent.bases.${value}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>
        <DialogActionFooter
          cancelLabel={t('engagement.consent.cancel')}
          confirmLabel={t('engagement.consent.confirm')}
          busyLabel={t('engagement.actions.offering')}
          onCancel={close}
          onConfirm={confirm}
          isSubmitting={busy}
          canSubmit={basis !== null}
        />
      </DialogContent>
    </Dialog>
  );
}
