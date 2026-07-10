/**
 * ADR-619 — SSoT for the drawing-tool tags that emit a freshly-created
 * `StairEntity` on `drawing:entity-created`.
 *
 * Two tools build a stair: the line-based stair tool (`'stair'`) and «Σκάλα από
 * περιοχή» (`'stair-from-region'`). Both go through `addStairToScene`, which
 * broadcasts the create event tagged with the originating tool. The persistence
 * first-save listener (`use-stair-persistence`) must accept BOTH tags — a scattered
 * `tool === 'stair'` check silently dropped the region stair, so it was never
 * written to Firestore and vanished on refresh (ADR-619 Bug #6). Centralising the
 * set here makes that gate a single testable decision: a future 3rd stair tool
 * only has to be added to this array to persist correctly.
 */

/** Tool tags whose `drawing:entity-created` payload carries a `StairEntity`. */
export const STAIR_CREATE_TOOLS = ['stair', 'stair-from-region'] as const;

export type StairCreateTool = (typeof STAIR_CREATE_TOOLS)[number];

/** True when `tool` is one of the stair-creating drawing tools. */
export function isStairCreateTool(tool: string | undefined): boolean {
  return tool !== undefined && (STAIR_CREATE_TOOLS as readonly string[]).includes(tool);
}
