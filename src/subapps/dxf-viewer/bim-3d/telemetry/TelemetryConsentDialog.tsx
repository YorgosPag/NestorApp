'use client';

/**
 * TelemetryConsentDialog — ADR-366 §C.7.Q3
 *
 * Prop-driven GDPR Article 6(1)(a) explicit consent modal. Shown when the
 * user enables the anonymous telemetry toggle in Quality3DPanelTab.
 *
 *   accept   → opt-in flips to true (caller wires telemetryStore.setOptIn)
 *   decline  → caller leaves opt-in at false (toggle reverts)
 *   close    → treated as decline
 */

import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface TelemetryConsentDialogProps {
  open: boolean;
  privacyPolicyHref?: string;
  onAccept(): void;
  onDecline(): void;
}

export function TelemetryConsentDialog({
  open,
  privacyPolicyHref,
  onAccept,
  onDecline,
}: TelemetryConsentDialogProps) {
  const { t } = useTranslation('bim3d');
  const href = privacyPolicyHref ?? t('performance.telemetry.consentDialog.privacyPolicyHref');

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDecline(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('performance.telemetry.consentDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('performance.telemetry.consentDialog.body')}
          </DialogDescription>
        </DialogHeader>

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline underline-offset-4 hover:no-underline"
        >
          {t('performance.telemetry.consentDialog.privacyLink')}
        </a>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onDecline}>
            {t('performance.telemetry.consentDialog.decline')}
          </Button>
          <Button onClick={onAccept}>
            {t('performance.telemetry.consentDialog.accept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
