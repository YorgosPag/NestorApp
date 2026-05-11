/**
 * ADR-344 Phase 7.A — Scale bar caption (bilingual).
 *
 * Short label paired with the graphical scale bar (rendered separately
 * by the geometry engine). Contains the scale ratio and unit label.
 *
 * Placeholders:
 *   drawing.scale, drawing.units
 */

import { CAPTION_RUN_STYLE, DEFAULT_RUN_STYLE, makeBuiltIn, makeNode, makeParagraph, makeRun } from './template-helpers';
import type { BuiltInTextTemplate } from '../template.types';

const SCALE_BAR_MULTI_CONTENT = makeNode(
  [
    makeParagraph([makeRun('Κλίμακα / Scale: {{drawing.scale}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Μονάδες / Units: {{drawing.units}}', CAPTION_RUN_STYLE)]),
  ],
  { attachment: 'BL' },
);

export const SCALE_BAR_MULTI: BuiltInTextTemplate = makeBuiltIn({
  slug: 'scale-bar-multi',
  nameI18nKey: 'textTemplates:defaults.scaleBar.multi',
  displayName: 'Ένδειξη Κλίμακας / Scale Caption',
  category: 'scale-bar',
  locale: 'multi',
  content: SCALE_BAR_MULTI_CONTENT,
});

export const SCALE_BAR_DEFAULTS: readonly BuiltInTextTemplate[] = [SCALE_BAR_MULTI];
