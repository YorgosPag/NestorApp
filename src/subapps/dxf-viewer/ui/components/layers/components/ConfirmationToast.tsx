'use client';

import React from 'react';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { AlertTriangle, Trash2, GitMerge } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';

interface ConfirmationToastProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  irreversible?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationToast({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  irreversible = false,
  onConfirm,
  onCancel
}: ConfirmationToastProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <div className={`flex flex-col ${PANEL_LAYOUT.GAP.MD} ${PANEL_LAYOUT.SPACING.LG} max-w-md ${colors.bg.primary} rounded-lg shadow-lg ${quick.card}`}>
      <div className={`flex items-start ${PANEL_LAYOUT.GAP.MD}`}>
        {/* Icon */}
        <div className={`flex-shrink-0 ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>
          {destructive ? (
            <div className={`${iconSizes.xl} ${colors.bg.muted} rounded-full flex items-center justify-center`}>
              <Trash2 className={`${iconSizes.sm} ${colors.text.error}`} />
            </div>
          ) : (
            <div className={`${iconSizes.xl} ${colors.bg.secondary} rounded-full flex items-center justify-center`}>
              <GitMerge className={`${iconSizes.sm} ${colors.text.info}`} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className={`${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.primary} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
            {title}
          </h4>
          <p className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.secondary} whitespace-pre-line leading-relaxed`}>
            {message}
          </p>
          
          {/* Irreversible Warning */}
          {irreversible && (
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.MARGIN.TOP_MD} ${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} rounded ${quick.warning}`}>
              <AlertTriangle className={`${iconSizes.sm} ${colors.text.warning} flex-shrink-0`} />
              <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.warning} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>
                ⚠️ Αυτή η ενέργεια δεν μπορεί να αναιρεθεί!
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Actions */}
      <div className={`flex ${PANEL_LAYOUT.GAP.SM} justify-end ${PANEL_LAYOUT.PADDING.TOP_SM} ${quick.separatorH}`}>
        <button
          onClick={onCancel}
          className={`${PANEL_LAYOUT.BUTTON.PADDING} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary} ${colors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.GRAY_LIGHT} rounded-md ${PANEL_LAYOUT.TRANSITION.COLORS} focus:outline-none ${colors.interactive.focus.ring}`}
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          className={`${PANEL_LAYOUT.BUTTON.PADDING} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} rounded-md transition-colors focus:outline-none ${colors.interactive.focus.ring} ${
            destructive
              ? `${colors.bg.error} ${HOVER_BACKGROUND_EFFECTS.RED_DARKER} ${colors.text.primary}`
              : `${colors.bg.info} ${HOVER_BACKGROUND_EFFECTS.BLUE_DARKER} ${colors.text.primary}`
          }`}
        >
          {confirmText}
        </button>
      </div>
    </div>
  );
}