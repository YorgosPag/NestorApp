'use client';

/**
 * ADR-674 Φ C — Opening Hardware trigger widget (contextual Opening ribbon).
 *
 * Opens `EditOpeningHardwareDialog` for the currently selected opening
 * INSTANCE (per-placement `params.hardwareOverrides` — "this door only",
 * not the shared family type). Unlike `RibbonOpeningTypePropertiesWidget`
 * (which self-hides for untyped openings, since dimensions are type-governed),
 * hardware overrides apply to ANY placed opening — typed or ad-hoc — so this
 * widget only gates on the selected opening's `kind` actually owning operable
 * hardware (`openingHasOperableHardware`); a `fixed`/`bay-window`/
 * `overhead-door`/`revolving-door` selection renders nothing, same as
 * `OpeningHardwareSetEditor` itself.
 *
 * Reuses `useOpeningFamilyTypeController()` purely for its `opening` field —
 * the SAME selected-opening lookup `RibbonOpeningTypePropertiesWidget` uses —
 * so no second selection-resolution path is introduced.
 *
 * @see ../hooks/useOpeningFamilyTypeController.ts — shared selected-opening source
 * @see ../../../bim/family-types/opening-hardware-set.ts — openingHasOperableHardware
 * @see ./EditOpeningHardwareDialog.tsx — the dialog this trigger opens
 */

import React from 'react';
import { Wrench } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useOpeningFamilyTypeController } from '../hooks/useOpeningFamilyTypeController';
import { openEditOpeningHardware } from '../../../bim/family-types/edit-opening-hardware-store';
import { openingHasOperableHardware } from '../../../bim/family-types/opening-hardware-set';

export function RibbonOpeningHardwareWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const { opening } = useOpeningFamilyTypeController();

  if (!opening || !openingHasOperableHardware(opening.params.kind)) return null;

  return (
    <span className="dxf-ribbon-combobox-row items-center">
      <button
        type="button"
        className="text-xs px-1.5 py-0.5 rounded border border-black/20 hover:bg-black/5 whitespace-nowrap"
        onClick={() => openEditOpeningHardware(opening.id)}
      >
        {t('ribbon.commands.bimFamilyType.editOpeningHardwareButton')}
      </button>
    </span>
  );
}
