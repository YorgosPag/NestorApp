/**
 * ADR-920 Β1 — re-export. The implementation lives in `@/lib/terrain/topo-point-elevation`, shared by the DXF Viewer
 * and the public plot listing (which may not import from the subapp — CHECK 3.62).
 * Same bodies, same semantics: every existing importer is unchanged. Edit the lib file, not this one.
 */
export * from '@/lib/terrain/topo-point-elevation';
