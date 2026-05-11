'use client';

/**
 * ADR-344 Phase 5.C + Q18 — Font family combobox.
 *
 * cmdk-based searchable combobox. The font list comes from the existing
 * `FontCache` (Phase 2). A trailing "Upload font…" action opens the
 * `FontManagerPanel` (Phase 2) — we do NOT reimplement upload here per
 * the SSoT rule (Q18 reuse).
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandSeparator } from 'cmdk';
import { Upload, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MixedValue } from '../../../text-engine/types';

interface FontFamilyComboboxProps {
  readonly value: MixedValue<string>;
  readonly availableFonts: readonly string[];
  readonly onChange: (family: string) => void;
  readonly onRequestUpload: () => void;
  readonly canUpload: boolean;
  readonly disabled?: boolean;
}

export function FontFamilyCombobox({
  value,
  availableFonts,
  onChange,
  onRequestUpload,
  canUpload,
  disabled,
}: FontFamilyComboboxProps) {
  const { t } = useTranslation(['textToolbar']);
  const [open, setOpen] = useState(false);
  const label = value === null ? t('textToolbar:font.mixed') : value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label={t('textToolbar:font.label')}
          disabled={disabled}
          className="min-h-[44px] sm:min-h-[36px] min-w-[10rem] justify-between"
          data-state={value === null ? 'indeterminate' : 'determinate'}
        >
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command>
          <CommandInput placeholder={t('textToolbar:font.searchPlaceholder')} />
          <CommandList>
            <CommandEmpty>{t('textToolbar:font.empty')}</CommandEmpty>
            {availableFonts.map((font) => (
              <CommandItem
                key={font}
                value={font}
                onSelect={(v) => {
                  onChange(v);
                  setOpen(false);
                }}
                className={cn('flex items-center justify-between gap-2 px-2 py-1.5 cursor-pointer')}
              >
                <span style={{ fontFamily: font }}>{font}</span>
                {value === font ? <Check className="h-4 w-4" /> : null}
              </CommandItem>
            ))}
            {canUpload && (
              <>
                <CommandSeparator />
                <CommandItem
                  value="__upload__"
                  onSelect={() => {
                    setOpen(false);
                    onRequestUpload();
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                >
                  <Upload className="h-4 w-4" />
                  <span>{t('textToolbar:font.uploadAction')}</span>
                </CommandItem>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
