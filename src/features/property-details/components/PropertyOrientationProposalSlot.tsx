/**
 * **Η πρόταση προσανατολισμού στην κάρτα του ακινήτου** (ADR-937 Φάση Β/Γ) — διαβάζει το `property.orientationProposal`
 * από τον ΕΝΑ αναγνώστη, εφαρμόζει στη **φόρμα** (ο άνθρωπος αποθηκεύει) και απορρίπτει με `null` στο PATCH.
 *
 * ⚠️ Μόνο για ακίνητο ενός επιπέδου: στα πολυώροφα το `orientations` είναι **άθροισμα** των ορόφων και μια εφαρμογή στο
 *    επίπεδο του ακινήτου θα ξαναγραφόταν από τη συνάθροιση (ADR-236). Καταγεγραμμένο όριο του ADR-937.
 */

import React, { useState } from 'react';
import type { TFunction } from 'i18next';

import type { OrientationType } from '@/constants/property-features-enterprise';
import { OrientationProposalStrip } from '@/components/properties/shared/OrientationProposalStrip';
import { readOrientationProposal } from '@/lib/property/orientation-proposal';
import { useNotifications } from '@/providers/NotificationProvider';
import { updateProperty } from '@/services/properties.service';
import type { Property } from '@/types/property';

interface PropertyOrientationProposalSlotProps {
  readonly property: Property;
  readonly declared: readonly OrientationType[];
  readonly onApply: (values: readonly OrientationType[]) => void;
  readonly disabled: boolean;
  readonly t: TFunction;
}

export function PropertyOrientationProposalSlot(props: PropertyOrientationProposalSlotProps) {
  const { property, declared, onApply, disabled, t } = props;
  const notifications = useNotifications();
  const [dismissing, setDismissing] = useState(false);
  const proposal = readOrientationProposal(property.orientationProposal);

  const dismiss = async () => {
    setDismissing(true);
    try {
      await updateProperty(property.id, { orientationProposal: null });
    } catch {
      notifications.error(t('orientation.proposal.dismissFailed'));
    } finally {
      setDismissing(false);
    }
  };

  return (
    <OrientationProposalStrip
      proposal={proposal}
      declared={declared}
      onApply={onApply}
      onDismiss={dismiss}
      disabled={disabled || dismissing}
      t={t}
    />
  );
}
