'use client';

import React from 'react';
import { useTranslation } from '@/i18n';
import { AccordionSection } from '../../components/dxf-settings/settings/shared/AccordionSection';
import type { DimStyle } from '../../../types/dimension';
import type { UpdateCustomStylePatch } from '../../../systems/dimensions/dim-style-registry';
import { LinesSection } from './sections/LinesSection';
import { SymbolsSection } from './sections/SymbolsSection';
import { TextSection } from './sections/TextSection';
import { FitSection } from './sections/FitSection';
import { UnitsSection } from './sections/UnitsSection';
import { TolerancesSection } from './sections/TolerancesSection';
import { DimStylePreview } from './DimStylePreview';

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
      <div className="flex justify-center py-1">
        <DimStylePreview style={style} />
      </div>

      <AccordionSection title={s('lines')} defaultOpen size="sm" variant="bordered">
        <LinesSection style={style} onChange={onChange} readOnly={readOnly} />
      </AccordionSection>

      <AccordionSection title={s('symbols')} defaultOpen={false} size="sm" variant="bordered">
        <SymbolsSection style={style} onChange={onChange} readOnly={readOnly} />
      </AccordionSection>

      <AccordionSection title={s('text')} defaultOpen={false} size="sm" variant="bordered">
        <TextSection style={style} onChange={onChange} readOnly={readOnly} />
      </AccordionSection>

      <AccordionSection title={s('fit')} defaultOpen={false} size="sm" variant="bordered">
        <FitSection style={style} onChange={onChange} readOnly={readOnly} />
      </AccordionSection>

      <AccordionSection title={s('units')} defaultOpen={false} size="sm" variant="bordered">
        <UnitsSection style={style} onChange={onChange} readOnly={readOnly} />
      </AccordionSection>

      <AccordionSection title={s('tolerances')} defaultOpen={false} size="sm" variant="bordered">
        <TolerancesSection style={style} onChange={onChange} readOnly={readOnly} />
      </AccordionSection>
    </div>
  );
}
