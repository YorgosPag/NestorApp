'use client';

/**
 * ADR-901 Φ4 · Ε-4 — **«Αναλαμβάνω» με δήλωση ιδιότητας**, για τον επαγγελματία που **έχει ήδη** λογαριασμό.
 *
 * 🔑 **Η ΙΔΙΑ** φόρμα με την πρόσκληση με email (`CredentialDeclarationForm` + `credentialDraftOf`/`credentialFromDraft`).
 *    Δύο διαδρομές καταλήγουν σε **μία** δήλωση, που φτάνει στον **έναν** γραφέα (`planResponse`). Δεύτερη φόρμα
 *    δεν υπάρχει.
 * 🔑 **Προσυμπλήρωση «θυμήσου με»**: πρώτα η πιο πρόσφατη δήλωση του ίδιου, μετά το βιβλίο του οικοδεσπότη. Ο
 *    άνθρωπος επιβεβαιώνει με ένα πάτημα (πρότυπο DocuSign «confirm your details»).
 *
 * @module components/conveyance/my-cases/AcceptEngagementDialog
 */

import React, { useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import {
  CredentialDeclarationForm,
  credentialDraftOf,
  credentialFromDraft,
  type CredentialDraft,
} from '@/components/case-invite/CredentialDeclarationForm';
import type { CredentialDeclarationInput } from '@/lib/conveyance/declared-credential';
import type { MyCaseCard } from '@/types/conveyance-case';

interface AcceptEngagementDialogProps {
  /** Η πρόταση που αναλαμβάνεται — `null` ⇒ κλειστός διάλογος. */
  readonly card: MyCaseCard | null;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: (engagementId: string, credential: CredentialDeclarationInput) => void;
}

function AcceptForm({ card, busy, onCancel, onConfirm }: AcceptEngagementDialogProps & { readonly card: MyCaseCard }) {
  const { t } = useTranslation(['conveyance']);
  const [draft, setDraft] = useState<CredentialDraft>(() => credentialDraftOf(card.credentialHint));
  const [showMissing, setShowMissing] = useState(false);

  const confirm = () => {
    const credential = credentialFromDraft(draft);
    if (credential === null) { setShowMissing(true); return; }
    onConfirm(card.engagementId, credential);
  };

  return (
    <>
      <CredentialDeclarationForm role={card.role} draft={draft} onChange={setDraft} showMissing={showMissing} disabled={busy} />
      <DialogActionFooter
        cancelLabel={t('engagement.myCases.acceptDialog.cancel')}
        confirmLabel={t('engagement.myCases.accept')}
        busyLabel={t('engagement.myCases.acceptDialog.accepting')}
        onCancel={onCancel}
        onConfirm={confirm}
        isSubmitting={busy}
      />
    </>
  );
}

export function AcceptEngagementDialog(props: AcceptEngagementDialogProps) {
  const { t } = useTranslation(['conveyance']);
  const { card, onCancel } = props;
  if (card === null) return null;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('engagement.myCases.acceptDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('engagement.myCases.acceptDialog.description', {
              role: t(`engagement.roles.${card.role}`),
              property: card.propertyName ?? t('engagement.myCases.untitled'),
            })}
          </DialogDescription>
        </DialogHeader>
        {/* `key` ⇒ νέα πρόταση = νέο προσχέδιο από τη δική της προσυμπλήρωση, ποτέ το προηγούμενο. */}
        <AcceptForm key={card.engagementId} {...props} card={card} />
      </DialogContent>
    </Dialog>
  );
}
