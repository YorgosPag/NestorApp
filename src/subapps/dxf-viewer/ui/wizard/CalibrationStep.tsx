// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React, { useState } from 'react';
import { Ruler, CheckCircle } from 'lucide-react';
import { useLevels } from '../../systems/levels';
import { createDefaultCalibration } from './utils/calibration-utils';
import { HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

export function CalibrationStep() {
  const { t } = useTranslation('dxf-viewer');
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { setCalibration } = useLevels();
  const [units, setUnits] = useState<'mm' | 'cm' | 'm' | 'in' | 'ft'>('mm');
  const [skipCalibration, setSkipCalibration] = useState(true);
  const [realDistance, setRealDistance] = useState('');

  const handleSkipChange = (skip: boolean) => {
    setSkipCalibration(skip);
    if (skip && setCalibration) {
      setCalibration(createDefaultCalibration(units, 100));
    }
  };

  const handleUnitsChange = (newUnits: typeof units) => {
    setUnits(newUnits);
    if (setCalibration) {
      setCalibration(createDefaultCalibration(newUnits, parseFloat(realDistance) || 100));
    }
  };

  const handleManualCalibration = () => {
    setSkipCalibration(false);
    if (setCalibration) {
      setCalibration(createDefaultCalibration(units, parseFloat(realDistance) || 100));
    }
  };

  // 🏢 ENTERPRISE: Unit options with i18n labels
  const unitOptions = [
    { value: 'mm', labelKey: 'calibrationStep.units.mm' },
    { value: 'cm', labelKey: 'calibrationStep.units.cm' },
    { value: 'm', labelKey: 'calibrationStep.units.m' },
    { value: 'in', labelKey: 'calibrationStep.units.in' },
    { value: 'ft', labelKey: 'calibrationStep.units.ft' }
  ] as const;

  return (
    <section className={PANEL_LAYOUT.SPACING.GAP_XL}>
      {/* ✅ ENTERPRISE: Semantic HTML + PANEL_LAYOUT tokens (ADR-003) */}
      <header>
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
          {t('calibrationStep.title')}
        </h3>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>
          {t('calibrationStep.description')}
        </p>
      </header>

      {/* Units Selection */}
      <fieldset className={PANEL_LAYOUT.SPACING.GAP_MD}>
        <legend className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.tertiary}`}>{t('calibrationStep.units.title')}</legend>
        <nav className={`grid ${PANEL_LAYOUT.GRID.COLS_5} ${PANEL_LAYOUT.GAP.SM}`} role="group" aria-label={t('calibrationStep.units.ariaLabel')}>
          {unitOptions.map((unit) => (
            <button
              key={unit.value}
              onClick={() => handleUnitsChange(unit.value as typeof units)}
              className={`${PANEL_LAYOUT.SPACING.SM} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                units === unit.value
                  ? `${getStatusBorder('info')} ${colors.bg.info} ${colors.text.info}`
                  : `${quick.button} ${colors.text.tertiary} ${HOVER_BORDER_EFFECTS.MUTED}`
              }`}
            >
              {t(unit.labelKey)}
            </button>
          ))}
        </nav>
      </fieldset>

      {/* Calibration Options */}
      <fieldset className={PANEL_LAYOUT.SPACING.GAP_LG}>
        <legend className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.tertiary}`}>{t('calibrationStep.calibration.title')}</legend>

        {/* Skip Calibration Option */}
        <label className={`flex items-start ${PANEL_LAYOUT.SPACING.MD} ${quick.card} ${PANEL_LAYOUT.CURSOR.POINTER} ${HOVER_BORDER_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS}`}>
          <input
            type="radio"
            name="calibration"
            checked={skipCalibration}
            onChange={() => handleSkipChange(true)}
            className={`${PANEL_LAYOUT.MARGIN.TOP_XS} ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}
          />
          <article>
            <strong className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>{t('calibrationStep.calibration.skip.title')}</strong>
            <p className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>
              {t('calibrationStep.calibration.skip.description')}
            </p>
            <aside className={`flex items-center ${PANEL_LAYOUT.MARGIN.TOP_SM} ${colors.text.success}`}>
              <CheckCircle className={`${iconSizes.sm} ${PANEL_LAYOUT.MARGIN.LEFT_HALF}`} />
              <span className={PANEL_LAYOUT.TYPOGRAPHY.XS}>{t('calibrationStep.calibration.skip.benefit')}</span>
            </aside>
          </article>
        </label>

        {/* Manual Calibration Option */}
        <label className={`flex items-start ${PANEL_LAYOUT.SPACING.MD} ${quick.card} ${PANEL_LAYOUT.CURSOR.POINTER} ${HOVER_BORDER_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS}`}>
          <input
            type="radio"
            name="calibration"
            checked={!skipCalibration}
            onChange={() => handleManualCalibration()}
            className={`${PANEL_LAYOUT.MARGIN.TOP_XS} ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}
          />
          <article>
            <strong className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>{t('calibrationStep.calibration.manual.title')}</strong>
            <p className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>
              {t('calibrationStep.calibration.manual.description')}
            </p>
            <aside className={`flex items-center ${PANEL_LAYOUT.MARGIN.TOP_SM} ${colors.text.info}`}>
              <Ruler className={`${iconSizes.sm} ${PANEL_LAYOUT.MARGIN.LEFT_HALF}`} />
              <span className={PANEL_LAYOUT.TYPOGRAPHY.XS}>{t('calibrationStep.calibration.manual.benefit')}</span>
            </aside>
          </article>
        </label>

        {/* Manual Calibration Controls */}
        {!skipCalibration && (
          <aside className={`${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.LG} ${PANEL_LAYOUT.SPACING.LG} ${PANEL_LAYOUT.SPACING.GAP_MD}`}>
            <h5 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.info}`}>{t('calibrationStep.calibration.settings.title')}</h5>
            <section className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.tertiary}`}>
                {t('calibrationStep.calibration.settings.distanceLabel')}
                <input
                  type="number"
                  value={realDistance}
                  onChange={(e) => setRealDistance(e.target.value)}
                  placeholder={t('calibrationStep.calibration.settings.placeholder')}
                  className={`${PANEL_LAYOUT.MARGIN.TOP_XS} w-full ${colors.bg.muted} ${quick.input} ${PANEL_LAYOUT.INPUT.PADDING} ${colors.text.primary} ${colors.text.muted} ${PANEL_LAYOUT.INPUT.FOCUS}`}
                />
              </label>
              <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
                {t('calibrationStep.calibration.settings.hint')}
              </p>
            </section>
          </aside>
        )}
      </fieldset>

    </section>
  );
}
