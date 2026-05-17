/**
 * ADR-362 Phase E2 — DIM ribbon command-key registry.
 * Mirrors `stair-command-keys.ts` pattern (ADR-358 Phase 7a).
 * All writes are stubs in E2; real dispatch arrives in Phase F+G.
 */

export const DIM_RIBBON_KEYS = {
  style: {
    chooser:      'dim.style.chooser',
    applyStyle:   'dim.style.apply',
    editStyle:    'dim.style.edit',
  },
  override: {
    color:          'dim.override.color',
    arrowStyle:     'dim.override.arrowStyle',
    resetOverrides: 'dim.override.reset',
  },
  text: {
    height:        'dim.text.height',
    position:      'dim.text.position',
    rotation:      'dim.text.rotation',
    resetPosition: 'dim.text.resetPosition',
  },
  properties: {
    layer:           'dim.properties.layer',
    annotationScale: 'dim.properties.annotationScale',
    openPanel:       'dim.properties.openPanel',
  },
} as const;

const ALL_DIM_KEYS: ReadonlySet<string> = new Set(
  (Object.values(DIM_RIBBON_KEYS) as Record<string, string>[]).flatMap(
    (group) => Object.values(group),
  ),
);

export function isDimRibbonKey(key: string): boolean {
  return ALL_DIM_KEYS.has(key);
}
