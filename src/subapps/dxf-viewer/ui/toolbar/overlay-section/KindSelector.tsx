/**
 * ui/toolbar/overlay-section/KindSelector.tsx
 * Επιλογέας είδους περιοχής (Ακίνητο · Θέση · Αποθήκη · Κοινόχρηστος · Αποτύπωμα).
 *
 * 🏢 ADR-050: UNIFIED TOOLBAR INTEGRATION — εικονίδια με κεντρικά OVERLAY_TOOLBAR_COLORS.
 * ADR-933: ξαναχρησιμοποιείται στην contextual καρτέλα «Περιοχή» της κορδέλας.
 *   - Ο κατάλογος ειδών έρχεται από το `OVERLAY_KINDS` (ένα σημείο δήλωσης)· ο χάρτης εικονιδίων
 *     είναι `Record<OverlayKind, …>`, άρα νέο είδος χωρίς εικονίδιο = σφάλμα τύπου, όχι σιωπηλό κενό
 *     (έτσι είχε ξεχαστεί το `common_space` του ADR-931 Β1).
 *   - Ετικέτες από το `KIND_LABELS` (i18n) — όχι σκληροκωδικοποιημένα αγγλικά.
 */

'use client';

import React from 'react';
import { Home, Car, Package, Users, Footprints, type LucideIcon } from 'lucide-react';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { OVERLAY_TOOLBAR_COLORS } from '../../../config/toolbar-colors';
import { KIND_LABELS, OVERLAY_KINDS, type OverlayKind } from '../../../overlays/types';

interface KindSelectorProps {
  currentKind: OverlayKind;
  onKindChange: (kind: OverlayKind) => void;
  /** Προσβάσιμο όνομα της ομάδας (π.χ. «Είδος περιοχής»). */
  groupLabel?: string;
}

const KIND_ICONS: Readonly<Record<OverlayKind, LucideIcon>> = {
  property: Home,
  parking: Car,
  storage: Package,
  common_space: Users,
  footprint: Footprints,
};

export const KindSelector: React.FC<KindSelectorProps> = ({
  currentKind,
  onKindChange,
  groupLabel,
}) => {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('dxf-viewer');

  return (
    <fieldset className={`flex ${PANEL_LAYOUT.GAP.XS}`} aria-label={groupLabel}>
      {OVERLAY_KINDS.map((kind) => {
        const Icon = KIND_ICONS[kind];
        const label = t(KIND_LABELS[kind]);
        const isActive = currentKind === kind;
        return (
          <Tooltip key={kind}>
            <TooltipTrigger asChild>
              <ToggleButton
                pressed={isActive}
                variant="ghost"
                size="icon-sm"
                onClick={() => onKindChange(kind)}
                aria-label={label}
              >
                <Icon className={`${iconSizes.sm} ${isActive ? '' : OVERLAY_TOOLBAR_COLORS[kind]}`} />
              </ToggleButton>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </fieldset>
  );
};
