/**
 * =============================================================================
 * SSoT: DXF scene text entity → plain string
 * =============================================================================
 *
 * ONE owner of «where does the readable text of a text/mtext entity live».
 * Two shapes coexist in a persisted scene and every text pass must handle both:
 *  - flat `text` — DXF-imported TEXT/MTEXT entities
 *  - `textNode` AST — entities authored by the DXF Viewer's T-tool (CreateTextCommand),
 *    whose content is split into paragraphs → runs
 *
 * Extraction is identical on every surface (gallery canvas, upload thumbnail,
 * SVG serializer); only the *styling* of the resulting string differs, which is
 * why the paint passes stay per-surface while this does not.
 *
 * @module lib/dxf-scene/scene-text-content
 * @enterprise ADR-033 (Floorplan Processing), ADR-370 (Read-only render)
 */

/** `textNode` AST shape — only the fields the content walk needs. */
interface TextNodeShape {
  paragraphs?: Array<{ runs?: Array<{ text?: string }> }>;
}

/**
 * Read the displayable text of a text/mtext entity.
 *
 * @param e entity as a loose property bag (entities carry fields outside the
 *          minimal scene type contracts)
 * @returns the flat text, the flattened `textNode` AST, or `undefined` when the
 *          entity carries no renderable content
 */
export function readSceneTextContent(e: Record<string, unknown>): string | undefined {
  const flat = e.text as string | undefined;
  if (flat) return flat;

  const textNode = e.textNode as TextNodeShape | undefined;
  if (!textNode?.paragraphs) return undefined;

  return textNode.paragraphs
    .map(p => (p.runs ?? []).map(r => r.text ?? '').join(''))
    .join('\n')
    .trim() || undefined;
}
