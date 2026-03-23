/**
 * ui/toolbar/overlay-section/StatusPalette.tsx
 * Status color palette (8 buttons) for overlay toolbar
 *
 * 🏢 ADR-050: UNIFIED TOOLBAR INTEGRATION (2027-01-27)
 * 8 colored status buttons με centralized STATUS_COLORS
 *
 * @deprecated ADR-258: StatusPalette αφαιρέθηκε από το toolbar — ο χρωματισμός
 * γίνεται πλέον δυναμικά βάσει entity.commercialStatus (Twin Architecture).
 * Διατηρείται για backward compatibility reference. ΜΗΝ χρησιμοποιείς σε νέο κώδικα.
 */

'use client';

import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { OVERLAY_STATUS_KEYS, STATUS_LABELS } from '../../../overlays/types';
import { getStatusColorButtonStyles } from '../../DxfViewerComponents.styles';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import type { Status } from '../../../overlays/types';
import type { PropertyStatus } from '../../../../../constants/property-statuses-enterprise';

interface StatusPaletteProps {
  currentStatus: Status;
  onStatusChange: (status: Status) => void;
}

export const StatusPalette: React.FC<StatusPaletteProps> = ({
  currentStatus,
  onStatusChange
}) => {
  return (
    <div className={`flex ${PANEL_LAYOUT.GAP.XS}`}>
      {OVERLAY_STATUS_KEYS.map(status => (
        <Tooltip key={status}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onStatusChange(status)}
              style={getStatusColorButtonStyles(status as PropertyStatus, currentStatus === status)}
              aria-label={STATUS_LABELS[status]}
              className="transition-opacity hover:opacity-80"
            />
          </TooltipTrigger>
          <TooltipContent>{STATUS_LABELS[status]}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
};
