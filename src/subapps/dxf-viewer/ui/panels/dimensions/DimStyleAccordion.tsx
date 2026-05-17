'use client';

import React from 'react';
import { useTranslation } from '@/i18n';
import { AccordionSection } from '../../components/dxf-settings/settings/shared/AccordionSection';
import type { DimStyle } from '../../../types/dimension';
import type { UpdateCustomStylePatch } from '../../../systems/dimensions/dim-style-registry';
import { LinesSection } from './sections/LinesSection';
import { SymbolsSection } from './sections/SymbolsSection';
import { TextSection } from './sections/TextSection';

interface DimStyleAccordionProps {
  style: DimStyle;
  onChange: (patch: UpdateCustomStylePatch) => void;
  readOnly?: boolean;
}

export function DimStyleAccordion({ style, onChange, readOnly = false }: DimStyleAccordionProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const s = (key: string) => t(`panels.dimensions.editor.sections.${key}`);

  return (
    <div className="flex flex-col gap-1">
      <AccordionSection title={s('lines')} defaultOpen size="sm" variant="bordered">
        <LinesSection style={style} onChange={onChange} readOnly={readOnly} />
      </AccordionSection>

      <AccordionSection title={s('symbols')} defaultOpen={false} size="sm" variant="bordered">
        <SymbolsSection style={style} onChange={onChange} readOnly={readOnly} />
      </AccordionSection>

      <AccordionSection title={s('text')} defaultOpen={false} size="sm" variant="bordered">
        <TextSection style={style} onChange={onChange} readOnly={readOnly} />
      </AccordionSection>
    </div>
  );
}
