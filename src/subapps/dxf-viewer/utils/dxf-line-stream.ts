/**
 * ADR-920 Β4.1β — re-export. The implementation lives in `@/lib/dxf/dxf-line-stream`, shared by the DXF Viewer and the
 * owner's plot-listing survey import (which may not import from the subapp — CHECK 3.62). The lib file is still a
 * zero-import LEAF, so this re-export cannot close the `converters → mline-parser → entity-parser` cycle (ADR-736).
 * Same bodies, same semantics: every existing importer is unchanged. Edit the lib file, not this one.
 */
export * from '@/lib/dxf/dxf-line-stream';
