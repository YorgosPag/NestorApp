'use client';

/**
 * ADR-344 Phase 5.D — Tools panel.
 *
 * - Eyedropper standalone button (also embedded in ColorPickerPopover Q13).
 * - Voice mic — placeholder for Q16 (ADR-185 + ADR-156); wired in Phase 12.
 * - Find/Replace — placeholder for Q7 (Phase 9).
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pipette, Mic, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ToolsPanelProps {
  readonly onEyedropper: () => void;
  readonly onVoice?: () => void;
  readonly onFindReplace?: () => void;
  readonly disabled?: boolean;
}

export function ToolsPanel({
  onEyedropper,
  onVoice,
  onFindReplace,
  disabled,
}: ToolsPanelProps) {
  const { t } = useTranslation(['textToolbar']);

  return (
    <section className="flex flex-wrap items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={onEyedropper}
        disabled={disabled}
        aria-label={t('textToolbar:tools.eyedropper')}
        className="min-h-[44px] sm:min-h-[36px]"
      >
        <Pipette className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onVoice}
        disabled={disabled || !onVoice}
        aria-label={t('textToolbar:tools.voice')}
        className="min-h-[44px] sm:min-h-[36px]"
      >
        <Mic className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onFindReplace}
        disabled={disabled || !onFindReplace}
        aria-label={t('textToolbar:tools.findReplace')}
        className="min-h-[44px] sm:min-h-[36px]"
      >
        <Search className="h-4 w-4" />
      </Button>
    </section>
  );
}
