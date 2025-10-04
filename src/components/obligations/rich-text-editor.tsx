"use client";

import { useState, useMemo, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useHistoryStack } from './rich-text/hooks/useHistoryStack';
import { useFormatter } from './rich-text/hooks/useFormatter';
import { useShortcuts } from './rich-text/hooks/useShortcuts';
import { convertMarkdownToHtml, getWordCount, getCharacterCount } from '@/lib/obligations-utils';

import { Toolbar } from './rich-text/parts/Toolbar';
import { EditorArea } from './rich-text/parts/EditorArea';
import { Preview } from './rich-text/parts/Preview';
import { StatsFooter } from './rich-text/parts/StatsFooter';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  maxHeight?: number;
  showStats?: boolean;
  disabled?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "Εισάγετε το περιεχόμενο...",
  className,
  minHeight = 200,
  maxHeight = 600,
  showStats = true,
  disabled = false
}) => {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Undo/Redo history hook
  const { 
    currentValue, 
    setValue, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useHistoryStack(value, {
    onValueChange: onChange,
    max: 100,
    debounceMs: 250
  });

  // Formatting hook
  const { 
    formatBold, 
    formatItalic, 
    formatUnderline, 
    insertBulletList, 
    insertNumberedList, 
    insertQuote 
  } = useFormatter({ 
    textareaRef, 
    value: currentValue, 
    onChange: setValue 
  });
  
  // Shortcuts hook
  const handleKeyDown = useShortcuts({
    onBold: formatBold,
    onItalic: formatItalic,
    onUnderline: formatUnderline,
    onUndo: undo,
    onRedo: redo
  });

  // Derived state for preview and stats
  const htmlPreview = useMemo(() => convertMarkdownToHtml(currentValue), [currentValue]);
  const wordCount = useMemo(() => getWordCount(currentValue), [currentValue]);
  const charCount = useMemo(() => getCharacterCount(currentValue), [currentValue]);

  return (
    <div className={cn("space-y-2", className)}>
      <Toolbar
        disabled={disabled}
        isPreview={isPreviewMode}
        onTogglePreview={() => setIsPreviewMode(!isPreviewMode)}
        onBold={formatBold}
        onItalic={formatItalic}
        onUnderline={formatUnderline}
        onBulletList={insertBulletList}
        onNumberList={insertNumberedList}
        onQuote={insertQuote}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      
      {isPreviewMode ? (
        <Preview
          html={htmlPreview}
          placeholder={placeholder}
          minHeight={minHeight}
          maxHeight={maxHeight}
        />
      ) : (
        <EditorArea
          textareaRef={textareaRef}
          value={currentValue}
          onChange={setValue}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          minHeight={minHeight}
          maxHeight={maxHeight}
          disabled={disabled}
        />
      )}

      {showStats && (
        <StatsFooter words={wordCount} chars={charCount} />
      )}
    </div>
  );
};

export default RichTextEditor;
