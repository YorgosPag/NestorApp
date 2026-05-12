export { dxfTextToTipTap } from './dxf-to-tiptap';
export { tipTapToDxfText } from './tiptap-to-dxf';
export { ensureTextNode } from './ensure-text-node';
export { diffTextNode, type DiffServices } from './diff-text-node';
export { dxfTextExtensions, DXF_MARK_NAMES, type DxfMarkName } from './tiptap-config';
export type {
  TipTapDoc,
  TipTapParagraph,
  TipTapInline,
  TipTapText,
  TipTapHardBreak,
  TipTapStackNode,
  TipTapMark,
  DocAttrs,
  ParagraphAttrs,
  ColumnsAttrs,
  BgMaskAttrs,
  StackNodeAttrs,
} from './tiptap-json.types';
export * as marks from './marks';
export * as nodes from './nodes';
