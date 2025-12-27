'use client';

import React from 'react';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { AlertTriangle, Trash2, GitMerge } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

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
    <div className={`flex flex-col gap-3 p-4 max-w-md ${colors.bg.primary} rounded-lg shadow-lg ${quick.card}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-1">
          {destructive ? (
            <div className={`${iconSizes.xl} ${colors.bg.muted} rounded-full flex items-center justify-center`}>
              <Trash2 className={`${iconSizes.sm} text-red-600 dark:text-red-400`} />
            </div>
          ) : (
            <div className={`${iconSizes.xl} ${colors.bg.secondary} rounded-full flex items-center justify-center`}>
              <GitMerge className={`${iconSizes.sm} text-blue-600 dark:text-blue-400`} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {title}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
            {message}
          </p>
          
          {/* Irreversible Warning */}
          {irreversible && (
            <div className={`flex items-center gap-2 mt-3 p-2 ${colors.bg.hover} rounded ${quick.warning}`}>
              <AlertTriangle className={`${iconSizes.sm} text-yellow-600 dark:text-yellow-400 flex-shrink-0`} />
              <span className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                ⚠️ Αυτή η ενέργεια δεν μπορεί να αναιρεθεί!
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Actions */}
      <div className={`flex gap-2 justify-end pt-2 ${quick.separatorH}`}>
        <button
          onClick={onCancel}
          className={`px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 ${colors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.GRAY_LIGHT} dark:${HOVER_BACKGROUND_EFFECTS.GRAY} rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500`}
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 ${
            destructive
              ? `bg-red-600 ${HOVER_BACKGROUND_EFFECTS.RED_DARKER} text-white focus:ring-red-500`
              : `bg-blue-600 ${HOVER_BACKGROUND_EFFECTS.BLUE_DARKER} text-white focus:ring-blue-500`
          }`}
        >
          {confirmText}
        </button>
      </div>
    </div>
  );
}