'use client';

import React from 'react';
import { FileText, Ruler, CheckCircle, Scissors, AlertTriangle } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useLevels } from '../../systems/levels';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

export function PreviewStep() {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { levels, importWizard } = useLevels();
  // 🌐 i18n
  const { t } = useTranslation('dxf-viewer');
  
  const selectedLevel = importWizard.selectedLevelId 
    ? levels.find(l => l.id === importWizard.selectedLevelId)
    : null;

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <section className={PANEL_LAYOUT.SPACING.GAP_XL}>
      {/* ✅ ENTERPRISE: Semantic header + fix broken template string (ADR-003) */}
      <header>
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
          {t('importWizard.preview.title')}
        </h3>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>
          {t('importWizard.preview.description')}
        </p>
      </header>

      {/* File Information */}
      <article className={`${colors.bg.secondary} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} ${PANEL_LAYOUT.SPACING.LG}`}>
        <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.info} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center`}>
          <FileText className={`${iconSizes.sm} ${PANEL_LAYOUT.SPACING.GAP_H_SM}`} />
          {t('importWizard.preview.fileInfo.title')}
        </h4>
        <dl className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
          <div className="flex justify-between">
            <dt className={colors.text.muted}>{t('importWizard.preview.fileInfo.file')}</dt>
            <dd className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>{importWizard.file?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className={colors.text.muted}>{t('importWizard.preview.fileInfo.size')}</dt>
            <dd className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>
              {importWizard.file ? formatFileSize(importWizard.file.size) : t('importWizard.preview.fileInfo.unknown')}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className={colors.text.muted}>{t('importWizard.preview.fileInfo.type')}</dt>
            <dd className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>AutoCAD DXF</dd>
          </div>
        </dl>
      </article>

      {/* Level Assignment */}
      <article className={`${colors.bg.secondary} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} ${PANEL_LAYOUT.SPACING.LG}`}>
        <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.success} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center`}>
          <NAVIGATION_ENTITIES.building.icon className={`${iconSizes.sm} ${PANEL_LAYOUT.SPACING.GAP_H_SM} ${NAVIGATION_ENTITIES.building.color}`} />
          {t('importWizard.preview.levelAssignment.title')}
        </h4>
        <dl className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
          <div className="flex justify-between">
            <dt className={colors.text.muted}>{t('importWizard.preview.levelAssignment.destination')}</dt>
            <dd className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>
              {selectedLevel?.name || importWizard.newLevelName || t('importWizard.preview.fileInfo.unknown')}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className={colors.text.muted}>{t('importWizard.preview.levelAssignment.action')}</dt>
            <dd className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>
              {selectedLevel ? t('importWizard.preview.levelAssignment.addToExisting') : t('importWizard.preview.levelAssignment.createNew')}
            </dd>
          </div>
        </dl>
      </article>

      {/* Scale & Units */}
      <article className={`${colors.bg.secondary} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} ${PANEL_LAYOUT.SPACING.LG}`}>
        <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.accent} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center`}>
          <Ruler className={`${iconSizes.sm} ${PANEL_LAYOUT.SPACING.GAP_H_SM}`} />
          {t('importWizard.preview.scaleUnits.title')}
        </h4>
        <dl className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
          <div className="flex justify-between">
            <dt className={colors.text.muted}>{t('importWizard.preview.scaleUnits.units')}</dt>
            <dd className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>
              {importWizard.calibration?.units || t('importWizard.preview.scaleUnits.millimeters')}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className={colors.text.muted}>{t('importWizard.preview.scaleUnits.scale')}</dt>
            <dd className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>{t('importWizard.preview.scaleUnits.native')}</dd>
          </div>
          <div className="flex justify-between">
            <dt className={colors.text.muted}>{t('importWizard.preview.scaleUnits.calibration')}</dt>
            <dd className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>
              {importWizard.calibration ? t('importWizard.preview.scaleUnits.applied') : t('importWizard.preview.scaleUnits.none')}
            </dd>
          </div>
        </dl>
      </article>

      {/* DXF Processing Info */}
      <aside className={`${colors.bg.warning} ${PANEL_LAYOUT.BG_OPACITY['30']} ${getStatusBorder('warning')} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} ${PANEL_LAYOUT.SPACING.LG}`}>
        <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.warning} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center`}>
          <Scissors className={`${iconSizes.sm} ${PANEL_LAYOUT.SPACING.GAP_H_SM}`} />
          {t('importWizard.preview.processing.title')}
        </h4>
        <ul className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.warning}`}>
          <li className="flex items-start">
            <CheckCircle className={`${iconSizes.sm} ${PANEL_LAYOUT.SPACING.GAP_H_SM} ${colors.text.success} ${PANEL_LAYOUT.MARGIN.LEFT_HALF}`} />
            <span>{t('importWizard.preview.processing.autoCrop')}</span>
          </li>
        </ul>
      </aside>

      {/* What Happens Next */}
      <aside className={`${colors.bg.info} ${PANEL_LAYOUT.BG_OPACITY['30']} ${getStatusBorder('info')} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} ${PANEL_LAYOUT.SPACING.LG}`}>
        <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.info} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD}`}>{t('importWizard.preview.whatNext.title')}</h4>
        <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.info}`}>
          <div className="flex items-center">
            <CheckCircle className={`${iconSizes.sm} ${PANEL_LAYOUT.MARGIN.RIGHT_SM} ${colors.text.success}`} />
            <span>{t('importWizard.preview.whatNext.analyze')}</span>
          </div>
        </div>
      </aside>

      {/* Warning if creating new level */}
      {importWizard.newLevelName && (
        <aside className={`${colors.bg.warning} ${PANEL_LAYOUT.BG_OPACITY['30']} ${getStatusBorder('warning')} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} ${PANEL_LAYOUT.SPACING.MD}`}>
          <div className="flex items-center">
            <AlertTriangle className={`${iconSizes.sm} ${PANEL_LAYOUT.MARGIN.RIGHT_SM} ${colors.text.warning}`} />
            <p className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.warning}`}>
              <strong>{t('importWizard.preview.newLevelWarning')}</strong> "{importWizard.newLevelName}"
            </p>
          </div>
        </aside>
      )}
    </section>
  );
}
