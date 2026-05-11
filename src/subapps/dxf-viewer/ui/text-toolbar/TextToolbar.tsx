'use client';

/**
 * ADR-344 Phase 5.D — TextToolbar root (SSoT registry: text-toolbar).
 *
 * Radix Toolbar.Root positioned as a fixed overlay above the canvas while
 * the user is actively editing a text entity (Layer 5, ADR §3.4). The
 * subset shown in the FloatingPanel "Text Properties" tab (Phase 5.F)
 * embeds the same panel components.
 *
 * Permission gating (Q8) — when the user lacks `canEdit`, the entire
 * toolbar renders in a `disabled` shell with a tooltip showing the deny
 * reason. Anonymous read-only viewers see no toolbar at all (handled by
 * the caller).
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import * as Toolbar from '@radix-ui/react-toolbar';
import { cn } from '@/lib/utils';
import { useCanEditText } from '../../hooks/useCanEditText';
import {
  StylePanel,
  FormattingPanel,
  ParagraphPanel,
  InsertPanel,
  ToolsPanel,
} from './panels';
import {
  LayerSelectorDropdown,
  type LayerSelectorEntry,
} from './controls';
import { useTextToolbarStore } from '../../state/text-toolbar';
import { DxfDocumentVersion } from '../../text-engine/types';

interface TextToolbarProps {
  readonly layers: readonly LayerSelectorEntry[];
  readonly availableFonts: readonly string[];
  readonly documentVersion: DxfDocumentVersion;
  readonly onRequestFontUpload: () => void;
  readonly onInsertToken: (token: string) => void;
  readonly onEyedropper: () => void;
  readonly onVoice?: () => void;
  readonly onFindReplace?: () => void;
}

export function TextToolbar({
  layers,
  availableFonts,
  documentVersion,
  onRequestFontUpload,
  onInsertToken,
  onEyedropper,
  onVoice,
  onFindReplace,
}: TextToolbarProps) {
  const { t } = useTranslation(['textToolbar']);
  const caps = useCanEditText();
  const layerId = useTextToolbarStore((s) => s.layerId);
  const setValue = useTextToolbarStore((s) => s.setValue);

  const disabled = !caps.canEdit;

  return (
    <Toolbar.Root
      orientation="horizontal"
      aria-label={t('textToolbar:rootLabel')}
      data-disabled={disabled ? '' : undefined}
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-md border bg-background p-2 shadow-md',
        'fixed left-1/2 top-2 z-50 -translate-x-1/2',
        'min-w-[320px] max-w-[calc(100vw-1rem)]',
        disabled && 'opacity-60',
      )}
      title={disabled && caps.denyReason ? t(caps.denyReason) : undefined}
    >
      <StylePanel disabled={disabled} />
      <Toolbar.Separator className="mx-1 h-6 w-px bg-border" />
      <FormattingPanel
        availableFonts={availableFonts}
        documentVersion={documentVersion}
        onRequestFontUpload={onRequestFontUpload}
        canUploadFont={caps.canEdit}
        disabled={disabled}
      />
      <Toolbar.Separator className="mx-1 h-6 w-px bg-border" />
      <ParagraphPanel disabled={disabled} />
      <Toolbar.Separator className="mx-1 h-6 w-px bg-border" />
      <LayerSelectorDropdown
        value={layerId}
        layers={layers}
        canUnlockLayer={caps.canUnlockLayer}
        onChange={(id) => setValue('layerId', id)}
        disabled={disabled}
      />
      <Toolbar.Separator className="mx-1 h-6 w-px bg-border" />
      <InsertPanel onInsert={onInsertToken} disabled={disabled} />
      <Toolbar.Separator className="mx-1 h-6 w-px bg-border" />
      <ToolsPanel
        onEyedropper={onEyedropper}
        onVoice={onVoice}
        onFindReplace={onFindReplace}
        disabled={disabled}
      />
    </Toolbar.Root>
  );
}
