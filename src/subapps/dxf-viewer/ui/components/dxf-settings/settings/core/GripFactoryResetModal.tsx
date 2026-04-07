'use client';

/**
 * Grip Factory Reset Confirmation Modal
 *
 * Enterprise confirmation dialog for factory-resetting grip settings.
 * Extracted from GripSettings.tsx per ADR-065 (file size compliance).
 */

import React from 'react';
import { useTranslation } from '@/i18n';
import { Factory } from 'lucide-react';
import { HOVER_BACKGROUND_EFFECTS, INTERACTIVE_PATTERNS } from '../../../../../../../components/ui/effects';
import { useIconSizes } from '../../../../../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../../../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
import { BaseModal } from '../../../../../components/shared/BaseModal';

interface GripFactoryResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function GripFactoryResetModal({ isOpen, onClose, onConfirm }: GripFactoryResetModalProps) {
  const { t } = useTranslation('dxf-viewer');
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`⚠️ ${t('settings.grip.factoryReset.title')}`}
      size="md"
      closeOnBackdrop={false}
      zIndex={10000}
    >
      <article className={PANEL_LAYOUT.SPACING.GAP_LG}>
        <aside className={`${colors.bg.errorSubtle} ${getStatusBorder('error')} ${PANEL_LAYOUT.ALERT.PADDING_LG} ${PANEL_LAYOUT.ALERT.BORDER_RADIUS}`} role="alert">
          <p className={`${colors.text.error} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
            ⚠️ {t('settings.grip.factoryReset.warning')}
          </p>
        </aside>

        <section className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <p className={`${colors.text.muted} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>{t('settings.grip.factoryReset.lossTitle')}</p>
          <ul className={`list-disc list-inside ${PANEL_LAYOUT.SPACING.GAP_XS} ${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
            <li>{t('settings.grip.factoryReset.lossList.customSettings')}</li>
            <li>{t('settings.grip.factoryReset.lossList.colors')}</li>
            <li>{t('settings.grip.factoryReset.lossList.changes')}</li>
          </ul>
        </section>

        <aside className={`${colors.bg.infoSubtle} ${getStatusBorder('info')} ${PANEL_LAYOUT.ALERT.PADDING_LG} ${PANEL_LAYOUT.ALERT.BORDER_RADIUS}`} role="note">
          <p className={`${colors.text.info} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
            {t('settings.grip.factoryReset.resetInfo')}
          </p>
        </aside>

        <p className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} text-center ${PANEL_LAYOUT.PADDING.TOP_SM}`}>
          {t('settings.grip.factoryReset.confirm')}
        </p>

        <footer className={`flex ${PANEL_LAYOUT.GAP.MD} justify-end ${PANEL_LAYOUT.PADDING.TOP_LG}${quick.separator}`}>
          <button
            onClick={onClose}
            className={`${PANEL_LAYOUT.BUTTON.PADDING_LG} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${colors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.text.inverted} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
          >
            {t('settings.grip.factoryReset.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={`${PANEL_LAYOUT.BUTTON.PADDING_LG} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${colors.bg.danger} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} ${colors.text.inverted} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} flex items-center ${PANEL_LAYOUT.GAP.XS}`}
          >
            <Factory className={iconSizes.xs} />
            {t('settings.grip.factoryReset.confirmButton')}
          </button>
        </footer>
      </article>
    </BaseModal>
  );
}
