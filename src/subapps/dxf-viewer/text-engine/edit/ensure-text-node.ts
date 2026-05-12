/**
 * ADR-344 Phase 6.E — Legacy-entity → DxfTextNode fallback.
 *
 * The Phase 1 DXF parser does not yet populate `textNode: DxfTextNode`
 * on scene entities — it produces the legacy `TextEntity` / `MTextEntity`
 * shape (flat `text`, `fontSize`, `fontFamily`…). The full converter is
 * scheduled with the Phase 7 Firestore persistence pass.
 *
 * Until then, every consumer that needs an AST view (toolbar populate,
 * TipTap overlay, command dispatch) must call `ensureTextNode(entity)`.
 * It returns the existing AST when present, otherwise derives a single-
 * run paragraph from the legacy fields. AutoCAD parity: equivalent to
 * the implicit upgrade R12 → R14 path where pre-MTEXT entities are
 * promoted to a single-paragraph MTEXT view at runtime.
 */

import type {
  DxfTextNode,
  TextParagraph,
  TextRun,
  TextJustification,
} from '../types';
import { DXF_COLOR_BY_LAYER } from '../types';

interface LegacyTextLike {
  readonly type?: string;
  readonly text?: string;
  readonly fontSize?: number;
  readonly height?: number;
  readonly fontFamily?: string;
  readonly rotation?: number;
  readonly alignment?: 'left' | 'center' | 'right' | 'justify';
  readonly lineSpacing?: number;
  readonly isAnnotative?: boolean;
  // textNode may already be present (post Phase 7 / set by commands)
  readonly textNode?: DxfTextNode;
}

function legacyAlignmentToAttachment(
  alignment: LegacyTextLike['alignment'],
): TextJustification {
  switch (alignment) {
    case 'center':
      return 'MC';
    case 'right':
      return 'MR';
    case 'justify':
      return 'ML';
    case 'left':
    default:
      return 'ML';
  }
}

function buildFallbackNode(entity: LegacyTextLike): DxfTextNode {
  const run: TextRun = {
    text: entity.text ?? '',
    style: {
      fontFamily: entity.fontFamily ?? '',
      bold: false,
      italic: false,
      underline: false,
      overline: false,
      strikethrough: false,
      height: entity.height ?? entity.fontSize ?? 2.5,
      widthFactor: 1,
      obliqueAngle: 0,
      tracking: 1,
      color: DXF_COLOR_BY_LAYER,
    },
  };
  const paragraph: TextParagraph = {
    runs: [run],
    indent: 0,
    leftMargin: 0,
    rightMargin: 0,
    tabs: [],
    justification: 0,
    lineSpacingMode: 'multiple',
    lineSpacingFactor: entity.lineSpacing ?? 1,
  };
  return {
    paragraphs: [paragraph],
    attachment: legacyAlignmentToAttachment(entity.alignment),
    lineSpacing: { mode: 'multiple', factor: entity.lineSpacing ?? 1 },
    rotation: entity.rotation ?? 0,
    isAnnotative: entity.isAnnotative ?? false,
    annotationScales: [],
    currentScale: '',
  };
}

/**
 * Return the entity's `DxfTextNode`. When the field is absent (legacy
 * pre-Phase 7 parser output), synthesise a single-paragraph node from
 * the flat fields so downstream consumers always work with an AST.
 */
export function ensureTextNode<T extends LegacyTextLike>(
  entity: T,
): DxfTextNode {
  if (entity.textNode) return entity.textNode;
  return buildFallbackNode(entity);
}
