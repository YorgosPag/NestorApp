'use client';

/**
 * ADR-344 Phase 5.D — Style panel.
 *
 * Bold / italic / underline / overline / strikethrough toggles.
 * Each is a Radix Toolbar.ToggleItem with `data-state="indeterminate"`
 * support for mixed selections.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import * as Toolbar from '@radix-ui/react-toolbar';
import { Bold, Italic, Underline, Strikethrough } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useTextToolbarStore,
  type TextToolbarValues,
} from '../../../state/text-toolbar';

interface StylePanelProps {
  readonly disabled?: boolean;
}

function ToggleButton({
  pressed,
  onPressedChange,
  ariaLabel,
  children,
  disabled,
}: {
  readonly pressed: boolean | null;
  readonly onPressedChange: (next: boolean) => void;
  readonly ariaLabel: string;
  readonly children: React.ReactNode;
  readonly disabled?: boolean;
}) {
  const isIndeterminate = pressed === null;
  return (
    <Toolbar.ToggleItem
      value={ariaLabel}
      pressed={pressed ?? false}
      onPressedChange={onPressedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      data-state={isIndeterminate ? 'indeterminate' : pressed ? 'on' : 'off'}
      className={cn(
        'inline-flex h-9 min-h-[44px] sm:min-h-[36px] w-9 min-w-[44px] sm:min-w-[36px]',
        'items-center justify-center rounded border bg-background',
        'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
        'data-[state=indeterminate]:border-dashed',
        'focus:outline-none focus:ring-2',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      {children}
    </Toolbar.ToggleItem>
  );
}

export function StylePanel({ disabled }: StylePanelProps) {
  const { t } = useTranslation(['textToolbar']);
  const bold = useTextToolbarStore((s) => s.bold);
  const italic = useTextToolbarStore((s) => s.italic);
  const underline = useTextToolbarStore((s) => s.underline);
  const overline = useTextToolbarStore((s) => s.overline);
  const strikethrough = useTextToolbarStore((s) => s.strikethrough);
  const setValue = useTextToolbarStore((s) => s.setValue);

  const set = <K extends keyof TextToolbarValues>(key: K) => (next: boolean) => {
    setValue(key, next as TextToolbarValues[K]);
  };

  return (
    <Toolbar.ToolbarToggleGroup type="multiple" className="inline-flex gap-1">
      <ToggleButton
        pressed={bold}
        onPressedChange={set('bold')}
        ariaLabel={t('textToolbar:style.bold')}
        disabled={disabled}
      >
        <Bold className="h-4 w-4" />
      </ToggleButton>
      <ToggleButton
        pressed={italic}
        onPressedChange={set('italic')}
        ariaLabel={t('textToolbar:style.italic')}
        disabled={disabled}
      >
        <Italic className="h-4 w-4" />
      </ToggleButton>
      <ToggleButton
        pressed={underline}
        onPressedChange={set('underline')}
        ariaLabel={t('textToolbar:style.underline')}
        disabled={disabled}
      >
        <Underline className="h-4 w-4" />
      </ToggleButton>
      <ToggleButton
        pressed={overline}
        onPressedChange={set('overline')}
        ariaLabel={t('textToolbar:style.overline')}
        disabled={disabled}
      >
        <span aria-hidden="true" className="text-sm font-bold underline-offset-[6px] underline">O</span>
      </ToggleButton>
      <ToggleButton
        pressed={strikethrough}
        onPressedChange={set('strikethrough')}
        ariaLabel={t('textToolbar:style.strikethrough')}
        disabled={disabled}
      >
        <Strikethrough className="h-4 w-4" />
      </ToggleButton>
    </Toolbar.ToolbarToggleGroup>
  );
}
