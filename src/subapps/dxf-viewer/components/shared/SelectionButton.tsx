/**
 * Shared selection button component
 * Eliminates duplicate button styling and structure
 */
import React from 'react';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';

interface SelectionButtonProps {
  onClick: () => void;
  icon: string;
  title: string;
  subtitle?: string;
  extraInfo?: string;
}

export function SelectionButton({
  onClick,
  icon,
  title,
  subtitle,
  extraInfo
}: SelectionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border border-gray-600 transition-colors ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${HOVER_BACKGROUND_EFFECTS.MUTED}`}
    >
      <div className="flex items-center space-x-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="text-white font-medium">{title}</div>
          {subtitle && (
            <div className="text-gray-400 text-sm">{subtitle}</div>
          )}
          {extraInfo && (
            <div className="text-gray-400 text-sm">{extraInfo}</div>
          )}
        </div>
      </div>
    </button>
  );
}