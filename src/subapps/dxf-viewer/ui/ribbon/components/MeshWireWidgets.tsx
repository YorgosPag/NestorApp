'use client';

/**
 * ADR-689 Φ3 — τα δύο ribbon widgets του mesh wireframe (View tab, δίπλα στο «Στυλ Προβολής»).
 *
 *   - **Ακμές Πλέγματος** — dropdown `feature` ⟷ `full`, στο σχήμα του {@link GlassQualitySelect}
 *     (Radix `@/components/ui/select`, ADR-001 — ΟΧΙ `EnterpriseComboBox`/native `<select>`).
 *   - **Πάχος Ακμών** — αριθμητικό πεδίο πάνω στο υπάρχον {@link RibbonNumericFieldWidget}
 *     (ADR-662 Φάση 1b): μηδέν νέα λογική input, ~6 γραμμές config όπως τα τοπογραφικά πεδία.
 *
 * Και τα δύο είναι λεπτοί αναγνώστες/συγγραφείς του `useBimRenderSettingsStore` (το SSoT, με
 * Firestore persistence ανά προβολή). Το `useBim3DVgResync` ξαναχτίζει τη σκηνή όταν αλλάξουν —
 * το `aWireCode` και το πάχος ψήνονται στη γεωμετρία/υλικό τη στιγμή του build.
 *
 * Ενεργά μόνο όταν το Visual Style είναι «Συρμάτινο» ή «Κρυφή Γραμμή»· στα υπόλοιπα στυλ η τιμή
 * απλώς περιμένει (ίδια συμπεριφορά με την «Ποιότητα Γυαλιού», που αφορά μόνο τα γυάλινα υλικά).
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import {
  MESH_WIRE_MODES,
  MESH_WIRE_WIDTH_MAX_PX,
  MESH_WIRE_WIDTH_MIN_PX,
  MESH_WIRE_WIDTH_PRESETS_PX,
  type MeshWireMode,
} from '../../../config/bim-visual-style';
import {
  RibbonNumericFieldWidget,
  type RibbonNumericConfig,
} from './RibbonNumericFieldWidget';

export const MeshWireModeSelect: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const meshWireMode = useBimRenderSettingsStore((s) => s.meshWireMode);
  const setMeshWireMode = useBimRenderSettingsStore((s) => s.setMeshWireMode);

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{t('ribbon.commands.meshWireMode.label')}</span>
      <Select value={meshWireMode} onValueChange={(v) => setMeshWireMode(v as MeshWireMode)}>
        <SelectTrigger
          size="sm"
          aria-label={t('ribbon.commands.meshWireMode.label')}
          title={t('ribbon.commands.meshWireMode.tooltip')}
        >
          <SelectValue />
        </SelectTrigger>
        {/* w-auto overrides the popper's trigger-width lock so the Greek labels are never clipped. */}
        <SelectContent className="w-auto min-w-[9rem]">
          {MESH_WIRE_MODES.map((option) => (
            <SelectItem key={option} value={option} className="whitespace-nowrap">
              {t(`ribbon.commands.meshWireMode.options.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  );
};

const MESH_WIRE_WIDTH: RibbonNumericConfig = {
  commandId: 'view.meshWireWidth.field',
  labelKey: 'ribbon.commands.meshWireWidth.label',
  presets: MESH_WIRE_WIDTH_PRESETS_PX,
  min: MESH_WIRE_WIDTH_MIN_PX,
  max: MESH_WIRE_WIDTH_MAX_PX,
  allowDecimal: true,
  useNumericState: () => {
    const value = useBimRenderSettingsStore((s) => s.meshWireWidthPx);
    const commit = useBimRenderSettingsStore((s) => s.setMeshWireWidthPx);
    return { value, commit };
  },
};

export const MeshWireWidthField: React.FC = () => (
  <RibbonNumericFieldWidget config={MESH_WIRE_WIDTH} />
);
