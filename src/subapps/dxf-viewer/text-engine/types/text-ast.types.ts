/**
 * ADR-344 Phase 1 — DxfTextNode AST and associated types.
 *
 * DxfTextNode is the canonical in-memory representation of a DXF TEXT or
 * MTEXT entity. The parser (Layer 1) produces it; the serializer (Layer 1)
 * consumes it; the layout engine (Layer 3) reads it; the renderer (Layer 2)
 * draws it.
 *
 * AnnotationScale is part of the DxfTextNode data model (Q11).
 * The viewport infrastructure (Phase 11) reads these fields at render time.
 */

import type { DxfColor } from './text-toolbar.types';

// ── Justification & spacing ───────────────────────────────────────────────────

/** 9-point attachment grid used by MTEXT group code 71. */
export type TextJustification =
  | 'TL' | 'TC' | 'TR'
  | 'ML' | 'MC' | 'MR'
  | 'BL' | 'BC' | 'BR';

/** MTEXT line-spacing mode (group code 73). */
export type LineSpacingMode = 'multiple' | 'exact' | 'at-least';

// ── Annotation scaling (Q11) ─────────────────────────────────────────────────

/**
 * One entry in the per-entity annotation-scale list.
 * Stored in DXF XDATA (group codes 1000/1070/1071) on ANNOTATIVE entities.
 */
export interface AnnotationScale {
  /** Display name, e.g. "1:100". */
  readonly name: string;
  /** Desired paper-space text height in mm. */
  readonly paperHeight: number;
  /** model-space height = paperHeight × scaleFactor (computed). */
  readonly modelHeight: number;
}

// ── Run-level styling ─────────────────────────────────────────────────────────

/** Style attributes that can vary per inline run within a paragraph. */
export interface TextRunStyle {
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  overline: boolean;
  strikethrough: boolean;
  /** Character height in drawing units. */
  height: number;
  /** Width factor (1.0 = normal). */
  widthFactor: number;
  /** Oblique angle in degrees (positive = slant right). */
  obliqueAngle: number;
  /** Character tracking/spacing factor (1.0 = normal). */
  tracking: number;
  color: DxfColor;
}

/** A contiguous run of text sharing a single style. */
export interface TextRun {
  readonly text: string;
  readonly style: TextRunStyle;
}

/**
 * A stacked fraction or tolerance produced by the \S inline code.
 * Rendered as vertically stacked top/bottom text.
 */
export interface TextStack {
  readonly top: string;
  readonly bottom: string;
  /** ^ = tolerance (diagonal), / = diagonal fraction, # = horizontal fraction. */
  readonly type: 'tolerance' | 'diagonal' | 'horizontal';
  readonly style: Pick<TextRunStyle, 'fontFamily' | 'height' | 'color'>;
}

// ── Paragraph ─────────────────────────────────────────────────────────────────

/** A paragraph composed of one or more runs and/or stacks. */
export interface TextParagraph {
  readonly runs: ReadonlyArray<TextRun | TextStack>;
  /** First-line indent in drawing units (\pi). */
  readonly indent: number;
  /** Left margin in drawing units (\pl). */
  readonly leftMargin: number;
  /** Right margin in drawing units (\pr). */
  readonly rightMargin: number;
  /** Tab-stop positions in drawing units (\pt). */
  readonly tabs: readonly number[];
  /** Paragraph justification: 0=left, 1=center, 2=right, 3=justify (\pq). */
  readonly justification: 0 | 1 | 2 | 3;
  /** Line spacing for this paragraph. */
  readonly lineSpacingMode: LineSpacingMode;
  readonly lineSpacingFactor: number;
}

// ── Root node ─────────────────────────────────────────────────────────────────

/** Root AST node representing one TEXT or MTEXT DXF entity. */
export interface DxfTextNode {
  readonly paragraphs: readonly TextParagraph[];
  /** 9-point attachment point for MTEXT positioning (group code 71). */
  readonly attachment: TextJustification;
  /** Node-level line spacing; individual paragraphs may override. */
  readonly lineSpacing: { readonly mode: LineSpacingMode; readonly factor: number };
  /** Background fill mask (group codes 90/63/421). */
  readonly bgMask?: {
    readonly color: DxfColor;
    readonly offsetFactor: number;
  };
  /** Multi-column layout (R2007+, group codes 73/74/45). */
  readonly columns?: {
    readonly type: 'static' | 'dynamic';
    readonly count: number;
    readonly width: number;
    readonly gutter: number;
  };
  /** Entity rotation in degrees (group code 50). */
  readonly rotation: number;
  /** True when the entity carries the ANNOTATIVE flag. */
  readonly isAnnotative: boolean;
  /** Per-entity annotation scales (Q11, DXF XDATA). */
  readonly annotationScales: readonly AnnotationScale[];
  /** Name of the currently active annotation scale ("" = use first scale). */
  readonly currentScale: string;
}

// ── STYLE table ───────────────────────────────────────────────────────────────

/** One entry from the DXF STYLE symbol table (section TABLES). */
export interface DxfStyleTableEntry {
  /** Style name (group code 2). */
  readonly name: string;
  /** Primary font filename (group code 3), e.g. "romans.shx" or "Arial.ttf". */
  readonly fontFile: string;
  /** Big-font filename (group code 4) for Asian glyph support. */
  readonly bigFontFile: string;
  /** Fixed text height in drawing units (group code 40). 0 = variable. */
  readonly height: number;
  /** Width factor (group code 41). */
  readonly widthFactor: number;
  /** Oblique angle in degrees (group code 50). */
  readonly obliqueAngle: number;
  /** Style flags (group code 70). */
  readonly flags: number;
  /** Text generation flags: 2=backward, 4=upside-down (group code 71). */
  readonly textGenerationFlags: number;
}
