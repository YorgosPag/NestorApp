'use client';

/**
 * ADR-362 (Path B) / ADR-510 Φ2E #3 — shared «Line Pattern» launcher button.
 *
 * SSoT presentational widget: a small ribbon button that opens the reusable
 * `LinePatternEditorDialog` and forwards its `onCreated(name)` result. Extracted
 * from `DimNewLinePatternWidget` so BOTH the Dimension contextual tab (register
 * only) AND the Line contextual tab (register + assign to the selected line, via
 * `onCreated`) share ONE button + dialog + open-state — zero clone (N.18).
 *
 * The editor registers the user-created linetype in `LinetypeRegistry`; every
 * linetype picker reads that live registry, so a new pattern appears there
 * automatically. Consumers that ALSO want to assign it pass `onCreated`.
 */

import React, { useState, useCallback } from 'react';
import { Plus, Pencil, Copy } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { LinePatternEditorDialog } from '../../panels/dimensions/LinePatternEditorDialog';

/** Icon by dialog mode — «Νέος» (Plus) / «Επεξεργασία» (Pencil) / «Διπλότυπο» (Copy). */
const MODE_ICONS = { new: Plus, edit: Pencil, duplicate: Copy } as const;

interface LinePatternLauncherButtonProps {
  /** i18n key (namespace `dxf-viewer-shell`) for the button label + aria-label. */
  readonly labelKey: string;
  /** Called with the linetype name after a successful create/duplicate (unused for edit-in-place). */
  readonly onCreated?: (name: string) => void;
  /** ADR-642 Edit-in-place — edit this existing user-created type in place (name locked → upsert). */
  readonly editName?: string;
  /** ADR-642 Duplicate — seed from this read-only source type into a new named user copy. */
  readonly duplicateFrom?: string;
}

export const LinePatternLauncherButton: React.FC<LinePatternLauncherButtonProps> = ({
  labelKey,
  onCreated,
  editName,
  duplicateFrom,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const [open, setOpen] = useState(false);
  const openDialog = useCallback(() => setOpen(true), []);

  const Icon = MODE_ICONS[editName ? 'edit' : duplicateFrom ? 'duplicate' : 'new'];

  return (
    <span className="dxf-ribbon-combobox-row">
      <button
        type="button"
        onClick={openDialog}
        aria-label={t(labelKey)}
        className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
      >
        <Icon className="w-3 h-3 opacity-80" />
        <span>{t(labelKey)}</span>
      </button>
      <LinePatternEditorDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={onCreated}
        editName={editName}
        duplicateFrom={duplicateFrom}
      />
    </span>
  );
};
