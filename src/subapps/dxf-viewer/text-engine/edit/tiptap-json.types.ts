/**
 * ADR-344 Phase 4 — TipTap (ProseMirror) JSON schema for DXF text.
 *
 * Framework-agnostic shape of the document the TipTap editor produces
 * and consumes. The dxf-to-tiptap / tiptap-to-dxf serialisers convert
 * between this shape and the DxfTextNode AST.
 *
 * Standard ProseMirror node types (`doc`, `paragraph`, `text`, `hard_break`)
 * are extended with one custom inline node (`stack`, for the DXF `\S` code)
 * and 11 custom marks covering the per-run DXF inline codes.
 *
 * @module text-engine/edit/tiptap-json.types
 */

import type { DxfColor } from '../types/text-toolbar.types';
import type {
  LineSpacingMode,
  TextJustification,
  AnnotationScale,
} from '../types/text-ast.types';

// ── Document attributes (DxfTextNode metadata) ───────────────────────────────

export interface ColumnsAttrs {
  readonly type: 'static' | 'dynamic';
  readonly count: number;
  readonly width: number;
  readonly gutter: number;
}

export interface BgMaskAttrs {
  readonly color: DxfColor;
  readonly offsetFactor: number;
}

export interface DocAttrs {
  readonly attachment: TextJustification;
  readonly lineSpacing: { readonly mode: LineSpacingMode; readonly factor: number };
  readonly rotation: number;
  readonly isAnnotative: boolean;
  readonly annotationScales: readonly AnnotationScale[];
  readonly currentScale: string;
  /** null = no background mask. */
  readonly bgMask: BgMaskAttrs | null;
  /** null = single-column. */
  readonly columns: ColumnsAttrs | null;
}

// ── Paragraph attributes ──────────────────────────────────────────────────────

export interface ParagraphAttrs {
  readonly indent: number;
  readonly leftMargin: number;
  readonly rightMargin: number;
  readonly tabs: readonly number[];
  readonly justification: 0 | 1 | 2 | 3;
  readonly lineSpacingMode: LineSpacingMode;
  readonly lineSpacingFactor: number;
}

// ── Inline marks ──────────────────────────────────────────────────────────────

export type TipTapMark =
  | { readonly type: 'bold' }
  | { readonly type: 'italic' }
  | { readonly type: 'underline' }
  | { readonly type: 'strike' }
  | { readonly type: 'overline' }
  | { readonly type: 'fontFamily';   readonly attrs: { readonly family: string } }
  | { readonly type: 'fontHeight';   readonly attrs: { readonly height: number } }
  | { readonly type: 'widthFactor';  readonly attrs: { readonly factor: number } }
  | { readonly type: 'obliqueAngle'; readonly attrs: { readonly angle: number } }
  | { readonly type: 'tracking';     readonly attrs: { readonly tracking: number } }
  | { readonly type: 'dxfColor';     readonly attrs: { readonly color: DxfColor } };

// ── Inline node types ─────────────────────────────────────────────────────────

export interface TipTapText {
  readonly type: 'text';
  readonly text: string;
  readonly marks?: readonly TipTapMark[];
}

export interface TipTapHardBreak {
  readonly type: 'hard_break';
}

export interface StackNodeAttrs {
  readonly top: string;
  readonly bottom: string;
  readonly stackType: 'tolerance' | 'diagonal' | 'horizontal';
  readonly fontFamily: string;
  readonly height: number;
  readonly color: DxfColor;
}

export interface TipTapStackNode {
  readonly type: 'stack';
  readonly attrs: StackNodeAttrs;
}

export type TipTapInline = TipTapText | TipTapHardBreak | TipTapStackNode;

// ── Block nodes ───────────────────────────────────────────────────────────────

export interface TipTapParagraph {
  readonly type: 'paragraph';
  readonly attrs: ParagraphAttrs;
  readonly content: readonly TipTapInline[];
}

export interface TipTapDoc {
  readonly type: 'doc';
  readonly attrs: DocAttrs;
  readonly content: readonly TipTapParagraph[];
}
