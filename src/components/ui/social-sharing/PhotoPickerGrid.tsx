'use client';

/**
 * @fileoverview Centralized photo picker grid — SSoT for photo selection UI.
 * Used by EmailShareForm (multi-select) and ShareModal/Telegram (single-select).
 */

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// TYPES
// ============================================================================

interface PhotoPickerGridProps {
  /** Available photo URLs */
  photos: string[];
  /** Currently selected photo URL(s) */
  selected: string[];
  /** Callback when selection changes */
  onSelectionChange: (selected: string[]) => void;
  /** Single select (Telegram) vs multi select (Email) */
  mode?: 'single' | 'multi';
  /** Disable interaction */
  disabled?: boolean;
  /** Custom label — defaults to i18n emailShare.selectPhotos */
  label?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PhotoPickerGrid({
  photos,
  selected,
  onSelectionChange,
  mode = 'single',
  disabled = false,
  label,
}: PhotoPickerGridProps) {
  const { t } = useTranslation('common');

  const handleClick = (url: string) => {
    if (disabled) return;

    if (mode === 'single') {
      onSelectionChange([url]);
      return;
    }

    // Multi-select: toggle
    const isSelected = selected.includes(url);
    onSelectionChange(
      isSelected ? selected.filter(s => s !== url) : [...selected, url]
    );
  };

  if (photos.length < 2) return null;

  return (
    <fieldset>
      <label className="text-sm font-medium mb-1.5 block">
        {label ?? t('emailShare.selectPhotos')}
      </label>
      <ul
        className="grid grid-cols-3 gap-2"
        role="listbox"
        aria-multiselectable={mode === 'multi'}
      >
        {photos.map((url) => {
          const isChecked = selected.includes(url);
          return (
            <li key={url} role="option" aria-selected={isChecked}>
              <button
                type="button"
                onClick={() => handleClick(url)}
                disabled={disabled}
                className={cn(
                  'relative w-full aspect-square rounded-lg overflow-hidden border-2 transition-all',
                  isChecked
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <img
                  src={url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {isChecked && (
                  <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
