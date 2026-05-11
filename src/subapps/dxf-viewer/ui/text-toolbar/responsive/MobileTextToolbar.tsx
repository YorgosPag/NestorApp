'use client';

/**
 * ADR-344 Phase 5.E + Q10 — Mobile-responsive collapsed toolbar.
 *
 * On viewports < 768 px, the desktop ribbon collapses into Radix
 * Accordion sections (Style / Formatting / Paragraph / Insert / Tools).
 * Touch targets meet Apple HIG (44×44) / Material (48×48).
 *
 * `touch-action: pan-x pan-y` is set on the editor overlay (mounted in
 * Phase 5.H) — pinch-zoom continues to bubble to the canvas layer below.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanEditText } from '../../../hooks/useCanEditText';
import {
  StylePanel,
  FormattingPanel,
  ParagraphPanel,
  InsertPanel,
  ToolsPanel,
} from '../panels';
import {
  LayerSelectorDropdown,
  type LayerSelectorEntry,
} from '../controls';
import { useTextToolbarStore } from '../../../state/text-toolbar';
import { useVisualViewport } from './useVisualViewport';
import { DxfDocumentVersion } from '../../../text-engine/types';

interface MobileTextToolbarProps {
  readonly layers: readonly LayerSelectorEntry[];
  readonly availableFonts: readonly string[];
  readonly documentVersion: DxfDocumentVersion;
  readonly onRequestFontUpload: () => void;
  readonly onInsertToken: (token: string) => void;
  readonly onEyedropper: () => void;
  readonly onVoice?: () => void;
  readonly onFindReplace?: () => void;
}

function Section({
  value,
  titleKey,
  children,
}: {
  readonly value: string;
  readonly titleKey: string;
  readonly children: React.ReactNode;
}) {
  const { t } = useTranslation(['textToolbar']);
  return (
    <Accordion.Item value={value} className="border-b">
      <Accordion.Header>
        <Accordion.Trigger
          className={cn(
            'group flex w-full items-center justify-between p-3 min-h-[48px]',
            'text-sm font-medium text-left',
            'focus:outline-none focus:ring-2 focus:bg-muted',
          )}
        >
          {t(titleKey)}
          <ChevronDown
            aria-hidden="true"
            className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="p-3">{children}</Accordion.Content>
    </Accordion.Item>
  );
}

export function MobileTextToolbar({
  layers,
  availableFonts,
  documentVersion,
  onRequestFontUpload,
  onInsertToken,
  onEyedropper,
  onVoice,
  onFindReplace,
}: MobileTextToolbarProps) {
  const { t } = useTranslation(['textToolbar']);
  const caps = useCanEditText();
  const layerId = useTextToolbarStore((s) => s.layerId);
  const setValue = useTextToolbarStore((s) => s.setValue);
  const { keyboardInset } = useVisualViewport();
  const disabled = !caps.canEdit;

  return (
    <aside
      aria-label={t('textToolbar:rootLabel')}
      className={cn(
        'fixed left-0 right-0 bottom-0 z-50 border-t bg-background shadow-lg',
        'max-h-[60vh] overflow-y-auto',
        disabled && 'opacity-60',
      )}
      style={keyboardInset > 0 ? { bottom: `${keyboardInset}px` } : undefined}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Accordion.Root type="single" collapsible defaultValue="style">
        <Section value="style" titleKey="textToolbar:section.style">
          <StylePanel disabled={disabled} />
        </Section>
        <Section value="formatting" titleKey="textToolbar:section.formatting">
          <FormattingPanel
            availableFonts={availableFonts}
            documentVersion={documentVersion}
            onRequestFontUpload={onRequestFontUpload}
            canUploadFont={caps.canEdit}
            disabled={disabled}
          />
        </Section>
        <Section value="paragraph" titleKey="textToolbar:section.paragraph">
          <ParagraphPanel disabled={disabled} />
        </Section>
        <Section value="layer" titleKey="textToolbar:section.layer">
          <LayerSelectorDropdown
            value={layerId}
            layers={layers}
            canUnlockLayer={caps.canUnlockLayer}
            onChange={(id) => setValue('layerId', id)}
            disabled={disabled}
          />
        </Section>
        <Section value="insert" titleKey="textToolbar:section.insert">
          <InsertPanel onInsert={onInsertToken} disabled={disabled} />
        </Section>
        <Section value="tools" titleKey="textToolbar:section.tools">
          <ToolsPanel
            onEyedropper={onEyedropper}
            onVoice={onVoice}
            onFindReplace={onFindReplace}
            disabled={disabled}
          />
        </Section>
      </Accordion.Root>
    </aside>
  );
}
