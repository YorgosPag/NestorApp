'use client';

import React from 'react';
import { Ruler, Wand2 } from 'lucide-react';
import { useLevels } from '../../systems/levels';
import type { SceneUnits } from '../../utils/scene-units';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { useTranslation } from '@/i18n';

type DrawingUnitsChoice = SceneUnits | 'auto';

interface UnitOption {
  value: DrawingUnitsChoice;
  labelKey: string;
  descKey: string;
  example: string;
}

const UNIT_OPTIONS: UnitOption[] = [
  { value: 'auto', labelKey: 'drawingUnits.option.auto.label', descKey: 'drawingUnits.option.auto.desc', example: '' },
  { value: 'm',    labelKey: 'drawingUnits.option.m.label',    descKey: 'drawingUnits.option.m.desc',    example: '5.00' },
  { value: 'cm',   labelKey: 'drawingUnits.option.cm.label',   descKey: 'drawingUnits.option.cm.desc',   example: '500' },
  { value: 'mm',   labelKey: 'drawingUnits.option.mm.label',   descKey: 'drawingUnits.option.mm.desc',   example: '5000' },
  { value: 'ft',   labelKey: 'drawingUnits.option.ft.label',   descKey: 'drawingUnits.option.ft.desc',   example: '16.4' },
  { value: 'in',   labelKey: 'drawingUnits.option.in.label',   descKey: 'drawingUnits.option.in.desc',   example: '196.9' },
];

export function DrawingUnitsStep() {
  const { t } = useTranslation('dxf-viewer-wizard');
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { importWizard, setUserDrawingUnits } = useLevels();

  const current: DrawingUnitsChoice = importWizard.userDrawingUnits ?? 'auto';

  const handleSelect = (value: DrawingUnitsChoice) => {
    setUserDrawingUnits?.(value);
  };

  return (
    <section className={PANEL_LAYOUT.SPACING.GAP_XL}>
      <header>
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} flex items-center gap-2`}>
          <Ruler className={iconSizes.md} />
          {t('drawingUnits.title')}
        </h3>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>
          {t('drawingUnits.description')}
        </p>
      </header>

      <ul className={`${PANEL_LAYOUT.SPACING.GAP_SM} list-none`} role="radiogroup" aria-label={t('drawingUnits.title')}>
        {UNIT_OPTIONS.map(opt => {
          const isSelected = current === opt.value;
          const isAuto = opt.value === 'auto';
          return (
            <li key={opt.value}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleSelect(opt.value)}
                className={`w-full text-left ${PANEL_LAYOUT.SPACING.LG} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} flex items-start gap-3 transition-colors ${
                  isSelected
                    ? `${colors.bg.infoSubtle} ${quick.info}`
                    : `${colors.bg.secondary} ${quick.muted}`
                }`}
              >
                <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  isSelected ? `${quick.info} ${colors.bg.info}` : quick.muted
                }`}>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                <span className="flex-1">
                  <span className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} flex items-center gap-2`}>
                    {t(opt.labelKey)}
                    {isAuto && (
                      <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.successSubtle} ${colors.text.success} px-1.5 py-0.5 rounded flex items-center gap-1`}>
                        <Wand2 className="w-3 h-3" />
                        {t('drawingUnits.recommended')}
                      </span>
                    )}
                  </span>
                  <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} block mt-0.5`}>
                    {t(opt.descKey)}
                    {!isAuto && opt.example && (
                      <span className={`ml-1 font-mono ${colors.text.info}`}>
                        {t('drawingUnits.example', { value: opt.example })}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <aside className={`${colors.bg.warningSubtle} ${PANEL_LAYOUT.SPACING.MD} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} ${getStatusBorder('warning')} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.warning}`}>
        {t('drawingUnits.hint')}
      </aside>
    </section>
  );
}
