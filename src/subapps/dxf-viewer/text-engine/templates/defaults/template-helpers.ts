/**
 * ADR-344 Phase 7.A — Compact builders for built-in template DxfTextNodes.
 *
 * The built-in templates are static TypeScript constants. Writing each
 * one with the full DxfTextNode literal would be ~80 lines per template
 * (paragraphs/runs/style/lineSpacing/...). These helpers keep each
 * template declaration short and readable while still producing a
 * fully-typed, immutable DxfTextNode.
 *
 * Only used by `./` defaults. Not exported through the package barrel.
 */

import { DXF_COLOR_BY_LAYER } from '../../types/text-toolbar.types';
import type {
  DxfTextNode,
  LineSpacingMode,
  TextJustification,
  TextParagraph,
  TextRun,
  TextRunStyle,
} from '../../types/text-ast.types';
import { extractPlaceholders } from '../extract-placeholders';
import type { BuiltInTextTemplate, TextTemplateCategory, TextTemplateLocale } from '../template.types';

/** Plain CAD style — Arial substitute, height 2.5mm, BYLAYER colour. */
export const DEFAULT_RUN_STYLE: TextRunStyle = Object.freeze({
  fontFamily: 'Arial',
  bold: false,
  italic: false,
  underline: false,
  overline: false,
  strikethrough: false,
  height: 2.5,
  widthFactor: 1.0,
  obliqueAngle: 0,
  tracking: 1.0,
  color: DXF_COLOR_BY_LAYER,
});

/** Heading variant — bold, height 3.5mm. */
export const HEADING_RUN_STYLE: TextRunStyle = Object.freeze({
  ...DEFAULT_RUN_STYLE,
  bold: true,
  height: 3.5,
});

/** Small caption variant — height 1.8mm. */
export const CAPTION_RUN_STYLE: TextRunStyle = Object.freeze({
  ...DEFAULT_RUN_STYLE,
  height: 1.8,
});

export function makeRun(text: string, style: TextRunStyle = DEFAULT_RUN_STYLE): TextRun {
  return { text, style };
}

export function makeParagraph(
  runs: readonly TextRun[],
  overrides: Partial<Omit<TextParagraph, 'runs'>> = {},
): TextParagraph {
  return {
    runs,
    indent: 0,
    leftMargin: 0,
    rightMargin: 0,
    tabs: [],
    justification: 0,
    lineSpacingMode: 'multiple',
    lineSpacingFactor: 1.0,
    ...overrides,
  };
}

export interface MakeNodeOptions {
  readonly attachment?: TextJustification;
  readonly rotation?: number;
  readonly lineSpacingMode?: LineSpacingMode;
  readonly lineSpacingFactor?: number;
  readonly columns?: DxfTextNode['columns'];
}

export function makeNode(paragraphs: readonly TextParagraph[], options: MakeNodeOptions = {}): DxfTextNode {
  return {
    paragraphs,
    attachment: options.attachment ?? 'TL',
    lineSpacing: {
      mode: options.lineSpacingMode ?? 'multiple',
      factor: options.lineSpacingFactor ?? 1.0,
    },
    columns: options.columns,
    rotation: options.rotation ?? 0,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
  };
}

/**
 * Convenience wrapper: build a built-in template record.
 * Placeholders are auto-extracted from `content` so a single source of truth.
 */
export function makeBuiltIn(args: {
  slug: string;
  nameI18nKey: string;
  displayName: string;
  category: TextTemplateCategory;
  locale: TextTemplateLocale;
  content: DxfTextNode;
}): BuiltInTextTemplate {
  return {
    id: `builtin/${args.slug}`,
    companyId: null,
    name: args.displayName,
    nameI18nKey: args.nameI18nKey,
    category: args.category,
    content: args.content,
    placeholders: Object.freeze(extractPlaceholders(args.content)),
    isDefault: true,
    locale: args.locale,
    createdAt: null,
    updatedAt: null,
  };
}
