/**
 * ADR-345 Fase 5.5 — Stable commandKey constants for the Text Editor
 * contextual tab. Centralised so the data declaration and the bridge
 * agree on the same string identifiers (avoids stringly-typed drift).
 */

export const TEXT_RIBBON_KEYS = {
  font: {
    family: 'text.font.family',
    height: 'text.font.height',
    widthFactor: 'text.font.widthFactor',
    obliqueAngle: 'text.font.obliqueAngle',
    tracking: 'text.font.tracking',
  },
  style: {
    bold: 'text.style.bold',
    italic: 'text.style.italic',
    underline: 'text.style.underline',
    overline: 'text.style.overline',
    strikethrough: 'text.style.strikethrough',
  },
  align: {
    left: 'text.align.left',
    center: 'text.align.center',
    right: 'text.align.right',
  },
  paragraph: {
    lineSpacing: 'text.paragraph.lineSpacing',
  },
  properties: {
    layer: 'text.properties.layer',
    annotationScale: 'text.properties.annotationScale',
  },
} as const;

export type TextRibbonCommandKey =
  | typeof TEXT_RIBBON_KEYS.font.family
  | typeof TEXT_RIBBON_KEYS.font.height
  | typeof TEXT_RIBBON_KEYS.font.widthFactor
  | typeof TEXT_RIBBON_KEYS.font.obliqueAngle
  | typeof TEXT_RIBBON_KEYS.font.tracking
  | typeof TEXT_RIBBON_KEYS.style.bold
  | typeof TEXT_RIBBON_KEYS.style.italic
  | typeof TEXT_RIBBON_KEYS.style.underline
  | typeof TEXT_RIBBON_KEYS.style.overline
  | typeof TEXT_RIBBON_KEYS.style.strikethrough
  | typeof TEXT_RIBBON_KEYS.align.left
  | typeof TEXT_RIBBON_KEYS.align.center
  | typeof TEXT_RIBBON_KEYS.align.right
  | typeof TEXT_RIBBON_KEYS.paragraph.lineSpacing
  | typeof TEXT_RIBBON_KEYS.properties.layer
  | typeof TEXT_RIBBON_KEYS.properties.annotationScale;
