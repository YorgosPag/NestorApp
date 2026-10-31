// Εμφάνιση γραμμών χάρακα: ΕΝΑ component για τις δύο βαθμίδες (ορατότητα, αδιαφάνεια, χρώμα, πάχος).

'use client';

import React from 'react';
import { useRulersGridContext } from '../../../../../../systems/rulers-grid/RulersGridSystem';
import type { RulerAxisSettings } from '../../../../../../systems/rulers-grid/config';
import { ColorDialogTrigger } from '../../../../../color/EnterpriseColorDialog';
import { UI_COLORS, withOpacity } from '../../../../../../config/color-config';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// ADR-573: base-hex + opacity extraction live once in color/utils.
import { stripAlphaToBaseHex, extractColorOpacity } from '../../../../../color/utils';
import { Switch } from '@/components/ui/switch';
import { PANEL_LAYOUT } from '../../../../../../config/panel-tokens';
import { useTranslation } from '@/i18n';
import { SliderInput } from '../../../../shared/SliderInput';
// ADR-682: unit = format+parse pair → the value beside the slider becomes typeable.
import { SLIDER_VALUE_UNITS } from '../../../../shared/slider-value-units';
import { RULER_TICK_TIERS, rulerTickLabelKey } from './ruler-tick-tiers';
import type { RulerTickLabelKey, RulerTickTier } from './ruler-tick-tiers';

/** Το slider δουλεύει σε px (0.5..3)· το αποθηκευμένο μήκος είναι px ×10. Κλιμάκωση μοντέλου, όχι μονάδα. */
const TICK_LENGTH_PER_PX = 10;

type Label = (key: RulerTickLabelKey) => string;

function useRulerTickControls(tier: RulerTickTier) {
  const fields = RULER_TICK_TIERS[tier];
  const { state: { rulers }, updateRulerSettings } = useRulersGridContext();
  const patchBothAxes = (patch: Partial<RulerAxisSettings>) => {
    updateRulerSettings({
      horizontal: { ...rulers.horizontal, ...patch },
      vertical: { ...rulers.vertical, ...patch },
    });
  };
  return {
    visible: fields.visible(rulers.horizontal),
    color: fields.color(rulers.horizontal),
    length: fields.length(rulers.horizontal) / TICK_LENGTH_PER_PX,
    setVisible: (visible: boolean) => patchBothAxes(fields.patchVisible(visible)),
    setColor: (color: string) => patchBothAxes(fields.patchColor(color)),
    setLength: (px: number) => patchBothAxes(fields.patchLength(px * TICK_LENGTH_PER_PX)),
    setOpacity: (opacity: number) => {
      // Πρώτα το σκέτο χρώμα: αλλιώς η νέα αδιαφάνεια θα έμπαινε πάνω στην παλιά.
      const base = stripAlphaToBaseHex(fields.color(rulers.horizontal) || UI_COLORS.WHITE);
      patchBothAxes(fields.patchColor(withOpacity(base, opacity)));
    },
  };
}

function SettingCard({ children }: { children: React.ReactNode }) {
  const colors = useSemanticColors();
  return <section className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>{children}</section>;
}

function SettingHeading({ title, description }: { title: string; description: string }) {
  const colors = useSemanticColors();
  return (
    <header className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
      <p className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{title}</p>
      <p className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{description}</p>
    </header>
  );
}

interface VisibilityCardProps {
  label: Label;
  stateLabel: string;
  visible: boolean;
  onChange: (visible: boolean) => void;
}

function VisibilityCard({ label, stateLabel, visible, onChange }: VisibilityCardProps) {
  const colors = useSemanticColors();
  return (
    <SettingCard>
      <article className="flex items-center justify-between">
        <SettingHeading title={label('display.title')} description={label('display.description')} />
        <span className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{stateLabel}</span>
          {/* ADR-128: Status variant - Green ON / Red OFF */}
          <Switch checked={visible} onCheckedChange={onChange} variant="status" />
        </span>
      </article>
    </SettingCard>
  );
}

function ColorCard({ label, color, onChange }: { label: Label; color: string; onChange: (color: string) => void }) {
  const colors = useSemanticColors();
  const baseColor = stripAlphaToBaseHex(color);
  return (
    <SettingCard>
      <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{label('color.title')}</label>
      <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{label('color.description')}</p>
      <ColorDialogTrigger
        value={baseColor}
        onChange={onChange}
        label={baseColor}
        title={label('colorPicker')}
        alpha={false}
        modes={['hex', 'rgb', 'hsl']}
        palettes={['dxf', 'semantic', 'material']}
        recent
        eyedropper
      />
    </SettingCard>
  );
}

export interface RulerTickLinesSettingsProps {
  tier: RulerTickTier;
  className?: string;
}

/** Οι αλλαγές ισχύουν αμέσως και στους δύο χάρακες· η ανάγνωση γίνεται από τον οριζόντιο. */
export const RulerTickLinesSettings: React.FC<RulerTickLinesSettingsProps> = ({ tier, className = '' }) => {
  const { t } = useTranslation('dxf-viewer');
  const controls = useRulerTickControls(tier);
  const label: Label = (key) => t(rulerTickLabelKey(tier, key));
  const stateLabel = controls.visible ? t('rulerSettings.common.active') : t('rulerSettings.common.inactive');

  return (
    <section className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${className}`}>
      <VisibilityCard label={label} stateLabel={stateLabel} visible={controls.visible} onChange={controls.setVisible} />
      <SettingCard>
        <SettingHeading title={label('opacity.title')} description={label('opacity.description')} />
        <SliderInput value={extractColorOpacity(controls.color)} min={0.1} max={1} step={0.1} onChange={controls.setOpacity} showValue unit={SLIDER_VALUE_UNITS.percent01} tooltip={label('opacity.title')} />
      </SettingCard>
      <ColorCard label={label} color={controls.color} onChange={controls.setColor} />
      <SettingCard>
        <SettingHeading title={label('width.title')} description={label('width.description')} />
        <SliderInput value={controls.length} min={0.5} max={3} step={0.5} onChange={controls.setLength} showValue unit={SLIDER_VALUE_UNITS.pixels} tooltip={label('width.title')} />
      </SettingCard>
    </section>
  );
};
