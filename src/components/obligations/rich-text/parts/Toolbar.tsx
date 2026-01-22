"use client";

import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import {
  Bold, Italic, Underline, List, ListOrdered, Quote, Eye, Edit3, RotateCcw, RotateCw
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getAriaLabels } from '../utils/a11y';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
  // Visual state for active formatting
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
  activeBold = false,
  activeItalic = false,
  activeUnderline = false
}: ToolbarProps) {
  const iconSizes = useIconSizes();
  const ariaLabels = getAriaLabels();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('common');

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
      </div>

      <div className={`h-6 w-px bg-muted-foreground/30 mx-1`} />

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

      <div className={`h-6 w-px bg-muted-foreground/30 mx-1`} />

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
