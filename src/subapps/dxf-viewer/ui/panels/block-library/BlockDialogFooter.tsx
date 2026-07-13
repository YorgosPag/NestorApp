'use client';

/**
 * ADR-652 M3 — Το footer των φορμών της βιβλιοθήκης block (άκυρο + κύρια ενέργεια).
 *
 * Δύο φόρμες («Αποθήκευση», «Δημοσίευση») με ΤΟ ΙΔΙΟ footer: άκυρο + κύριο κουμπί που
 * αλλάζει ετικέτα όσο τρέχει και κλειδώνει όταν η φόρμα δεν είναι έγκυρη. Γράφεται ΜΙΑ
 * φορά (το `jscpd` το έπιασε ως clone στην πρώτη γραφή — N.18).
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';

export interface BlockDialogFooterProps {
  /** Ετικέτα κύριας ενέργειας σε ηρεμία. */
  readonly confirmLabel: string;
  /** Ετικέτα κύριας ενέργειας όσο τρέχει. */
  readonly busyLabel: string;
  readonly busy: boolean;
  /** `false` ⇒ η φόρμα δεν επιτρέπει ακόμα την ενέργεια (π.χ. νομικό gate ή κενό όνομα). */
  readonly canConfirm: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export const BlockDialogFooter: React.FC<BlockDialogFooterProps> = ({
  confirmLabel,
  busyLabel,
  busy,
  canConfirm,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');

  return (
    <DialogFooter className="gap-2">
      <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
        {t('blockLibrary.save.cancel')}
      </Button>
      <Button size="sm" onClick={onConfirm} disabled={busy || !canConfirm}>
        {busy ? busyLabel : confirmLabel}
      </Button>
    </DialogFooter>
  );
};
