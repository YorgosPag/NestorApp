"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import {
  Bold, Italic, Underline, List, ListOrdered, Quote, Eye, Edit3, RotateCcw, RotateCw, Palette, X
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getAriaLabels } from '../utils/a11y';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/design-system';

/** Predefined document text colors using CSS classes from globals.css */
const DOCUMENT_COLORS = [
  { className: 'doc-text-red', swatch: 'bg-red-800 dark:bg-red-400', label: 'Κόκκινο' },
  { className: 'doc-text-blue', swatch: 'bg-blue-800 dark:bg-blue-400', label: 'Μπλε' },
  { className: 'doc-text-green', swatch: 'bg-green-800 dark:bg-green-400', label: 'Πράσινο' },
  { className: 'doc-text-purple', swatch: 'bg-purple-800 dark:bg-purple-400', label: 'Μωβ' },
  { className: 'doc-text-orange', swatch: 'bg-orange-700 dark:bg-orange-400', label: 'Πορτοκαλί' },
  { className: 'doc-text-gray', swatch: 'bg-gray-600 dark:bg-gray-400', label: 'Γκρι' },
  { className: 'doc-text-reset', swatch: 'bg-foreground', label: 'Αφαίρεση χρώματος' },
] as const;

interface ToolbarProps {
  disabled: boolean;
  isPreview: boolean;
  onTogglePreview: () => void;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onBulletList: () => void;
  onNumberList: () => void;
  onQuote: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onColor?: (cssClass: string) => void;
  activeBold?: boolean;
  activeItalic?: boolean;
  activeUnderline?: boolean;
}

export function Toolbar({
  disabled,
  isPreview,
  onTogglePreview,
  onBold,
  onItalic,
  onUnderline,
  onBulletList,
  onNumberList,
  onQuote,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onColor,
  activeBold = false,
  activeItalic = false,
  activeUnderline = false
}: ToolbarProps) {
  const iconSizes = useIconSizes();
  const ariaLabels = getAriaLabels();
  const { t } = useTranslation('common');
  const [colorOpen, setColorOpen] = useState(false);

  return (
    <div className="flex items-center gap-1 p-2 border rounded-md bg-muted/30 flex-wrap">
      {/* Text formatting */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={activeBold ? "default" : "ghost"}
              size="sm"
              onClick={onBold}
              className={`${iconSizes.xl} p-0`}
              aria-label={t('richText.bold')}
              aria-pressed={activeBold}
              disabled={isPreview || disabled}
            >
              <Bold className={iconSizes.sm} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('richText.bold')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={activeItalic ? "default" : "ghost"}
              size="sm"
              onClick={onItalic}
              className={`${iconSizes.xl} p-0`}
              aria-label={t('richText.italic')}
              aria-pressed={activeItalic}
              disabled={isPreview || disabled}
            >
              <Italic className={iconSizes.sm} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('richText.italic')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={activeUnderline ? "default" : "ghost"}
              size="sm"
              onClick={onUnderline}
              className={`${iconSizes.xl} p-0`}
              aria-label={t('richText.underline')}
              aria-pressed={activeUnderline}
              disabled={isPreview || disabled}
            >
              <Underline className={iconSizes.sm} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('richText.underline')}</TooltipContent>
        </Tooltip>

        {/* Font color picker */}
        {onColor && (
          <Popover open={colorOpen} onOpenChange={setColorOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`${iconSizes.xl} p-0`}
                    aria-label="Χρώμα γραμματοσειράς"
                    disabled={isPreview || disabled}
                  >
                    <Palette className={iconSizes.sm} />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Χρώμα γραμματοσειράς</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-auto p-3" align="start">
              <nav aria-label="Χρώματα γραμματοσειράς" className="grid grid-cols-4 gap-2">
                {DOCUMENT_COLORS.map((color) => (
                  <Tooltip key={color.className}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => { onColor(color.className); setColorOpen(false); }}
                        className={cn(
                          "w-7 h-7 rounded-md border border-border hover:scale-110 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          color.swatch,
                          color.className === 'doc-text-reset' && 'flex items-center justify-center'
                        )}
                        aria-label={color.label}
                      >
                        {color.className === 'doc-text-reset' && (
                          <X className="h-3 w-3 text-background" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{color.label}</TooltipContent>
                  </Tooltip>
                ))}
              </nav>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="h-6 w-px bg-muted-foreground/30 mx-1" />

      {/* Lists and quotes */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="sm" onClick={onBulletList} className={`${iconSizes.xl} p-0`} aria-label={ariaLabels.bulletList} disabled={isPreview || disabled}>
              <List className={iconSizes.sm} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{ariaLabels.bulletList}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="sm" onClick={onNumberList} className={`${iconSizes.xl} p-0`} aria-label={ariaLabels.numberList} disabled={isPreview || disabled}>
              <ListOrdered className={iconSizes.sm} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{ariaLabels.numberList}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="sm" onClick={onQuote} className={`${iconSizes.xl} p-0`} aria-label={ariaLabels.quote} disabled={isPreview || disabled}>
              <Quote className={iconSizes.sm} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{ariaLabels.quote}</TooltipContent>
        </Tooltip>
      </div>

      <div className="h-6 w-px bg-muted-foreground/30 mx-1" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="sm" onClick={onUndo} className={`${iconSizes.xl} p-0`} aria-label={ariaLabels.undo} disabled={isPreview || disabled || !canUndo}>
              <RotateCcw className={iconSizes.sm} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{ariaLabels.undo}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="sm" onClick={onRedo} className={`${iconSizes.xl} p-0`} aria-label={ariaLabels.redo} disabled={isPreview || disabled || !canRedo}>
              <RotateCw className={iconSizes.sm} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{ariaLabels.redo}</TooltipContent>
        </Tooltip>
      </div>

      {/* Preview toggle */}
      <div className="flex items-center gap-1 ml-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant={isPreview ? "default" : "ghost"} size="sm" onClick={onTogglePreview} className="h-8 px-3" aria-pressed={isPreview} disabled={disabled}>
              {isPreview ? (
                <><Edit3 className={`${iconSizes.sm} mr-1`} />{t('actions.edit')}</>
              ) : (
                <><Eye className={`${iconSizes.sm} mr-1`} />{t('richText.preview')}</>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isPreview ? ariaLabels.edit : ariaLabels.preview}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
