/**
 * **«Πρόταση προσανατολισμού στο ακίνητο»** στο πάνελ ιδιοτήτων του overlay (ADR-937 Φάση Β).
 *
 * Δείχνει τι συμπεραίνει η κάτοψη για το συνδεδεμένο ακίνητο, και με **ρητή** πράξη του ανθρώπου στέλνει την πρόταση
 * στο πεδίο `orientationProposal` του ακινήτου. **Ποτέ** δεν γράφει το δηλωμένο `orientations` — εκεί αποφασίζει ο
 * άνθρωπος στην καρτέλα του ακινήτου (πρότυπο ΠΕΑ: πρόταση, όχι εγγραφή).
 */

import React, { useState } from 'react';

import { useTranslation } from '@/i18n';
import { ORIENTATION_LABELS } from '@/constants/property-features-enterprise';
import { useNotifications } from '@/providers/NotificationProvider';
import { updateProperty } from '@/services/properties.service';
import { nowISO } from '@/lib/date-local';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { EventBus } from '../../systems/events';
import {
  usePropertyOrientationProposal,
  type FloorplanOrientationProposalStatus,
} from '../../hooks/data/usePropertyOrientationProposal';
import type { Overlay } from '../../overlays/types';

/** Το μήνυμα της κενής πρότασης ανά αιτία — «δεν βρέθηκαν ανοίγματα» **μόνο** όταν υπάρχει μοντέλο να ψάξει. */
const EMPTY_MESSAGE_KEY: Record<FloorplanOrientationProposalStatus, string> = {
  'no-model': 'overlayProperties.orientationProposal.noModel',
  'no-envelope': 'overlayProperties.orientationProposal.noEnvelope',
  derived: 'overlayProperties.orientationProposal.none',
};

/**
 * Χωρίς μοντέλο ο επόμενος δρόμος είναι «σχέδιο → μοντέλο» (ADR-929 / ADR-911 Φ3β) — το **ίδιο** σήμα που στέλνει το
 * πλήκτρο του ribbon (`open-model-from-drawing` → `ModelFromDrawingHost`), όχι δεύτερος δρόμος.
 */
function openModelFromDrawing(): void {
  EventBus.emit('dxf:model-from-drawing-requested', {});
}

interface OverlayOrientationProposalProps {
  readonly overlay: Overlay;
}

export function OverlayOrientationProposal({ overlay }: OverlayOrientationProposalProps) {
  const { t } = useTranslation('dxf-viewer');
  const { t: tEnums } = useTranslation('properties-enums');
  const { t: tShell } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const notifications = useNotifications();
  const [sending, setSending] = useState(false);
  const propertyId = overlay.kind === 'property' ? overlay.linked?.propertyId : undefined;
  const proposal = usePropertyOrientationProposal(propertyId ? overlay.polygon : undefined);

  if (!propertyId || !proposal) return null;

  const send = async () => {
    setSending(true);
    try {
      await updateProperty(propertyId, {
        orientationProposal: {
          values: [...proposal.values],
          source: 'floorplan',
          northAssumed: proposal.northAssumed,
          proposedAt: nowISO(),
        },
      });
      notifications.success(t('overlayProperties.orientationProposal.sent'));
    } catch {
      notifications.error(t('overlayProperties.orientationProposal.failed'));
    } finally {
      setSending(false);
    }
  };

  const hasValues = proposal.values.length > 0;
  return (
    <section className={PANEL_LAYOUT.SPACING.GAP_XS}>
      <Label className={PANEL_LAYOUT.TYPOGRAPHY.XS}>{t('overlayProperties.orientationProposal.label')}</Label>
      <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${hasValues ? '' : colors.text.muted}`}>
        {hasValues
          ? proposal.values.map((o) => tEnums(ORIENTATION_LABELS[o])).join(', ')
          : t(EMPTY_MESSAGE_KEY[proposal.status])}
      </p>
      {proposal.status === 'no-model' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={PANEL_LAYOUT.HEIGHT.INPUT_SM}
          onClick={openModelFromDrawing}
        >
          {tShell('ribbon.commands.bim.wallsFromDrawing.label')}
        </Button>
      )}
      {proposal.northAssumed && proposal.status === 'derived' && (
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
          {t('overlayProperties.orientationProposal.northAssumed')}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={PANEL_LAYOUT.HEIGHT.INPUT_SM}
        disabled={!hasValues || sending}
        onClick={send}
      >
        {t('overlayProperties.orientationProposal.send')}
      </Button>
    </section>
  );
}
