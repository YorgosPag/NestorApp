"use client";

import { Button } from '@/components/ui/button';
import { 
  Bold, Italic, Underline, List, ListOrdered, Quote, Eye, Edit3, RotateCcw, RotateCw 
} from 'lucide-react';
import { getAriaLabels } from '../utils/a11y';

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
  canRedo
}: ToolbarProps) {
  const ariaLabels = getAriaLabels();

  return (
    <div className="flex items-center gap-1 p-2 border rounded-md bg-muted/30 flex-wrap">
      {/* Text formatting */}
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={onBold} className="h-8 w-8 p-0" title={ariaLabels.bold} aria-label={ariaLabels.bold} disabled={isPreview || disabled}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onItalic} className="h-8 w-8 p-0" title={ariaLabels.italic} aria-label={ariaLabels.italic} disabled={isPreview || disabled}>
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onUnderline} className="h-8 w-8 p-0" title={ariaLabels.underline} aria-label={ariaLabels.underline} disabled={isPreview || disabled}>
          <Underline className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-6 w-px bg-muted-foreground/30 mx-1" />

      {/* Lists and quotes */}
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={onBulletList} className="h-8 w-8 p-0" title={ariaLabels.bulletList} aria-label={ariaLabels.bulletList} disabled={isPreview || disabled}>
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onNumberList} className="h-8 w-8 p-0" title={ariaLabels.numberList} aria-label={ariaLabels.numberList} disabled={isPreview || disabled}>
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onQuote} className="h-8 w-8 p-0" title={ariaLabels.quote} aria-label={ariaLabels.quote} disabled={isPreview || disabled}>
          <Quote className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-6 w-px bg-muted-foreground/30 mx-1" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={onUndo} className="h-8 w-8 p-0" title={ariaLabels.undo} aria-label={ariaLabels.undo} disabled={isPreview || disabled || !canUndo}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onRedo} className="h-8 w-8 p-0" title={ariaLabels.redo} aria-label={ariaLabels.redo} disabled={isPreview || disabled || !canRedo}>
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Preview toggle */}
      <div className="flex items-center gap-1 ml-auto">
        <Button type="button" variant={isPreview ? "default" : "ghost"} size="sm" onClick={onTogglePreview} className="h-8 px-3" title={isPreview ? ariaLabels.edit : ariaLabels.preview} aria-pressed={isPreview} disabled={disabled}>
          {isPreview ? (
            <><Edit3 className="h-4 w-4 mr-1" />Επεξεργασία</>
          ) : (
            <><Eye className="h-4 w-4 mr-1" />Προεπισκόπηση</>
          )}
        </Button>
      </div>
    </div>
  );
}
